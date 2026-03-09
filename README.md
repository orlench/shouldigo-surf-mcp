# shouldigo-surf-mcp

MCP server for [Should I Go?](https://shouldigo.surf) — real-time surf conditions for 73+ beaches worldwide.

Use this with Claude Desktop, Claude Code, or any MCP-compatible client to check surf conditions, find nearby spots, and get a score + verdict on whether it's worth paddling out.

## Setup

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "shouldigo-surf": {
      "command": "npx",
      "args": ["-y", "shouldigo-surf-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add shouldigo-surf -- npx -y shouldigo-surf-mcp
```

## Tools

### check_conditions

Get real-time surf conditions for a specific beach.

**Input:** `{ "spotId": "pipeline" }`

**Returns:** Score (0-100), verdict (yes/no/maybe), wave height, wind, water temp, trend, and board recommendation.

### find_nearest_spot

Find the nearest surf spot to given coordinates.

**Input:** `{ "lat": 21.66, "lon": -158.05 }` (optional — auto-detects if omitted)

### list_spots

List all available surf spots, optionally filtered by country.

**Input:** `{ "country": "Australia" }` (optional)

## Example

Ask Claude:

> "What are the surf conditions at Pipeline right now?"

> "Find me the nearest surf spot to Sydney and check if it's worth going"

> "List all surf spots in Portugal"

## API

This MCP server calls the public [Should I Go? API](https://api.shouldigo.surf). No API key needed.

Rate limited to 60 requests per 15 minutes. For higher limits, email support@shouldigo.surf.

## License

MIT
