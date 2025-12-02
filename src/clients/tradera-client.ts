/**
 * Tradera SOAP API Client
 * https://api.tradera.com/v3/
 *
 * CRITICAL: Rate limit is 100 calls per 24 hours!
 * This client implements aggressive caching and budget management.
 */

import { createClientAsync, Client } from 'soap';
import { CacheManager, getCacheManager, CacheTTL } from '../cache/cache-manager.js';
import { normalizeTraderaItem } from '../utils/normalizer.js';
import type {
  TraderaAuth,
  TraderaApiBudget,
  TraderaCategory,
  TraderaCounty,
  TraderaItem,
  TraderaSearchParams,
  TraderaSearchResult,
  TraderaFeedbackSummary,
} from '../types/tradera.js';
import type { UnifiedListing } from '../types/unified.js';

// SOAP service URLs
const SOAP_URLS = {
  public: 'https://api.tradera.com/v3/PublicService.asmx?WSDL',
  search: 'https://api.tradera.com/v3/SearchService.asmx?WSDL',
};

export interface TraderaClientOptions {
  appId?: number;
  appKey?: string;
  cacheManager?: CacheManager;
}

export class TraderaClient {
  private readonly auth: TraderaAuth;
  private readonly cache: CacheManager;
  private publicClient: Client | null = null;
  private searchClient: Client | null = null;

  // API Budget tracking (100 calls/24h)
  private budget: TraderaApiBudget = {
    dailyLimit: 100,
    used: 0,
    resetTime: this.getNextResetTime(),
    remaining: 100,
  };

  constructor(options: TraderaClientOptions = {}) {
    // Use environment variables or provided options
    // Default credentials are for development only
    this.auth = {
      appId: options.appId ?? parseInt(process.env.TRADERA_APP_ID ?? '5572'),
      appKey: options.appKey ?? process.env.TRADERA_APP_KEY ?? '81974dd3-404d-456e-b050-b030ba646d6a',
    };
    this.cache = options.cacheManager ?? getCacheManager();
  }

  /**
   * Initialize SOAP clients and warm cache
   */
  async init(): Promise<void> {
    await this.cache.init();

    // Check if we have cached categories/counties to avoid API calls
    const hasCachedCategories = await this.cache.has('tradera:categories', 'all');
    const hasCachedCounties = await this.cache.has('tradera:counties', 'all');

    console.error('[TraderaClient] Initialized');
    console.error(`[TraderaClient] API Budget: ${this.budget.remaining}/${this.budget.dailyLimit} remaining`);

    if (!hasCachedCategories || !hasCachedCounties) {
      console.error('[TraderaClient] Cache warming needed - will fetch on first use');
    }
  }

  /**
   * Get remaining API budget
   */
  getBudget(): TraderaApiBudget {
    this.checkBudgetReset();
    return { ...this.budget };
  }

  /**
   * Check if we can make an API call
   */
  canMakeApiCall(): boolean {
    this.checkBudgetReset();
    return this.budget.remaining > 0;
  }

  /**
   * Search for items (heavily cached)
   */
  async search(params: TraderaSearchParams, forceRefresh = false): Promise<TraderaSearchResult> {
    const cacheKey = JSON.stringify(params);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await this.cache.get<TraderaSearchResult>('tradera:search', cacheKey);
      if (cached.data) {
        return {
          ...cached.data,
          cached: true,
          cache_age_seconds: cached.ageSeconds ?? 0,
        };
      }
    }

    // Check budget before API call
    if (!this.canMakeApiCall()) {
      throw new Error(
        `Tradera API budget exhausted (${this.budget.used}/${this.budget.dailyLimit}). ` +
        `Resets at ${this.budget.resetTime.toISOString()}. Use cached data or wait.`
      );
    }

    try {
      const client = await this.getSearchClient();

      const request = {
        query: params.query,
        categoryId: params.categoryId ?? 0,
        orderBy: params.orderBy ?? 'Relevance',
        pageNumber: params.pageNumber ?? 1,
        itemsPerPage: params.itemsPerPage ?? 50,
      };

      // Make SOAP call (auth is in SOAP header, not here)
      const [response] = await client.SearchAsync({
        request,
      });

      this.recordApiCall();

      const items: TraderaItem[] = this.parseSearchResponse(response);
      const result: TraderaSearchResult = {
        items,
        totalCount: response?.TotalNumberOfItems ?? items.length,
        pageNumber: params.pageNumber ?? 1,
        itemsPerPage: params.itemsPerPage ?? 50,
        totalPages: Math.ceil((response?.TotalNumberOfItems ?? items.length) / (params.itemsPerPage ?? 50)),
        cached: false,
      };

      // Cache the result
      await this.cache.set('tradera:search', cacheKey, result, CacheTTL.tradera.searchResults);

      return result;
    } catch (error) {
      console.error('[TraderaClient] Search failed:', error);
      throw error;
    }
  }

  /**
   * Get item details by ID
   */
  async getItem(itemId: number, forceRefresh = false): Promise<TraderaItem | null> {
    const cacheKey = String(itemId);

    if (!forceRefresh) {
      const cached = await this.cache.get<TraderaItem>('tradera:item', cacheKey);
      if (cached.data) {
        return cached.data;
      }
    }

    if (!this.canMakeApiCall()) {
      console.error('[TraderaClient] Budget exhausted, cannot fetch item');
      return null;
    }

    try {
      const client = await this.getPublicClient();

      const [response] = await client.GetItemAsync({
        itemId,
      });

      this.recordApiCall();

      if (!response?.Item) {
        return null;
      }

      const item = this.parseItem(response.Item);
      await this.cache.set('tradera:item', cacheKey, item, CacheTTL.tradera.itemDetails);

      return item;
    } catch (error) {
      console.error(`[TraderaClient] Failed to get item ${itemId}:`, error);
      return null;
    }
  }

  /**
   * Get all categories (long cache - 24h)
   */
  async getCategories(forceRefresh = false): Promise<TraderaCategory[]> {
    if (!forceRefresh) {
      const cached = await this.cache.get<TraderaCategory[]>('tradera:categories', 'all');
      if (cached.data) {
        return cached.data;
      }
    }

    if (!this.canMakeApiCall()) {
      console.error('[TraderaClient] Budget exhausted, returning empty categories');
      return [];
    }

    try {
      const client = await this.getPublicClient();

      const [response] = await client.GetCategoriesAsync({});

      this.recordApiCall();

      const categories = this.parseCategories(response?.Categories ?? []);
      await this.cache.set('tradera:categories', 'all', categories, CacheTTL.tradera.categories);

      return categories;
    } catch (error) {
      console.error('[TraderaClient] Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get Swedish counties (very long cache - 7 days)
   */
  async getCounties(forceRefresh = false): Promise<TraderaCounty[]> {
    if (!forceRefresh) {
      const cached = await this.cache.get<TraderaCounty[]>('tradera:counties', 'all');
      if (cached.data) {
        return cached.data;
      }
    }

    if (!this.canMakeApiCall()) {
      console.error('[TraderaClient] Budget exhausted, returning empty counties');
      return [];
    }

    try {
      const client = await this.getPublicClient();

      const [response] = await client.GetCountiesAsync({});

      this.recordApiCall();

      const counties: TraderaCounty[] = (response?.Counties ?? []).map((c: { CountyId: number; CountyName: string }) => ({
        countyId: c.CountyId,
        countyName: c.CountyName,
      }));

      await this.cache.set('tradera:counties', 'all', counties, CacheTTL.tradera.counties);

      return counties;
    } catch (error) {
      console.error('[TraderaClient] Failed to get counties:', error);
      return [];
    }
  }

  /**
   * Get seller feedback summary
   */
  async getFeedbackSummary(userId: number): Promise<TraderaFeedbackSummary | null> {
    const cacheKey = String(userId);

    const cached = await this.cache.get<TraderaFeedbackSummary>('tradera:feedback', cacheKey);
    if (cached.data) {
      return cached.data;
    }

    if (!this.canMakeApiCall()) {
      return null;
    }

    try {
      const client = await this.getPublicClient();

      const [response] = await client.GetFeedbackSummaryAsync({
        userId,
      });

      this.recordApiCall();

      if (!response) {
        return null;
      }

      const summary: TraderaFeedbackSummary = {
        userId,
        totalPositive: response.TotalPositive ?? 0,
        totalNegative: response.TotalNegative ?? 0,
        totalNeutral: response.TotalNeutral ?? 0,
        feedbackPercentage: response.FeedbackPercentage ?? 0,
      };

      await this.cache.set('tradera:feedback', cacheKey, summary, CacheTTL.tradera.feedbackSummary);

      return summary;
    } catch (error) {
      console.error(`[TraderaClient] Failed to get feedback for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Convert Tradera results to unified format
   */
  normalizeResults(results: TraderaSearchResult): UnifiedListing[] {
    return results.items.map((item) => normalizeTraderaItem(item));
  }

  /**
   * Add SOAP authentication header to client
   * IMPORTANT: Auth must be in SOAP header, not in request body!
   */
  private addAuthHeader(client: Client): void {
    client.addSoapHeader({
      AuthenticationHeader: {
        attributes: {
          xmlns: 'http://api.tradera.com',
        },
        AppId: this.auth.appId,
        AppKey: this.auth.appKey,
      },
    });
  }

  /**
   * Get or create PublicService client
   */
  private async getPublicClient(): Promise<Client> {
    if (!this.publicClient) {
      this.publicClient = await createClientAsync(SOAP_URLS.public);
      this.addAuthHeader(this.publicClient);
    }
    return this.publicClient;
  }

  /**
   * Get or create SearchService client
   */
  private async getSearchClient(): Promise<Client> {
    if (!this.searchClient) {
      this.searchClient = await createClientAsync(SOAP_URLS.search);
      this.addAuthHeader(this.searchClient);
    }
    return this.searchClient;
  }

  /**
   * Record an API call and update budget
   */
  private recordApiCall(): void {
    this.checkBudgetReset();
    this.budget.used++;
    this.budget.remaining = this.budget.dailyLimit - this.budget.used;
    console.error(`[TraderaClient] API call made. Budget: ${this.budget.remaining}/${this.budget.dailyLimit}`);
  }

  /**
   * Check if budget should reset
   */
  private checkBudgetReset(): void {
    if (Date.now() > this.budget.resetTime.getTime()) {
      this.budget.used = 0;
      this.budget.remaining = this.budget.dailyLimit;
      this.budget.resetTime = this.getNextResetTime();
      console.error('[TraderaClient] Budget reset!');
    }
  }

  /**
   * Get next reset time (midnight UTC)
   */
  private getNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Parse SOAP search response to items
   */
  private parseSearchResponse(response: Record<string, unknown> | null | undefined): TraderaItem[] {
    if (!response) return [];

    const items = (response as Record<string, unknown>).Items ??
                  ((response as Record<string, { Items?: unknown[] }>).SearchResult?.Items) ?? [];
    if (!Array.isArray(items)) return [];

    return items.map((item) => this.parseItem(item as Record<string, unknown>));
  }

  /**
   * Parse SOAP item to TraderaItem
   */
  private parseItem(item: Record<string, unknown>): TraderaItem {
    return {
      itemId: Number(item.Id ?? item.ItemId ?? 0),
      shortDescription: String(item.ShortDescription ?? item.Title ?? ''),
      longDescription: item.LongDescription as string | undefined,
      categoryId: Number(item.CategoryId ?? 0),
      categoryName: item.CategoryName as string | undefined,
      sellerId: Number(item.SellerId ?? 0),
      sellerAlias: item.SellerAlias as string | undefined,
      startPrice: item.StartPrice ? Number(item.StartPrice) : undefined,
      reservePrice: item.ReservePrice ? Number(item.ReservePrice) : undefined,
      buyItNowPrice: item.BuyItNowPrice ? Number(item.BuyItNowPrice) : undefined,
      currentBid: item.MaxBid ? Number(item.MaxBid) : undefined,
      bidCount: Number(item.TotalBids ?? 0),
      startDate: String(item.StartDate ?? ''),
      endDate: String(item.EndDate ?? ''),
      thumbnailUrl: item.ThumbnailLink as string | undefined,
      imageUrls: this.parseImageUrls(item.ImageLinks),
      itemType: this.parseItemType(item.ItemType),
      itemUrl: item.ItemUrl as string | undefined,
    };
  }

  /**
   * Parse image URLs from SOAP response
   */
  private parseImageUrls(imageLinks: unknown): string[] | undefined {
    if (!imageLinks) return undefined;
    if (Array.isArray(imageLinks)) {
      return imageLinks.map((url) => String(url));
    }
    if (typeof imageLinks === 'string') {
      return [imageLinks];
    }
    return undefined;
  }

  /**
   * Parse item type
   */
  private parseItemType(itemType: unknown): 'Auction' | 'BuyItNow' | 'ShopItem' {
    const type = String(itemType ?? 'Auction');
    if (type === 'BuyItNow' || type === 'ShopItem') return type;
    return 'Auction';
  }

  /**
   * Parse categories from SOAP response
   */
  private parseCategories(categories: unknown[]): TraderaCategory[] {
    if (!Array.isArray(categories)) return [];

    return categories.map((catUnknown) => {
      const cat = catUnknown as Record<string, unknown>;
      return {
        categoryId: Number(cat.CategoryId ?? cat.Id ?? 0),
        categoryName: String(cat.CategoryName ?? cat.Name ?? ''),
        parentId: cat.ParentId ? Number(cat.ParentId) : undefined,
        hasChildren: Boolean(cat.HasChildren ?? false),
        childCategories: cat.ChildCategories
          ? this.parseCategories(cat.ChildCategories as unknown[])
          : undefined,
      };
    });
  }
}

// Singleton instance
let traderaClientInstance: TraderaClient | null = null;

export function getTraderaClient(options?: TraderaClientOptions): TraderaClient {
  if (!traderaClientInstance) {
    traderaClientInstance = new TraderaClient(options);
  }
  return traderaClientInstance;
}
