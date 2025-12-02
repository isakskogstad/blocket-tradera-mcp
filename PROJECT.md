# Blocket & Tradera MCP

## Overview
MCP server for integrating with Swedish marketplaces Blocket and Tradera. Enables AI assistants to search listings, monitor prices, and interact with these platforms.

## Tech Stack
- TypeScript
- MCP SDK (@modelcontextprotocol/sdk)
- Node.js

## Project Structure
```
blocket-tradera-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools/            # MCP tools
│   ├── resources/        # MCP resources
│   └── services/         # API integrations
├── backups/              # Automatic backups
├── package.json
├── tsconfig.json
└── PROJECT.md
```

## Instructions
- Follow MCP 2025 protocol specifications
- Implement proper error handling for API calls
- Use TypeScript strict mode
- Document all tools clearly

## Settings
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`

## Backup Info
- Last session backup: 2025-12-02 (initial)
- Backup retention policy: default

## Notes
- Blocket: Sweden's largest marketplace (part of Schibsted)
- Tradera: Swedish auction/marketplace (owned by eBay)
- Research APIs and web scraping options needed

## API Research (TODO)
- [ ] Investigate Blocket API availability
- [ ] Investigate Tradera API availability
- [ ] Consider web scraping as fallback
- [ ] Check rate limiting policies
