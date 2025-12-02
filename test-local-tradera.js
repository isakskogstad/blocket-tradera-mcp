// Test Tradera client directly (no MCP overhead)
import { TraderaClient } from './build/clients/tradera-client.js';

async function test() {
  console.log('Creating Tradera client...');
  const client = new TraderaClient({
    appId: 5572,
    appKey: '81974dd3-404d-456e-b050-b030ba646d6a'
  });

  console.log('Initializing...');
  await client.init();

  console.log('\n=== Testing search for "iPhone" ===');
  try {
    const result = await client.search({ query: 'iPhone' }, true); // forceRefresh
    console.log('SUCCESS!');
    console.log('Total count:', result.totalCount);
    console.log('Items returned:', result.items.length);
    console.log('Page:', result.pageNumber, '/', result.totalPages);
    console.log('Cached:', result.cached);

    if (result.items.length > 0) {
      console.log('\nFirst 3 items:');
      result.items.slice(0, 3).forEach((item, i) => {
        const title = item.shortDescription ? item.shortDescription.substring(0, 60) : 'No title';
        const price = item.buyItNowPrice || item.currentBid || item.startPrice || 'N/A';
        console.log((i+1) + '. [' + item.itemId + '] ' + title);
        console.log('   Price: ' + price + ' SEK');
      });
    }

    console.log('\nAPI Budget:', client.getBudget());
  } catch (error) {
    console.error('FAILED:', error.message);
    if (error.root) {
      console.error('SOAP Fault:', JSON.stringify(error.root.Envelope.Body.Fault, null, 2));
    }
  }
}

test().catch(console.error);
