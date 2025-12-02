// Test MCP server via HTTP
const SESSION_ID = 'test-' + Date.now();
const BASE_URL = 'https://blocket-tradera-mcp.onrender.com/mcp';

async function sendRequest(method, params, id) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': SESSION_ID
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    })
  });
  
  const text = await response.text();
  // Parse SSE format
  const lines = text.split('\n').filter(l => l.startsWith('data: '));
  if (lines.length > 0) {
    return JSON.parse(lines[0].replace('data: ', ''));
  }
  return JSON.parse(text);
}

async function test() {
  console.log('Session ID:', SESSION_ID);
  
  // 1. Initialize
  console.log('\n=== Initialize ===');
  const initResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' }
  }, 1);
  console.log('Init result:', JSON.stringify(initResult, null, 2));
  
  // 2. Test Tradera search
  console.log('\n=== Tradera Search: iPhone ===');
  const traderaResult = await sendRequest('tools/call', {
    name: 'tradera_search',
    arguments: { query: 'iPhone' }
  }, 2);
  
  if (traderaResult.result?.content?.[0]?.text) {
    const data = JSON.parse(traderaResult.result.content[0].text);
    console.log('Total results:', data.total_count);
    console.log('Items returned:', data.results?.length || 0);
    console.log('API Budget:', data.api_budget);
    if (data.results?.[0]) {
      console.log('First item:', {
        id: data.results[0].id,
        title: data.results[0].title?.substring(0, 50)
      });
    }
  } else {
    console.log('Result:', JSON.stringify(traderaResult, null, 2));
  }
}

test().catch(console.error);
