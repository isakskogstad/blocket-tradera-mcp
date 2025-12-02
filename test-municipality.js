/**
 * Test municipality filtering - the Kungälv case
 */

import { handleToolCall } from './build/tools/tool-handlers.js';

async function parseResult(result) {
  if (result.isError) {
    return { error: true, data: JSON.parse(result.content[0].text) };
  }
  return { error: false, data: JSON.parse(result.content[0].text) };
}

async function testMunicipalityFiltering() {
  console.log('========================================');
  console.log('TESTING MUNICIPALITY FILTERING');
  console.log('========================================\n');

  // Test 1: Search for elcyklar in Kungälv (the original use case!)
  console.log('=== Test 1: Elcyklar i Kungälv ===');
  const kungalv = await parseResult(await handleToolCall('blocket_search', {
    query: 'elcykel',
    municipality: 'Kungälv'
  }));

  if (kungalv.error) {
    console.log('ERROR:', kungalv.data);
  } else {
    console.log('Total results:', kungalv.data.results?.length || 0);
    console.log('Municipality filter applied:', kungalv.data.municipality_filter);
    console.log('Auto-selected region:', kungalv.data.auto_selected_region);
    console.log('Filtered out:', kungalv.data.filtered_out);

    if (kungalv.data.results?.length > 0) {
      console.log('\nResults (all should be from Kungälv area):');
      kungalv.data.results.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.subject?.substring(0, 40)} - ${r.location || 'N/A'}`);
      });
    }
  }

  // Test 2: Search in Stockholm city (not län)
  console.log('\n=== Test 2: iPhone i Stockholm stad ===');
  const stockholm = await parseResult(await handleToolCall('blocket_search', {
    query: 'iPhone',
    municipality: 'Stockholm'
  }));

  if (!stockholm.error) {
    console.log('Total results:', stockholm.data.results?.length || 0);
    console.log('Municipality filter:', stockholm.data.municipality_filter);
    console.log('Filtered out:', stockholm.data.filtered_out);

    // Check for leakage
    const leaks = (stockholm.data.results || []).filter(r => {
      const loc = (r.location || '').toLowerCase();
      return loc && !loc.includes('stockholm');
    });
    console.log('Results NOT from Stockholm:', leaks.length);
    if (leaks.length > 0) {
      console.log('  Leaked locations:', leaks.slice(0, 3).map(r => r.location));
    }
  }

  // Test 3: Search in Göteborg
  console.log('\n=== Test 3: Soffa i Göteborg ===');
  const goteborg = await parseResult(await handleToolCall('blocket_search', {
    query: 'soffa',
    municipality: 'Göteborg'
  }));

  if (!goteborg.error) {
    console.log('Total results:', goteborg.data.results?.length || 0);
    console.log('Municipality filter:', goteborg.data.municipality_filter);
    console.log('Auto-selected region:', goteborg.data.auto_selected_region);

    if (goteborg.data.results?.length > 0) {
      console.log('\nFirst 3 results:');
      goteborg.data.results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.subject?.substring(0, 40)} - ${r.location}`);
      });
    }
  }

  // Test 4: marketplace_search with municipality
  console.log('\n=== Test 4: Unified search i Malmö ===');
  const malmo = await parseResult(await handleToolCall('marketplace_search', {
    query: 'cykel',
    municipality: 'Malmö'
  }));

  if (!malmo.error) {
    console.log('Total results:', malmo.data.total_count);
    console.log('Blocket count:', malmo.data.metadata?.blocket_count);
    console.log('Tradera count:', malmo.data.metadata?.tradera_count);
    console.log('Note: Tradera results are NOT filtered by location (API limitation)');
  }

  // Test 5: Invalid municipality
  console.log('\n=== Test 5: Invalid municipality ===');
  const invalid = await parseResult(await handleToolCall('blocket_search', {
    query: 'test',
    municipality: 'FakeCity123'
  }));

  console.log('Handled gracefully:', !invalid.error || invalid.data.error?.includes('not found'));

  console.log('\n========================================');
  console.log('MUNICIPALITY TESTING COMPLETE');
  console.log('========================================');
}

testMunicipalityFiltering().catch(console.error);
