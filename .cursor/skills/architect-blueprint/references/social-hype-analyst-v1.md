# Social Hype Distribution Agent v1

> Maps **where {brand} publishes** and recommends the **same primary channel** for companion content.

## Problem

Makers need to know which social channel a brand is investing in during an active campaign — and prefer that same medium to reach the warm audience.

## Pipeline

1. **Collectors** (`server/discovery/socialHypeCollectors.js`) — Serper site queries + Apify Twitter + DataForSEO PAA
2. **Normalizer** (`server/discovery/normalizeHypeDistribution.js`) — `hypeDistribution.v1` with `channelIntel.preferredChannelForUser`
3. **Analyst** (`server/agents/socialHypeAnalyst.js`) — Groq narrative (does not alter percentages)
4. **Client** — Intel Market Hype panel + canvas agent `social-hype-analyst`

## API

`POST /api/agents/social-hype-analyst`

```json
{ "brandName": "Nike", "keyword": "Nike", "locale": "en" }
```

## UI

- Intel → Market Hype → **Scan distribution**
- Canvas → Social Hype Analyst node → Run

## Credits

2.5 credits per scan (`AGENT_RUN_CREDIT_COST`).
