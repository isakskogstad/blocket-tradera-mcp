/**
 * Blocket REST API Client
 * https://blocket-api.se/v1/
 *
 * Rate limit: 5 requests per second
 * No authentication required for searches
 */

import { z } from 'zod';
import {
  RateLimiter,
  createBlocketRateLimiter,
} from '../utils/rate-limiter.js';
import { CacheManager, getCacheManager } from '../cache/cache-manager.js';
import {
  normalizeBlocketListing,
  mapBlocketLocation,
} from '../utils/normalizer.js';
import {
  BlocketLocations,
  BlocketCategories,
} from '../types/blocket.js';
import type {
  BlocketSearchParams,
  BlocketCarSearchParams,
  BlocketBoatSearchParams,
  BlocketMcSearchParams,
  BlocketSearchResult,
  BlocketAdDetails,
  BlocketLocation,
  BlocketCategory,
} from '../types/blocket.js';
import type { UnifiedListing } from '../types/unified.js';

// Response validation schemas (loose validation, then cast)
const BlocketListingSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  subject: z.string(),
  body: z.string().optional(),
  price: z.number().optional(),
  price_formatted: z.string().optional(),
  location: z.string().optional(),
  region: z.string().optional(),
  published: z.string().optional(),
  ad_type: z.string().optional(),
  category: z.string().optional(),
  images: z.array(z.string()).optional(),
  url: z.string().optional(),
  seller: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.enum(['private', 'dealer']).optional(),
    })
    .optional(),
  vehicle: z
    .object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      mileage: z.number().optional(),
      fuel_type: z.string().optional(),
      transmission: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
});

const BlocketSearchResultSchema = z.object({
  results: z.array(BlocketListingSchema).default([]),
  pagination: z
    .object({
      page: z.number().default(1),
      total_pages: z.number().default(1),
      total_results: z.number().optional(),
    })
    .default({ page: 1, total_pages: 1 }),
});

export interface BlocketClientOptions {
  baseUrl?: string;
  cacheManager?: CacheManager;
}

export class BlocketClient {
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: CacheManager;

  constructor(options: BlocketClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://blocket-api.se/v1';
    this.rateLimiter = createBlocketRateLimiter();
    this.cache = options.cacheManager ?? getCacheManager();
  }

  /**
   * Initialize the client (cache warmup)
   */
  async init(): Promise<void> {
    await this.cache.init();
    console.error('[BlocketClient] Initialized');
  }

  /**
   * General search
   */
  async search(params: BlocketSearchParams): Promise<BlocketSearchResult> {
    const cacheKey = JSON.stringify(params);

    // Check cache first
    const cached = await this.cache.get<BlocketSearchResult>(
      'blocket:search',
      cacheKey
    );
    if (cached.data) {
      return {
        ...cached.data,
        cached: true,
        cache_age_seconds: cached.ageSeconds ?? 0,
      };
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('query', params.query);
    if (params.page) queryParams.set('page', String(params.page));
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);
    if (params.category) queryParams.set('category', params.category);
    if (params.locations?.length) {
      params.locations.forEach((loc) => queryParams.append('locations', loc));
    }

    const result = await this.fetchAndValidate(
      `/search?${queryParams.toString()}`
    );

    // Cache the result
    await this.cache.set('blocket:search', cacheKey, result);

    return { ...result, cached: false };
  }

  /**
   * Car-specific search with vehicle filters
   */
  async searchCars(params: BlocketCarSearchParams): Promise<BlocketSearchResult> {
    const cacheKey = `cars:${JSON.stringify(params)}`;

    // Check cache
    const cached = await this.cache.get<BlocketSearchResult>(
      'blocket:search',
      cacheKey
    );
    if (cached.data) {
      return {
        ...cached.data,
        cached: true,
        cache_age_seconds: cached.ageSeconds ?? 0,
      };
    }

    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('query', params.query);
    if (params.page) queryParams.set('page', String(params.page));
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);
    if (params.price_from) queryParams.set('price_from', String(params.price_from));
    if (params.price_to) queryParams.set('price_to', String(params.price_to));
    if (params.year_from) queryParams.set('year_from', String(params.year_from));
    if (params.year_to) queryParams.set('year_to', String(params.year_to));
    if (params.milage_from) queryParams.set('milage_from', String(params.milage_from));
    if (params.milage_to) queryParams.set('milage_to', String(params.milage_to));
    if (params.models?.length) {
      params.models.forEach((m) => queryParams.append('models', m));
    }
    if (params.colors?.length) {
      params.colors.forEach((c) => queryParams.append('colors', c));
    }
    if (params.transmissions?.length) {
      params.transmissions.forEach((t) => queryParams.append('transmissions', t));
    }
    if (params.locations?.length) {
      params.locations.forEach((loc) => queryParams.append('locations', loc));
    }

    const result = await this.fetchAndValidate(
      `/search/car?${queryParams.toString()}`
    );

    await this.cache.set('blocket:search', cacheKey, result);
    return { ...result, cached: false };
  }

  /**
   * Boat search
   */
  async searchBoats(params: BlocketBoatSearchParams): Promise<BlocketSearchResult> {
    const cacheKey = `boats:${JSON.stringify(params)}`;

    const cached = await this.cache.get<BlocketSearchResult>(
      'blocket:search',
      cacheKey
    );
    if (cached.data) {
      return {
        ...cached.data,
        cached: true,
        cache_age_seconds: cached.ageSeconds ?? 0,
      };
    }

    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('query', params.query);
    if (params.page) queryParams.set('page', String(params.page));
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);
    if (params.price_from) queryParams.set('price_from', String(params.price_from));
    if (params.price_to) queryParams.set('price_to', String(params.price_to));
    if (params.length_from) queryParams.set('length_from', String(params.length_from));
    if (params.length_to) queryParams.set('length_to', String(params.length_to));
    if (params.types?.length) {
      params.types.forEach((t) => queryParams.append('types', t));
    }
    if (params.locations?.length) {
      params.locations.forEach((loc) => queryParams.append('locations', loc));
    }

    const result = await this.fetchAndValidate(
      `/search/boat?${queryParams.toString()}`
    );

    await this.cache.set('blocket:search', cacheKey, result);
    return { ...result, cached: false };
  }

  /**
   * Motorcycle search
   */
  async searchMc(params: BlocketMcSearchParams): Promise<BlocketSearchResult> {
    const cacheKey = `mc:${JSON.stringify(params)}`;

    const cached = await this.cache.get<BlocketSearchResult>(
      'blocket:search',
      cacheKey
    );
    if (cached.data) {
      return {
        ...cached.data,
        cached: true,
        cache_age_seconds: cached.ageSeconds ?? 0,
      };
    }

    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('query', params.query);
    if (params.page) queryParams.set('page', String(params.page));
    if (params.sort_order) queryParams.set('sort_order', params.sort_order);
    if (params.price_from) queryParams.set('price_from', String(params.price_from));
    if (params.price_to) queryParams.set('price_to', String(params.price_to));
    if (params.engine_volume_from)
      queryParams.set('engine_volume_from', String(params.engine_volume_from));
    if (params.engine_volume_to)
      queryParams.set('engine_volume_to', String(params.engine_volume_to));
    if (params.models?.length) {
      params.models.forEach((m) => queryParams.append('models', m));
    }
    if (params.types?.length) {
      params.types.forEach((t) => queryParams.append('types', t));
    }
    if (params.locations?.length) {
      params.locations.forEach((loc) => queryParams.append('locations', loc));
    }

    const result = await this.fetchAndValidate(
      `/search/mc?${queryParams.toString()}`
    );

    await this.cache.set('blocket:search', cacheKey, result);
    return { ...result, cached: false };
  }

  /**
   * Get ad details by ID
   */
  async getAd(
    adId: string,
    adType: 'RECOMMERCE' | 'CAR' | 'BOAT' | 'MC' = 'RECOMMERCE'
  ): Promise<BlocketAdDetails | null> {
    const cacheKey = `${adType}:${adId}`;

    const cached = await this.cache.get<BlocketAdDetails>('blocket:ad', cacheKey);
    if (cached.data) {
      return cached.data;
    }

    try {
      await this.rateLimiter.throttle();

      const url = `${this.baseUrl}/ad/${adType}?id=${adId}`;
      console.error(`[BlocketClient] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlocketTraderaMCP/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const validated = BlocketListingSchema.extend({
        description: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        contact: z
          .object({
            phone: z.string().optional(),
            email: z.string().optional(),
          })
          .optional(),
        attributes: z.record(z.string()).optional(),
      }).parse(data);

      const result = validated as BlocketAdDetails;
      await this.cache.set('blocket:ad', cacheKey, result);
      return result;
    } catch (error) {
      console.error(`[BlocketClient] Failed to get ad ${adId}:`, error);
      return null;
    }
  }

  /**
   * Get available locations
   */
  getLocations(): { id: BlocketLocation; name: string }[] {
    return BlocketLocations.map((loc) => ({
      id: loc,
      name: mapBlocketLocation(loc),
    }));
  }

  /**
   * Get available categories
   */
  getCategories(): { id: BlocketCategory; name: string }[] {
    const categoryNames: Record<BlocketCategory, string> = {
      AFFARSVERKSAMHET: 'Affärsverksamhet',
      DJUR_OCH_TILLBEHOR: 'Djur och Tillbehör',
      ELEKTRONIK_OCH_VITVAROR: 'Elektronik och Vitvaror',
      FORDONSTILLBEHOR: 'Fordonstillbehör',
      FRITID_HOBBY_OCH_UNDERHALLNING: 'Fritid, Hobby och Underhållning',
      FORALDRAR_OCH_BARN: 'Föräldrar och Barn',
      KLADER_KOSMETIKA_OCH_ACCESSOARER: 'Kläder, Kosmetika och Accessoarer',
      KONST_OCH_ANTIKT: 'Konst och Antikt',
      MOBLER_OCH_INREDNING: 'Möbler och Inredning',
      SPORT_OCH_FRITID: 'Sport och Fritid',
      TRADGARD_OCH_RENOVERING: 'Trädgård och Renovering',
    };

    return BlocketCategories.map((cat) => ({
      id: cat,
      name: categoryNames[cat],
    }));
  }

  /**
   * Convert Blocket results to unified format
   */
  normalizeResults(
    results: BlocketSearchResult,
    adType?: string
  ): UnifiedListing[] {
    return results.results.map((listing) =>
      normalizeBlocketListing(listing, adType)
    );
  }

  /**
   * Get rate limiter stats
   */
  getRateLimitStats(): { used: number; remaining: number; windowMs: number } {
    return this.rateLimiter.getStats();
  }

  /**
   * Internal fetch with rate limiting and validation
   */
  private async fetchAndValidate(endpoint: string): Promise<BlocketSearchResult> {
    await this.rateLimiter.throttle();

    const url = `${this.baseUrl}${endpoint}`;
    console.error(`[BlocketClient] Fetching: ${url}`);

    // Request timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlocketTraderaMCP/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 422) {
          const error = await response.json();
          throw new Error(`Validation error: ${JSON.stringify(error)}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const validated = BlocketSearchResultSchema.parse(data);

      // Cast to our interface type
      return validated as BlocketSearchResult;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timeout after 30 seconds');
      }
      throw err;
    }
  }
}

// Singleton instance
let blocketClientInstance: BlocketClient | null = null;

export function getBlocketClient(options?: BlocketClientOptions): BlocketClient {
  if (!blocketClientInstance) {
    blocketClientInstance = new BlocketClient(options);
  }
  return blocketClientInstance;
}
