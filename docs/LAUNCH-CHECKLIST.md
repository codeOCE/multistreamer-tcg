# Launch checklist

Living document for production readiness. Check items off as you complete them. Use **Owner** to assign responsibility (name or role).

---

## 1. Data & schema

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [x] | Apply all pending Supabase migrations to **production** in order | | Verified 2026-07-09 via `list_migrations` against project `tfvivclqjqgyowvuhzxc` (CreatorCards, ACTIVE_HEALTHY) — DB is current through `perf_notifications_policy_initplan` (2026-07-06). |
| [x] | Verify RLS and grants for binders / `user_binders` / `user_binder_cards` | | Verified 2026-07-09 via Supabase security advisors: **zero** ERROR/WARN-level findings, only INFO (unindexed FKs, unused indexes, RLS-no-policy on the separate service-role-only `bot` schema — expected per [[project_db_access_architecture]]). |
| [ ] | Confirm enriched views and dependent queries work after migrations | | |
| [~] | Document prod vs staging migration state (last applied revision) | | **Gap found 2026-07-09:** two migrations applied to prod (`security_lockdown_users_read_rls_grants` 2026-07-03, `perf_notifications_policy_initplan` 2026-07-06) have no corresponding file in the repo's `migrations/` folder — replaying the repo against a fresh DB would not reproduce current prod state. Also: `migrations/083_battle_mmr_system.sql` and `migrations/083_fix_binder_color_priority.sql` share a number — ambiguous ordering. Needs a decision on how to backfill/renumber. |

---

## 2. Security & privacy

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [x] | Remove or **feature-flag** `x-debug-*` headers on `/api/bootstrap` in production | | Verified 2026-07-09: gated behind `isDebugBootstrap(env)` (`DEBUG_BOOTSTRAP` secret), which is unset in prod — headers are off. |
| [ ] | Re-verify `/api/share-image` allowlist against real card image URLs | | CDN + Supabase storage; extend only with SSRF review |
| [ ] | Confirm admin-only routes and destructive actions (e.g. user wipe) are protected | | |
| [x] | Production secrets: `FRONTEND_URL`, `CREATOR_CDN_BASE`, `SESSION_SECRET`, Twitch keys | | Verified 2026-07-09 via `wrangler secret list` — all set. `UPSTASH_REDIS_REST_URL`/`TOKEN` set 2026-07-09 — Redis caching layer (mechanics/streamers/branding) is now active. **Still not set:** `ENCRYPTION_SECRET` (safe — falls back to `SESSION_SECRET` at [src/index.ts:1159-1161](src/index.ts#L1159-L1161)), `ENVIRONMENT` (unset, but the only thing it gates — `shouldLogBootstrapVerbose`'s prod check — is already redundant with the `DEBUG_BOOTSTRAP` check, so no live leak). |
| [ ] | CORS + cookies validated on **final production domain** | | |
| [ ] | Quick pass: no secrets or tokens in client bundle or committed files | | |

---

## 3. Frontend & configuration

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Update `public/index.html` OG/Twitter meta URLs to production domain | | Currently may reference `*.workers.dev` |
| [ ] | Update `preconnect` / `dns-prefetch` if still pointing at old host | | |
| [ ] | Confirm `social-preview.png` URL in meta tags is correct | | |
| [ ] | Resolve duplicate or alternate entry points (`dashboard.html` vs SPA) | | Canonical routes, redirects, or deprecate one path |
| [ ] | Decide on CDN scripts (Tailwind, FA, html2canvas, etc.) for v1 | | Pin versions or self-host if required |

---

## 4. Product QA (staging or prod-like)

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Twitch login, session refresh, logout | | |
| [ ] | Creator onboarding → cards / sets / packs | | |
| [ ] | Collector onboarding and hub navigation | | |
| [ ] | Custom binders: add, reorder, remove, pagination | | |
| [ ] | Binder **Share** export: card art, footer copy, download | | |
| [ ] | Trading: create, accept, reject, cancel | | |
| [ ] | Battles (if enabled for launch) | | |
| [ ] | OBS overlay + queue control (tokens, cold load) | | |
| [ ] | Mobile / narrow viewport on main flows | | |

---

## 5. Observability & operations

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Trim or level-gate verbose Worker `console.log` for production | | Webhooks, achievements, battles |
| [ ] | Cloudflare Worker errors / analytics reviewed | | |
| [ ] | Optional: client or edge error reporting (e.g. Sentry) | | |
| [ ] | Post-deploy smoke: `GET /api/csrf`, health/bootstrap, authenticated `/api/me` | | |
| [ ] | Rate limits sanity check under light load | | bootstrap, onboarding, share-image |

---

## 6. Quality & repo hygiene

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Add minimal automated tests OR document deferred risk | | **Confirmed 2026-07-09: zero test files exist** despite `vitest` + `@cloudflare/vitest-pool-workers` + `@playwright/test` installed as devDependencies. Decision: add critical-path tests (auth, Stripe webhooks, pack-opening grant logic, RLS-sensitive endpoints) before launch — in progress. |
| [ ] | `.gitignore` for `.wrangler/tmp`, local scratch files | | |
| [ ] | Remove or ignore stray dev files (`tmp_help.txt`, duplicate paths) before tag | | |

---

## 7. Legal & trust

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Terms of service linked and accurate | | |
| [ ] | Privacy policy linked; matches data you collect (Twitch, collection, tokens) | | |
| [ ] | Support or contact path visible | | |

---

## Launch sign-off

| Done | Item | Owner |
|------|------|-------|
| [ ] | **Go / no-go** meeting completed | |
| [ ] | **Production deploy** tagged / recorded (git tag or release note) | |
| [ ] | **Rollback plan** agreed (Worker version, DB migration notes) | |

---

*Last updated: add date when you edit this file.*
