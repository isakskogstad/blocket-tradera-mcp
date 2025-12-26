/**
 * Final comprehensive test with correct tool names
 */

import { handleToolCall } from '../build/tools/tool-handlers.js';

async function parseResult(result) {
  if (result.isError) {
    return { success: false, error: JSON.parse(result.content[0].text) };
  }
  return { success: true, data: JSON.parse(result.content[0].text) };
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('FINAL COMPREHENSIVE TEST');
  console.log('='.repeat(60));
  console.log();

  const results = [];

  // Test 1: tradera_search
  console.log('--- TEST 1: tradera_search (iPhone) ---');
  const t1 = await parseResult(await handleToolCall('tradera_search', { query: 'iPhone 14', force_refresh: true }));
  let traderaItemId = null;
  if (t1.success) {
    console.log('✓ Results:', t1.data.results?.length || 0);
    console.log('✓ Total:', t1.data.total_count);

    if (t1.data.results?.length > 0) {
      const item = t1.data.results[0];
      traderaItemId = item.id;
      console.log('✓ Item ID:', item.id);
      console.log('✓ Title:', item.title?.substring(0, 50));
      console.log('  --- NEW FIELDS ---');
      console.log('  nextBid:', item.platformSpecific?.nextBid ?? 'N/A');
      console.log('  bidCount:', item.platformSpecific?.bidCount ?? 'N/A');
      console.log('  brand:', item.platformSpecific?.brand ?? 'N/A');
      console.log('  model:', item.platformSpecific?.model ?? 'N/A');
      console.log('  storage:', item.platformSpecific?.storage ?? 'N/A');
      console.log('  conditionText:', item.platformSpecific?.conditionText ?? 'N/A');
      console.log('  seller.rating:', item.seller?.rating ?? 'N/A');
    }
    results.push({ test: 'tradera_search', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t1.error);
    results.push({ test: 'tradera_search', status: 'FAIL' });
  }
  console.log();

  // Test 2: get_listing_details (Tradera) - Check detailed fields
  console.log('--- TEST 2: get_listing_details (Tradera) ---');
  if (traderaItemId) {
    const t2 = await parseResult(await handleToolCall('get_listing_details', { 
      listing_id: String(traderaItemId),
      platform: 'tradera'
    }));
    if (t2.success) {
      console.log('✓ Item:', t2.data.title?.substring(0, 50));
      console.log('  --- NEW DETAILED FIELDS ---');
      console.log('  seller.city:', t2.data.seller?.city ?? 'N/A');
      console.log('  seller.rating:', t2.data.seller?.rating ?? 'N/A');
      console.log('  shippingOptions:', t2.data.platformSpecific?.shippingOptions?.length ?? 0, 'options');
      if (t2.data.platformSpecific?.shippingOptions?.length > 0) {
        t2.data.platformSpecific.shippingOptions.slice(0,2).forEach((s, i) => {
          console.log(`    ${i+1}. ${s.name}: ${s.cost} kr`);
        });
      }
      console.log('  brand:', t2.data.platformSpecific?.brand ?? 'N/A');
      console.log('  model:', t2.data.platformSpecific?.model ?? 'N/A');
      console.log('  conditionText:', t2.data.platformSpecific?.conditionText ?? 'N/A');
      results.push({ test: 'get_listing_details_tradera', status: 'PASS' });
    } else {
      console.log('✗ FAILED:', t2.error);
      results.push({ test: 'get_listing_details_tradera', status: 'FAIL' });
    }
  } else {
    console.log('⊘ SKIPPED (no item ID)');
    results.push({ test: 'get_listing_details_tradera', status: 'SKIP' });
  }
  console.log();

  // Test 3: get_categories (includes Tradera)
  console.log('--- TEST 3: get_categories ---');
  const t3 = await parseResult(await handleToolCall('get_categories', {}));
  if (t3.success) {
    console.log('✓ Blocket categories:', t3.data.blocket?.length || 0);
    console.log('✓ Tradera categories:', t3.data.tradera?.length || 0);
    results.push({ test: 'get_categories', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t3.error);
    results.push({ test: 'get_categories', status: 'FAIL' });
  }
  console.log();

  // Test 4: blocket_search
  console.log('--- TEST 4: blocket_search ---');
  const t4 = await parseResult(await handleToolCall('blocket_search', { query: 'cykel' }));
  if (t4.success) {
    console.log('✓ Results:', t4.data.results?.length || 0);
    results.push({ test: 'blocket_search', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t4.error);
    results.push({ test: 'blocket_search', status: 'FAIL' });
  }
  console.log();

  // Test 5: blocket_search + municipality
  console.log('--- TEST 5: blocket_search + municipality (Stockholm) ---');
  const t5 = await parseResult(await handleToolCall('blocket_search', { 
    query: 'soffa', 
    municipality: 'Stockholm' 
  }));
  if (t5.success) {
    console.log('✓ Results:', t5.data.results?.length || 0);
    console.log('✓ Municipality filter:', t5.data.municipality_filter);
    console.log('✓ Filtered out:', t5.data.filtered_out);
    results.push({ test: 'blocket_municipality', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t5.error);
    results.push({ test: 'blocket_municipality', status: 'FAIL' });
  }
  console.log();

  // Test 6: blocket_search_cars
  console.log('--- TEST 6: blocket_search_cars ---');
  const t6 = await parseResult(await handleToolCall('blocket_search_cars', { make: 'Volvo' }));
  if (t6.success) {
    console.log('✓ Results:', t6.data.results?.length || 0);
    results.push({ test: 'blocket_search_cars', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t6.error);
    results.push({ test: 'blocket_search_cars', status: 'FAIL' });
  }
  console.log();

  // Test 7: blocket_search_boats
  console.log('--- TEST 7: blocket_search_boats ---');
  const t7 = await parseResult(await handleToolCall('blocket_search_boats', { boat_type: 'MOTORBAT' }));
  if (t7.success) {
    console.log('✓ Results:', t7.data.results?.length || 0);
    results.push({ test: 'blocket_search_boats', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t7.error);
    results.push({ test: 'blocket_search_boats', status: 'FAIL' });
  }
  console.log();

  // Test 8: blocket_search_mc
  console.log('--- TEST 8: blocket_search_mc ---');
  const t8 = await parseResult(await handleToolCall('blocket_search_mc', { mc_type: 'SPORT' }));
  if (t8.success) {
    console.log('✓ Results:', t8.data.results?.length || 0);
    results.push({ test: 'blocket_search_mc', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t8.error);
    results.push({ test: 'blocket_search_mc', status: 'FAIL' });
  }
  console.log();

  // Test 9: marketplace_search
  console.log('--- TEST 9: marketplace_search ---');
  const t9 = await parseResult(await handleToolCall('marketplace_search', { query: 'gitarr' }));
  if (t9.success) {
    console.log('✓ Total:', t9.data.total_count);
    console.log('✓ Blocket:', t9.data.metadata?.blocket_count);
    console.log('✓ Tradera:', t9.data.metadata?.tradera_count);
    
    // Check Tradera results
    const traderaItems = t9.data.results?.filter(r => r.platform === 'tradera') || [];
    if (traderaItems.length > 0) {
      const tr = traderaItems[0];
      console.log('  --- Tradera item sample ---');
      console.log('  nextBid:', tr.platformSpecific?.nextBid ?? 'N/A');
      console.log('  conditionText:', tr.platformSpecific?.conditionText ?? 'N/A');
    }
    results.push({ test: 'marketplace_search', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t9.error);
    results.push({ test: 'marketplace_search', status: 'FAIL' });
  }
  console.log();

  // Test 10: compare_prices
  console.log('--- TEST 10: compare_prices ---');
  const t10 = await parseResult(await handleToolCall('compare_prices', { query: 'MacBook' }));
  if (t10.success) {
    console.log('✓ Total listings:', t10.data.total_listings);
    console.log('✓ Avg price:', t10.data.price_analysis?.average);
    console.log('✓ Min price:', t10.data.price_analysis?.min);
    console.log('✓ Max price:', t10.data.price_analysis?.max);
    results.push({ test: 'compare_prices', status: 'PASS' });
  } else {
    console.log('✗ FAILED:', t10.error);
    results.push({ test: 'compare_prices', status: 'FAIL' });
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log();

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⊘';
    console.log(`${icon} ${r.test}: ${r.status}`);
  });

  console.log();
  console.log(`TOTAL: ${passed}/${results.length} PASSED`);
  console.log();
}

runTests().catch(console.error);
