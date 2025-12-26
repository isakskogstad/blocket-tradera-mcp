/**
 * Fuzzy Search Utility
 * Handles typos and Swedish character variations in search queries
 */

/**
 * Swedish character mappings for normalization
 */
const SWEDISH_CHAR_MAP: Record<string, string> = {
  'å': 'a',
  'ä': 'a',
  'ö': 'o',
  'Å': 'A',
  'Ä': 'A',
  'Ö': 'O',
  // Common typo replacements
  'aa': 'å',
  'ae': 'ä',
  'oe': 'ö',
};

/**
 * Common Swedish search term corrections
 * Maps common misspellings to correct terms
 */
const COMMON_CORRECTIONS: Record<string, string[]> = {
  // Electronics
  'iphone': ['ifone', 'iphne', 'iphon', 'iohone', 'ipohne'],
  'samsung': ['samsng', 'smasung', 'samung', 'samsong'],
  'laptop': ['laptpp', 'laptopp', 'laptob', 'labtop'],
  'dator': ['dattor', 'daor', 'datro'],
  'telefon': ['telefn', 'tlefon', 'telfon'],
  'tv': ['teve', 'tivi'],
  'playstation': ['playstaton', 'playstaion', 'playsation', 'ps5', 'ps4'],
  'xbox': ['xbxo', 'xobx'],

  // Vehicles
  'volvo': ['vovlo', 'voolvo', 'vlovo'],
  'mercedes': ['merceds', 'merceeds', 'mercedez'],
  'volkswagen': ['folksvagen', 'vw', 'volkswagn', 'wolkswagen'],
  'cykel': ['cykkel', 'cyckle', 'cykl', 'ccykel'],
  'motorcykel': ['motorcykkel', 'motocykel', 'mc'],

  // Furniture
  'soffa': ['sofa', 'sofan', 'soffan', 'sooffa'],
  'stol': ['stool', 'stl'],
  'bord': ['bordet', 'brd'],
  'säng': ['sang', 'seng', 'sång'],
  'byrå': ['byra', 'byrån', 'bira'],
  'garderob': ['garderb', 'garderoob', 'gardrob'],
  'bokhylla': ['bokhyla', 'bokhyllan', 'bkhylla'],

  // Sports & Hobbies
  'gitarr': ['gitar', 'gitrr', 'gittar'],
  'piano': ['pinao', 'pino'],
  'kamera': ['kamra', 'camera', 'kamrea'],
  'skidor': ['skidro', 'sidor', 'skidr'],
  'snowboard': ['snowbord', 'snåbord', 'snöbord'],

  // Clothing
  'jacka': ['jakcka', 'jackan', 'jakca'],
  'byxor': ['bxyxor', 'byxr', 'byxorna'],
  'skor': ['skorna', 'skro', 'skor'],
  'väska': ['vaska', 'veska', 'väskan'],

  // Animals
  'hund': ['hundar', 'hundvalp', 'hnd'],
  'katt': ['katten', 'kat', 'katter'],
  'akvarium': ['akvariu', 'aquarium', 'akvarie'],

  // Home & Garden
  'grill': ['grrill', 'gril', 'griill'],
  'trädgård': ['tradgard', 'tradgård', 'trädgard'],
  'verktyg': ['vertyg', 'verktygs', 'verktg'],
  'dammsugare': ['dammsugar', 'damsugar', 'damsugare'],
};

/**
 * Build a reverse lookup map for corrections
 */
const CORRECTION_LOOKUP: Map<string, string> = new Map();
for (const [correct, misspellings] of Object.entries(COMMON_CORRECTIONS)) {
  for (const misspelling of misspellings) {
    CORRECTION_LOOKUP.set(misspelling.toLowerCase(), correct);
  }
}

/**
 * Normalize a string for comparison
 * - Converts to lowercase
 * - Normalizes Swedish characters
 * - Removes extra whitespace
 */
export function normalizeString(str: string): string {
  let normalized = str.toLowerCase().trim();

  // Replace Swedish characters with ASCII equivalents
  for (const [swedish, ascii] of Object.entries(SWEDISH_CHAR_MAP)) {
    normalized = normalized.replace(new RegExp(swedish, 'g'), ascii);
  }

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0 to 1, where 1 is exact match)
 */
export function stringSimilarity(a: string, b: string): number {
  const normalA = normalizeString(a);
  const normalB = normalizeString(b);

  if (normalA === normalB) return 1;

  const maxLength = Math.max(normalA.length, normalB.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(normalA, normalB);
  return 1 - distance / maxLength;
}

/**
 * Suggest corrections for a search query
 * Returns the corrected query and suggestions
 */
export function suggestCorrections(query: string): {
  correctedQuery: string;
  suggestions: string[];
  wasModified: boolean;
} {
  const words = query.toLowerCase().split(/\s+/);
  const correctedWords: string[] = [];
  const suggestions: string[] = [];
  let wasModified = false;

  for (const word of words) {
    // Check if we have a direct correction
    const correction = CORRECTION_LOOKUP.get(word);
    if (correction) {
      correctedWords.push(correction);
      suggestions.push(`"${word}" → "${correction}"`);
      wasModified = true;
      continue;
    }

    // Check for close matches using Levenshtein distance
    let bestMatch: { word: string; distance: number } | null = null;
    for (const correct of Object.keys(COMMON_CORRECTIONS)) {
      // Check against the correct word
      const distance = levenshteinDistance(word, correct);
      if (distance <= 2 && distance > 0) { // Allow up to 2 edits
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { word: correct, distance };
        }
      }
    }

    if (bestMatch) {
      correctedWords.push(bestMatch.word);
      suggestions.push(`"${word}" → "${bestMatch.word}" (fuzzy match)`);
      wasModified = true;
    } else {
      correctedWords.push(word);
    }
  }

  return {
    correctedQuery: correctedWords.join(' '),
    suggestions,
    wasModified,
  };
}

/**
 * Generate alternative search queries for better results
 * Handles Swedish character variations
 */
export function generateQueryVariants(query: string): string[] {
  const variants: Set<string> = new Set([query]);
  const lowerQuery = query.toLowerCase();

  // Add version with Swedish characters replaced
  let withAscii = lowerQuery;
  withAscii = withAscii.replace(/å/g, 'a');
  withAscii = withAscii.replace(/ä/g, 'a');
  withAscii = withAscii.replace(/ö/g, 'o');
  if (withAscii !== lowerQuery) {
    variants.add(withAscii);
  }

  // Add version with ASCII digraphs replaced with Swedish characters
  let withSwedish = lowerQuery;
  withSwedish = withSwedish.replace(/aa/g, 'å');
  withSwedish = withSwedish.replace(/ae/g, 'ä');
  withSwedish = withSwedish.replace(/oe/g, 'ö');
  if (withSwedish !== lowerQuery) {
    variants.add(withSwedish);
  }

  // Check for known corrections
  const { correctedQuery, wasModified } = suggestCorrections(query);
  if (wasModified) {
    variants.add(correctedQuery);
  }

  return Array.from(variants);
}

/**
 * Score how well a listing title matches a search query
 * Returns a score from 0 to 1
 */
export function scoreMatch(query: string, title: string): number {
  const normalQuery = normalizeString(query);
  const normalTitle = normalizeString(title);

  // Exact match
  if (normalTitle.includes(normalQuery)) {
    return 1;
  }

  // Check word-by-word matching
  const queryWords = normalQuery.split(' ');
  const titleWords = normalTitle.split(' ');

  let matchedWords = 0;
  for (const qWord of queryWords) {
    for (const tWord of titleWords) {
      if (tWord.includes(qWord) || stringSimilarity(qWord, tWord) > 0.8) {
        matchedWords++;
        break;
      }
    }
  }

  return matchedWords / queryWords.length;
}
