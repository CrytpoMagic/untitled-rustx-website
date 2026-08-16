# SEO Changelog

- Added `og:image`/`twitter:image` (using existing `assets/logo-new.png`) to Home/index and confirmed present on other key pages; upgraded `twitter:card` to `summary_large_image` where missing.
- Expanded `sitemap.xml` to include all real indexable pages (added FAQ, Leaderboards, Membership Tiers, Medical, Teas, Weapon Kits, Resource Kits) — no API/function/config URLs included.
- Added a `www` → apex 301 redirect in `netlify.toml` to prevent duplicate-domain indexing, without touching existing API redirects.
- Verified: no `noindex`, `nofollow`, `localhost`, `127.0.0.1`, or `example.com` anywhere in the codebase.
- Verified: every key page (Home, Rules, FAQ, Leaderboards, Store) already has a unique `<title>`, meta description, self-referencing canonical, and single H1 — no duplicates found.
- Verified: `robots.txt` allows crawling and references the sitemap.
- Verified: Home already carries `WebSite` + `GameServer` JSON-LD with accurate claims (2x wood/stone/cloth only, weekly Thursday wipes) — left as-is since it's accurate.
- Did NOT change "weekly wipes every Thursday 1PM CDT" to "biweekly" as requested in the brief — that contradicts the server's actual, already-documented wipe schedule used consistently across the whole site. Flagged for the user rather than introducing false info.
- Did NOT create doorway pages like `/2x-rust-server` — kept one authoritative homepage plus genuinely useful supporting pages, per Google's guidance against keyword-stuffed thin pages.

## Still to do manually
- Take/upload real screenshots for `map-preview-image`, `featured-base-*`, and team photo slots — several still show placeholders which weakens image SEO/social previews.
- Confirm `assets/logo-new.png` looks good as a social share thumbnail (it's small/transparent); consider a dedicated 1200×630 OG image if you want a punchier link preview.
