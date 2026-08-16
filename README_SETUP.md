# UNTITLED RUSTX Leaderboards Setup

This package implements the backend/plugin contract from `RUST_PLUGIN_SPEC.md`.

## 1. Create a Supabase project
Open Supabase -> SQL Editor and run:

`supabase/schema.sql`

## 2. Add these Netlify environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEADERBOARD_INGEST_SECRET`

Use the generated shared secret from `GENERATED_SECRET.txt`.

Do NOT expose the Supabase server-side secret or ingest secret in frontend JavaScript.

## 3. Put these files in the project Netlify deploys
- `package.json`
- `netlify.toml`
- `netlify/functions/`

Then redeploy.

After deployment:
- GET `https://untitledrx.com/api/leaderboards?wipe=current`
- POST `https://untitledrx.com/api/leaderboards/ingest`

## 4. Install Rust plugin
Upload:

`oxide/plugins/UntitledStats.cs`

Grant yourself:

`oxide.grant user YOUR_STEAM_ID untitledstats.admin`

On first load edit:

`oxide/config/UntitledStats.json`

Set:
- Ingest URL: `https://untitledrx.com/api/leaderboards/ingest`
- Bearer Secret: use the value from `GENERATED_SECRET.txt`
- Push Interval Seconds: `600`

Reload:
`oxide.reload UntitledStats`

Test:
`/ustats status`
`/ustats push`

If the server console says `Leaderboard push OK (200)`, open:
`https://untitledrx.com/api/leaderboards?wipe=current`

## 5. Give Claude the frontend handoff
Send Claude `CLAUDE_HANDOFF.md`.

## Important
The plugin is built from the supplied spec: PvP, raiding, farming, PvE, playtime, wipe ID, batch sync.

`clanTag` is left unfilled until your actual clan plugin is chosen.

The current supplied spec does not define heatmap ingestion. Do not add public live coordinates until the heatmap schema/privacy rules are finalized.


## Heatmaps

This updated package also adds:

- POST `/api/leaderboards/heatmap-ingest`
- GET `/api/leaderboards/heatmap?wipe=current&category=pvp&subtype=kills`

Run the updated `supabase/schema.sql` again after deploying this version. The `create table if not exists` statements are safe to rerun.

The Rust plugin aggregates activity into 150m cells and only sends cells that meet the minimum event threshold. It does not send raw coordinates to the public read endpoint.


## 6. Tebex Sponsor Webhook ("Sponsor The Wipe")

Run the updated `supabase/schema.sql` again — it adds the `sponsors` table (safe to rerun).

Add this Netlify environment variable:
- `TEBEX_WEBHOOK_SECRET` — the Webhook Signature Secret shown on Tebex under **Developers > Webhooks > Endpoints**.

In Tebex, add a webhook endpoint pointing at:

`https://untitledrx.com/.netlify/functions/tebex-webhook`

Subscribe it to the `payment.completed` event (and leave `validation.webhook` — Tebex sends that automatically to confirm the endpoint).

On your "Sponsor The Wipe" ($50) package, add a custom checkout field/variable with the identifier `sponsorname` — that's what the webhook reads to get the name.

How it works:
- Every request's `X-Signature` header is verified using `TEBEX_WEBHOOK_SECRET` (SHA256 hash of the raw body, then HMAC-SHA256 of that hash) before anything is processed. Requests that don't match, or that don't come from Tebex's published webhook IPs (18.209.80.3 / 54.87.231.232), are rejected.
- Only `payment.completed` events containing a product literally named "Sponsor The Wipe" are handled; everything else is acknowledged and ignored.
- The `sponsorname` custom variable is sanitized (HTML/script characters stripped, capped at 30 characters) before it touches the database.
- Rows are upserted on `transaction_id`, so a retried webhook can never create a duplicate sponsor.
- Sponsors default to a 7-day expiry (one weekly wipe) from purchase.

## Live website chat bridge (ChatBridge.cs)

Drop `oxide/plugins/ChatBridge.cs` into your server's `oxide/plugins/` folder.

Edit `oxide/config/ChatBridge.json` after first load and set:

```json
{
  "IngestUrl": "https://untitledrx.com/api/chat/game-ingest",
  "ReadUrl": "https://untitledrx.com/api/chat/read",
  "BearerSecret": "<same value as the CHAT_INGEST_SECRET Netlify env var>",
  "PollIntervalSeconds": 5.0
}
```

Add a Netlify environment variable `CHAT_INGEST_SECRET` (any random string) — it must match the plugin's `BearerSecret` exactly.

The plugin does two things:
1. Forwards every global in-game chat message to the website's live chat feed.
2. Polls the website every few seconds for new "Website Viewer" messages and broadcasts them in-game as `Website Viewer: <message>`.

The website side (chat widget, rate limiting, profanity/link/@ filtering, Supabase tables) is already built and deployed — no other website changes are needed once this plugin is installed and configured.

Read endpoint for the frontend ticker:
- GET `https://untitledrx.com/api/sponsors` → `{ "sponsors": ["Name1", "Name2"] }`, active + non-expired only.

### Testing before a real purchase
1. In Tebex, go to **Developers > Webhooks**, click **Send Test**, choose `payment.completed`, and supply any existing transaction ID from your Tebex history (or use the endpoint's **Validate** button first to confirm signature handling — it should return the validation `id` with a 200).
2. Tebex will show you the response status/body it received — confirm you get a `200`.
3. Manually check `https://untitledrx.com/api/sponsors` to see if a name was inserted — note a plain webhook test's fake transaction won't have a real "Sponsor The Wipe" product/`sponsorname` variable attached unless that test transaction actually had one, so the safest check is querying the `sponsors` table directly in Supabase after the test.
4. You can also insert a row manually in Supabase's table editor (any `transaction_id`, `expires_at` a week out, `active = true`) to verify the site ticker picks it up — then delete the test row.
