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
 * Normalize a Blocket listing to unified format
 */
export function normalizeBlocketListing(
  listing: BlocketListing | BlocketAdDetails,
  adType?: string
): UnifiedListing {
  const id = `blocket:${listing.id}`;
  const price = parseBlocketPrice(listing.price_formatted ?? listing.price?.toString());

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
    images: listing.images ?? [],
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
    images: item.imageUrls ?? (item.thumbnailUrl ? [item.thumbnailUrl] : []),
    location: {
      region: 'Sweden', // Tradera doesn't always provide location
    },
    seller: {
      id: String(item.sellerId),
      name: item.sellerAlias,
    },
    category: {
      id: String(item.categoryId),
      name: item.categoryName ?? 'Unknown',
    },
    condition: item.condition ?? 'used',
    publishedAt: item.startDate,
    expiresAt: item.endDate,
    url: item.itemUrl ?? `https://www.tradera.com/item/${item.itemId}`,
    platformSpecific: {
      bidCount: item.bidCount,
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
