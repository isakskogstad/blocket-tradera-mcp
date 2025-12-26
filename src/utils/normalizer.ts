/**
 * Data Normalizer Utility
 * Converts platform-specific listings to unified format
 */

import type {
  BlocketListing,
  BlocketAdDetails,
  BlocketLocation,
} from '../types/blocket.js';
import type { TraderaItem } from '../types/tradera.js';
import type { UnifiedListing } from '../types/unified.js';

/**
 * Generate thumbnail URLs from a source image URL
 * Uses CDN parameters where supported, otherwise returns the original
 */
function generateThumbnails(images: string[]): UnifiedListing['thumbnails'] {
  if (!images || images.length === 0) return undefined;

  const firstImage = images[0];
  if (!firstImage) return undefined;

  // Blocket images: images.blocket.se supports resizing via path
  // Format: /original/hash.jpg -> /100x100/hash.jpg
  if (firstImage.includes('images.blocket.se')) {
    return {
      small: firstImage.replace('/original/', '/100x100/').replace('/large/', '/100x100/'),
      medium: firstImage.replace('/original/', '/300x300/').replace('/large/', '/300x300/'),
      large: firstImage.replace('/original/', '/600x600/').replace('/large/', '/600x600/'),
    };
  }

  // Tradera images: img.tradera.net supports resizing via query params
  // Format: /images/xxx.jpg -> /images/xxx.jpg?width=100
  if (firstImage.includes('tradera.net') || firstImage.includes('tradera.com')) {
    const baseUrl = firstImage.split('?')[0];
    return {
      small: `${baseUrl}?width=100&height=100&fit=crop`,
      medium: `${baseUrl}?width=300&height=300&fit=crop`,
      large: `${baseUrl}?width=600&height=600&fit=crop`,
    };
  }

  // Fallback: use the first image as-is for all sizes
  return {
    small: firstImage,
    medium: firstImage,
    large: firstImage,
  };
}

/**
 * Normalize a Blocket listing to unified format
 */
export function normalizeBlocketListing(
  listing: BlocketListing | BlocketAdDetails,
  adType?: string
): UnifiedListing {
  const id = `blocket:${listing.id}`;
  const price = parseBlocketPrice(listing.price_formatted ?? listing.price?.toString());
  const images = listing.images ?? [];

  return {
    id,
    platform: 'blocket',
    platformListingId: listing.id,
    title: listing.subject,
    description: 'body' in listing ? listing.body : undefined,
    price: {
      amount: price,
      currency: 'SEK',
      type: 'fixed',
    },
    images,
    thumbnails: generateThumbnails(images),
    location: {
      region: listing.region ?? listing.location ?? 'Unknown',
      city: listing.location,
    },
    seller: {
      id: listing.seller?.id,
      name: listing.seller?.name,
      type: listing.seller?.type,
    },
    category: {
      id: listing.category ?? adType ?? 'unknown',
      name: listing.category ?? adType ?? 'Unknown',
    },
    condition: 'used', // Default for second-hand marketplace
    publishedAt: listing.published ?? new Date().toISOString(),
    url: listing.url ?? `https://www.blocket.se/annons/${listing.id}`,
    platformSpecific: listing.vehicle
      ? {
          mileage: listing.vehicle.mileage,
          year: listing.vehicle.year,
          transmission: listing.vehicle.transmission,
          fuelType: listing.vehicle.fuel_type,
          color: listing.vehicle.color,
          make: listing.vehicle.make,
          model: listing.vehicle.model,
        }
      : undefined,
  };
}

/**
 * Map Swedish condition text to condition enum
 */
function mapCondition(text?: string): 'new' | 'used' | 'refurbished' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('ny') || lower.includes('oanvänd')) return 'new';
  if (lower.includes('renoverad') || lower.includes('refurb')) return 'refurbished';
  return 'used';
}

/**
 * Normalize a Tradera item to unified format
 */
export function normalizeTraderaItem(item: TraderaItem): UnifiedListing {
  const id = `tradera:${item.itemId}`;

  // Determine price type based on item type
  let priceType: UnifiedListing['price']['type'];
  let priceAmount: number;

  if (item.itemType === 'ShopItem' || item.itemType === 'BuyItNow') {
    priceType = 'fixed';
    priceAmount = item.buyItNowPrice ?? item.currentBid ?? item.startPrice ?? 0;
  } else {
    priceType = item.currentBid ? 'auction' : 'starting_bid';
    priceAmount = item.currentBid ?? item.startPrice ?? 0;
  }

  // Map condition from attributes if available
  const conditionFromAttributes = mapCondition(item.attributes?.condition);
  const finalCondition = conditionFromAttributes ?? item.condition ?? 'used';

  // Collect images from various sources
  const images = item.imageUrls ?? (item.thumbnailUrl ? [item.thumbnailUrl] : []);

  return {
    id,
    platform: 'tradera',
    platformListingId: String(item.itemId),
    title: item.shortDescription,
    description: item.longDescription,
    price: {
      amount: priceAmount,
      currency: 'SEK',
      type: priceType,
      currentBid: item.currentBid,
      buyNowPrice: item.buyItNowPrice,
    },
    images,
    thumbnails: generateThumbnails(images),
    location: {
      region: 'Sweden', // Tradera doesn't always provide location
      city: item.sellerCity,
    },
    seller: {
      id: String(item.sellerId),
      name: item.sellerAlias,
      rating: item.sellerRating ?? item.sellerTotalRating,
      city: item.sellerCity,
    },
    category: {
      id: String(item.categoryId),
      name: item.categoryName ?? 'Unknown',
    },
    condition: finalCondition,
    publishedAt: item.startDate,
    expiresAt: item.endDate,
    url: item.itemUrl ?? `https://www.tradera.com/item/${item.itemId}`,
    platformSpecific: {
      bidCount: item.bidCount,
      nextBid: item.nextBid,
      brand: item.attributes?.brand,
      model: item.attributes?.model,
      storage: item.attributes?.storage,
      conditionText: item.attributes?.condition || item.conditionText,
      shippingOptions: item.shippingOptions?.map(opt => ({
        name: opt.name || opt.shippingName || 'Shipping',
        cost: opt.cost ?? 0,
        provider: opt.provider,
      })),
    },
  };
}

/**
 * Parse Blocket price string to number
 */
function parseBlocketPrice(priceStr?: string): number {
  if (!priceStr) return 0;

  // Remove currency symbols, spaces, and convert to number
  const cleaned = priceStr
    .replace(/[^0-9]/g, '');

  return parseInt(cleaned, 10) || 0;
}

/**
 * Map Blocket location to display name
 */
export function mapBlocketLocation(location: BlocketLocation): string {
  const locationMap: Record<BlocketLocation, string> = {
    STOCKHOLM: 'Stockholm',
    UPPSALA: 'Uppsala',
    SODERMANLAND: 'Södermanland',
    OSTERGOTLAND: 'Östergötland',
    JONKOPING: 'Jönköping',
    KRONOBERG: 'Kronoberg',
    KALMAR: 'Kalmar',
    BLEKINGE: 'Blekinge',
    SKANE: 'Skåne',
    HALLAND: 'Halland',
    VASTRA_GOTALAND: 'Västra Götaland',
    VARMLAND: 'Värmland',
    OREBRO: 'Örebro',
    VASTMANLAND: 'Västmanland',
    DALARNA: 'Dalarna',
    GAVLEBORG: 'Gävleborg',
    VASTERNORRLAND: 'Västernorrland',
    JAMTLAND: 'Jämtland',
    VASTERBOTTEN: 'Västerbotten',
    NORRBOTTEN: 'Norrbotten',
    GOTLAND: 'Gotland',
  };

  return locationMap[location] ?? location;
}

/**
 * Calculate price statistics from listings
 */
export function calculatePriceStats(listings: UnifiedListing[]): {
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
} | null {
  const prices = listings
    .map((l) => l.price.amount)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return null;
  }

  const sum = prices.reduce((a, b) => a + b, 0);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 !== 0
      ? prices[mid]!
      : (prices[mid - 1]! + prices[mid]!) / 2;

  return {
    count: prices.length,
    minPrice: prices[0]!,
    maxPrice: prices[prices.length - 1]!,
    avgPrice: Math.round(sum / prices.length),
    medianPrice: Math.round(median),
  };
}
