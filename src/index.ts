#!/usr/bin/env node
/**
 * Blocket & Tradera MCP Server
 * Swedish marketplace integration for Claude
 *
 * Features:
 * - Unified search across both platforms
 * - Aggressive caching for Tradera's 100 calls/day limit
 * - Vehicle-specific searches (cars, boats, motorcycles)
 * - Price comparison tools
 * - Categories and regions reference
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolDefinitions } from './tools/tool-definitions.js';
import { handleToolCall } from './tools/tool-handlers.js';

// Create MCP server
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[MCP] Tool call: ${name}`);

  try {
    const result = await handleToolCall(name, (args ?? {}) as Record<string, unknown>);
    return {
      content: result.content,
      isError: result.isError,
    };
  } catch (error) {
    console.error(`[MCP] Tool error:`, error);
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Blocket & Tradera MCP Server started');
  console.error('Available tools: 10');
  console.error('- marketplace_search (unified)');
  console.error('- blocket_search, blocket_search_cars, blocket_search_boats, blocket_search_mc');
  console.error('- tradera_search (cached, 100 calls/day limit)');
  console.error('- get_listing_details, compare_prices');
  console.error('- get_categories, get_regions');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export { server };
