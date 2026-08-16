# SEO Verification — Actual Production Values

## Homepage <head>
- title: Untitled RustX — Vanilla Rust Server, 2x Gather Rate | Weekly Wipes Thursday 1PM CDT
- meta description: Untitled RustX is a vanilla Rust server with a 2x gather rate on wood, stone, and cloth — everything else stock rates. Weekly wipes every Thursday at 1PM CDT, active admins, and a growing community. Join a fair, fun PC Rust server built for new players and veterans alike.
- canonical: https://untitledrx.com/
- robots meta: index, follow
- H1 (visible hero): "Where every wipe begins a new story." — brand-forward, not keyword-targeted
- og:title / og:description / og:url: same as above / https://untitledrx.com/
- og:image: https://untitledrx.com/assets/logo-new.png (1536x1024 PNG, 47% fully transparent, 2.1MB — NOT ideal for social cards)
- twitter:card: summary_large_image; twitter:image: same file

## JSON-LD (exact, 2 blocks)
```json
{"@context":"https://schema.org","@type":"WebSite","name":"Untitled RustX","url":"https://untitledrx.com/","description":"A vanilla Rust server with a 2x gather rate on wood, stone, and cloth, weekly wipes every Thursday at 1PM CDT, and an active community.","publisher":{"@type":"Organization","name":"Untitled RustX"}}
```
```json
{"@context":"https://schema.org","@type":"GameServer","name":"Untitled RustX","game":{"@type":"VideoGame","name":"Rust"},"serverStatus":"https://schema.org/Online","url":"https://untitledrx.com/"}
```

## robots.txt (full)
```
User-agent: *
Allow: /

Sitemap: https://untitledrx.com/sitemap.xml
```

## sitemap.xml — full URL list (13)
https://untitledrx.com/
https://untitledrx.com/Server.dc.html
https://untitledrx.com/WipeSchedule.dc.html
https://untitledrx.com/Rules.dc.html
https://untitledrx.com/FAQ.dc.html
https://untitledrx.com/Leaderboards.dc.html
https://untitledrx.com/Store.dc.html
https://untitledrx.com/MembershipTiers.dc.html
https://untitledrx.com/Medical.dc.html
https://untitledrx.com/Teas.dc.html
https://untitledrx.com/WeaponKits.dc.html
https://untitledrx.com/ResourceKits.dc.html
https://untitledrx.com/Minicopter.dc.html

No API/function/config URLs, no duplicates.

## netlify.toml redirects
```
[[redirects]]
  from = "https://www.untitledrx.com/*"
  to = "https://untitledrx.com/:splat"
  status = 301
  force = true
```
Plus 5 pre-existing API redirects (leaderboards, ingest, heatmap, heatmap-ingest, sponsors) — untouched. HTTPS itself is auto-enforced by Netlify on custom domains; no redundant rule added.

## noindex/nofollow/Disallow/X-Robots-Tag search
Zero matches anywhere in the codebase.

## Known real issue (not yet fixed, needs your OK)
og:image is the transparent nav logo at 2.1MB — will render poorly/invisible on Discord/Twitter link previews. Recommend a proper 1200x630 branded image instead.
