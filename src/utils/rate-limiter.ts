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
