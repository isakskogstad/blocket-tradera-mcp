/**
 * Rate Limiter Utility
 * Handles request throttling for API rate limits
 */

export interface RateLimiterConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Name for logging */
  name?: string;
}

export class RateLimiter {
  private requests: number[] = [];
  private readonly config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      ...config,
      name: config.name ?? 'RateLimiter',
    };
  }

  /**
   * Check if a request can be made without exceeding rate limit
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Get the number of remaining requests in the current window
   */
  getRemainingRequests(): number {
    this.cleanupOldRequests();
    return Math.max(0, this.config.maxRequests - this.requests.length);
  }

  /**
   * Get time until next request is allowed (in ms)
   * Returns 0 if a request can be made now
   */
  getTimeUntilNextRequest(): number {
    this.cleanupOldRequests();

    if (this.requests.length < this.config.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    if (!oldestRequest) return 0;

    return Math.max(0, oldestRequest + this.config.windowMs - Date.now());
  }

  /**
   * Record a request and wait if necessary
   * Returns a promise that resolves when the request can be made
   */
  async throttle(): Promise<void> {
    const waitTime = this.getTimeUntilNextRequest();

    if (waitTime > 0) {
      console.error(
        `[${this.config.name}] Rate limit reached, waiting ${waitTime}ms`
      );
      await this.sleep(waitTime);
    }

    this.recordRequest();
  }

  /**
   * Record that a request was made
   */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Get current usage statistics
   */
  getStats(): { used: number; remaining: number; windowMs: number } {
    this.cleanupOldRequests();
    return {
      used: this.requests.length,
      remaining: this.getRemainingRequests(),
      windowMs: this.config.windowMs,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a rate limiter for Blocket API (5 requests per second)
 */
export function createBlocketRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxRequests: 5,
    windowMs: 1000,
    name: 'Blocket',
  });
}

/**
 * Create a rate limiter for Tradera API (100 requests per 24 hours)
 */
export function createTraderaRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxRequests: 100,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    name: 'Tradera',
  });
}

// ============================================
// EXPONENTIAL BACKOFF WITH RETRY
// ============================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for each retry (default: 2) */
  backoffMultiplier?: number;
  /** Add randomness to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Name for logging */
  name?: string;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes?: number[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Retry with exponential backoff
 * Handles rate limits and transient failures gracefully
 */
export class RetryWithBackoff {
  private readonly config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      ...config,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitter: config.jitter ?? true,
      name: config.name ?? 'Retry',
      retryableStatusCodes: config.retryableStatusCodes ?? [429, 500, 502, 503, 504],
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    let attempts = 0;
    let totalDelayMs = 0;
    let lastError: Error | undefined;

    while (attempts <= this.config.maxRetries) {
      try {
        const result = await fn();
        return {
          success: true,
          data: result,
          attempts: attempts + 1,
          totalDelayMs,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;

        // Check if we should retry
        if (attempts > this.config.maxRetries) {
          break;
        }

        // Check if the error is retryable
        if (!this.isRetryable(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempts);
        totalDelayMs += delay;

        console.error(
          `[${this.config.name}] Attempt ${attempts}/${this.config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );

        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDelayMs,
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Check for rate limit indicators
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }

    // Check for network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // Check for HTTP status codes in error message
    for (const code of this.config.retryableStatusCodes) {
      if (message.includes(String(code))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential: initialDelay * multiplier^(attempt-1)
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at maxDelay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter (±25%)
    if (this.config.jitter) {
      const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
      delay = Math.round(delay * jitterFactor);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a retry handler for Blocket API
 * - Short delays since rate limit is per-second
 * - Max 3 retries
 */
export function createBlocketRetry(): RetryWithBackoff {
  return new RetryWithBackoff({
    maxRetries: 3,
    initialDelayMs: 200,
    maxDelayMs: 2000,
    name: 'Blocket',
  });
}

/**
 * Create a retry handler for Tradera API
 * - Longer delays since rate limit is daily
 * - Fewer retries to conserve API budget
 */
export function createTraderaRetry(): RetryWithBackoff {
  return new RetryWithBackoff({
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    name: 'Tradera',
  });
}
