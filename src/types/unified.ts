/**
 * Unified Types for Cross-Platform Operations
 * Common interface for both Blocket and Tradera listings
 */

// ============================================
// UNIFIED LISTING
// ============================================

export type Platform = 'blocket' | 'tradera';

export interface UnifiedListing {
  /** Unique identifier combining platform and listing ID */
  id: string;

  /** Source platform */
  platform: Platform;

  /** Original platform-specific ID */
  platformListingId: string;

  /** Listing title */
  title: string;

  /** Full description (if available) */
  description?: string;

  /** Price information */
  price: {
    amount: number;
    currency: 'SEK';
    type: 'fixed' | 'auction' | 'starting_bid' | 'buy_now';
    /** Current bid for auctions */
    currentBid?: number;
    /** Buy-it-now price for auctions */
    buyNowPrice?: number;
  };

  /** Image URLs */
  images: string[];

  /** Location information */
  location: {
    region: string;
    city?: string;
  };

  /** Seller information */
  seller: {
    id?: string;
    name?: string;
    type?: 'private' | 'dealer' | 'shop';
    rating?: number;
    feedbackPercentage?: number;
  };

  /** Category information */
  category: {
    id: string;
    name: string;
    subcategory?: string;
  };

  /** Item condition */
  condition?: 'new' | 'used' | 'refurbished' | 'unknown';

  /** Publication timestamp (ISO 8601) */
  publishedAt: string;

  /** Expiration timestamp for auctions (ISO 8601) */
  expiresAt?: string;

  /** Direct URL to the listing */
  url: string;

  /** Platform-specific additional data */
  platformSpecific?: {
    // Tradera auction info
    bidCount?: number;

    // Blocket vehicle info
    mileage?: number;
    year?: number;
    transmission?: string;
    fuelType?: string;
    color?: string;
    make?: string;
    model?: string;
  };
}

// ============================================
// UNIFIED SEARCH
// ============================================

export interface UnifiedSearchParams {
  query: string;
  category?: string;
  region?: string;
  priceMin?: number;
  priceMax?: number;
  platforms?: Platform[];
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'date_desc';
  page?: number;
  limit?: number;
}

export interface UnifiedSearchResult {
  listings: UnifiedListing[];
  totalResults: {
    blocket?: number;
    tradera?: number;
    combined: number;
  };
  pagination: {
    page: number;
    perPage: number;
    totalPages: number;
  };
  metadata: {
    searchTime: number;
    platforms: Platform[];
    cached: {
      blocket: boolean;
      tradera: boolean;
    };
  };
}

// ============================================
// PRICE COMPARISON
// ============================================

export interface PriceComparison {
  query: string;
  results: {
    blocket: PriceStats | null;
    tradera: PriceStats | null;
  };
  cheapestListing?: UnifiedListing;
  recommendation?: string;
}

export interface PriceStats {
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
}

// ============================================
// CATEGORY MAPPINGS
// ============================================

export interface UnifiedCategory {
  id: string;
  name: string;
  nameSwedish: string;
  platforms: {
    blocket?: string;
    tradera?: number;
  };
  subcategories?: UnifiedCategory[];
}

// ============================================
// REGION MAPPINGS
// ============================================

export interface UnifiedRegion {
  id: string;
  name: string;
  nameSwedish: string;
  platforms: {
    blocket?: string;
    tradera?: number;
  };
}
