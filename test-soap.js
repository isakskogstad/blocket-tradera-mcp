import { createClientAsync } from 'soap';

const SOAP_URL = 'https://api.tradera.com/v3/PublicService.asmx?WSDL';

async function test() {
  console.log('Creating SOAP client...');
  const client = await createClientAsync(SOAP_URL);
  
  console.log('Available methods:', Object.keys(client).filter(k => typeof client[k] === 'function').slice(0, 10));
  
  // Test 1: How the current code does it
  console.log('\n=== Test 1: Current implementation (nested object) ===');
  try {
    const [response1] = await client.GetOfficalTimeAsync({
      AuthenticationHeader: {
        AppId: 5572,
        AppKey: '81974dd3-404d-456e-b050-b030ba646d6a'
      }
    });
    console.log('SUCCESS Test 1:', response1);
  } catch (error) {
    console.error('FAILED Test 1:', error.message);
    console.error('Error root:', error.root?.Envelope?.Body?.Fault);
  }
  
  // Test 2: Try adding security
  console.log('\n=== Test 2: Using addSoapHeader ===');
  try {
    client.clearSoapHeaders();
    client.addSoapHeader({
      AppId: 5572,
      AppKey: '81974dd3-404d-456e-b050-b030ba646d6a'
    }, 'AuthenticationHeader', 'tns', 'http://api.tradera.com');
    
    const [response2] = await client.GetOfficalTimeAsync({});
    console.log('SUCCESS Test 2:', response2);
  } catch (error) {
    console.error('FAILED Test 2:', error.message);
  }
}

test().catch(console.error);
