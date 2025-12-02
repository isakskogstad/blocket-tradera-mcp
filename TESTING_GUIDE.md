# Testing Guide - New Municipality Features

## Quick Test Commands

### Test 1: Municipality Filter (Basic)
```json
{
  "tool": "blocket_search",
  "params": {
    "query": "iPhone",
    "municipality": "Stockholm"
  }
}
```
**Expected:** Only results from Stockholm city, not suburbs.

### Test 2: Municipality Auto-Region Selection
```json
{
  "tool": "blocket_search",
  "params": {
    "query": "Cykel",
    "municipality": "Göteborg"
  }
}
```
**Expected:** Auto-selects VASTRA_GOTALAND region, filters to Göteborg only.

### Test 3: Municipality + Region (Explicit)
```json
{
  "tool": "blocket_search_cars",
  "params": {
    "query": "Volvo",
    "locations": ["STOCKHOLM"],
    "municipality": "Solna"
  }
}
```
**Expected:** Searches Stockholm region, filters to Solna municipality.

### Test 4: Boat Types Enum
```json
{
  "tool": "blocket_search_boats",
  "params": {
    "query": "segelbåt",
    "types": ["SEGELBAT", "KATAMARAN"],
    "municipality": "Göteborg"
  }
}
```
**Expected:** Only sailboats and catamarans from Göteborg.

### Test 5: MC Types Enum
```json
{
  "tool": "blocket_search_mc",
  "params": {
    "query": "motorcykel",
    "types": ["SPORT", "NAKED"],
    "municipality": "Stockholm"
  }
}
```
**Expected:** Only sport and naked bikes from Stockholm.

### Test 6: Marketplace Search with Municipality
```json
{
  "tool": "marketplace_search",
  "params": {
    "query": "laptop",
    "municipality": "Uppsala",
    "platforms": ["blocket"]
  }
}
```
**Expected:** Cross-platform search filtered to Uppsala (Blocket only, Tradera unaffected).

### Test 7: Get Listing Details with Better Errors
```json
{
  "tool": "get_listing_details",
  "params": {
    "platform": "blocket",
    "listing_id": "INVALID_ID",
    "ad_type": "RECOMMERCE"
  }
}
```
**Expected:** Clear error message explaining the issue and suggesting solutions.

---

## Validation Checks

### ✅ Build Success
```bash
cd /Users/isak/Desktop/CLAUDE_CODE\ /projects/blocket-tradera-mcp
npm run build
```
Should complete with no errors.

### ✅ Municipality Lookup
Check that these municipalities map correctly:
- "Stockholm" → STOCKHOLM
- "Göteborg" → VASTRA_GOTALAND
- "Solna" → STOCKHOLM
- "Nacka" → STOCKHOLM
- "Uppsala" → UPPSALA
- "Malmö" → SKANE

### ✅ Type Enums
Verify these are accepted without errors:

**Boat Types:**
- SEGELBAT, MOTORBAT, RIB, KATAMARAN, JOLLE, HUSBAT, SPEEDBAT, FIBERBAT, RODDBAT, KAJAK, KANOT

**MC Types:**
- SPORT, CRUISER, TOURING, NAKED, ENDURO, CROSS, SCOOTER, MOPED, CLASSIC, ADVENTURE, SUPERSPORT

---

## Edge Cases to Test

### Edge Case 1: Invalid Municipality
```json
{
  "tool": "blocket_search",
  "params": {
    "query": "iPhone",
    "municipality": "NonExistentCity"
  }
}
```
**Expected:** No auto-region selection, search all of Sweden, no results filtered.

### Edge Case 2: Municipality + Platforms (Tradera)
```json
{
  "tool": "marketplace_search",
  "params": {
    "query": "iPhone",
    "municipality": "Stockholm",
    "platforms": ["tradera"]
  }
}
```
**Expected:** Tradera results NOT filtered (Tradera doesn't support geographic filtering).

### Edge Case 3: Empty Results After Municipality Filter
```json
{
  "tool": "blocket_search",
  "params": {
    "query": "extremely_rare_item",
    "municipality": "Gotland"
  }
}
```
**Expected:** Metadata shows `filtered_out: X`, empty results array.

---

## Response Metadata to Verify

All municipality-filtered searches should include:

```json
{
  "results": [...],
  "municipality_filter": "Stockholm",
  "filtered_out": 5,
  "auto_selected_region": "STOCKHOLM",
  "pagination": {...}
}
```

**Check:**
- `municipality_filter` matches input
- `filtered_out` is a number (items removed by filter)
- `auto_selected_region` is present if no region was explicitly provided

---

## Performance Considerations

### Municipality Filtering Performance
- Post-filtering happens in-memory (fast)
- Minimal performance impact
- May result in fewer results per page than requested

### Example:
```
API returns: 50 results from STOCKHOLM region
Municipality filter: "Solna"
Final results: 8 results (42 filtered out)

Metadata: { filtered_out: 42 }
```

---

## Error Messages to Verify

### Error 1: Invalid Listing ID (422)
**Message should include:**
- "Validation error (422)"
- "listing ID may be invalid or ad type mismatch"
- "Try different ad_type (RECOMMERCE/CAR/BOAT/MC)"
- "verify ID from search results"

### Error 2: Listing Not Found
**Message should include:**
- Listing ID that was searched
- Current ad_type used
- Suggestion to match ad_type to listing type

---

## Documentation Checks

Verify tool descriptions include:

### ✅ blocket_search
- "locations filters by region (län), not city"
- "Use municipality for city-level filtering"
- Example: "STOCKHOLM includes all of Stockholm County (Märsta, Kista, etc.)"

### ✅ marketplace_search
- "Region filter only applies to Blocket"
- "Tradera does not support geographic filtering"

### ✅ tradera_search
- "Tradera does NOT support geographic filtering"
- "searches return results from all of Sweden"

---

## Integration Testing

### Test Flow: Full Search Workflow
1. Search with municipality: `blocket_search({ query: "iPhone", municipality: "Stockholm" })`
2. Get details: `get_listing_details({ platform: "blocket", listing_id: "<id_from_results>" })`
3. Verify both work correctly

### Test Flow: Cross-Platform Search
1. Search both platforms: `marketplace_search({ query: "iPhone", municipality: "Stockholm" })`
2. Verify Blocket results are filtered
3. Verify Tradera results are NOT filtered (metadata should indicate this)

---

## Success Criteria

✅ All tests pass without TypeScript errors
✅ Municipality filtering works correctly
✅ Auto-region selection works
✅ Boat and MC type enums validate correctly
✅ Error messages are clear and helpful
✅ Documentation is accurate
✅ Metadata includes filtering information
✅ Build completes successfully
