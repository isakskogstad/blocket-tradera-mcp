/**
 * MCP Tool Handlers
 * Implementation logic for all 10 tools
 */

import { getBlocketClient } from '../clients/blocket-client.js';
import { getTraderaClient } from '../clients/tradera-client.js';
import { getRegionForMunicipality, matchesMunicipality } from '../utils/municipalities.js';
import { suggestCorrections, generateQueryVariants } from '../utils/fuzzy-search.js';
import type { Platform, UnifiedListing, PriceStats, PriceComparison } from '../types/unified.js';
import type { BlocketLocation, BlocketCategory, BlocketSortOrder, BlocketCarSortOrder, BlocketColor } from '../types/blocket.js';
import type { TraderaOrderBy } from '../types/tradera.js';

// Get client instances
const blocket = getBlocketClient();
const tradera = getTraderaClient();

// Initialize clients
let initialized = false;
async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await Promise.all([blocket.init(), tradera.init()]);
    initialized = true;
  }
}

/**
 * Tool handler results
 */
export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Create a successful tool result
 */
function success(data: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create an error tool result
 */
function error(message: string, details?: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message, ...details }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Handle rate limit errors with graceful degradation
 */
function handleRateLimitError(platform: string, err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (message.includes('429') || message.includes('rate limit') || message.includes('budget')) {
    return error(
      `${platform} rate limit exceeded. Try again later or use cached results.`,
      {
        platform,
        retry_after_seconds: 60,
        suggestion: 'Use force_refresh: false to get cached results',
      }
    );
  }

  if (message.includes('503') || message.includes('unavailable')) {
    return error(
      `${platform} service temporarily unavailable.`,
      {
        platform,
        retry_after_seconds: 30,
        suggestion: 'Service may be under maintenance. Try again shortly.',
      }
    );
  }

  return error(message);
}

// ============================================
// UNIFIED SEARCH
// ============================================

export async function handleMarketplaceSearch(args: {
  query: string;
  platforms?: Platform[];
  region?: string;
  municipality?: string;
  price_min?: number;
  price_max?: number;
  sort_by?: 'relevance' | 'price_asc' | 'price_desc' | 'date_desc';
  page?: number;
}): Promise<ToolResult> {
  await ensureInitialized();
  const startTime = Date.now();

  const platforms = args.platforms ?? ['blocket', 'tradera'];
  const results: UnifiedListing[] = [];

  // Check for typos and suggest corrections
  const { correctedQuery, suggestions, wasModified } = suggestCorrections(args.query);
  const queryVariants = generateQueryVariants(args.query);

  const metadata: Record<string, unknown> = {
    query: args.query,
    platforms,
    cached: { blocket: false, tradera: false },
  };

  // Add spelling suggestions if query was modified
  if (wasModified) {
    metadata.spelling_suggestions = suggestions;
    metadata.corrected_query = correctedQuery;
    metadata.note = `Query may contain typos. Suggested: "${correctedQuery}"`;
  }

  // Add query variants for alternative searches
  if (queryVariants.length > 1) {
    metadata.query_variants = queryVariants;
  }

  // If municipality is specified, determine parent region
  let region = args.region;
  if (args.municipality && !region) {
    const parentRegion = getRegionForMunicipality(args.municipality);
    if (parentRegion) {
      region = parentRegion;
      metadata.municipality_filter = args.municipality;
      metadata.auto_selected_region = parentRegion;
    }
  }

  // Search Blocket
  if (platforms.includes('blocket')) {
    try {
      const blocketResult = await blocket.search({
        query: args.query,
        locations: region ? [region as BlocketLocation] : undefined,
        sort_order: mapSortOrder(args.sort_by) as BlocketSortOrder | undefined,
        page: args.page,
      });
      let normalized = blocket.normalizeResults(blocketResult);

      // Post-filter by municipality if specified
      if (args.municipality) {
        const beforeFilter = normalized.length;
        normalized = normalized.filter(listing =>
          matchesMunicipality(listing.location.city, args.municipality!)
        );
        metadata.municipality_filtered_count = beforeFilter - normalized.length;
      }

      results.push(...normalized);
      metadata.blocket_count = normalized.length;
      metadata.blocket_total_before_filter = blocketResult.pagination.total_results;
      metadata.cached = { ...(metadata.cached as Record<string, boolean>), blocket: blocketResult.cached ?? false };
    } catch (err) {
      metadata.blocket_error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  // Search Tradera
  if (platforms.includes('tradera')) {
    try {
      const traderaResult = await tradera.search({
        query: args.query,
        orderBy: mapTraderaSort(args.sort_by),
        pageNumber: args.page,
      });
      const normalized = tradera.normalizeResults(traderaResult);
      results.push(...normalized);
      metadata.tradera_count = traderaResult.totalCount;
      metadata.cached = { ...(metadata.cached as Record<string, boolean>), tradera: traderaResult.cached ?? false };
      metadata.tradera_budget = tradera.getBudget();
    } catch (err) {
      metadata.tradera_error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  // Filter by price if specified
  let filtered = results;
  if (args.price_min !== undefined || args.price_max !== undefined) {
    filtered = results.filter((item) => {
      const price = item.price.amount;
      if (args.price_min !== undefined && price < args.price_min) return false;
      if (args.price_max !== undefined && price > args.price_max) return false;
      return true;
    });
  }

  // Sort combined results
  if (args.sort_by) {
    filtered = sortResults(filtered, args.sort_by);
  }

  metadata.search_time_ms = Date.now() - startTime;

  return success({
    results: filtered,
    total_count: filtered.length,
    metadata,
  });
}

// ============================================
// BLOCKET TOOLS
// ============================================

export async function handleBlocketSearch(args: {
  query: string;
  category?: BlocketCategory;
  locations?: BlocketLocation[];
  municipality?: string;
  sort_order?: BlocketSortOrder;
  page?: number;
}): Promise<ToolResult> {
  await ensureInitialized();

  try {
    // If municipality is specified, determine parent region
    let locations = args.locations;
    if (args.municipality && (!locations || locations.length === 0)) {
      const parentRegion = getRegionForMunicipality(args.municipality);
      if (parentRegion) {
        locations = [parentRegion];
      }
    }

    const result = await blocket.search({
      query: args.query,
      category: args.category,
      locations: locations,
      sort_order: args.sort_order,
      page: args.page,
    });

    // Normalize results to unified format for consistent API (title, url, images, etc.)
    let normalizedResults = blocket.normalizeResults(result);

    // Post-filter by municipality if specified
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
      rate_limit: blocket.getRateLimitStats(),
    };

    if (args.municipality) {
      const beforeFilter = normalizedResults.length;
      normalizedResults = normalizedResults.filter(listing =>
        matchesMunicipality(listing.location.city, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - normalizedResults.length;
    }

    return success({
      results: normalizedResults,
      ...metadata,
    });
  } catch (err) {
    return handleRateLimitError('Blocket', err);
  }
}

export async function handleBlocketSearchCars(args: {
  query?: string;
  models?: string[];
  price_from?: number;
  price_to?: number;
  year_from?: number;
  year_to?: number;
  milage_from?: number;
  milage_to?: number;
  colors?: string[];
  transmissions?: string[];
  locations?: string[];
  municipality?: string;
  sort_order?: BlocketCarSortOrder;
  page?: number;
}): Promise<ToolResult> {
  await ensureInitialized();

  try {
    // If municipality is specified, determine parent region
    let locations = args.locations;
    if (args.municipality && (!locations || locations.length === 0)) {
      const parentRegion = getRegionForMunicipality(args.municipality);
      if (parentRegion) {
        locations = [parentRegion];
      }
    }

    const result = await blocket.searchCars({
      query: args.query,
      models: args.models,
      price_from: args.price_from,
      price_to: args.price_to,
      year_from: args.year_from,
      year_to: args.year_to,
      milage_from: args.milage_from,
      milage_to: args.milage_to,
      colors: args.colors as BlocketColor[] | undefined,
      transmissions: args.transmissions as ('AUTOMATIC' | 'MANUAL')[] | undefined,
      locations: locations as BlocketLocation[] | undefined,
      sort_order: args.sort_order,
      page: args.page,
    });

    // Normalize results to unified format for consistent API (title, url, images, etc.)
    let normalizedResults = blocket.normalizeResults(result, 'CAR');
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = normalizedResults.length;
      normalizedResults = normalizedResults.filter(listing =>
        matchesMunicipality(listing.location.city, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - normalizedResults.length;
    }

    return success({
      results: normalizedResults,
      ...metadata,
    });
  } catch (err) {
    return handleRateLimitError('Blocket', err);
  }
}

export async function handleBlocketSearchBoats(args: {
  query?: string;
  types?: string[];
  price_from?: number;
  price_to?: number;
  length_from?: number;
  length_to?: number;
  locations?: string[];
  municipality?: string;
  sort_order?: BlocketSortOrder;
  page?: number;
}): Promise<ToolResult> {
  await ensureInitialized();

  try {
    // If municipality is specified, determine parent region
    let locations = args.locations;
    if (args.municipality && (!locations || locations.length === 0)) {
      const parentRegion = getRegionForMunicipality(args.municipality);
      if (parentRegion) {
        locations = [parentRegion];
      }
    }

    const result = await blocket.searchBoats({
      query: args.query,
      types: args.types,
      price_from: args.price_from,
      price_to: args.price_to,
      length_from: args.length_from,
      length_to: args.length_to,
      locations: locations as BlocketLocation[] | undefined,
      sort_order: args.sort_order,
      page: args.page,
    });

    // Normalize results to unified format for consistent API (title, url, images, etc.)
    let normalizedResults = blocket.normalizeResults(result, 'BOAT');
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = normalizedResults.length;
      normalizedResults = normalizedResults.filter(listing =>
        matchesMunicipality(listing.location.city, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - normalizedResults.length;
    }

    return success({
      results: normalizedResults,
      ...metadata,
    });
  } catch (err) {
    return handleRateLimitError('Blocket', err);
  }
}

export async function handleBlocketSearchMc(args: {
  query?: string;
  models?: string[];
  types?: string[];
  price_from?: number;
  price_to?: number;
  engine_volume_from?: number;
  engine_volume_to?: number;
  locations?: string[];
  municipality?: string;
  sort_order?: BlocketSortOrder;
  page?: number;
}): Promise<ToolResult> {
  await ensureInitialized();

  try {
    // If municipality is specified, determine parent region
    let locations = args.locations;
    if (args.municipality && (!locations || locations.length === 0)) {
      const parentRegion = getRegionForMunicipality(args.municipality);
      if (parentRegion) {
        locations = [parentRegion];
      }
    }

    const result = await blocket.searchMc({
      query: args.query,
      models: args.models,
      types: args.types,
      price_from: args.price_from,
      price_to: args.price_to,
      engine_volume_from: args.engine_volume_from,
      engine_volume_to: args.engine_volume_to,
      locations: locations as BlocketLocation[] | undefined,
      sort_order: args.sort_order,
      page: args.page,
    });

    // Normalize results to unified format for consistent API (title, url, images, etc.)
    let normalizedResults = blocket.normalizeResults(result, 'MC');
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = normalizedResults.length;
      normalizedResults = normalizedResults.filter(listing =>
        matchesMunicipality(listing.location.city, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - normalizedResults.length;
    }

    return success({
      results: normalizedResults,
      ...metadata,
    });
  } catch (err) {
    return handleRateLimitError('Blocket', err);
  }
}

// ============================================
// TRADERA TOOLS
// ============================================

export async function handleTraderaSearch(args: {
  query: string;
  category_id?: number;
  order_by?: TraderaOrderBy;
  page?: number;
  items_per_page?: number;
  force_refresh?: boolean;
}): Promise<ToolResult> {
  await ensureInitialized();

  const budget = tradera.getBudget();

  // Warn if budget is low
  if (budget.remaining < 10) {
    console.error(`[Warning] Tradera API budget low: ${budget.remaining}/${budget.dailyLimit}`);
  }

  try {
    const result = await tradera.search(
      {
        query: args.query,
        categoryId: args.category_id,
        orderBy: args.order_by,
        pageNumber: args.page,
        itemsPerPage: args.items_per_page,
      },
      args.force_refresh
    );

    // Normalize results to unified format for consistent API
    const normalizedResults = tradera.normalizeResults(result);

    return success({
      results: normalizedResults,
      total_count: result.totalCount,
      pagination: {
        page: result.pageNumber,
        per_page: result.itemsPerPage,
        total_pages: result.totalPages,
      },
      cached: result.cached,
      cache_age_seconds: result.cache_age_seconds,
      api_budget: tradera.getBudget(),
    });
  } catch (err) {
    return handleRateLimitError('Tradera', err);
  }
}

// ============================================
// DETAIL TOOLS
// ============================================

export async function handleGetListingDetails(args: {
  platform: Platform;
  listing_id: string;
  ad_type?: 'RECOMMERCE' | 'CAR' | 'BOAT' | 'MC';
}): Promise<ToolResult> {
  await ensureInitialized();

  // Strip platform prefix if present (e.g., "blocket:123" -> "123", "tradera:456" -> "456")
  let listingId = args.listing_id;
  if (listingId.includes(':')) {
    listingId = listingId.split(':')[1] ?? listingId;
  }

  if (args.platform === 'blocket') {
    try {
      const result = await blocket.getAd(listingId, args.ad_type ?? 'RECOMMERCE');
      if (!result) {
        return error(
          `Listing ${listingId} not found on Blocket. ` +
          `Make sure you're using the correct ad_type (${args.ad_type ?? 'RECOMMERCE'}). ` +
          `If you got this ID from search results, try matching the ad_type to the listing type.`
        );
      }
      return success(result);
    } catch (err) {
      return handleRateLimitError('Blocket', err);
    }
  } else if (args.platform === 'tradera') {
    try {
      const itemId = parseInt(listingId, 10);
      if (isNaN(itemId)) {
        return error('Invalid Tradera listing ID (must be a number)', {
          provided: args.listing_id,
          parsed: listingId,
        });
      }
      const result = await tradera.getItem(itemId);
      if (!result) {
        return error(`Listing ${listingId} not found on Tradera (or budget exhausted)`);
      }
      return success({
        ...result,
        api_budget: tradera.getBudget(),
      });
    } catch (err) {
      return handleRateLimitError('Tradera', err);
    }
  }

  return error('Invalid platform. Use "blocket" or "tradera"');
}

// ============================================
// AUCTION MONITORING TOOLS
// ============================================

interface AuctionStatus {
  itemId: number;
  title: string;
  currentBid: number;
  nextBid: number;
  bidCount: number;
  endDate: string;
  timeRemaining: {
    hours: number;
    minutes: number;
    seconds: number;
    isEnded: boolean;
    urgency: 'critical' | 'high' | 'medium' | 'low' | 'ended';
  };
  seller: {
    alias: string;
    rating?: number;
  };
  recommendedRefreshInterval: number; // in seconds
}

export async function handleWatchAuction(args: {
  item_ids: number[];
}): Promise<ToolResult> {
  await ensureInitialized();

  if (!args.item_ids || args.item_ids.length === 0) {
    return error('No item IDs provided');
  }

  if (args.item_ids.length > 5) {
    return error('Maximum 5 items per watch request');
  }

  // Check budget
  const budget = tradera.getBudget();
  if (budget.remaining < args.item_ids.length) {
    return error(
      `Insufficient API budget. Need ${args.item_ids.length} calls but only ${budget.remaining} remaining.`,
      { budget }
    );
  }

  const now = new Date();
  const statuses: AuctionStatus[] = [];

  // Fetch all items in parallel
  const itemPromises = args.item_ids.map(async (itemId): Promise<AuctionStatus | null> => {
    try {
      const item = await tradera.getItem(itemId);
      if (!item) return null;

      // Calculate time remaining
      const endDate = new Date(item.endDate);
      const diffMs = endDate.getTime() - now.getTime();
      const isEnded = diffMs <= 0;

      const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
      const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));

      // Determine urgency level
      let urgency: AuctionStatus['timeRemaining']['urgency'];
      if (isEnded) {
        urgency = 'ended';
      } else if (diffMs < 5 * 60 * 1000) { // < 5 min
        urgency = 'critical';
      } else if (diffMs < 30 * 60 * 1000) { // < 30 min
        urgency = 'high';
      } else if (diffMs < 2 * 60 * 60 * 1000) { // < 2 hours
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      // Recommend refresh interval based on urgency
      let recommendedRefreshInterval: number;
      switch (urgency) {
        case 'critical': recommendedRefreshInterval = 30; break;
        case 'high': recommendedRefreshInterval = 60; break;
        case 'medium': recommendedRefreshInterval = 300; break;
        case 'low': recommendedRefreshInterval = 900; break;
        default: recommendedRefreshInterval = 0;
      }

      return {
        itemId: item.itemId,
        title: item.shortDescription,
        currentBid: item.currentBid ?? item.startPrice ?? 0,
        nextBid: item.nextBid ?? (item.currentBid ?? item.startPrice ?? 0) + 1,
        bidCount: item.bidCount ?? 0,
        endDate: item.endDate,
        timeRemaining: {
          hours,
          minutes,
          seconds,
          isEnded,
          urgency,
        },
        seller: {
          alias: item.sellerAlias ?? 'Unknown',
          rating: item.sellerRating,
        },
        recommendedRefreshInterval,
      };
    } catch (err) {
      console.error(`Failed to fetch item ${itemId}:`, err);
      return null;
    }
  });

  const results = await Promise.all(itemPromises);

  for (const result of results) {
    if (result) {
      statuses.push(result);
    }
  }

  // Calculate overall recommended refresh interval (use the shortest)
  const minRefresh = statuses.reduce((min, s) =>
    s.recommendedRefreshInterval > 0 && s.recommendedRefreshInterval < min
      ? s.recommendedRefreshInterval
      : min,
    Infinity
  );

  return success({
    auctions: statuses,
    fetched_at: now.toISOString(),
    items_requested: args.item_ids.length,
    items_found: statuses.length,
    overall_recommended_refresh_seconds: minRefresh === Infinity ? 900 : minRefresh,
    api_budget: tradera.getBudget(),
    note: statuses.some(s => s.timeRemaining.urgency === 'critical')
      ? '⚠️ Some auctions ending soon!'
      : undefined,
  });
}

// ============================================
// BATCH TOOLS
// ============================================

interface BatchListingRequest {
  platform: Platform;
  listing_id: string;
  ad_type?: 'RECOMMERCE' | 'CAR' | 'BOAT' | 'MC';
}

interface BatchListingResult {
  platform: Platform;
  listing_id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function handleGetListingsBatch(args: {
  listings: BatchListingRequest[];
}): Promise<ToolResult> {
  await ensureInitialized();

  if (!args.listings || args.listings.length === 0) {
    return error('No listings provided');
  }

  if (args.listings.length > 20) {
    return error('Maximum 20 listings per batch request');
  }

  const startTime = Date.now();

  // Count Tradera listings to check budget
  const traderaListings = args.listings.filter(l => l.platform === 'tradera');

  // Check Tradera budget before making calls
  if (traderaListings.length > 0) {
    const budget = tradera.getBudget();
    if (budget.remaining < traderaListings.length) {
      return error(
        `Insufficient Tradera API budget. Need ${traderaListings.length} calls but only ${budget.remaining} remaining.`,
        { budget, requested: traderaListings.length }
      );
    }
  }

  // Process all listings in parallel for speed
  const allPromises = args.listings.map(async (listing): Promise<BatchListingResult> => {
    try {
      // Strip platform prefix if present
      let listingId = listing.listing_id;
      if (listingId.includes(':')) {
        listingId = listingId.split(':')[1] ?? listingId;
      }

      if (listing.platform === 'blocket') {
        const data = await blocket.getAd(listingId, listing.ad_type ?? 'RECOMMERCE');
        if (!data) {
          return {
            platform: listing.platform,
            listing_id: listing.listing_id,
            success: false,
            error: 'Listing not found',
          };
        }
        return {
          platform: listing.platform,
          listing_id: listing.listing_id,
          success: true,
          data,
        };
      } else if (listing.platform === 'tradera') {
        const itemId = parseInt(listingId, 10);
        if (isNaN(itemId)) {
          return {
            platform: listing.platform,
            listing_id: listing.listing_id,
            success: false,
            error: 'Invalid Tradera listing ID (must be a number)',
          };
        }
        const data = await tradera.getItem(itemId);
        if (!data) {
          return {
            platform: listing.platform,
            listing_id: listing.listing_id,
            success: false,
            error: 'Listing not found',
          };
        }
        return {
          platform: listing.platform,
          listing_id: listing.listing_id,
          success: true,
          data,
        };
      } else {
        return {
          platform: listing.platform,
          listing_id: listing.listing_id,
          success: false,
          error: 'Invalid platform',
        };
      }
    } catch (err) {
      return {
        platform: listing.platform,
        listing_id: listing.listing_id,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });

  const batchResults = await Promise.all(allPromises);

  return success({
    results: batchResults,
    summary: {
      total: args.listings.length,
      successful: batchResults.filter(r => r.success).length,
      failed: batchResults.filter(r => !r.success).length,
      processing_time_ms: Date.now() - startTime,
    },
    tradera_budget: tradera.getBudget(),
  });
}

// ============================================
// COMPARISON TOOLS
// ============================================

export async function handleComparePrices(args: {
  query: string;
  category?: string;
}): Promise<ToolResult> {
  await ensureInitialized();

  const comparison: PriceComparison = {
    query: args.query,
    results: {
      blocket: null,
      tradera: null,
    },
  };

  let blocketCount = 0;
  let traderaCount = 0;
  const allPricesArray: number[] = [];

  // Get Blocket prices
  try {
    const blocketResult = await blocket.search({
      query: args.query,
      category: args.category as BlocketCategory | undefined,
    });
    const prices = blocketResult.results
      .map((item) => item.price)
      .filter((p): p is number => p !== undefined && p > 0);

    if (prices.length > 0) {
      comparison.results.blocket = calculatePriceStats(prices);
      blocketCount = prices.length;
      allPricesArray.push(...prices);
    }
  } catch (err) {
    console.error('Blocket price fetch error:', err);
  }

  // Get Tradera prices (only if we have budget)
  if (tradera.canMakeApiCall()) {
    try {
      const traderaResult = await tradera.search({ query: args.query });
      const prices = traderaResult.items
        .map((item) => item.buyItNowPrice ?? item.currentBid ?? item.startPrice ?? 0)
        .filter((p) => p > 0);

      if (prices.length > 0) {
        comparison.results.tradera = calculatePriceStats(prices);
        traderaCount = prices.length;
        allPricesArray.push(...prices);
      }
    } catch (err) {
      console.error('Tradera price fetch error:', err);
    }
  }

  // Find cheapest overall
  const allPrices: { price: number; platform: Platform }[] = [];

  if (comparison.results.blocket) {
    allPrices.push({ price: comparison.results.blocket.minPrice, platform: 'blocket' });
  }
  if (comparison.results.tradera) {
    allPrices.push({ price: comparison.results.tradera.minPrice, platform: 'tradera' });
  }

  if (allPrices.length > 0) {
    const cheapest = allPrices.reduce((a, b) => (a.price < b.price ? a : b));
    comparison.recommendation = `Lowest price found on ${cheapest.platform}: ${cheapest.price} SEK`;
  }

  // Calculate combined price analysis for convenience
  const totalListings = blocketCount + traderaCount;
  let priceAnalysis = null;
  if (allPricesArray.length > 0) {
    const sorted = [...allPricesArray].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mid = Math.floor(sorted.length / 2);
    priceAnalysis = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: Math.round(sum / sorted.length),
      median: sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2),
    };
  }

  return success({
    ...comparison,
    total_listings: totalListings,
    price_analysis: priceAnalysis,
    tradera_budget: tradera.getBudget(),
  });
}

// ============================================
// REFERENCE TOOLS
// ============================================

export async function handleGetCategories(args: {
  platform?: 'blocket' | 'tradera' | 'both';
}): Promise<ToolResult> {
  await ensureInitialized();

  const platform = args.platform ?? 'both';
  const result: Record<string, unknown> = {};

  if (platform === 'blocket' || platform === 'both') {
    result.blocket = blocket.getCategories();
  }

  if (platform === 'tradera' || platform === 'both') {
    try {
      const categories = await tradera.getCategories();
      result.tradera = categories;
      result.tradera_budget = tradera.getBudget();
    } catch (err) {
      result.tradera_error = err instanceof Error ? err.message : 'Failed to get Tradera categories';
    }
  }

  return success(result);
}

export async function handleGetRegions(args: {
  platform?: 'blocket' | 'tradera' | 'both';
}): Promise<ToolResult> {
  await ensureInitialized();

  const platform = args.platform ?? 'both';
  const result: Record<string, unknown> = {};

  if (platform === 'blocket' || platform === 'both') {
    result.blocket = blocket.getLocations();
  }

  if (platform === 'tradera' || platform === 'both') {
    try {
      const counties = await tradera.getCounties();
      result.tradera = counties;
      result.tradera_budget = tradera.getBudget();
    } catch (err) {
      result.tradera_error = err instanceof Error ? err.message : 'Failed to get Tradera counties';
    }
  }

  return success(result);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapSortOrder(sort?: string): string | undefined {
  if (!sort) return undefined;
  const mapping: Record<string, string> = {
    relevance: 'RELEVANCE',
    price_asc: 'PRICE_ASC',
    price_desc: 'PRICE_DESC',
    date_desc: 'PUBLISHED_DESC',
  };
  return mapping[sort];
}

function mapTraderaSort(sort?: string): TraderaOrderBy | undefined {
  if (!sort) return undefined;
  const mapping: Record<string, TraderaOrderBy> = {
    relevance: 'Relevance',
    price_asc: 'PriceAscending',
    price_desc: 'PriceDescending',
    date_desc: 'EndDateDescending',
  };
  return mapping[sort];
}

function sortResults(
  results: UnifiedListing[],
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'date_desc'
): UnifiedListing[] {
  const sorted = [...results];

  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => a.price.amount - b.price.amount);
    case 'price_desc':
      return sorted.sort((a, b) => b.price.amount - a.price.amount);
    case 'date_desc':
      return sorted.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    default:
      return sorted;
  }
}

function calculatePriceStats(prices: number[]): PriceStats {
  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);

  return {
    count: sorted.length,
    minPrice: sorted[0],
    maxPrice: sorted[sorted.length - 1],
    avgPrice: Math.round(sum / sorted.length),
    medianPrice:
      sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2),
  };
}

// ============================================
// TOOL ROUTER
// ============================================

/**
 * Route tool call to appropriate handler
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'marketplace_search':
      return handleMarketplaceSearch(args as Parameters<typeof handleMarketplaceSearch>[0]);
    case 'blocket_search':
      return handleBlocketSearch(args as Parameters<typeof handleBlocketSearch>[0]);
    case 'blocket_search_cars':
      return handleBlocketSearchCars(args as Parameters<typeof handleBlocketSearchCars>[0]);
    case 'blocket_search_boats':
      return handleBlocketSearchBoats(args as Parameters<typeof handleBlocketSearchBoats>[0]);
    case 'blocket_search_mc':
      return handleBlocketSearchMc(args as Parameters<typeof handleBlocketSearchMc>[0]);
    case 'tradera_search':
      return handleTraderaSearch(args as Parameters<typeof handleTraderaSearch>[0]);
    case 'get_listing_details':
      return handleGetListingDetails(args as Parameters<typeof handleGetListingDetails>[0]);
    case 'watch_auction':
      return handleWatchAuction(args as Parameters<typeof handleWatchAuction>[0]);
    case 'get_listings_batch':
      return handleGetListingsBatch(args as Parameters<typeof handleGetListingsBatch>[0]);
    case 'compare_prices':
      return handleComparePrices(args as Parameters<typeof handleComparePrices>[0]);
    case 'get_categories':
      return handleGetCategories(args as Parameters<typeof handleGetCategories>[0]);
    case 'get_regions':
      return handleGetRegions(args as Parameters<typeof handleGetRegions>[0]);
    default:
      return error(`Unknown tool: ${name}`);
  }
}
