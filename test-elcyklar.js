// Search for used electric bikes in Kungälv
import { BlocketClient } from './build/clients/blocket-client.js';
import { TraderaClient } from './build/clients/tradera-client.js';

async function searchElcyklar() {
  console.log('=== Söker begagnade elcyklar i Kungälv ===\n');

  // Blocket search
  console.log('--- BLOCKET ---');
  const blocket = new BlocketClient();
  await blocket.init();

  try {
    // Kungälv is in Västra Götaland region
    const blocketResult = await blocket.search({
      query: 'elcykel',
      locations: ['VASTRA_GOTALAND']
    });

    console.log('Totalt antal resultat:', blocketResult.pagination.total_results || blocketResult.results.length);
    console.log('Resultat på denna sida:', blocketResult.results.length);

    if (blocketResult.results.length > 0) {
      console.log('\nBlocket-annonser:');
      blocketResult.results.slice(0, 5).forEach((item, i) => {
        console.log('\n' + (i+1) + '. ' + item.subject);
        console.log('   Pris: ' + (item.price ? item.price + ' kr' : 'Ej angivet'));
        console.log('   Plats: ' + (item.location || item.region || 'Ej angivet'));
        console.log('   URL: ' + (item.url || 'N/A'));
      });
    }
  } catch (error) {
    console.error('Blocket-fel:', error.message);
  }

  // Tradera search
  console.log('\n\n--- TRADERA ---');
  const tradera = new TraderaClient({
    appId: 5572,
    appKey: '81974dd3-404d-456e-b050-b030ba646d6a'
  });
  await tradera.init();

  try {
    const traderaResult = await tradera.search({ query: 'elcykel' }, true);

    console.log('Totalt antal resultat:', traderaResult.totalCount);
    console.log('Resultat på denna sida:', traderaResult.items.length);

    if (traderaResult.items.length > 0) {
      console.log('\nTradera-auktioner:');
      traderaResult.items.slice(0, 5).forEach((item, i) => {
        const price = item.buyItNowPrice || item.currentBid || item.startPrice;
        console.log('\n' + (i+1) + '. ' + item.shortDescription);
        console.log('   Pris: ' + (price ? price + ' kr' : 'Ej angivet'));
        console.log('   Typ: ' + item.itemType);
        console.log('   Bud: ' + item.bidCount);
        console.log('   URL: https://www.tradera.com/item/' + item.itemId);
      });
    }

    console.log('\nAPI Budget:', tradera.getBudget().remaining + '/100 remaining');
  } catch (error) {
    console.error('Tradera-fel:', error.message);
  }
}

searchElcyklar().catch(console.error);
