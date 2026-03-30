# Launch checklist

Living document for production readiness. Check items off as you complete them. Use **Owner** to assign responsibility (name or role).

---

## 1. Data & schema

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Apply all pending Supabase migrations to **production** in order | | Includes `035_social_links`, `036_pack_foil_color`, `041_pack_design_url`, `042_grant_binder_permissions`, and any others not yet on prod |
| [ ] | Verify RLS and grants for binders / `user_binders` / `user_binder_cards` | | Align with `042_grant_binder_permissions.sql` |
| [ ] | Confirm enriched views and dependent queries work after migrations | | |
| [ ] | Document prod vs staging migration state (last applied revision) | | |

---

## 2. Security & privacy

| Done | Item | Owner | Notes |
|------|------|-------|-------|
| [ ] | Remove or **feature-flag** `x-debug-*` headers on `/api/bootstrap` in production | | Avoid leaking hostnames, follow IDs, token hints |
| [ ] | Re-verify `/api/share-image` allowlist against real card image URLs | | CDN + Supabase storage; extend only with SSRF review |
| [ ] | Confirm admin-only routes and destructive actions (e.g. user wipe) are protected | | |
| [ ] | Production secrets: `FRONTEND_URL`, `CREATOR_CDN_BASE`, `SESSION_SECRET`, Twitch keys | | `wrangler secret` / dashboard |
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
| [ ] | Add minimal automated tests OR document deferred risk | | e.g. share-image allowlist, auth helpers |
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
