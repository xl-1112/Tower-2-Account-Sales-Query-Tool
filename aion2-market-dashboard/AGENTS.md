# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable Design Decisions

- Match the supplied pxb7 filter screenshot: white surfaces, restrained gray borders, compact PingFang typography, and orange selection states.
- Keep the dashboard desktop-first and responsive; preserve table readability with horizontal scrolling on narrow screens.
- Use two interaction modes: `查询` filters the already fetched in-memory dataset only, while `重新抓取` fetches fresh data from source platforms.
- Source scrape limits are user-configurable per platform. Default to 100 for `螃蟹` and 100 for `7881`; keep separate `pxb7Limit` and `source7881Limit` parameters when adding UI or API changes.
- Default race is `全部`, so fresh scrapes include both 天族 and 魔族 unless the user selects a specific race.
- Profession options include `拳星` in addition to the original eight classes; keep the frontend selector and backend profession allowlist synchronized.
- Price, equipment, combat power, membership-day, published-time sorting, local filtering, website pagination, and page-size switching are local and must not trigger another scrape.
- Page-size options are 10, 50, and 100 rows per page; switching page size returns to page 1.
- Always show scrape status and timestamp so stale data is not presented as live.
- Use the source game's real icon and Phosphor icons; do not replace visible assets with text glyphs or handmade shapes.
- Source values are `螃蟹` and `7881`; both are implemented. `螃蟹` uses the public JSON list API, and `7881` uses the public search page's same-origin list API with its page signing logic.
- Detail page seller speech is shown in expandable table rows, with the first 3 sorted rows expanded by default. If one detail page fails, keep the account row with list-page fields and leave seller-derived fields empty.
- Production API is served by EdgeOne Pages Function at `cloud-functions/api/listings.js`, mapped to `/api/listings`.
- Pure HTTP scrape requests execute independently rather than through a process-wide queue. Keep per-source timeouts, deduplicate by `source + productId`, and let the client accept only its latest refresh response so a stalled historical request cannot freeze the first page.
- `螃蟹` production scraping uses the public JSON list API `api-pc.pxb7.com/api/search/product/v2/selectSearchPageList`; keep one stable `device_id`/`gio_device` per scrape so pagination remains stable. Do not reintroduce Playwright for EdgeOne deployment.
- Linked-account filtering includes `4连以下`, `单号`, and `4连号` through `8连号`. `4连以下` matches 3连号、2连号、单号; `单号` matches only single accounts, and missing linked-account data is displayed as `单号`. For `螃蟹`, prefer API tags such as `important: ["同职业4连号"]`; otherwise prefer explicit title/detail text like `连体号-5连号`; finally infer `main account + parsed small accounts`, so descriptions like `小号158杀+181护+154弓` count as `4连号`.
