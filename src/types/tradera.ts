/**
 * Tradera API Types
 * Based on https://api.tradera.com/v3/
 * SOAP API with strict rate limiting (100 calls/24h)
 */

// ============================================
// AUTH TYPES
// ============================================

export interface TraderaAuth {
  appId: number;
  appKey: string;
}

export interface TraderaToken {
  userId: number;
  token: string;
  expirationDate: Date;
}

// ============================================
// API BUDGET TYPES
// ============================================

export interface TraderaApiBudget {
  dailyLimit: number;
  used: number;
  resetTime: Date;
  remaining: number;
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface TraderaCategory {
  categoryId: number;
  categoryName: string;
  parentId?: number;
  hasChildren: boolean;
  childCategories?: TraderaCategory[];
  itemCount?: number;
}

// ============================================
// COUNTY/REGION TYPES
// ============================================

export interface TraderaCounty {
  countyId: number;
  countyName: string;
}

// ============================================
// ITEM TYPES
// ============================================

export interface TraderaItem {
  itemId: number;
  shortDescription: string;
  longDescription?: string;
  categoryId: number;
  categoryName?: string;
  sellerId: number;
  sellerAlias?: string;
  startPrice?: number;
  reservePrice?: number;
  buyItNowPrice?: number;
  currentBid?: number;
  bidCount: number;
  startDate: string;
  endDate: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  itemType: TraderaItemType;
  paymentTypes?: string[];
  shippingOptions?: TraderaShippingOption[];
  itemUrl?: string;
  condition?: 'new' | 'used' | 'refurbished';
}

export type TraderaItemType = 'Auction' | 'BuyItNow' | 'ShopItem';

export interface TraderaShippingOption {
  shippingId: number;
  shippingName: string;
  cost: number;
}

// ============================================
// SEARCH TYPES
// ============================================

export interface TraderaSearchParams {
  query: string;
  categoryId?: number;
  countyId?: number;
  orderBy?: TraderaOrderBy;
  pageNumber?: number;
  itemsPerPage?: number;
  onlyBuyItNow?: boolean;
  onlyAuctions?: boolean;
}

export type TraderaOrderBy =
  | 'Relevance'
  | 'PriceAscending'
  | 'PriceDescending'
  | 'EndDateAscending'
  | 'EndDateDescending'
  | 'BidsAscending'
  | 'BidsDescending';

export interface TraderaSearchResult {
  items: TraderaItem[];
  totalCount: number;
  pageNumber: number;
  itemsPerPage: number;
  totalPages: number;
  cached?: boolean;
  cache_age_seconds?: number;
}

// ============================================
// USER/SELLER TYPES
// ============================================

export interface TraderaUser {
  userId: number;
  alias: string;
  memberSince?: string;
  totalPositive?: number;
  totalNegative?: number;
  totalNeutral?: number;
  feedbackPercentage?: number;
}

export interface TraderaFeedbackSummary {
  userId: number;
  totalPositive: number;
  totalNegative: number;
  totalNeutral: number;
  feedbackPercentage: number;
  recentFeedback?: TraderaFeedback[];
}

export interface TraderaFeedback {
  feedbackId: number;
  rating: 'Positive' | 'Negative' | 'Neutral';
  comment?: string;
  date: string;
  fromUserId: number;
  fromUserAlias?: string;
}

// ============================================
// SOAP REQUEST/RESPONSE TYPES
// ============================================

export interface TraderaSoapRequest {
  AuthenticationHeader: {
    AppId: number;
    AppKey: string;
  };
}

export interface TraderaSoapResponse<T> {
  result: T;
  error?: TraderaSoapError;
}

export interface TraderaSoapError {
  code: string;
  message: string;
}

// ============================================
// OFFICIAL TIME RESPONSE
// ============================================

export interface TraderaOfficialTime {
  time: Date;
}
