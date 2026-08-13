# Untitled RustX Leaderboards — Backend/Plugin Spec

The Leaderboards page (`Leaderboards.dc.html`) is a **frontend only**. It currently renders clearly-labeled sample data shaped exactly like what's below, so it's a drop-in once a real feed exists. This document is what to hand to whoever builds the Rust plugin + API (e.g. ChatGPT/a dev).

## 1. What the plugin needs to track, per player, per wipe

Keyed by **Steam ID** (64-bit), reset to zero on wipe:

| Field | Type | Notes |
|---|---|---|
| steamId | string | 64-bit Steam ID |
| name | string | Current display name |
| clanTag | string \| null | From your clan/team plugin, if any |
| kills | int | Player kills (PvP) |
| deaths | int | Player deaths |
| headshots | int | Headshot kills |
| longestKillMeters | int | Longest confirmed kill distance |
| structuresDestroyed | int | Building blocks destroyed via raid (not decay/upkeep loss) |
| doorsDestroyed | int | Doors destroyed via raid |
| rocketsUsed | int | Rockets fired at structures |
| c4Used | int | C4 used on structures |
| satchelsUsed | int | Satchel charges used |
| explosiveAmmoUsed | int | 40mm HE / explosive ammo used on structures |
| wood, stone, cloth, metalOre, sulfurOre, hqmOre | int | Resources gathered (not looted from crates — gathered from source) |
| scientistsKilled | int | NPC scientist kills (any monument) |
| animalsKilled | int | Wildlife kills |
| bradleyKills | int | Bradley APC destroyed (credit to killer) |
| heliKills | int | Patrol Helicopter destroyed (credit to killer) |
| otherNpcKills | int | Any other NPC kill not covered above |
| playtimeSeconds | int | Total connected time this wipe |

**Do not send fields you can't collect.** The frontend only displays what's in the payload — leave a field out rather than send a fake 0/null if it's genuinely untracked.

## 2. Wipe identification

Send a `wipeId` with every payload — recommend `map_seed` + `wipe_started_at` (ISO 8601) concatenated, or just an incrementing integer your plugin persists. The frontend uses this to know "current" vs "previous" and will eventually list all past wipes once storage exists.

## 3. Clan/team identification

If you're not using Rust's native `Clan` plugin, any tag-based grouping works as long as it's consistent — a `clanTag` string per player is all the frontend needs; it aggregates clan totals client-side (or server-side, your call) from member rows.

## 4. API endpoint(s)

Simplest option — one endpoint, plugin pushes on an interval:

```
POST /api/leaderboards/ingest
Authorization: Bearer <shared secret, stored server-side only>
Content-Type: application/json

{
  "wipeId": "map_12345_2026-08-07T18:00:00Z",
  "generatedAt": "2026-08-12T01:00:00Z",
  "players": [ { ...fields above... }, ... ]
}
```

Read side (what the site fetches):

```
GET /api/leaderboards?wipe=current
GET /api/leaderboards?wipe=<wipeId>
```

Returns the same player array plus any server-computed aggregates.

## 5. Update frequency

Every 5–15 minutes is plenty — this is a leaderboard, not a live scoreboard. Avoid per-kill webhooks; batch and push on an interval to keep load low.

## 6. Derived stats (computed client-side already, no need to send)

- `kd` = kills / max(deaths, 1)
- `totalResources` = wood + stone + cloth + metalOre + sulfurOre + hqmOre
- `raidScore` = rockets×25 + c4×20 + satchels×8 + explosiveAmmo×0.5 + structuresDestroyed×3 + doorsDestroyed×2
- `overallScore` = kills×4 + raidScore×0.6 + totalResources/500 + playtimeHours×3

Feel free to tune these weights — they're a starting point, not gospel.

## 7. Heatmap data contract (aggregated only — never live positions)

The Heatmaps view visualizes activity density, never exact/live coordinates. Send pre-aggregated grid-cell counts, not raw event coordinates.

**Grid**: divide the map into fixed-size cells (recommend 150m × 150m). Send `cellX`/`cellY` as integer cell indices (`floor(worldX / 150)`), never raw world coordinates.

**Aggregation window**: bucket by wipe, updated on the same 5–15 min interval as stats — never per-event/real-time.

Payload shape:

```
POST /api/leaderboards/heatmap-ingest
Authorization: Bearer <same shared secret>
Content-Type: application/json

{
  "wipeId": "map_12345_2026-08-07T18:00:00Z",
  "category": "pvp" | "raiding" | "farming" | "pve",
  "subtype": "kills" | "deaths" | "rockets" | "c4" | "satchels" | "wood" | "stone" | "cloth" | "metal" | "sulfur" | "scientists" | "animals" | "bradley" | "heli",
  "cells": [ { "cellX": 12, "cellY": 40, "count": 7 }, ... ]
}
```

**Privacy rules — non-negotiable**:
- No per-player or per-base attribution in heatmap data — counts only, aggregated across all players in a cell.
- No raw world coordinates — cell indices only, at 150m+ resolution.
- No live/real-time push — heatmaps reflect historical density only, same batch cadence as everything else.
- Suppress any cell with fewer than ~3 events to avoid singling out one active base.

## 8. What's already built and ready on the frontend

- Players / Clans toggle
- Overview / PvP / Raiding / Farming / PvE tabs (PvE is players-only)
- Top 3 podium + full sortable table per tab
- Player profile (click any row) — stats + per-category rank
- Clan profile (click any row in Clans mode) — aggregate stats + member list
- Search
- Current Wipe / Previous Wipe toggle (previous wipe needs real archived data once available)
- Empty/no-results state

Once the API above returns real data, swap the sample arrays in `Leaderboards.dc.html`'s `playersData`/`clanDefs` getters for a `fetch()` call — the rest of the render logic (scoring, ranking, profiles, search) already works off that shape unchanged.
