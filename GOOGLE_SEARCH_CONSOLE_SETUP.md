# Google Search Console Setup

1. Go to https://search.google.com/search-console and add property `https://untitledrx.com/` (URL-prefix, not domain property, since you don't control DNS TXT records here easily — HTML file or meta tag verification works fine).
2. Verify ownership using the HTML tag method: Google gives you a `<meta name="google-site-verification" ...>` tag — add it into `Home.dc.html`'s `<helmet>` and redeploy, then click Verify.
3. Submit the sitemap: Search Console → Sitemaps → enter `sitemap.xml` → Submit.
4. Use URL Inspection on `https://untitledrx.com/` → Request Indexing.
5. Repeat URL Inspection + Request Indexing for: `/Rules.dc.html`, `/FAQ.dc.html`, `/Leaderboards.dc.html`, `/Store.dc.html`.
6. Check back in ~1-2 weeks under Performance to see impressions for target queries (2x rust server, vanilla rust server, pc rust server, etc.).
