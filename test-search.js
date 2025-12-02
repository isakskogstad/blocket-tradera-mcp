import { createClientAsync } from 'soap';

const SEARCH_URL = 'https://api.tradera.com/v3/SearchService.asmx?WSDL';

async function test() {
  console.log('Creating SearchService client...');
  const client = await createClientAsync(SEARCH_URL);
  
  console.log('Available methods:', Object.keys(client).filter(k => typeof client[k] === 'function').slice(0, 5));
  
  // Test with proper SOAP header
  console.log('\n=== Test: Search with proper SOAP header ===');
  try {
    // Add authentication as a proper SOAP header
    client.addSoapHeader({
      AuthenticationHeader: {
        attributes: {
          xmlns: 'http://api.tradera.com'
        },
        AppId: 5572,
        AppKey: '81974dd3-404d-456e-b050-b030ba646d6a'
      }
    });
    
    const [response] = await client.SearchAsync({
      query: 'iPhone',
      categoryId: 0,
      pageNumber: 1,
      orderBy: 'Relevance'
    });
    
    console.log('SUCCESS - Search results:');
    console.log('Total items:', response.TotalNumberOfItems);
    console.log('Items returned:', response.Items?.length || 0);
    if (response.Items?.[0]) {
      console.log('First item:', {
        id: response.Items[0].Id,
        title: response.Items[0].ShortDescription
      });
    }
  } catch (error) {
    console.error('FAILED:', error.message);
    if (error.root) {
      console.error('Fault:', error.root.Envelope.Body.Fault);
    }
  }
}

test().catch(console.error);
