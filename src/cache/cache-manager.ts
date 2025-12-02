/**
 * Cache Manager
 * Unified interface for two-tier caching (memory + file)
 * Critical for handling Tradera's 100 calls/24h rate limit
 */

import { MemoryCache } from './memory-cache.js';
import { FileCache } from './file-cache.js';

// TTL configurations
export const CacheTTL = {
  // Tradera - Long TTLs due to 100 calls/day limit
  tradera: {
    categories: 24 * 60 * 60 * 1000,      // 24 hours
    counties: 7 * 24 * 60 * 60 * 1000,    // 7 days
    searchResults: 30 * 60 * 1000,         // 30 minutes
    itemDetails: 15 * 60 * 1000,           // 15 minutes
    feedbackSummary: 60 * 60 * 1000,       // 1 hour
  },
  // Blocket - Shorter TTLs (more generous rate limit)
  blocket: {
    searchResults: 5 * 60 * 1000,          // 5 minutes
    adDetails: 10 * 60 * 1000,             // 10 minutes
    categories: 60 * 60 * 1000,            // 1 hour
  },
} as const;

export type CacheNamespace =
  | 'tradera:categories'
  | 'tradera:counties'
  | 'tradera:search'
  | 'tradera:item'
  | 'tradera:feedback'
  | 'blocket:search'
  | 'blocket:ad'
  | 'blocket:categories';

export interface CacheManagerOptions {
  /** Memory cache max size */
  memoryMaxSize?: number;
  /** File cache directory */
  fileCacheDir?: string;
  /** Enable file cache */
  enableFileCache?: boolean;
}

export class CacheManager {
  private readonly memory: MemoryCache;
  private readonly file: FileCache;
  private readonly enableFileCache: boolean;

  constructor(options: CacheManagerOptions = {}) {
    this.memory = new MemoryCache({
      maxSize: options.memoryMaxSize ?? 100,
      name: 'MemoryCache',
    });

    this.file = new FileCache({
      cacheDir: options.fileCacheDir ?? '/tmp/blocket-tradera-cache',
      name: 'FileCache',
    });

    this.enableFileCache = options.enableFileCache ?? true;
  }

  /**
   * Initialize cache (creates file cache directory)
   */
  async init(): Promise<void> {
    if (this.enableFileCache) {
      await this.file.init();
    }
    console.error('[CacheManager] Initialized');
  }

  /**
   * Generate cache key with namespace
   */
  private makeKey(namespace: CacheNamespace, key: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get TTL for namespace
   */
  private getTtl(namespace: CacheNamespace): number {
    const [platform, type] = namespace.split(':') as [keyof typeof CacheTTL, string];
    const platformConfig = CacheTTL[platform];
    return (platformConfig as Record<string, number>)[type] ?? 5 * 60 * 1000;
  }

  /**
   * Get value from cache (memory first, then file)
   */
  async get<T>(namespace: CacheNamespace, key: string): Promise<{
    data: T | null;
    cached: boolean;
    ageSeconds: number | null;
  }> {
    const cacheKey = this.makeKey(namespace, key);

    // Try memory cache first
    const memoryData = this.memory.get<T>(cacheKey);
    if (memoryData !== null) {
      return {
        data: memoryData,
        cached: true,
        ageSeconds: this.memory.getAge(cacheKey),
      };
    }

    // Try file cache if enabled
    if (this.enableFileCache) {
      const fileData = await this.file.get<T>(cacheKey);
      if (fileData !== null) {
        // Promote to memory cache
        const ttl = this.getTtl(namespace);
        this.memory.set(cacheKey, fileData, ttl);

        return {
          data: fileData,
          cached: true,
          ageSeconds: await this.file.getAge(cacheKey),
        };
      }
    }

    return {
      data: null,
      cached: false,
      ageSeconds: null,
    };
  }

  /**
   * Set value in cache (both memory and file)
   */
  async set<T>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    customTtl?: number
  ): Promise<void> {
    const cacheKey = this.makeKey(namespace, key);
    const ttl = customTtl ?? this.getTtl(namespace);

    // Always set in memory
    this.memory.set(cacheKey, value, ttl);

    // Set in file cache for long-lived data (Tradera)
    if (this.enableFileCache && namespace.startsWith('tradera:')) {
      await this.file.set(cacheKey, value, ttl);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(namespace: CacheNamespace, key: string): Promise<boolean> {
    const cacheKey = this.makeKey(namespace, key);

    if (this.memory.has(cacheKey)) {
      return true;
    }

    if (this.enableFileCache) {
      return await this.file.has(cacheKey);
    }

    return false;
  }

  /**
   * Delete a specific key
   */
  async delete(namespace: CacheNamespace, key: string): Promise<void> {
    const cacheKey = this.makeKey(namespace, key);
    this.memory.delete(cacheKey);

    if (this.enableFileCache) {
      await this.file.delete(cacheKey);
    }
  }

  /**
   * Clear all cache for a namespace or all
   */
  async clear(namespace?: CacheNamespace): Promise<void> {
    if (!namespace) {
      this.memory.clear();
      if (this.enableFileCache) {
        await this.file.clear();
      }
    } else {
      // Clear only keys in namespace (memory only)
      const keys = this.memory.keys();
      for (const key of keys) {
        if (key.startsWith(namespace)) {
          this.memory.delete(key);
        }
      }
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<{ memory: number; file: number }> {
    const memoryCleaned = this.memory.cleanup();
    const fileCleaned = this.enableFileCache ? await this.file.cleanup() : 0;

    return { memory: memoryCleaned, file: fileCleaned };
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: {
      size: number;
      maxSize: number;
      hits: number;
      misses: number;
      hitRate: number;
    };
    file: {
      size: number;
      totalSizeBytes: number;
      cacheDir: string;
    } | null;
  }> {
    return {
      memory: this.memory.getStats(),
      file: this.enableFileCache ? await this.file.getStats() : null,
    };
  }

  /**
   * Get with fallback
   * If cached, return cached. Otherwise, fetch with callback and cache.
   */
  async getOrFetch<T>(
    namespace: CacheNamespace,
    key: string,
    fetchFn: () => Promise<T>,
    customTtl?: number
  ): Promise<{ data: T; cached: boolean; ageSeconds: number | null }> {
    const cached = await this.get<T>(namespace, key);

    if (cached.data !== null) {
      return {
        data: cached.data,
        cached: true,
        ageSeconds: cached.ageSeconds,
      };
    }

    // Fetch fresh data
    const freshData = await fetchFn();

    // Cache it
    await this.set(namespace, key, freshData, customTtl);

    return {
      data: freshData,
      cached: false,
      ageSeconds: null,
    };
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(options?: CacheManagerOptions): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(options);
  }
  return cacheManagerInstance;
}
