/**
 * Blocket API Types
 * Based on https://blocket-api.se/swagger
 */

// ============================================
// ENUMS
// ============================================

export const BlocketLocations = [
  'STOCKHOLM', 'UPPSALA', 'SODERMANLAND', 'OSTERGOTLAND', 'JONKOPING',
  'KRONOBERG', 'KALMAR', 'BLEKINGE', 'SKANE', 'HALLAND', 'VASTRA_GOTALAND',
  'VARMLAND', 'OREBRO', 'VASTMANLAND', 'DALARNA', 'GAVLEBORG',
  'VASTERNORRLAND', 'JAMTLAND', 'VASTERBOTTEN', 'NORRBOTTEN', 'GOTLAND'
] as const;
export type BlocketLocation = typeof BlocketLocations[number];

export const BlocketCategories = [
  'AFFARSVERKSAMHET', 'DJUR_OCH_TILLBEHOR', 'ELEKTRONIK_OCH_VITVAROR',
  'FORDONSTILLBEHOR', 'FRITID_HOBBY_OCH_UNDERHALLNING', 'FORALDRAR_OCH_BARN',
  'KLADER_KOSMETIKA_OCH_ACCESSOARER', 'KONST_OCH_ANTIKT', 'MOBLER_OCH_INREDNING',
  'SPORT_OCH_FRITID', 'TRADGARD_OCH_RENOVERING'
] as const;
export type BlocketCategory = typeof BlocketCategories[number];

export const BlocketSortOrders = [
  'RELEVANCE', 'PRICE_DESC', 'PRICE_ASC', 'PUBLISHED_DESC', 'PUBLISHED_ASC'
] as const;
export type BlocketSortOrder = typeof BlocketSortOrders[number];

export const BlocketCarSortOrders = [
  ...BlocketSortOrders, 'MILEAGE_ASC', 'MILEAGE_DESC', 'MODEL', 'YEAR_ASC', 'YEAR_DESC'
] as const;
export type BlocketCarSortOrder = typeof BlocketCarSortOrders[number];

export const BlocketTransmissions = ['AUTOMATIC', 'MANUAL'] as const;
export type BlocketTransmission = typeof BlocketTransmissions[number];

export const BlocketColors = [
  'ROD', 'BLA', 'SVART', 'VIT', 'SILVER', 'GRA', 'GRON', 'GUL',
  'ORANGE', 'ROSA', 'LILA', 'BRONS', 'BEIGE', 'GULD', 'TURKOS', 'BRUN'
] as const;
export type BlocketColor = typeof BlocketColors[number];

export const BlocketAdTypes = ['RECOMMERCE', 'CAR', 'BOAT', 'MC'] as const;
export type BlocketAdType = typeof BlocketAdTypes[number];

// Car models - most popular
export const BlocketCarModels = [
  'AUDI', 'BMW', 'CHEVROLET', 'CITROEN', 'DACIA', 'FIAT', 'FORD',
  'HONDA', 'HYUNDAI', 'JAGUAR', 'JEEP', 'KIA', 'LAND_ROVER', 'LEXUS',
  'MAZDA', 'MERCEDES_BENZ', 'MINI', 'MITSUBISHI', 'NISSAN', 'OPEL',
  'PEUGEOT', 'PORSCHE', 'RENAULT', 'SAAB', 'SEAT', 'SKODA', 'SUBARU',
  'SUZUKI', 'TESLA', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO'
] as const;
export type BlocketCarModel = typeof BlocketCarModels[number];

// ============================================
// REQUEST TYPES
// ============================================

export interface BlocketSearchParams {
  query: string;
  page?: number;
  sort_order?: BlocketSortOrder;
  locations?: BlocketLocation[];
  category?: BlocketCategory;
}

export interface BlocketCarSearchParams {
  query?: string;
  page?: number;
  sort_order?: BlocketCarSortOrder;
  models?: string[];
  price_from?: number;
  price_to?: number;
  year_from?: number;
  year_to?: number;
  milage_from?: number;
  milage_to?: number;
  colors?: BlocketColor[];
  transmissions?: BlocketTransmission[];
  locations?: BlocketLocation[];
}

export interface BlocketBoatSearchParams {
  query?: string;
  page?: number;
  types?: string[];
  price_from?: number;
  price_to?: number;
  length_from?: number;
  length_to?: number;
  locations?: BlocketLocation[];
  sort_order?: BlocketSortOrder;
}

export interface BlocketMcSearchParams {
  query?: string;
  page?: number;
  models?: string[];
  types?: string[];
  price_from?: number;
  price_to?: number;
  engine_volume_from?: number;
  engine_volume_to?: number;
  locations?: BlocketLocation[];
  sort_order?: BlocketSortOrder;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface BlocketSearchResult {
  results: BlocketListing[];
  pagination: {
    page: number;
    total_pages: number;
    total_results?: number;
  };
  cached?: boolean;
  cache_age_seconds?: number;
}

export interface BlocketListing {
  id: string;
  subject: string;
  body?: string;
  price?: number;
  price_formatted?: string;
  location?: string;
  region?: string; // API returns string, may not match BlocketLocation exactly
  published?: string;
  ad_type?: string; // API returns string
  category?: string;
  images?: string[];
  url?: string;
  seller?: {
    id?: string;
    name?: string;
    type?: 'private' | 'dealer';
  };
  // Vehicle-specific fields
  vehicle?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    fuel_type?: string;
    transmission?: string;
    color?: string;
  };
}

export interface BlocketAdDetails extends BlocketListing {
  description?: string;
  created_at?: string;
  updated_at?: string;
  contact?: {
    phone?: string;
    email?: string;
  };
  attributes?: Record<string, string>;
}

export interface BlocketUser {
  id: string;
  name?: string;
  member_since?: string;
  rating?: number;
  reviews_count?: number;
  listings_count?: number;
  type: 'private' | 'dealer';
}

// ============================================
// API ERROR TYPES
// ============================================

export interface BlocketApiError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}
