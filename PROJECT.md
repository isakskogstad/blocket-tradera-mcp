# Blocket & Tradera MCP

## Overview
MCP server for Swedish marketplaces Blocket and Tradera. Enables AI assistants to search listings, compare prices, browse categories, and interact with both platforms through 10 specialized tools.

## Status
- **Version:** 1.0.0
- **npm:** `blocket-tradera-mcp`
- **GitHub:** https://github.com/isakskogstad/blocket-tradera-mcp
- **Live URL:** https://blocket-tradera-mcp.onrender.com

## Tech Stack
- TypeScript (strict mode)
- MCP SDK (@modelcontextprotocol/sdk)
- Express.js (HTTP server)
- SOAP (Tradera API)
- Node.js 18+

## Project Structure
```
blocket-tradera-mcp/
├── src/
│   ├── index.ts              # MCP stdio server
│   ├── http-server.ts        # HTTP server for Render
│   ├── clients/
│   │   ├── blocket-client.ts # REST client
│   │   └── tradera-client.ts # SOAP client + budget mgmt
│   ├── cache/                # Two-tier caching
│   ├── tools/                # 10 MCP tools
│   ├── types/                # TypeScript definitions
│   └── utils/                # Helpers
├── build/                    # TypeScript output (gitignored)
├── backups/                  # Automatic backups
├── render.yaml               # Render config
├── server.json               # MCP Registry metadata
├── package.json
└── tsconfig.json
```

## Tools (10)
| Tool | Description |
|------|-------------|
| `marketplace_search` | Unified search across both platforms |
| `blocket_search` | Search Blocket listings |
| `blocket_search_cars` | Car search with vehicle filters |
| `blocket_search_boats` | Boat search |
| `blocket_search_mc` | Motorcycle search |
| `tradera_search` | Tradera auctions (cached) |
| `get_listing_details` | Full listing details |
| `compare_prices` | Price comparison |
| `get_categories` | List categories |
| `get_regions` | List Swedish regions |

## Rate Limits
- **Tradera:** 100 calls/24h (aggressive caching required)
- **Blocket:** 5 requests/second

## Scripts
```bash
npm run build       # Compile TypeScript
npm run start       # Start stdio MCP server
npm run start:http  # Start HTTP server (for Render)
npm test           # Run tests
```

## Deployment
- **Render:** Auto-deploy from GitHub main branch
- **npm:** Published as `blocket-tradera-mcp`

## Lessons Learned

### Render Deployment Issue (2025-12-02)

**Problem:** Deployment failed with "Cannot find module build/http-server.js"

**Root Cause:**
1. Render auto-detected `npm start` from package.json `main` field
2. Build command was only `npm install` without TypeScript compilation

**Solution:**
1. Added `"postinstall": "npm run build"` to package.json as failsafe
2. Build Command: `npm ci && npm run build`
3. Start Command: `npm run start:http` (NOT `npm start`!)

**Key Learning:**
MCP servers have TWO entry points:
- `build/index.js` = stdio (lokal användning)
- `build/http-server.js` = HTTP (Render deployment)

Always use `npm run start:http` for HTTP deployments, not `npm start`.

## Backup Info
- Last session backup: 2025-12-02
- Backup retention policy: default

## Notes
- Tradera uses SOAP API with AppId/AppKey auth
- Blocket uses unofficial REST API (blocket-api.se)
- Two-tier caching: Memory LRU + File persistent
