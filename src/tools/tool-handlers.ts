/**
 * MCP Tool Handlers
 * Implementation logic for all 10 tools
 */

import { getBlocketClient } from '../clients/blocket-client.js';
import { getTraderaClient } from '../clients/tradera-client.js';
import { getRegionForMunicipality, matchesMunicipality } from '../utils/municipalities.js';
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
function error(message: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
    isError: true,
  };
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
  const metadata: Record<string, unknown> = {
    query: args.query,
    platforms,
    cached: { blocket: false, tradera: false },
  };

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

    let results = result.results;

    // Post-filter by municipality if specified
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
      rate_limit: blocket.getRateLimitStats(),
    };

    if (args.municipality) {
      const beforeFilter = results.length;
      results = results.filter(listing =>
        matchesMunicipality(listing.location, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - results.length;
    }

    return success({
      results,
      ...metadata,
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Blocket search failed');
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

    let results = result.results;
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = results.length;
      results = results.filter(listing =>
        matchesMunicipality(listing.location, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - results.length;
    }

    return success({
      results,
      ...metadata,
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Car search failed');
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

    let results = result.results;
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = results.length;
      results = results.filter(listing =>
        matchesMunicipality(listing.location, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - results.length;
    }

    return success({
      results,
      ...metadata,
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Boat search failed');
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

    let results = result.results;
    const metadata: Record<string, unknown> = {
      pagination: result.pagination,
      cached: result.cached,
    };

    // Post-filter by municipality if specified
    if (args.municipality) {
      const beforeFilter = results.length;
      results = results.filter(listing =>
        matchesMunicipality(listing.location, args.municipality!)
      );
      metadata.municipality_filter = args.municipality;
      metadata.filtered_out = beforeFilter - results.length;
    }

    return success({
      results,
      ...metadata,
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'MC search failed');
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

    return success({
      results: result.items,
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
    return error(err instanceof Error ? err.message : 'Tradera search failed');
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

  if (args.platform === 'blocket') {
    try {
      const result = await blocket.getAd(args.listing_id, args.ad_type ?? 'RECOMMERCE');
      if (!result) {
        return error(
          `Listing ${args.listing_id} not found on Blocket. ` +
          `Make sure you're using the correct ad_type (${args.ad_type ?? 'RECOMMERCE'}). ` +
          `If you got this ID from search results, try matching the ad_type to the listing type.`
        );
      }
      return success(result);
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to get Blocket listing');
    }
  } else if (args.platform === 'tradera') {
    try {
      const itemId = parseInt(args.listing_id, 10);
      if (isNaN(itemId)) {
        return error('Invalid Tradera listing ID (must be a number)');
      }
      const result = await tradera.getItem(itemId);
      if (!result) {
        return error(`Listing ${args.listing_id} not found on Tradera (or budget exhausted)`);
      }
      return success({
        ...result,
        api_budget: tradera.getBudget(),
      });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to get Tradera listing');
    }
  }

  return error('Invalid platform. Use "blocket" or "tradera"');
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

  return success({
    ...comparison,
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
