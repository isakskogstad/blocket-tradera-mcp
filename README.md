# Blocket & Tradera MCP Server

MCP-server för svenska marknadsplatser Blocket och Tradera. Sök efter produkter, jämför priser och bläddra bland annonser direkt från Claude.

[English documentation](README.en.md)

## Funktioner

- **10 MCP-verktyg** för sökning och jämförelse
- **Unified search** - sök på båda plattformarna samtidigt
- **Aggressiv caching** - hanterar Traderas begränsning på 100 anrop/dag
- **Fordonsspecifika sökningar** - bilar, båtar, motorcyklar
- **Prisjämförelse** - jämför priser mellan plattformarna

## Installation

### Claude Desktop

Lägg till i din `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blocket-tradera": {
      "command": "npx",
      "args": ["-y", "@isakskogstad/blocket-tradera-mcp"]
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

## Tillgängliga verktyg

| Verktyg | Beskrivning |
|---------|-------------|
| `marketplace_search` | Unified sökning på Blocket + Tradera |
| `blocket_search` | Generell sökning på Blocket |
| `blocket_search_cars` | Bilsökning med filter |
| `blocket_search_boats` | Båtsökning |
| `blocket_search_mc` | MC-sökning |
| `tradera_search` | Auktionssökning (cachad) |
| `get_listing_details` | Hämta full annonsinformation |
| `compare_prices` | Jämför priser mellan plattformar |
| `get_categories` | Lista kategorier |
| `get_regions` | Lista svenska regioner |

## Exempel

### Sök efter soffa

```
Använd marketplace_search för att hitta "soffa" på både Blocket och Tradera
```

### Sök efter bil

```
Använd blocket_search_cars för att hitta en Volvo från 2018 eller nyare, max 100000 mil
```

### Jämför priser

```
Använd compare_prices för att jämföra priser på "iPhone 14" mellan Blocket och Tradera
```

## Rate Limits

| Plattform | Begränsning | Caching |
|-----------|-------------|---------|
| **Blocket** | 5 anrop/sekund | 5 min |
| **Tradera** | 100 anrop/24h | 30 min |

Tradera har en mycket strikt begränsning på 100 API-anrop per dygn. Denna MCP-server implementerar aggressiv caching för att maximera användningen:

- Sökresultat cachas i 30 minuter
- Kategorier cachas i 24 timmar
- Regioner cachas i 7 dagar

## Utveckling

```bash
# Klona repo
git clone https://github.com/isakskogstad/blocket-tradera-mcp
cd blocket-tradera-mcp

# Installera beroenden
npm install

# Bygg
npm run build

# Kör lokalt (stdio)
npm start

# Kör HTTP-server
npm run start:http
```

## Miljövariabler

```bash
# Tradera API (rekommenderas att du skaffar egna)
TRADERA_APP_ID=your-app-id
TRADERA_APP_KEY=your-app-key

# Server
PORT=10000
CACHE_DIR=/tmp/blocket-tradera-cache
```

> **OBS:** Tradera kräver API-credentials. Skaffa egna på [api.tradera.com](https://api.tradera.com/) för att undvika delade rate limits. Utan credentials fungerar endast Blocket-sökningar.

## Licens

MIT

## Författare

Isak Skogstad
