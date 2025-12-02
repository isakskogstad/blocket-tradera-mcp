# Blocket & Tradera MCP Server

MCP server for Swedish marketplaces Blocket and Tradera. Search for products, compare prices, and browse listings directly from Claude.

[Svenska dokumentation](README.md)

## Features

- **10 MCP tools** for searching and comparing
- **Unified search** - search both platforms simultaneously
- **Aggressive caching** - handles Tradera's 100 calls/day limit
- **Vehicle-specific searches** - cars, boats, motorcycles
- **Price comparison** - compare prices between platforms

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blocket-tradera": {
      "command": "npx",
      "args": ["-y", "blocket-tradera-mcp"]
    }
  }
}
```

### Remote (HTTP Transport)

```json
{
  "mcpServers": {
    "blocket-tradera": {
      "type": "http",
      "url": "https://blocket-tradera-mcp.onrender.com/mcp"
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `marketplace_search` | Unified search on Blocket + Tradera |
| `blocket_search` | General search on Blocket |
| `blocket_search_cars` | Car search with filters |
| `blocket_search_boats` | Boat search |
| `blocket_search_mc` | Motorcycle search |
| `tradera_search` | Auction search (cached) |
| `get_listing_details` | Get full listing details |
| `compare_prices` | Compare prices between platforms |
| `get_categories` | List categories |
| `get_regions` | List Swedish regions |

## Examples

### Search for sofa

```
Use marketplace_search to find "soffa" on both Blocket and Tradera
```

### Search for car

```
Use blocket_search_cars to find a Volvo from 2018 or newer, max 100000 km
```

### Compare prices

```
Use compare_prices to compare prices on "iPhone 14" between Blocket and Tradera
```

## Rate Limits

| Platform | Limit | Caching |
|----------|-------|---------|
| **Blocket** | 5 requests/second | 5 min |
| **Tradera** | 100 requests/24h | 30 min |

Tradera has a very strict limit of 100 API calls per day. This MCP server implements aggressive caching to maximize usage:

- Search results cached for 30 minutes
- Categories cached for 24 hours
- Regions cached for 7 days

## Development

```bash
# Clone repo
git clone https://github.com/isakskogstad/blocket-tradera-mcp
cd blocket-tradera-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally (stdio)
npm start

# Run HTTP server
npm run start:http
```

## Environment Variables

```bash
# Tradera API (recommended to get your own)
TRADERA_APP_ID=your-app-id
TRADERA_APP_KEY=your-app-key

# Server
PORT=10000
CACHE_DIR=/tmp/blocket-tradera-cache
```

> **NOTE:** Tradera requires API credentials. Get your own at [api.tradera.com](https://api.tradera.com/) to avoid shared rate limits. Without credentials, only Blocket searches will work.

## License

MIT

## Author

Isak Skogstad
