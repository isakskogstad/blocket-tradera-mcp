/**
 * MCP Tool Definitions
 * All 10 buyer-focused tools for Blocket & Tradera
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * All available MCP tools for the server
 */
export const toolDefinitions: Tool[] = [
  // ============================================
  // UNIFIED SEARCH TOOLS
  // ============================================
  {
    name: 'marketplace_search',
    description:
      'Search across both Blocket and Tradera simultaneously. Returns unified results for easy comparison. ' +
      'Best for general product searches. NOTE: Region filter only applies to Blocket (Tradera does not support geographic filtering). ' +
      'Tradera has strict rate limits (100 calls/day), results may be cached.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (Swedish works best, e.g., "iPhone 14", "Soffa", "Cykel")',
        },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['blocket', 'tradera'] },
          description: 'Which platforms to search (default: both)',
        },
        region: {
          type: 'string',
          description: 'Swedish region (län) to filter by (e.g., "STOCKHOLM", "SKANE"). Only applies to Blocket.',
        },
        municipality: {
          type: 'string',
          description:
            'Swedish municipality (kommun) to filter by (e.g., "Göteborg", "Nacka", "Solna"). ' +
            'Filters results after search. Only applies to Blocket.',
        },
        price_min: {
          type: 'number',
          description: 'Minimum price in SEK',
        },
        price_max: {
          type: 'number',
          description: 'Maximum price in SEK',
        },
        sort_by: {
          type: 'string',
          enum: ['relevance', 'price_asc', 'price_desc', 'date_desc'],
          description: 'Sort order (default: relevance)',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
        },
      },
      required: ['query'],
    },
  },

  // ============================================
  // BLOCKET TOOLS
  // ============================================
  {
    name: 'blocket_search',
    description:
      'Search Blocket for general items (electronics, furniture, etc.). ' +
      'Higher rate limit than Tradera. Good for everyday items. ' +
      'NOTE: "locations" filters by region (län), not city. Use "municipality" for city-level filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term',
        },
        category: {
          type: 'string',
          enum: [
            'AFFARSVERKSAMHET',
            'DJUR_OCH_TILLBEHOR',
            'ELEKTRONIK_OCH_VITVAROR',
            'FORDONSTILLBEHOR',
            'FRITID_HOBBY_OCH_UNDERHALLNING',
            'FORALDRAR_OCH_BARN',
            'KLADER_KOSMETIKA_OCH_ACCESSOARER',
            'KONST_OCH_ANTIKT',
            'MOBLER_OCH_INREDNING',
            'SPORT_OCH_FRITID',
            'TRADGARD_OCH_RENOVERING',
          ],
          description: 'Category filter',
        },
        locations: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'STOCKHOLM',
              'UPPSALA',
              'SODERMANLAND',
              'OSTERGOTLAND',
              'JONKOPING',
              'KRONOBERG',
              'KALMAR',
              'BLEKINGE',
              'SKANE',
              'HALLAND',
              'VASTRA_GOTALAND',
              'VARMLAND',
              'OREBRO',
              'VASTMANLAND',
              'DALARNA',
              'GAVLEBORG',
              'VASTERNORRLAND',
              'JAMTLAND',
              'VASTERBOTTEN',
              'NORRBOTTEN',
              'GOTLAND',
            ],
          },
          description:
            'Region filters (län). Note: Filters by county, not city. ' +
            'For example, STOCKHOLM includes all of Stockholm County (Märsta, Kista, etc.).',
        },
        municipality: {
          type: 'string',
          description:
            'Municipality (kommun) filter for city-level filtering (e.g., "Stockholm", "Göteborg", "Nacka"). ' +
            'Filters results after search to only show items from specific municipality.',
        },
        sort_order: {
          type: 'string',
          enum: ['RELEVANCE', 'PRICE_DESC', 'PRICE_ASC', 'PUBLISHED_DESC', 'PUBLISHED_ASC'],
          description: 'Sort order',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'blocket_search_cars',
    description:
      'Search for cars on Blocket with vehicle-specific filters. ' +
      'Supports make, model, year, mileage, color, and transmission filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (optional for cars)',
        },
        models: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'AUDI',
              'BMW',
              'CHEVROLET',
              'CITROEN',
              'DACIA',
              'FIAT',
              'FORD',
              'HONDA',
              'HYUNDAI',
              'JAGUAR',
              'JEEP',
              'KIA',
              'LAND_ROVER',
              'LEXUS',
              'MAZDA',
              'MERCEDES_BENZ',
              'MINI',
              'MITSUBISHI',
              'NISSAN',
              'OPEL',
              'PEUGEOT',
              'PORSCHE',
              'RENAULT',
              'SAAB',
              'SEAT',
              'SKODA',
              'SUBARU',
              'SUZUKI',
              'TESLA',
              'TOYOTA',
              'VOLKSWAGEN',
              'VOLVO',
            ],
          },
          description: 'Car makes/brands to filter by',
        },
        price_from: {
          type: 'number',
          description: 'Minimum price in SEK',
        },
        price_to: {
          type: 'number',
          description: 'Maximum price in SEK',
        },
        year_from: {
          type: 'number',
          description: 'Minimum model year',
        },
        year_to: {
          type: 'number',
          description: 'Maximum model year',
        },
        milage_from: {
          type: 'number',
          description: 'Minimum mileage in km',
        },
        milage_to: {
          type: 'number',
          description: 'Maximum mileage in km',
        },
        colors: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'ROD',
              'BLA',
              'SVART',
              'VIT',
              'SILVER',
              'GRA',
              'GRON',
              'GUL',
              'ORANGE',
              'ROSA',
              'LILA',
              'BRONS',
              'BEIGE',
              'GULD',
              'TURKOS',
              'BRUN',
            ],
          },
          description: 'Color filters',
        },
        transmissions: {
          type: 'array',
          items: { type: 'string', enum: ['AUTOMATIC', 'MANUAL'] },
          description: 'Transmission type',
        },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Region filters (län). Filters by county, not city.',
        },
        municipality: {
          type: 'string',
          description: 'Municipality (kommun) filter for city-level filtering.',
        },
        sort_order: {
          type: 'string',
          enum: [
            'RELEVANCE',
            'PRICE_DESC',
            'PRICE_ASC',
            'MILEAGE_ASC',
            'MILEAGE_DESC',
            'MODEL',
            'YEAR_ASC',
            'YEAR_DESC',
          ],
          description: 'Sort order',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
    },
  },
  {
    name: 'blocket_search_boats',
    description: 'Search for boats on Blocket with boat-specific filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term',
        },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'SEGELBAT',
              'MOTORBAT',
              'RIB',
              'KATAMARAN',
              'JOLLE',
              'HUSBAT',
              'SPEEDBAT',
              'FIBERBAT',
              'RODDBAT',
              'KAJAK',
              'KANOT',
            ],
          },
          description: 'Boat types to filter by',
        },
        price_from: {
          type: 'number',
          description: 'Minimum price in SEK',
        },
        price_to: {
          type: 'number',
          description: 'Maximum price in SEK',
        },
        length_from: {
          type: 'number',
          description: 'Minimum length in meters',
        },
        length_to: {
          type: 'number',
          description: 'Maximum length in meters',
        },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Region filters (län). Filters by county, not city.',
        },
        municipality: {
          type: 'string',
          description: 'Municipality (kommun) filter for city-level filtering.',
        },
        sort_order: {
          type: 'string',
          enum: ['RELEVANCE', 'PRICE_DESC', 'PRICE_ASC', 'PUBLISHED_DESC', 'PUBLISHED_ASC'],
          description: 'Sort order',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
    },
  },
  {
    name: 'blocket_search_mc',
    description: 'Search for motorcycles on Blocket with MC-specific filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term',
        },
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'MC brands/models',
        },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'SPORT',
              'CRUISER',
              'TOURING',
              'NAKED',
              'ENDURO',
              'CROSS',
              'SCOOTER',
              'MOPED',
              'CLASSIC',
              'ADVENTURE',
              'SUPERSPORT',
            ],
          },
          description: 'MC types to filter by',
        },
        price_from: {
          type: 'number',
          description: 'Minimum price in SEK',
        },
        price_to: {
          type: 'number',
          description: 'Maximum price in SEK',
        },
        engine_volume_from: {
          type: 'number',
          description: 'Minimum engine volume in cc',
        },
        engine_volume_to: {
          type: 'number',
          description: 'Maximum engine volume in cc',
        },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Region filters (län). Filters by county, not city.',
        },
        municipality: {
          type: 'string',
          description: 'Municipality (kommun) filter for city-level filtering.',
        },
        sort_order: {
          type: 'string',
          enum: ['RELEVANCE', 'PRICE_DESC', 'PRICE_ASC', 'PUBLISHED_DESC', 'PUBLISHED_ASC'],
          description: 'Sort order',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
      },
    },
  },

  // ============================================
  // TRADERA TOOLS
  // ============================================
  {
    name: 'tradera_search',
    description:
      'Search Tradera auctions. IMPORTANT: Tradera has a strict limit of 100 API calls per 24 hours. ' +
      'Results are aggressively cached (30 min). Great for finding unique items and deals. ' +
      'NOTE: Tradera does NOT support geographic filtering - searches return results from all of Sweden.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term',
        },
        category_id: {
          type: 'number',
          description: 'Category ID (use get_categories to find IDs)',
        },
        order_by: {
          type: 'string',
          enum: [
            'Relevance',
            'PriceAscending',
            'PriceDescending',
            'EndDateAscending',
            'EndDateDescending',
            'BidsAscending',
            'BidsDescending',
          ],
          description: 'Sort order',
        },
        page: {
          type: 'number',
          description: 'Page number',
        },
        items_per_page: {
          type: 'number',
          description: 'Results per page (max 50)',
        },
        force_refresh: {
          type: 'boolean',
          description: 'Force fresh API call (use sparingly due to rate limits!)',
        },
      },
      required: ['query'],
    },
  },

  // ============================================
  // DETAIL TOOLS
  // ============================================
  {
    name: 'get_listing_details',
    description:
      'Get full details for a specific listing by ID. ' +
      'Specify platform (blocket/tradera) and the listing ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['blocket', 'tradera'],
          description: 'Which platform the listing is from',
        },
        listing_id: {
          type: 'string',
          description: 'The listing ID (from search results)',
        },
        ad_type: {
          type: 'string',
          enum: ['RECOMMERCE', 'CAR', 'BOAT', 'MC'],
          description: 'Blocket ad type (required for Blocket, default: RECOMMERCE)',
        },
      },
      required: ['platform', 'listing_id'],
    },
  },

  // ============================================
  // COMPARISON TOOLS
  // ============================================
  {
    name: 'compare_prices',
    description:
      'Compare prices for a search term across Blocket and Tradera. ' +
      'Returns statistics like min, max, average, and median prices for each platform.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to compare prices for',
        },
        category: {
          type: 'string',
          description: 'Category to narrow results',
        },
      },
      required: ['query'],
    },
  },

  // ============================================
  // REFERENCE TOOLS
  // ============================================
  {
    name: 'get_categories',
    description:
      'Get available categories for Blocket and/or Tradera. ' +
      'Useful for filtering searches. Tradera categories are cached for 24 hours.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['blocket', 'tradera', 'both'],
          description: 'Which platform(s) to get categories for (default: both)',
        },
      },
    },
  },
  {
    name: 'get_regions',
    description:
      'Get available Swedish regions for filtering searches. ' +
      'Blocket uses län names, Tradera uses county IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['blocket', 'tradera', 'both'],
          description: 'Which platform(s) to get regions for (default: both)',
        },
      },
    },
  },
];

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): Tool | undefined {
  return toolDefinitions.find((t) => t.name === name);
}
