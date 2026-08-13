# Claude handoff — live stats + heatmaps

Real leaderboard endpoints:

- `GET https://untitledrx.com/api/leaderboards?wipe=current`
- `GET https://untitledrx.com/api/leaderboards?wipe=<wipeId>`

Heatmap endpoint:

- `GET https://untitledrx.com/api/leaderboards/heatmap?wipe=current&category=pvp&subtype=kills`

Supported heatmap categories/subtypes:

- `pvp`: `kills`, `deaths`
- `raiding`: `rockets`, `c4`, `satchels`
- `farming`: `wood`, `stone`, `cloth`, `metal`, `sulfur`
- `pve`: `scientists`, `animals`, `bradley`, `heli`

Heatmap response:

```json
{
  "wipeId": "map_...",
  "category": "pvp",
  "subtype": "kills",
  "cellSizeMeters": 150,
  "cells": [
    { "cellX": 12, "cellY": 40, "count": 7 }
  ]
}
```

The data is already privacy-reduced:
- no Steam IDs in heatmap rows
- no base/player attribution
- no raw world coordinates
- 150m grid cells
- cells with fewer than 3 events are suppressed
- data arrives in the same batched cadence as leaderboard stats, not real-time

Wire the Heatmaps UI to this GET endpoint.
Keep the existing Players/Clans leaderboard logic and replace sample arrays with the normal leaderboard GET endpoint.

Do not expose `LEADERBOARD_INGEST_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` in browser JavaScript.
