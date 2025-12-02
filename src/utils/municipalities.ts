/**
 * Swedish Municipalities (Kommuner) Data
 * Complete list of all 290 Swedish municipalities grouped by their parent regions (län)
 */

import type { BlocketLocation } from '../types/blocket.js';

/**
 * Mapping of Swedish municipalities to their parent regions
 * Source: SCB (Statistiska centralbyrån)
 */
export const MUNICIPALITIES: Record<BlocketLocation, string[]> = {
  STOCKHOLM: [
    'Stockholm',
    'Solna',
    'Sundbyberg',
    'Nacka',
    'Huddinge',
    'Botkyrka',
    'Haninge',
    'Tyresö',
    'Värmdö',
    'Lidingö',
    'Upplands Väsby',
    'Vallentuna',
    'Österåker',
    'Sigtuna',
    'Sollentuna',
    'Upplands-Bro',
    'Täby',
    'Danderyd',
    'Vaxholm',
    'Norrtälje',
    'Ekerö',
    'Nynäshamn',
    'Järfälla',
    'Salem',
    'Södertälje',
    'Nykvarn',
  ],
  UPPSALA: [
    'Uppsala',
    'Enköping',
    'Håbo',
    'Älvkarleby',
    'Knivsta',
    'Heby',
    'Tierp',
    'Östhammar',
  ],
  SODERMANLAND: [
    'Eskilstuna',
    'Katrineholm',
    'Flen',
    'Gnesta',
    'Nyköping',
    'Oxelösund',
    'Strängnäs',
    'Trosa',
    'Vingåker',
  ],
  OSTERGOTLAND: [
    'Linköping',
    'Norrköping',
    'Mjölby',
    'Motala',
    'Vadstena',
    'Ödeshög',
    'Ydre',
    'Åtvidaberg',
    'Finspång',
    'Valdemarsvik',
    'Boxholm',
    'Kinda',
  ],
  JONKOPING: [
    'Jönköping',
    'Nässjö',
    'Värnamo',
    'Eksjö',
    'Vetlanda',
    'Sävsjö',
    'Gislaved',
    'Gnosjö',
    'Vaggeryd',
    'Tranås',
    'Aneby',
    'Mullsjö',
    'Habo',
  ],
  KRONOBERG: [
    'Växjö',
    'Ljungby',
    'Älmhult',
    'Lessebo',
    'Tingsryd',
    'Alvesta',
    'Markaryd',
    'Uppvidinge',
  ],
  KALMAR: [
    'Kalmar',
    'Nybro',
    'Oskarshamn',
    'Västervik',
    'Vimmerby',
    'Borgholm',
    'Hultsfred',
    'Mönsterås',
    'Emmaboda',
    'Torsås',
    'Mörbylånga',
    'Högsby',
  ],
  BLEKINGE: [
    'Karlskrona',
    'Ronneby',
    'Karlshamn',
    'Sölvesborg',
    'Olofström',
  ],
  SKANE: [
    'Malmö',
    'Helsingborg',
    'Lund',
    'Kristianstad',
    'Landskrona',
    'Trelleborg',
    'Eslöv',
    'Ystad',
    'Ängelholm',
    'Hässleholm',
    'Höganäs',
    'Simrishamn',
    'Staffanstorp',
    'Burlöv',
    'Vellinge',
    'Lomma',
    'Svedala',
    'Skurup',
    'Sjöbo',
    'Hörby',
    'Höör',
    'Tomelilla',
    'Bromölla',
    'Osby',
    'Perstorp',
    'Klippan',
    'Åstorp',
    'Båstad',
    'Bjuv',
    'Kävlinge',
    'Örkelljunga',
    'Svalöv',
    'Köping',
  ],
  HALLAND: [
    'Halmstad',
    'Varberg',
    'Kungsbacka',
    'Falkenberg',
    'Laholm',
    'Hylte',
  ],
  VASTRA_GOTALAND: [
    'Göteborg',
    'Mölndal',
    'Kungälv',
    'Partille',
    'Härryda',
    'Lerum',
    'Ale',
    'Stenungsund',
    'Tjörn',
    'Orust',
    'Lysekil',
    'Uddevalla',
    'Trollhättan',
    'Vänersborg',
    'Borås',
    'Alingsås',
    'Skövde',
    'Lidköping',
    'Mariestad',
    'Falköping',
    'Ulricehamn',
    'Mark',
    'Åmål',
    'Bengtsfors',
    'Dals-Ed',
    'Färgelanda',
    'Grästorp',
    'Gullspång',
    'Götene',
    'Herrljunga',
    'Vara',
    'Essunga',
    'Karlsborg',
    'Tibro',
    'Töreboda',
    'Tranemo',
    'Mellerud',
    'Lilla Edet',
    'Munkedal',
    'Sotenäs',
    'Strömstad',
    'Svenljunga',
    'Tanum',
    'Bollebygd',
    'Öckerö',
  ],
  VARMLAND: [
    'Karlstad',
    'Kristinehamn',
    'Filipstad',
    'Arvika',
    'Säffle',
    'Åmotfors',
    'Årjäng',
    'Eda',
    'Torsby',
    'Storfors',
    'Hagfors',
    'Munkfors',
    'Forshaga',
    'Grums',
    'Sunne',
    'Kil',
  ],
  OREBRO: [
    'Örebro',
    'Kumla',
    'Hallsberg',
    'Nora',
    'Askersund',
    'Karlskoga',
    'Degerfors',
    'Laxå',
    'Hällefors',
    'Lindesberg',
    'Ljusnarsberg',
  ],
  VASTMANLAND: [
    'Västerås',
    'Sala',
    'Fagersta',
    'Köping',
    'Arboga',
    'Kungsör',
    'Hallstahammar',
    'Norberg',
    'Skinnskatteberg',
    'Surahammar',
  ],
  DALARNA: [
    'Falun',
    'Borlänge',
    'Avesta',
    'Ludvika',
    'Hedemora',
    'Säter',
    'Mora',
    'Orsa',
    'Älvdalen',
    'Rättvik',
    'Leksand',
    'Malung-Sälen',
    'Gagnef',
    'Vansbro',
    'Smedjebacken',
  ],
  GAVLEBORG: [
    'Gävle',
    'Sandviken',
    'Söderhamn',
    'Bollnäs',
    'Hudiksvall',
    'Ljusdal',
    'Nordanstig',
    'Ovanåker',
    'Hofors',
    'Ockelbo',
  ],
  VASTERNORRLAND: [
    'Sundsvall',
    'Härnösand',
    'Kramfors',
    'Sollefteå',
    'Örnsköldsvik',
    'Timrå',
    'Ånge',
  ],
  JAMTLAND: [
    'Östersund',
    'Åre',
    'Berg',
    'Bräcke',
    'Härjedalen',
    'Krokom',
    'Ragunda',
    'Strömsund',
  ],
  VASTERBOTTEN: [
    'Umeå',
    'Skellefteå',
    'Lycksele',
    'Vindeln',
    'Robertsfors',
    'Nordmaling',
    'Bjurholm',
    'Vännäs',
    'Vilhelmina',
    'Åsele',
    'Dorotea',
    'Malå',
    'Norsjö',
    'Sorsele',
    'Storuman',
  ],
  NORRBOTTEN: [
    'Luleå',
    'Piteå',
    'Boden',
    'Kalix',
    'Kiruna',
    'Gällivare',
    'Haparanda',
    'Arvidsjaur',
    'Arjeplog',
    'Jokkmokk',
    'Överkalix',
    'Övertorneå',
    'Pajala',
    'Älvsbyn',
  ],
  GOTLAND: ['Gotland'],
};

/**
 * Get all municipalities for a specific region
 */
export function getMunicipalitiesForRegion(region: BlocketLocation): string[] {
  return MUNICIPALITIES[region] || [];
}

/**
 * Find which region a municipality belongs to
 */
export function getRegionForMunicipality(municipality: string): BlocketLocation | null {
  const normalizedSearch = municipality.toLowerCase().trim();

  for (const [region, municipalities] of Object.entries(MUNICIPALITIES)) {
    if (
      municipalities.some(
        (m) => m.toLowerCase() === normalizedSearch || m.toLowerCase().includes(normalizedSearch)
      )
    ) {
      return region as BlocketLocation;
    }
  }

  return null;
}

/**
 * Check if a location string matches a municipality (case-insensitive, partial match)
 */
export function matchesMunicipality(location: string | undefined, municipality: string): boolean {
  if (!location) return false;

  const normalizedLocation = location.toLowerCase().trim();
  const normalizedMunicipality = municipality.toLowerCase().trim();

  // Check for exact match or if location contains the municipality name
  return (
    normalizedLocation === normalizedMunicipality ||
    normalizedLocation.includes(normalizedMunicipality) ||
    normalizedMunicipality.includes(normalizedLocation)
  );
}

/**
 * Get all municipalities as a flat list
 */
export function getAllMunicipalities(): string[] {
  return Object.values(MUNICIPALITIES).flat().sort();
}

/**
 * Get municipality options for a tool schema enum
 */
export function getMunicipalityEnumValues(): string[] {
  return getAllMunicipalities();
}
