#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://api.shouldigo.surf";

const server = new McpServer({
  name: "shouldigo-surf",
  version: "1.0.2",
});

// --- Tool: check_conditions ---

server.registerTool(
  "check_conditions",
  {
    description:
      "Get real-time surf conditions for a specific beach. Returns score (0-100), verdict (yes/no/maybe), wave height, wind, water temp, trend forecast, and board recommendation.",
    inputSchema: {
      spotId: z
        .string()
        .describe(
          'The spot identifier, e.g. "pipeline", "bells_beach", "tel_aviv_maaravi". Use list_spots to find valid IDs.'
        ),
    },
  },
  async ({ spotId }) => {
    try {
      const res = await fetch(`${API_BASE}/api/agent/${encodeURIComponent(spotId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          content: [
            {
              type: "text",
              text: err.hint
                ? `Error: ${err.error}\n${err.hint}`
                : `Error: Could not fetch conditions for "${spotId}" (HTTP ${res.status})`,
            },
          ],
        };
      }
      const data = await res.json();
      return { content: [{ type: "text", text: formatConditions(data) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
      };
    }
  }
);

// --- Tool: find_nearest_spot ---

server.registerTool(
  "find_nearest_spot",
  {
    description:
      "Find the nearest surf spot to given coordinates and return its current conditions. If no coordinates provided, auto-detects location.",
    inputSchema: {
      lat: z.number().min(-90).max(90).optional().describe("Latitude"),
      lon: z.number().min(-180).max(180).optional().describe("Longitude"),
    },
  },
  async ({ lat, lon }) => {
    try {
      const params = new URLSearchParams();
      if (lat != null) params.set("lat", String(lat));
      if (lon != null) params.set("lon", String(lon));
      const url = `${API_BASE}/api/agent/nearest${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        return {
          content: [
            { type: "text", text: `Error: Could not find nearest spot (HTTP ${res.status})` },
          ],
        };
      }
      const data = await res.json();
      return { content: [{ type: "text", text: formatConditions(data) }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
      };
    }
  }
);

// --- Tool: list_spots ---

server.registerTool(
  "list_spots",
  {
    description:
      "List all available surf spots. Optionally filter by country name.",
    inputSchema: {
      country: z
        .string()
        .optional()
        .describe('Filter by country name, e.g. "USA", "Australia", "Israel"'),
    },
  },
  async ({ country }) => {
    try {
      const res = await fetch(`${API_BASE}/api/spots`);
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Error: Could not fetch spots (HTTP ${res.status})` }],
        };
      }
      const data = await res.json();
      let spots = data.spots || [];

      if (country) {
        const filter = country.toLowerCase();
        spots = spots.filter(
          (s) => s.country && s.country.toLowerCase().includes(filter)
        );
      }

      if (spots.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: country
                ? `No spots found for country "${country}". Try without a filter to see all spots.`
                : "No spots available.",
            },
          ],
        };
      }

      const grouped = {};
      for (const s of spots) {
        const c = s.country || "Other";
        if (!grouped[c]) grouped[c] = [];
        grouped[c].push(s);
      }

      let text = `Available surf spots (${spots.length}):\n\n`;
      for (const [c, list] of Object.entries(grouped)) {
        text += `${c}:\n`;
        for (const s of list) {
          text += `  - ${s.name} (${s.id})\n`;
        }
        text += "\n";
      }

      text += `Use check_conditions with a spot ID to get current conditions.`;
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
      };
    }
  }
);

// --- Prompts ---

server.prompt(
  "surf_check",
  {
    spot: z.string().optional().describe('Spot name or ID, e.g. "pipeline" or "bondi_beach"'),
  },
  ({ spot }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: spot
            ? `Should I go surfing at ${spot} right now? Use check_conditions to get the latest data, then give me a quick verdict: yes, no, or maybe — with a one-line reason why. Keep it casual.`
            : `Should I go surfing right now? Use find_nearest_spot to find my closest beach, check the conditions, and give me a quick verdict: yes, no, or maybe — with a one-line reason why. Keep it casual.`,
        },
      },
    ],
  })
);

server.prompt(
  "surf_trip",
  {
    country: z.string().describe('Country to explore, e.g. "Portugal", "Australia", "USA"'),
  },
  ({ country }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I'm planning a surf trip to ${country}. Use list_spots to find all available spots there, then check_conditions on the top 3. Rank them by score and recommend which one I should hit first, with a short reason for each.`,
        },
      },
    ],
  })
);

// --- Helpers ---

function formatConditions(data) {
  const lines = [];
  lines.push(`${data.spot.name} (${data.spot.country}) — Surf Conditions`);
  lines.push(`Score: ${data.score}/100 (${data.rating})`);
  lines.push(`Verdict: ${data.verdict}`);
  if (data.summary) lines.push(`Summary: ${data.summary}`);
  lines.push("");

  const c = data.conditions;
  if (c) {
    if (c.waveHeight?.avg) lines.push(`Wave Height: ${c.waveHeight.avg}${c.waveHeight.unit}`);
    if (c.wavePeriod?.value) lines.push(`Wave Period: ${c.wavePeriod.value}${c.wavePeriod.unit}`);
    if (c.wind?.speed != null) {
      let w = `Wind: ${c.wind.speed} ${c.wind.unit}`;
      if (c.wind.direction) w += ` ${c.wind.direction}`;
      lines.push(w);
    }
    if (c.waterTemp?.value != null) lines.push(`Water Temp: ${c.waterTemp.value}°${c.waterTemp.unit}`);
  }

  if (data.board) lines.push(`\nRecommended Board: ${data.board}`);

  if (data.trend) {
    lines.push("");
    if (data.trend.direction) lines.push(`Trend: ${data.trend.direction}`);
    if (data.trend.bestWindow) lines.push(`Best Window: ${data.trend.bestWindow}`);
    if (data.trend.message) lines.push(`Forecast: ${data.trend.message}`);
  }

  lines.push(`\nView on web: ${data.links?.web || `https://shouldigo.surf/?spot=${data.spot.id}`}`);
  return lines.join("\n");
}

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Should I Go? MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
