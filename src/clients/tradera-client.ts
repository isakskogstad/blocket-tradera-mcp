/**
 * Tradera REST API Client
 * https://api.tradera.com/v3/
 *
 * CRITICAL: Rate limit is 100 calls per 24 hours!
 * This client implements aggressive caching and budget management.
 */

import { parseStringPromise } from 'xml2js';
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

// REST API endpoints
const API_BASE = 'https://api.tradera.com/v3';
const API_ENDPOINTS = {
  search: `${API_BASE}/searchservice.asmx/Search`,
  getItem: `${API_BASE}/publicservice.asmx/GetItem`,
  getCategories: `${API_BASE}/publicservice.asmx/GetCategories`,
  getCounties: `${API_BASE}/publicservice.asmx/GetCounties`,
  getFeedbackSummary: `${API_BASE}/publicservice.asmx/GetFeedbackSummary`,
};

export interface TraderaClientOptions {
  appId?: number;
  appKey?: string;
  cacheManager?: CacheManager;
}

export class TraderaClient {
  private readonly auth: TraderaAuth;
  private readonly cache: CacheManager;

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
   * Initialize cache and warm up
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
      // Build URL with query parameters
      const url = new URL(API_ENDPOINTS.search);
      url.searchParams.append('query', params.query);
      url.searchParams.append('categoryId', String(params.categoryId ?? 0));
      url.searchParams.append('orderBy', params.orderBy ?? 'Relevance');
      url.searchParams.append('pageNumber', String(params.pageNumber ?? 1));
      url.searchParams.append('appId', String(this.auth.appId));
      url.searchParams.append('appKey', this.auth.appKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Tradera API returned ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { explicitArray: false });

      this.recordApiCall();

      const items: TraderaItem[] = this.parseSearchResponse(parsed);
      const totalCount = this.extractTotalCount(parsed);

      const result: TraderaSearchResult = {
        items,
        totalCount,
        pageNumber: params.pageNumber ?? 1,
        itemsPerPage: params.itemsPerPage ?? 50,
        totalPages: Math.ceil(totalCount / (params.itemsPerPage ?? 50)),
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
      const url = new URL(API_ENDPOINTS.getItem);
      url.searchParams.append('itemId', String(itemId));
      url.searchParams.append('appId', String(this.auth.appId));
      url.searchParams.append('appKey', this.auth.appKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Tradera API returned ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { explicitArray: false });

      this.recordApiCall();

      const itemData = this.extractItemFromResponse(parsed);
      if (!itemData) {
        return null;
      }

      const item = this.parseItem(itemData, true);
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
      const url = new URL(API_ENDPOINTS.getCategories);
      url.searchParams.append('appId', String(this.auth.appId));
      url.searchParams.append('appKey', this.auth.appKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Tradera API returned ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { explicitArray: false });

      this.recordApiCall();

      const categories = this.parseCategories(parsed);
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
      const url = new URL(API_ENDPOINTS.getCounties);
      url.searchParams.append('appId', String(this.auth.appId));
      url.searchParams.append('appKey', this.auth.appKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Tradera API returned ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { explicitArray: false });

      this.recordApiCall();

      const counties = this.parseCounties(parsed);
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
      const url = new URL(API_ENDPOINTS.getFeedbackSummary);
      url.searchParams.append('userId', String(userId));
      url.searchParams.append('appId', String(this.auth.appId));
      url.searchParams.append('appKey', this.auth.appKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Tradera API returned ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = await parseStringPromise(xmlText, { explicitArray: false });

      this.recordApiCall();

      const summary = this.parseFeedbackSummary(parsed, userId);
      if (!summary) {
        return null;
      }

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
   * Extract total count from search response
   */
  private extractTotalCount(parsed: any): number {
    try {
      // REST API returns SearchResult directly (not wrapped in SOAP)
      const searchResult = parsed.SearchResult;
      if (searchResult?.TotalNumberOfItems) {
        return Number(searchResult.TotalNumberOfItems);
      }
      return 0;
    } catch (error) {
      console.error('[TraderaClient] Failed to extract total count:', error);
      return 0;
    }
  }

  /**
   * Extract item from GetItem response
   */
  private extractItemFromResponse(parsed: any): any {
    try {
      // REST API returns Item directly (not wrapped in SOAP)
      return parsed.Item;
    } catch (error) {
      console.error('[TraderaClient] Failed to extract item from response:', error);
      return null;
    }
  }

  /**
   * Parse search response to items array
   */
  private parseSearchResponse(parsed: any): TraderaItem[] {
    try {
      // REST API returns SearchResult -> Items array directly
      const searchResult = parsed.SearchResult;
      const items = searchResult?.Items;

      if (!items) {
        return [];
      }

      // Items is an array of item objects (not wrapped in Item element)
      const itemArray = Array.isArray(items) ? items : [items];
      return itemArray.map((item) => this.parseItem(item, false));
    } catch (error) {
      console.error('[TraderaClient] Failed to parse search response:', error);
      return [];
    }
  }

  /**
   * Parse XML item to TraderaItem
   * @param item - Raw XML item data
   * @param isDetailedView - Whether this is from GetItem (detailed) or Search (summary)
   */
  private parseItem(item: any, isDetailedView: boolean): TraderaItem {
    const baseItem: TraderaItem = {
      itemId: Number(item.Id ?? item.ItemId ?? 0),
      shortDescription: String(item.ShortDescription ?? item.Title ?? ''),
      longDescription: item.LongDescription,
      categoryId: Number(item.CategoryId ?? 0),
      categoryName: item.CategoryName,
      sellerId: Number(item.SellerId ?? 0),
      sellerAlias: item.SellerAlias,
      startPrice: item.StartPrice ? Number(item.StartPrice) : undefined,
      reservePrice: item.ReservePrice ? Number(item.ReservePrice) : undefined,
      buyItNowPrice: item.BuyItNowPrice ? Number(item.BuyItNowPrice) : undefined,
      currentBid: item.MaxBid ? Number(item.MaxBid) : undefined,
      bidCount: Number(item.TotalBids ?? 0),
      startDate: String(item.StartDate ?? ''),
      endDate: String(item.EndDate ?? ''),
      thumbnailUrl: item.ThumbnailLink,
      imageUrls: this.parseImageUrls(item.ImageLinks),
      itemType: this.parseItemType(item.ItemType),
      itemUrl: item.ItemUrl,
    };

    // Add detailed fields if available (from GetItem or Search with extended data)
    if (item.NextBid) {
      baseItem.nextBid = Number(item.NextBid);
    }

    if (item.SellerDsrAverage) {
      baseItem.sellerRating = Number(item.SellerDsrAverage);
    }

    // Parse attributes (brand, model, storage, condition)
    if (item.AttributeValues) {
      baseItem.attributes = this.parseAttributes(item.AttributeValues);
    }

    // Parse seller details (from detailed view)
    if (isDetailedView && item.Seller) {
      if (item.Seller.City) {
        baseItem.sellerCity = item.Seller.City;
      }
      if (item.Seller.TotalRating) {
        baseItem.sellerTotalRating = Number(item.Seller.TotalRating);
      }
    }

    // Parse shipping options
    if (item.ShippingOptions) {
      baseItem.shippingOptions = this.parseShippingOptions(item.ShippingOptions);
    }

    // Parse auction status (REST API uses string "true"/"false")
    if (item.Status) {
      baseItem.auctionStatus = {
        ended: item.Status.Ended === 'true' || item.Status.Ended === true,
        gotBidders: item.Status.GotBidders === 'true' || item.Status.GotBidders === true,
        gotWinner: item.Status.GotWinner === 'true' || item.Status.GotWinner === true,
      };
    }

    return baseItem;
  }

  /**
   * Parse attributes from AttributeValues (REST API structure)
   */
  private parseAttributes(attrValues: any): { brand?: string; model?: string; storage?: string; condition?: string } {
    const attrs: { brand?: string; model?: string; storage?: string; condition?: string } = {};

    // REST API uses TermAttributeValues structure
    if (!attrValues?.TermAttributeValues?.TermAttributeValue) {
      return attrs;
    }

    const values = Array.isArray(attrValues.TermAttributeValues.TermAttributeValue)
      ? attrValues.TermAttributeValues.TermAttributeValue
      : [attrValues.TermAttributeValues.TermAttributeValue];

    for (const attr of values) {
      const name = attr.Name?.toLowerCase();
      const value = attr.Values?.string;

      if (!value) continue;

      if (name === 'condition' || name === 'skick') {
        attrs.condition = value;
      } else if (name === 'mobile_brand' || name === 'märke' || name === 'brand') {
        attrs.brand = value;
      } else if (name === 'mobile_model' || name === 'modell' || name === 'model') {
        attrs.model = value;
      } else if (name === 'mobile_disk_memory' || name === 'lagring' || name === 'storage') {
        attrs.storage = value;
      }
    }

    return attrs;
  }

  /**
   * Parse shipping options (REST API structure)
   */
  private parseShippingOptions(shippingOptions: any): any[] {
    // REST API returns array directly
    if (!shippingOptions || !Array.isArray(shippingOptions)) {
      return [];
    }

    return shippingOptions.map((opt: any) => ({
      shippingId: opt.ShippingOptionId ? Number(opt.ShippingOptionId) : undefined,
      shippingProductId: opt.ShippingProductId ? Number(opt.ShippingProductId) : undefined,
      shippingProviderId: opt.ShippingProviderId ? Number(opt.ShippingProviderId) : undefined,
      cost: opt.Cost ? Number(opt.Cost) : 0,
      weight: opt.ShippingWeight ? Number(opt.ShippingWeight) : undefined,
    }));
  }

  /**
   * Parse image URLs from XML response (REST API structure)
   */
  private parseImageUrls(imageLinks: any): string[] | undefined {
    if (!imageLinks) return undefined;

    // REST API returns array of strings directly
    if (Array.isArray(imageLinks)) {
      return imageLinks.map((url) => String(url));
    }

    // Also handle string array element
    if (imageLinks.string) {
      const links = Array.isArray(imageLinks.string)
        ? imageLinks.string
        : [imageLinks.string];
      return links.map((url: any) => String(url));
    }

    if (typeof imageLinks === 'string') {
      return [imageLinks];
    }

    return undefined;
  }

  /**
   * Parse item type
   */
  private parseItemType(itemType: any): 'Auction' | 'BuyItNow' | 'ShopItem' {
    const type = String(itemType ?? 'Auction');
    if (type === 'BuyItNow' || type === 'ShopItem') return type;
    return 'Auction';
  }

  /**
   * Parse categories from XML response
   */
  private parseCategories(parsed: any): TraderaCategory[] {
    try {
      // REST API returns ArrayOfCategory directly
      const categoriesResponse = parsed.ArrayOfCategory;
      const categories = categoriesResponse?.Category;

      if (!categories) {
        return [];
      }

      const categoryArray = Array.isArray(categories) ? categories : [categories];
      return this.parseCategoryArray(categoryArray);
    } catch (error) {
      console.error('[TraderaClient] Failed to parse categories:', error);
      return [];
    }
  }

  /**
   * Recursively parse category array
   */
  private parseCategoryArray(categories: any[]): TraderaCategory[] {
    return categories.map((cat) => ({
      categoryId: Number(cat.CategoryId ?? cat.Id ?? 0),
      categoryName: String(cat.CategoryName ?? cat.Name ?? ''),
      parentId: cat.ParentId ? Number(cat.ParentId) : undefined,
      hasChildren: Boolean(cat.HasChildren ?? false),
      childCategories: cat.ChildCategories?.Category
        ? this.parseCategoryArray(
            Array.isArray(cat.ChildCategories.Category)
              ? cat.ChildCategories.Category
              : [cat.ChildCategories.Category]
          )
        : undefined,
    }));
  }

  /**
   * Parse counties from XML response
   */
  private parseCounties(parsed: any): TraderaCounty[] {
    try {
      // REST API returns ArrayOfCounty directly
      const countiesResponse = parsed.ArrayOfCounty;
      const counties = countiesResponse?.County;

      if (!counties) {
        return [];
      }

      const countyArray = Array.isArray(counties) ? counties : [counties];
      return countyArray.map((c: any) => ({
        countyId: Number(c.CountyId ?? 0),
        countyName: String(c.CountyName ?? ''),
      }));
    } catch (error) {
      console.error('[TraderaClient] Failed to parse counties:', error);
      return [];
    }
  }

  /**
   * Parse feedback summary from XML response
   */
  private parseFeedbackSummary(parsed: any, userId: number): TraderaFeedbackSummary | null {
    try {
      // REST API returns FeedbackSummary directly
      const feedbackSummary = parsed.FeedbackSummary;

      if (!feedbackSummary) {
        return null;
      }

      return {
        userId,
        totalPositive: Number(feedbackSummary.TotalPositive ?? 0),
        totalNegative: Number(feedbackSummary.TotalNegative ?? 0),
        totalNeutral: Number(feedbackSummary.TotalNeutral ?? 0),
        feedbackPercentage: Number(feedbackSummary.FeedbackPercentage ?? 0),
      };
    } catch (error) {
      console.error('[TraderaClient] Failed to parse feedback summary:', error);
      return null;
    }
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
