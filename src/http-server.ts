#!/usr/bin/env node
/**
 * Blocket & Tradera MCP HTTP Server
 * Express server for Render deployment with MCP endpoint
 */

import express, { Request, Response } from 'express';
import { marked } from 'marked';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolDefinitions } from './tools/tool-definitions.js';
import { handleToolCall } from './tools/tool-handlers.js';
import { getTraderaClient } from './clients/tradera-client.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? '10000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// ============================================
// HOMEPAGE
// ============================================

const HOMEPAGE_MD = `
# Blocket & Tradera MCP Server

Swedish marketplace integration for Claude and other AI assistants.

## Available Tools (10)

| Tool | Description |
|------|-------------|
| \`marketplace_search\` | Unified search across both Blocket and Tradera |
| \`blocket_search\` | Search Blocket for general items |
| \`blocket_search_cars\` | Search cars with vehicle filters |
| \`blocket_search_boats\` | Search boats |
| \`blocket_search_mc\` | Search motorcycles |
| \`tradera_search\` | Search Tradera auctions (cached, 100 calls/day) |
| \`get_listing_details\` | Get full details for a listing |
| \`compare_prices\` | Compare prices across platforms |
| \`get_categories\` | List available categories |
| \`get_regions\` | List Swedish regions |

## Usage

### Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "blocket-tradera": {
      "command": "npx",
      "args": ["-y", "blocket-tradera-mcp"]
    }
  }
}
\`\`\`

### MCP HTTP Transport

\`\`\`json
{
  "mcpServers": {
    "blocket-tradera": {
      "type": "http",
      "url": "${process.env.RENDER_EXTERNAL_URL ?? 'https://blocket-tradera-mcp.onrender.com'}/mcp"
    }
  }
}
\`\`\`

## Important Notes

- **Tradera Rate Limit**: Tradera allows only 100 API calls per 24 hours. Results are aggressively cached.
- **Blocket Rate Limit**: 5 requests per second.
- **Swedish Terms**: Swedish search terms work best (e.g., "Soffa", "Cykel", "Bil").

## Endpoints

- \`GET /\` - This page
- \`GET /health\` - Health check
- \`POST /mcp\` - MCP protocol endpoint

## Links

- [GitHub Repository](https://github.com/isakskogstad/blocket-tradera-mcp)
- [npm Package](https://www.npmjs.com/package/@isakskogstad/blocket-tradera-mcp)

---

*Developed by Isak Skogstad*
`;

app.get('/', (_req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blocket & Tradera MCP Server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #0066cc; }
    h2 { color: #444; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    code {
      background: #f4f4f4;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    pre {
      background: #f4f4f4;
      padding: 1rem;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th { background: #f9f9f9; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  ${marked(HOMEPAGE_MD)}
</body>
</html>
  `;
  res.type('html').send(html);
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  const tradera = getTraderaClient();
  const budget = tradera.getBudget();

  res.json({
    status: 'ok',
    server: 'blocket-tradera-mcp',
    version: '1.0.0',
    tools_count: 10,
    tradera_api_budget: {
      remaining: budget.remaining,
      daily_limit: budget.dailyLimit,
      resets_at: budget.resetTime.toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// MCP ENDPOINT
// ============================================

// Create MCP server instance for HTTP transport
function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'blocket-tradera-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[MCP HTTP] Tool call: ${name}`);

    try {
      const result = await handleToolCall(name, (args ?? {}) as Record<string, unknown>);
      return {
        content: result.content,
        isError: result.isError,
      };
    } catch (error) {
      console.error(`[MCP HTTP] Tool error:`, error);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Store active transports by session ID with last activity tracking
const transports = new Map<string, {
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}>();

// Session cleanup interval (every 5 minutes, expire after 30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of transports.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      session.transport.close();
      transports.delete(sessionId);
      console.error(`[MCP HTTP] Session expired: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

// MCP POST endpoint
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Check for existing transport
  let session = sessionId ? transports.get(sessionId) : undefined;

  if (!session) {
    // Create new transport for new sessions
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, { transport, lastActivity: Date.now() });
        console.error(`[MCP HTTP] Session initialized: ${newSessionId}`);
      },
    });

    // Connect to new MCP server instance
    const server = createMCPServer();
    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } else {
    // Update last activity and handle request
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res, req.body);
  }
});

// MCP GET endpoint for SSE (server-sent events)
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing mcp-session-id header' });
    return;
  }

  const session = transports.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  session.lastActivity = Date.now();
  await session.transport.handleRequest(req, res);
});

// MCP DELETE endpoint for cleanup
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing mcp-session-id header' });
    return;
  }

  const session = transports.get(sessionId);
  if (session) {
    await session.transport.close();
    transports.delete(sessionId);
    console.error(`[MCP HTTP] Session closed: ${sessionId}`);
  }

  res.status(204).send();
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, HOST, () => {
  console.error(`Blocket & Tradera MCP HTTP Server`);
  console.error(`Listening on http://${HOST}:${PORT}`);
  console.error(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.error(`Health check: http://${HOST}:${PORT}/health`);
});

export { app };
