import { createClientAsync } from 'soap';

const SOAP_URL = 'https://api.tradera.com/v3/PublicService.asmx?WSDL';

async function test() {
  console.log('Creating SOAP client...');
  const client = await createClientAsync(SOAP_URL);
  
  // Test 3: Set SOAP header BEFORE calling method
  console.log('\n=== Test 3: Proper SOAP header (before method call) ===');
  try {
    // Add authentication as a proper SOAP header
    client.addSoapHeader(
      {
        'tns:AuthenticationHeader': {
          'tns:AppId': 5572,
          'tns:AppKey': '81974dd3-404d-456e-b050-b030ba646d6a'
        }
      }
    );
    
    const [response] = await client.GetOfficalTimeAsync({});
    console.log('SUCCESS Test 3:', response);
  } catch (error) {
    console.error('FAILED Test 3:', error.message);
    if (error.root) {
      console.error('Fault:', error.root.Envelope.Body.Fault);
    }
  }
  
  // Test 4: Without namespace prefix
  console.log('\n=== Test 4: Without tns: prefix ===');
  try {
    client.clearSoapHeaders();
    client.addSoapHeader(
      {
        AuthenticationHeader: {
          AppId: 5572,
          AppKey: '81974dd3-404d-456e-b050-b030ba646d6a'
        }
      },
      '',
      '',
      'http://api.tradera.com'
    );
    
    const [response] = await client.GetOfficalTimeAsync({});
    console.log('SUCCESS Test 4:', response);
  } catch (error) {
    console.error('FAILED Test 4:', error.message);
  }
  
  // Test 5: Using wsSecurity style
  console.log('\n=== Test 5: Direct header with xmlns ===');
  try {
    client.clearSoapHeaders();
    const header = {
      AuthenticationHeader: {
        attributes: {
          xmlns: 'http://api.tradera.com'
        },
        AppId: 5572,
        AppKey: '81974dd3-404d-456e-b050-b030ba646d6a'
      }
    };
    client.addSoapHeader(header);
    
    const [response] = await client.GetOfficalTimeAsync({});
    console.log('SUCCESS Test 5:', response);
  } catch (error) {
    console.error('FAILED Test 5:', error.message);
  }
}

test().catch(console.error);
