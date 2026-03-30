# Castle TCG — Performance audit (Cloudflare Workers + Supabase)

**Scope:** Repository review of `src/index.ts`, `public/app.js`, `public/index.html`, `public/dashboard.html`, migrations, and related assets.  
**Assumption:** Production behaves like this code unless you have divergent deploy branches. Estimates are **qualitative** (low / medium / high impact) because live metrics (RUM, Supabase query stats, Worker CPU) were not available.

---

## Executive summary

The largest costs are (1) **`/api/bootstrap` doing far more than “assemble UI state”**—including loading **all streamers**, optional **Twitch Helix** calls, multiple **extra Supabase round-trips**, and **large debug response headers**—and (2) **frontend loading strategy** (Tailwind CDN, multiple heavy CDNs, large inline-dependent scripts) on first paint. Caching exists for **Upstash Redis** in some paths (grants, rate limits, branding warm) but **not** for the hottest read endpoints at the edge.

---

## API surface (representative)

| Area | Example endpoints | Typical extra latency drivers |
|------|---------------------|-------------------------------|
| Bootstrap | `GET /api/bootstrap` | Supabase RPC + DB + optional Twitch API + JS merge + large JSON |
| Collection | `GET /api/collection` | `enriched_user_cards` `select('*')`, unbounded rows |
| Streamer | `GET /api/streamer/config`, `GET /api/streamers` | DB read; no edge cache in `secureResponse` |
| Mechanics | `GET /api/mechanics` | `select('*')` every time |
| Creator / admin | Many `/api/creator/*`, `/api/admin/*` | Auth + DB + sometimes Twitch/Stripe subrequests |
| Real-time-ish | OBS routes, webhooks | Polling or event bursts; webhooks do grant + logging |

**Worker constraint:** Each **Redis** `get`/`setex` and each **external** HTTP call (Twitch, Stripe, etc.) counts toward **subrequest limits** and adds tail latency.

---

## Top 10 performance issues (ranked)

### 1. `/api/bootstrap` is overloaded (critical path)

**Why it’s slow**

- After `supabase.rpc('get_bootstrap_data_v4', …)` the handler still:
  - Loads **`streamers` with a wide `select`** for *every* active streamer to match Twitch follows in memory.
  - For Twitch users: decrypt tokens, call **`getTwitchFollows` (Helix)** with possible refresh + retry.
  - Runs **additional queries**: `platform_staff`, `streamer_team_members` + **`streamers` `.in('id', …)`**, optional **missing favorites** resolution.
- Response includes **`creator_cards`** and other large arrays in one JSON payload.
- **Debug headers** (`x-debug-follows-raw-ids`, `x-debug-all-streamers`, `x-debug-streamers-detail`, etc.) can carry **large strings** on every response → extra bandwidth and serialization cost.

**Fix**

- **Split bootstrap**: e.g. `GET /api/bootstrap/core` (user, streamer, csrf, stats, sections metadata) and lazy-load `creator_cards`, heavy lists, or binder-specific data when the user opens those tabs.
- **Move follow matching server-side**: store normalized `twitch_id` on `streamers`, query only `streamers` rows where `twitch_id = ANY($1)` from Helix IDs (no full-table fetch into Worker).
- **Gate debug headers** behind `env.DEBUG_BOOTSTRAP` or non-production only; default off in prod.
- **Consider** moving Twitch follow fetch to **onboarding-only** or **background** (user taps “Refresh follows”) so binder/dashboard first paint does not wait on Helix.

**Estimated improvement:** **High** (often hundreds of ms to multiple seconds on cold Helix + large streamer tables).

---

### 2. Unbounded collection payload (`GET /api/collection`)

**Why it’s slow**

- `enriched_user_cards.select('*')` with filters and `order('created_at')` returns **every column** for **every row**—payload grows linearly with collection size; parse/render cost on the client grows with it.

**Fix**

- Add **`limit` / `cursor`** query params; default cap (e.g. 200–500) with “load more”.
- Add a **lite projection** for grid views: id, name, rarity, image_url, streamer_id, mechanic fields needed for badges—omit long descriptions where unused.
- Ensure composite index alignment with filters: you already have `idx_user_cards_twitch_streamer_created` (see migrations)—verify plans in Supabase for `(twitch_id, streamer_id, created_at DESC)`.

**Estimated improvement:** **High** for large collectors; **medium** for small ones.

---

### 3. Production use of `cdn.tailwindcss.com` (JIT in the browser)

**Why it’s slow**

- The Play CDN downloads and runs the **full Tailwind compiler** in the client on **every first visit**; it blocks/interleaves with paint and is **much slower** than a prebuilt CSS file.
- Same pattern in `dashboard.html` and `index.html`.

**Fix**

- Add a **build step** (Tailwind CLI, Vite, etc.) emitting a **single minified CSS**; purge unused classes. Keep free tier: build on CI or locally, commit `dist` or deploy artifact.
- Remove `<script src="https://cdn.tailwindcss.com">` from production HTML.

**Estimated improvement:** **High** for TTFB-to-interactive on cold visits.

---

### 4. Heavy third-party scripts on the main shell (`index.html`)

**Why it’s slow**

- Loads include **Sortable**, **html2canvas**, **fabric.js** (and dashboard adds **Chart.js**) from CDNs. Even if cached, **parse/compile** cost on main thread is significant; many users may not need fabric/html2canvas on initial route.

**Fix**

- **Dynamic `import()`** or load scripts only when entering features that need them (binder export, card editor, etc.).
- Prefer **smaller alternatives** or **code-split** vendor chunks if you introduce a bundler.

**Estimated improvement:** **Medium–high** depending on device tier.

---

### 5. No edge caching for safe, read-heavy JSON

**Why it’s slow**

- `secureResponse` responses generally **omit** `Cache-Control` for API JSON (unlike the one `private, max-age=120` case elsewhere). Every mechanics/streamers/config hit goes **Worker → Supabase**.

**Fix**

- **Cloudflare Cache API** or **KV** for:
  - `GET /api/mechanics` (TTL **300–900s**; invalidate on admin mechanic writes).
  - `GET /api/streamers` (short TTL, **30–120s**, or KV bump on streamer activate).
  - Parts of `streamer/config` that rarely change (brand colors, pack image)—**must** exclude secrets; you already strip `stripe_connect_id` for public fields—cache the **public JSON blob** with TTL **60–300s**.
- Use **`Cache-Control: public, s-maxage=…, stale-while-revalidate`** only for **truly public** data.

**Estimated improvement:** **Medium** (reduces Supabase egress and Worker–DB round trips).

---

### 6. Redis used selectively; bootstrap hot path not cached

**Why it’s slow**

- `fetchWithCache` + branding warm help **repeat** branding reads, but **bootstrap** still recomputes heavy merge logic and hits DB/Twitch every time (client uses `sessionStorage` stale-while-revalidate, which **does not** reduce server work).

**Fix**

- **Not** full-bootstrap in KV (too user-specific)—but cache **slices**: e.g. mechanics list, global streamers discovery list, achievement catalog.
- For **optional** cost: short-TTL KV key `bootstrap:{userId}:streamer:{streamerId}` **only if** you accept staleness or strict invalidation on grant/trade—often better to fix query shape first.

**Estimated improvement:** **Low–medium** unless you were hammering the same endpoints from many tabs/devices.

---

### 7. `GET /api/mechanics` uses `select('*')`

**Why it’s slow**

- Over-fetching columns and any large text fields on every dust/mechanics UI open.

**Fix**

- `select('id, name, display_name, icon, base_cost, …')` explicit list.
- Combine with **§5** cache.

**Estimated improvement:** **Low–medium** (bandwidth + JSON parse).

---

### 8. Logging and debug work on the hot path

**Why it’s slow**

- `console.log` for bootstrap sections, Twitch match diagnostics, webhook paths, etc. In Workers, logging has **non-zero overhead** and noisy logs make **Logpush** costly at scale.

**Fix**

- Wrap verbose logs in **`env.ENVIRONMENT !== 'production'`** or a feature flag.
- Keep **one structured log line** per request with **correlation id** instead of many strings.

**Estimated improvement:** **Low** per request, but **medium** at volume; improves signal/noise.

---

### 9. N+1-style patterns in creator/admin flows (risk)

**Why it’s slow**

- Large `index.ts` with many handlers increases risk of **per-row queries** in loops (not fully enumerated here). Any `for` + `await supabase.from(...).eq('id', …)` is a **Worker CPU + subrequest** killer.

**Fix**

- Audit handlers that loop cards/users: batch `.in('id', ids)` or use **SQL functions** returning joined rows once.
- Add **integration tests** or lint rule for `await` inside `for` over dynamic lists.

**Estimated improvement:** **High** where the pattern exists; **n/a** where it doesn’t.

---

### 10. Images and CDN behavior

**Why it’s slow**

- Card art is typically **one URL per image**; without **responsive variants** (width/quality), mobile loads full-resolution assets. R2/Supabase storage **depends on cache headers** you set at upload/serve time.

**Fix**

- Serve images via **Cloudflare** with **long `Cache-Control`** on immutable filenames (hash in path).
- Offer **two sizes** (thumb + full) in the API or transform with **Cloudflare Images** only if within budget; cheapest path is **pre-generate WebP thumbs** at upload (Worker already caps edge pixels for uploads—good).

**Estimated improvement:** **Medium** on image-heavy binder views.

---

## Database (Supabase)

- **Views:** `enriched_user_cards` joins multiple tables—reasonable for correctness; cost is proportional to **selected columns and row count**. Prefer **narrow selects** and **pagination**.
- **Indexes:** `008_performance_indexes.sql` and others define sensible indexes—**verify** with `EXPLAIN (ANALYZE)` on:
  - collection queries by `(twitch_id, streamer_id)` + sort by `created_at`
  - leaderboard RPC internals (not in repo migrations grep—validate in Supabase SQL editor)
- **RPC `get_bootstrap_data_v4`:** Centralizing reads is good; ensure it does **not** duplicate work the Worker then repeats (e.g. streamers list + follows).

---

## Caching strategy (free-tier friendly)

| Data | Store | TTL | Invalidation |
|------|-------|-----|----------------|
| Mechanics catalog | KV or Cache API | 5–15 min | On mechanic admin mutation |
| Public streamer list | KV / Cache API | 1–2 min | Webhook or admin on streamer active toggle |
| Streamer public config | KV | 1–5 min | PATCH creator settings |
| Rate limit counters | Upstash (existing) | sliding window | N/A |
| User session / CSRF | Never CDN-cache | — | Cookie + server |

**Avoid** caching personalized collection JSON at the edge without a **private** cache key and **short TTL**—usually not worth complexity vs fixing payload size.

---

## Network & architecture — requests per load (collector app)

**Typical flow (from `public/app.js`):**

1. `GET /views/{view}.html` (shell fragments)
2. **`GET /api/bootstrap?...`** (dominant) — may run **again** in background when `sessionStorage` cache exists
3. Additional fetches when user opens dust, trades, admin, etc.

**Parallelization**

- After splitting bootstrap, fire **independent** fetches with `Promise.all` only for **non-dependent** resources (e.g. mechanics + favorites metadata)—**do not** parallelize CSRF/bootstrap if cookies race (your `dashboard.js` comment about `/api/csrf` vs bootstrap is correct).

---

## Frontend performance

- **Render-blocking:** Google Fonts CSS (blocking unless `media` trick + swap); Font Awesome **entire** CSS.
- **Re-renders:** Large `app.js` likely re-renders binder on many state changes—**profile** with Chrome Performance; virtualize grid if > ~100 DOM card nodes.
- **sessionStorage bootstrap:** Good for perceived speed; **server** still pays full cost on refresh—see §1.

---

## File & asset handling

- Prefer **`font-display: swap`** (already often on Google Fonts URL via `display=swap`).
- **Self-host** subset fonts or use **fewer weights** to cut CSS payload.
- Ensure **static assets** on Workers (`ASSETS`) send **`Cache-Control: public, max-age=31536000, immutable`** for hashed filenames.

---

## Logging & background work

- Move **non-blocking** work (activity logs, achievement sync already sometimes deferred) off the **critical webhook response** path where possible: return `200` quickly, **`waitUntil`** queue to async processing (Queues or fire-and-forget with caution on Worker lifetime).
- Stripe/Twitch failures: fail fast; **retry** in background, not in user-facing request unless required.

---

## Quick wins (&lt; 1 hour each)

1. **Remove or env-gate bootstrap `x-debug-*` headers** in production → instant bandwidth + header size win.
2. **Remove verbose `console.log` in bootstrap** behind `DEBUG` flag.
3. **Mechanics endpoint:** narrow `select(...)` + **5–10 min** KV/Cache API cache.
4. **`/api/collection`:** add `?limit=` default cap (e.g. 500) and document; return `next_cursor` if you add keyset pagination later.
5. **Preconnect only what you use**; drop duplicate preconnects if any.
6. **`/api/cards/count`:** already `head: true`—good; ensure no accidental `select('*')` elsewhere for counts.

---

## Brutally honest conclusion

The codebase **already** shows awareness of cost (Redis optional for webhooks, RPC for bootstrap, indexes in migrations). The remaining pain is **classic**: **one endpoint does too much**, **first-load frontend stack is dev-oriented (Tailwind CDN)**, and **payloads are wider than the UI needs**. Fixing **bootstrap shape** and **Tailwind build** alone will dwarf micro-optimizations elsewhere.

---

## Suggested next steps (measurement)

1. Add **Server-Timing** or structured logs: RPC duration, streamers query duration, Helix duration, JSON stringify size.
2. Supabase **Query Performance** + **Advisor** for slow queries on `enriched_user_cards` and RPC.
3. Lighthouse on `/` and `/dashboard` cold load; **Network** panel: count bytes from Tailwind CDN vs CSS file after fix.

---

## Remediation shipped (2026)

The following aligns this document with work completed in-repo (see `package.json` `build:css`, `src/index.ts`, `public/app.js`, `migrations/050_match_streamers_for_bootstrap_follows.sql`):

- **Bootstrap:** `DEBUG_BOOTSTRAP` / `ENVIRONMENT` gating, `Server-Timing`, `?lite=1` smaller payload; follow matching via RPC `match_streamers_for_bootstrap_follows` (apply migration in Supabase). Client uses `lite=1` on bootstrap URLs; dashboard cache key bumped for the new URL shape.
- **API:** Mechanics narrowed select + Redis cache; streamers + streamer config cached with bust hooks on creator settings; collection limit + explicit `enriched_user_cards` columns.
- **Frontend:** Tailwind CLI → `public/tailwind-built.css` (run `npm run build:css` before deploy); Sortable, html2canvas, fabric, and Chart.js loaded on demand; binder card images use `loading="lazy"`.
- **Webhooks:** Twitch and Kick notification handling deferred with `executionCtx.waitUntil` after verification/idempotency so the Worker responds with `200` immediately while grants continue in the background.
- **Baselines:** Run **Lighthouse** + **Network** on `/` and `/dashboard` after deploy; in Supabase run **EXPLAIN (ANALYZE)** on the collection query pattern and compare before/after payload sizes.

---

*Generated from repository analysis; update this document when major routes or deploy topology change.*
