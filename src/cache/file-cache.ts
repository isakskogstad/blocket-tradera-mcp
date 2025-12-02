/**
 * File Cache (Persistent)
 * Disk-based cache that survives server restarts
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface FileCacheOptions {
  /** Cache directory path */
  cacheDir?: string;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Name for logging */
  name?: string;
}

interface FileCacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

export class FileCache {
  private readonly cacheDir: string;
  private readonly defaultTtl: number;
  private readonly name: string;
  private initialized = false;

  constructor(options: FileCacheOptions = {}) {
    this.cacheDir = options.cacheDir ?? '/tmp/blocket-tradera-cache';
    this.defaultTtl = options.defaultTtl ?? 30 * 60 * 1000; // 30 minutes
    this.name = options.name ?? 'FileCache';
  }

  /**
   * Initialize cache directory
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
      console.error(`[${this.name}] Initialized at ${this.cacheDir}`);
    } catch (error) {
      console.error(`[${this.name}] Failed to create cache dir:`, error);
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    await this.init();

    const filePath = this.getFilePath(key);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: FileCacheEntry<T> = JSON.parse(content);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.init();

    const ttl = ttlMs ?? this.defaultTtl;
    const entry: FileCacheEntry<T> = {
      data: value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    };

    const filePath = this.getFilePath(key);

    try {
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[${this.name}] Failed to write cache:`, error);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<boolean> {
    await this.init();

    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.init();

    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map((f) => fs.unlink(path.join(this.cacheDir, f)))
      );
      console.error(`[${this.name}] Cleared all entries`);
    } catch (error) {
      console.error(`[${this.name}] Failed to clear cache:`, error);
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    await this.init();

    let cleaned = 0;
    const now = Date.now();

    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const entry: FileCacheEntry<unknown> = JSON.parse(content);

          if (now > entry.expiresAt) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch {
          // Corrupted file, delete it
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.error(`[${this.name}] Cleaned ${cleaned} expired entries`);
      }
    } catch (error) {
      console.error(`[${this.name}] Cleanup failed:`, error);
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    totalSizeBytes: number;
    cacheDir: string;
  }> {
    await this.init();

    let size = 0;
    let totalSizeBytes = 0;

    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const stat = await fs.stat(filePath);
        size++;
        totalSizeBytes += stat.size;
      }
    } catch {
      // Ignore errors
    }

    return {
      size,
      totalSizeBytes,
      cacheDir: this.cacheDir,
    };
  }

  /**
   * Get age of cached item in seconds
   */
  async getAge(key: string): Promise<number | null> {
    await this.init();

    const filePath = this.getFilePath(key);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: FileCacheEntry<unknown> = JSON.parse(content);
      return Math.floor((Date.now() - entry.createdAt) / 1000);
    } catch {
      return null;
    }
  }

  /**
   * Generate file path from cache key
   */
  private getFilePath(key: string): string {
    // Hash the key to ensure safe file names
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }
}
