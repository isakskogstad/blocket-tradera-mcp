/**
 * Memory Cache (LRU)
 * Fast in-memory cache with automatic eviction
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  accessedAt: number;
}

export interface MemoryCacheOptions {
  /** Maximum number of entries */
  maxSize?: number;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Name for logging */
  name?: string;
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly name: string;

  // Statistics
  private hits = 0;
  private misses = 0;

  constructor(options: MemoryCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.defaultTtl = options.defaultTtl ?? 5 * 60 * 1000; // 5 minutes
    this.name = options.name ?? 'MemoryCache';
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    this.hits++;

    return entry.data as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Enforce max size using LRU eviction
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttl = ttlMs ?? this.defaultTtl;
    const entry: CacheEntry<T> = {
      data: value,
      expiresAt: Date.now() + ttl,
      accessedAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get age of cached item in seconds
   */
  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttlMs = entry.expiresAt - entry.accessedAt;
    const ageMs = Date.now() - (entry.expiresAt - ttlMs);
    return Math.floor(ageMs / 1000);
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.error(`[${this.name}] Cleaned ${cleaned} expired entries`);
    }

    return cleaned;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.error(`[${this.name}] LRU evicted: ${oldestKey}`);
    }
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}
