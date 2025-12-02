/**
 * Comprehensive MCP Tool Testing
 * Tests all 10 tools and identifies issues/weaknesses
 */

import { handleToolCall } from './build/tools/tool-handlers.js';

const issues = [];
const testResults = [];

function addIssue(tool, severity, description, details = null) {
  issues.push({ tool, severity, description, details });
}

function logTest(tool, test, passed, details = null) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${tool}: ${test}`);
  testResults.push({ tool, test, passed, details });
  if (!passed && details) {
    console.log(`       Details: ${JSON.stringify(details).substring(0, 200)}`);
  }
}

async function parseResult(result) {
  if (result.isError) {
    return { error: true, data: JSON.parse(result.content[0].text) };
  }
  return { error: false, data: JSON.parse(result.content[0].text) };
}

// ============================================
// TEST: blocket_search
// ============================================
async function testBlocketSearch() {
  console.log('\n=== TEST: blocket_search ===');

  // Test 1: Basic search
  const basic = await parseResult(await handleToolCall('blocket_search', { query: 'soffa' }));
  logTest('blocket_search', 'Basic search works', !basic.error && basic.data.results?.length > 0);

  // Test 2: Search with region filter
  const withRegion = await parseResult(await handleToolCall('blocket_search', {
    query: 'cykel',
    locations: ['STOCKHOLM']
  }));
  logTest('blocket_search', 'Region filter works', !withRegion.error && withRegion.data.results?.length >= 0);

  // Test 3: Check if region filter actually filters (CRITICAL TEST)
  if (!withRegion.error && withRegion.data.results?.length > 0) {
    const nonStockholmResults = withRegion.data.results.filter(r => {
      const loc = (r.location || r.region || '').toLowerCase();
      return !loc.includes('stockholm') && loc !== '';
    });
    const hasLeakage = nonStockholmResults.length > 0;
    logTest('blocket_search', 'Region filter precise (no leakage)', !hasLeakage,
      hasLeakage ? { leakedLocations: nonStockholmResults.slice(0, 3).map(r => r.location || r.region) } : null);

    if (hasLeakage) {
      addIssue('blocket_search', 'HIGH',
        'Region filter shows results from outside specified region',
        { example: 'Searching STOCKHOLM shows results from other regions' });
    }
  }

  // Test 4: Municipality-level filtering NOT SUPPORTED
  addIssue('blocket_search', 'HIGH',
    'No municipality-level filtering available',
    {
      problem: 'Only supports 21 Swedish regions (län), not 290 municipalities',
      userImpact: 'User asking for "Kungälv" gets all of Västra Götaland',
      suggestion: 'Add post-filtering by municipality name in location field or add municipality parameter'
    });

  // Test 5: Empty search
  const empty = await parseResult(await handleToolCall('blocket_search', { query: 'xyznonexistent12345' }));
  logTest('blocket_search', 'Handles no results gracefully', !empty.error);

  // Test 6: Category filter
  const withCategory = await parseResult(await handleToolCall('blocket_search', {
    query: 'lampa',
    category: 'MOBLER_OCH_INREDNING'
  }));
  logTest('blocket_search', 'Category filter works', !withCategory.error);

  // Test 7: Pagination
  const page2 = await parseResult(await handleToolCall('blocket_search', { query: 'bil', page: 2 }));
  logTest('blocket_search', 'Pagination works', !page2.error && page2.data.pagination?.page === 2);
  if (!page2.error && page2.data.pagination?.page !== 2) {
    addIssue('blocket_search', 'MEDIUM', 'Pagination may not be working correctly');
  }
}

// ============================================
// TEST: blocket_search_cars
// ============================================
async function testBlocketSearchCars() {
  console.log('\n=== TEST: blocket_search_cars ===');

  // Test 1: Basic car search
  const basic = await parseResult(await handleToolCall('blocket_search_cars', {}));
  logTest('blocket_search_cars', 'Basic search works', !basic.error);

  // Test 2: Filter by make
  const volvo = await parseResult(await handleToolCall('blocket_search_cars', {
    models: ['VOLVO'],
    price_to: 100000
  }));
  logTest('blocket_search_cars', 'Make filter works', !volvo.error);

  // Test 3: Year range
  const yearFilter = await parseResult(await handleToolCall('blocket_search_cars', {
    year_from: 2020,
    year_to: 2023
  }));
  logTest('blocket_search_cars', 'Year filter works', !yearFilter.error);

  // Test 4: Check if filters actually work
  if (!volvo.error && volvo.data.results?.length > 0) {
    const nonVolvo = volvo.data.results.filter(r => {
      const make = (r.vehicle?.make || r.subject || '').toLowerCase();
      return !make.includes('volvo') && make !== '';
    });
    if (nonVolvo.length > volvo.data.results.length * 0.1) {
      addIssue('blocket_search_cars', 'MEDIUM',
        'Make filter may not be precise',
        { nonVolvoCount: nonVolvo.length, totalCount: volvo.data.results.length });
    }
  }

  // Test 5: Price filter
  const priceFilter = await parseResult(await handleToolCall('blocket_search_cars', {
    price_from: 50000,
    price_to: 100000
  }));
  logTest('blocket_search_cars', 'Price filter works', !priceFilter.error);
}

// ============================================
// TEST: blocket_search_boats
// ============================================
async function testBlocketSearchBoats() {
  console.log('\n=== TEST: blocket_search_boats ===');

  const basic = await parseResult(await handleToolCall('blocket_search_boats', { query: 'segelbåt' }));
  logTest('blocket_search_boats', 'Basic search works', !basic.error);

  const withLength = await parseResult(await handleToolCall('blocket_search_boats', {
    length_from: 5,
    length_to: 10
  }));
  logTest('blocket_search_boats', 'Length filter works', !withLength.error);

  // Check if boat types are documented
  addIssue('blocket_search_boats', 'LOW',
    'Boat types not documented in tool schema',
    { suggestion: 'Add enum for common boat types like segelbåt, motorbåt, RIB, etc.' });
}

// ============================================
// TEST: blocket_search_mc
// ============================================
async function testBlocketSearchMc() {
  console.log('\n=== TEST: blocket_search_mc ===');

  const basic = await parseResult(await handleToolCall('blocket_search_mc', { query: 'Honda' }));
  logTest('blocket_search_mc', 'Basic search works', !basic.error);

  const withEngine = await parseResult(await handleToolCall('blocket_search_mc', {
    engine_volume_from: 500,
    engine_volume_to: 1000
  }));
  logTest('blocket_search_mc', 'Engine volume filter works', !withEngine.error);

  // Check if MC types are documented
  addIssue('blocket_search_mc', 'LOW',
    'MC types and models not documented in tool schema',
    { suggestion: 'Add enums for common MC types (sport, cruiser, touring) and brands' });
}

// ============================================
// TEST: tradera_search
// ============================================
async function testTraderaSearch() {
  console.log('\n=== TEST: tradera_search ===');

  // Test 1: Basic search
  const basic = await parseResult(await handleToolCall('tradera_search', { query: 'klocka' }));
  logTest('tradera_search', 'Basic search works', !basic.error && basic.data.results?.length >= 0);

  if (basic.error) {
    addIssue('tradera_search', 'CRITICAL', 'Basic search failed', { error: basic.data });
    return;
  }

  // Test 2: Check API budget tracking
  logTest('tradera_search', 'API budget tracked', basic.data.api_budget?.remaining !== undefined);

  // Test 3: Category filter
  const withCategory = await parseResult(await handleToolCall('tradera_search', {
    query: 'iPhone',
    category_id: 302010 // Mobiltelefoner
  }));
  logTest('tradera_search', 'Category filter works', !withCategory.error);

  // Test 4: Sorting
  const sorted = await parseResult(await handleToolCall('tradera_search', {
    query: 'dator',
    order_by: 'PriceAscending'
  }));
  logTest('tradera_search', 'Sorting works', !sorted.error);

  // Test 5: NO REGION/LOCATION FILTERING
  addIssue('tradera_search', 'HIGH',
    'No region/location filtering available',
    {
      problem: 'Tradera search cannot filter by geographic location',
      apiLimitation: 'Tradera API may not support this',
      suggestion: 'Check if Tradera API supports county filtering, or add post-filtering'
    });

  // Test 6: Caching
  const cached = await parseResult(await handleToolCall('tradera_search', { query: 'klocka' }));
  logTest('tradera_search', 'Caching works', cached.data.cached === true);

  // Test 7: Force refresh
  const forced = await parseResult(await handleToolCall('tradera_search', {
    query: 'test123unique',
    force_refresh: true
  }));
  logTest('tradera_search', 'Force refresh works', !forced.error);
}

// ============================================
// TEST: marketplace_search (unified)
// ============================================
async function testMarketplaceSearch() {
  console.log('\n=== TEST: marketplace_search ===');

  // Test 1: Search both platforms
  const both = await parseResult(await handleToolCall('marketplace_search', { query: 'iPhone' }));
  logTest('marketplace_search', 'Searches both platforms', !both.error);

  if (!both.error) {
    const hasBlocket = both.data.metadata?.blocket_count > 0 || both.data.metadata?.blocket_error;
    const hasTradera = both.data.metadata?.tradera_count > 0 || both.data.metadata?.tradera_error;
    logTest('marketplace_search', 'Returns Blocket results', hasBlocket);
    logTest('marketplace_search', 'Returns Tradera results', hasTradera);
  }

  // Test 2: Platform filter
  const onlyBlocket = await parseResult(await handleToolCall('marketplace_search', {
    query: 'soffa',
    platforms: ['blocket']
  }));
  logTest('marketplace_search', 'Platform filter works', !onlyBlocket.error);

  // Test 3: Price filtering
  const priceFilter = await parseResult(await handleToolCall('marketplace_search', {
    query: 'cykel',
    price_min: 1000,
    price_max: 5000
  }));
  logTest('marketplace_search', 'Price filter works', !priceFilter.error);

  // Check if price filter actually works
  if (!priceFilter.error && priceFilter.data.results?.length > 0) {
    const outOfRange = priceFilter.data.results.filter(r => {
      const price = r.price?.amount || 0;
      return price < 1000 || price > 5000;
    });
    logTest('marketplace_search', 'Price filter precise', outOfRange.length === 0,
      outOfRange.length > 0 ? { outOfRangeCount: outOfRange.length } : null);

    if (outOfRange.length > 0) {
      addIssue('marketplace_search', 'MEDIUM',
        'Price filter not precise - results outside range returned',
        { outOfRange: outOfRange.length, total: priceFilter.data.results.length });
    }
  }

  // Test 4: Combined sorting
  const sorted = await parseResult(await handleToolCall('marketplace_search', {
    query: 'lampa',
    sort_by: 'price_asc'
  }));
  if (!sorted.error && sorted.data.results?.length > 1) {
    const prices = sorted.data.results.map(r => r.price?.amount || 0);
    const isSorted = prices.every((p, i) => i === 0 || p >= prices[i - 1]);
    logTest('marketplace_search', 'Combined sorting works', isSorted);
    if (!isSorted) {
      addIssue('marketplace_search', 'MEDIUM', 'Combined sorting not working correctly');
    }
  }

  // Test 5: Region limitation
  addIssue('marketplace_search', 'MEDIUM',
    'Region parameter only works for Blocket, ignored for Tradera',
    { suggestion: 'Document this limitation or implement Tradera county filtering' });
}

// ============================================
// TEST: get_listing_details
// ============================================
async function testGetListingDetails() {
  console.log('\n=== TEST: get_listing_details ===');

  // First get a real listing ID from search
  const searchResult = await parseResult(await handleToolCall('blocket_search', { query: 'soffa' }));

  if (!searchResult.error && searchResult.data.results?.length > 0) {
    const listingId = searchResult.data.results[0].id;

    // Test Blocket details
    const blocketDetails = await parseResult(await handleToolCall('get_listing_details', {
      platform: 'blocket',
      listing_id: listingId
    }));
    logTest('get_listing_details', 'Blocket details work', !blocketDetails.error);
  }

  // Test invalid listing
  const invalid = await parseResult(await handleToolCall('get_listing_details', {
    platform: 'blocket',
    listing_id: 'invalid123'
  }));
  logTest('get_listing_details', 'Handles invalid ID gracefully', invalid.error);

  // Test Tradera details
  const traderaSearch = await parseResult(await handleToolCall('tradera_search', { query: 'klocka' }));
  if (!traderaSearch.error && traderaSearch.data.results?.length > 0) {
    const traderaId = String(traderaSearch.data.results[0].itemId);
    const traderaDetails = await parseResult(await handleToolCall('get_listing_details', {
      platform: 'tradera',
      listing_id: traderaId
    }));
    logTest('get_listing_details', 'Tradera details work', !traderaDetails.error);
  }
}

// ============================================
// TEST: compare_prices
// ============================================
async function testComparePrices() {
  console.log('\n=== TEST: compare_prices ===');

  const comparison = await parseResult(await handleToolCall('compare_prices', { query: 'iPhone 13' }));
  logTest('compare_prices', 'Price comparison works', !comparison.error);

  if (!comparison.error) {
    logTest('compare_prices', 'Returns Blocket stats', comparison.data.results?.blocket !== undefined);
    logTest('compare_prices', 'Returns Tradera stats', comparison.data.results?.tradera !== undefined);
    logTest('compare_prices', 'Returns recommendation', comparison.data.recommendation !== undefined);
  }

  // Check for issues
  if (!comparison.error && !comparison.data.results?.blocket && !comparison.data.results?.tradera) {
    addIssue('compare_prices', 'MEDIUM',
      'Price comparison returned no data for either platform');
  }
}

// ============================================
// TEST: get_categories
// ============================================
async function testGetCategories() {
  console.log('\n=== TEST: get_categories ===');

  const both = await parseResult(await handleToolCall('get_categories', { platform: 'both' }));
  logTest('get_categories', 'Returns both platforms', !both.error);

  if (!both.error) {
    logTest('get_categories', 'Has Blocket categories', Array.isArray(both.data.blocket) && both.data.blocket.length > 0);
    logTest('get_categories', 'Has Tradera categories', Array.isArray(both.data.tradera));
  }

  const blocketOnly = await parseResult(await handleToolCall('get_categories', { platform: 'blocket' }));
  logTest('get_categories', 'Blocket-only works', !blocketOnly.error && blocketOnly.data.blocket);

  // Check for issues
  addIssue('get_categories', 'LOW',
    'Tradera categories are flat list, not hierarchical',
    { suggestion: 'Consider showing parent-child relationships for easier navigation' });
}

// ============================================
// TEST: get_regions
// ============================================
async function testGetRegions() {
  console.log('\n=== TEST: get_regions ===');

  const both = await parseResult(await handleToolCall('get_regions', { platform: 'both' }));
  logTest('get_regions', 'Returns both platforms', !both.error);

  if (!both.error) {
    logTest('get_regions', 'Has Blocket regions', Array.isArray(both.data.blocket) && both.data.blocket.length > 0);
    logTest('get_regions', 'Has Tradera counties', Array.isArray(both.data.tradera));
  }

  // Check for municipality issue
  addIssue('get_regions', 'HIGH',
    'Only returns regions (län), not municipalities (kommuner)',
    {
      blocketRegions: 21,
      swedishMunicipalities: 290,
      userImpact: 'Users cannot search by municipality',
      suggestion: 'Add municipality data or post-filter by location text'
    });
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('========================================');
  console.log('BLOCKET-TRADERA MCP - FULL TEST SUITE');
  console.log('========================================');
  console.log('Testing all 10 tools for issues and weaknesses...\n');

  try {
    await testBlocketSearch();
    await testBlocketSearchCars();
    await testBlocketSearchBoats();
    await testBlocketSearchMc();
    await testTraderaSearch();
    await testMarketplaceSearch();
    await testGetListingDetails();
    await testComparePrices();
    await testGetCategories();
    await testGetRegions();
  } catch (error) {
    console.error('\n[FATAL] Test suite crashed:', error.message);
    addIssue('TEST_SUITE', 'CRITICAL', 'Test suite crashed', { error: error.message });
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');

  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`Tests: ${passed} passed, ${failed} failed, ${testResults.length} total`);

  console.log('\n========================================');
  console.log('ISSUES FOUND');
  console.log('========================================');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');
  const low = issues.filter(i => i.severity === 'LOW');

  console.log(`\nCRITICAL (${critical.length}):`);
  critical.forEach(i => console.log(`  - [${i.tool}] ${i.description}`));

  console.log(`\nHIGH (${high.length}):`);
  high.forEach(i => console.log(`  - [${i.tool}] ${i.description}`));

  console.log(`\nMEDIUM (${medium.length}):`);
  medium.forEach(i => console.log(`  - [${i.tool}] ${i.description}`));

  console.log(`\nLOW (${low.length}):`);
  low.forEach(i => console.log(`  - [${i.tool}] ${i.description}`));

  console.log('\n========================================');
  console.log('DETAILED ISSUES FOR FIXING');
  console.log('========================================');
  console.log(JSON.stringify(issues, null, 2));

  return { testResults, issues };
}

runAllTests().catch(console.error);
