# Castle TCG Site Wiring Spec (Final)

## 1) Architecture Direction

- Primary direction is single-page-per-surface routing (de-emphasize old `index.html` SPA view switching).
- Use explicit URLs for each major feature surface (`/my-collection`, `/dashboard`, `/trading`, etc.).
- Keep behavior deterministic: route decides page, page decides data/state.

## 2) Canonical Route Map

- **`/`**
  - Logged out: marketing landing
  - Logged in: redirect to `/my-collection`
- **`/login`**
  - Login screen; honors `next` redirect when valid.
- **`/my-collection`**
  - Default post-login viewer landing.
- **`/dashboard`**
  - Creator console (creator-only).
- **`/trading`**
  - Dedicated trading surface replacing old exchange tab.
- **`/battle`**
  - Full battle page.
- **`/profile/:username`**
  - Public profile page.
- **`/profile`**
  - Logged in: redirect to own `/profile/:username`
  - Logged out: error page (or 404 behavior)
- **`/settings`**
  - Account/settings page.
- **`/onboarding`**
  - Onboarding flow gate for incomplete users.
- **`/queue-control`**
  - Creator-only live queue controls.
- **`/arena.html` and `/obs-overlay`**
  - Creator-only overlay surfaces.
- Legal/static pages (`/privacy`, `/terms`, `/cookies`) unchanged.
- Unknown routes resolve to `404`.

## 3) Access Control Rules (Guards)

- Auth-required pages: all product surfaces except landing/legal/public creator/profile pages you explicitly keep public.
- **Onboarding gate**
  - If onboarding incomplete: block protected access and route to `/onboarding`.
- **Role gate**
  - Creator-only pages (`/dashboard`, `/queue-control`, overlays, creator tools) require creator role.
  - Viewer users attempting creator pages redirect to `/my-collection`.
- **Post-onboarding destination**
  - Viewer complete -> `/my-collection`
  - Creator complete -> `/dashboard`

## 4) Redirect Matrix (Canonical Behavior)

- **`/`**
  - logged out -> stay on landing
  - logged in -> `/my-collection`
- **`/login`**
  - if already logged in and no `next` -> `/my-collection`
  - if `next` present and allowed -> send to `next`
- **Protected page while logged out**
  - redirect to `/login?next=<requested-path>`
- **Protected page while onboarding incomplete**
  - redirect to `/onboarding`
- **`/profile` (no username)**
  - logged in -> `/profile/<self-username>`
  - logged out -> error/404
- **Viewer on creator-only route**
  - redirect `/my-collection`

## 5) Navigation Standard

- Keep nav consistent across app surfaces (labels/order/pattern).
- Viewer primary nav anchors: `My Collection`, `Trading`, `Battle`, `Profile`, `Settings`.
- Creator primary nav anchors: `Dashboard`, `Queue`, `Overlays`, `Profile`, `Settings`.
- Cross-role items should not expose unauthorized destinations as active links.

## 6) Trading and Mutual Binders

- `/trading` is the single trading home and replaces the previous exchange tab.
- Mutual binders live under trading flows for now.
- Binder/profile sharing links are deferred; add later as deep links into `/trading`.

## 7) Coming Soon Standard

- For not-yet-built features, render disabled controls/cards labeled `Coming Soon`.
- Only hide features completely if they are too incomplete/confusing to expose safely.
- Maintain consistent badge/copy style across pages.

## 8) Profile Behavior Standard (Social-style Judgment)

- `/profile/:username` is public-facing profile.
- `/profile` is never a separate content page; it resolves to self when authenticated.
- If privacy controls are added later, default to typical social norms:
  - identity/basic header public
  - sensitive stats optional/toggleable

## 9) Implementation Order (Execution Plan)

1. Enforce canonical routing + redirects (`/`, `/login`, `/profile`, `404`).
2. Remove old SPA-only route dependencies and dead view switching.
3. Promote `/trading` and migrate exchange logic there.
4. Apply auth/onboarding/role guards consistently.
5. Normalize nav across viewer and creator surfaces.
6. Add/standardize `Coming Soon` states.
7. Final QA pass on route-edge cases and cross-link consistency.

## 10) Acceptance Criteria

- Logged-in user hitting `/` always lands on `/my-collection`.
- `/profile` resolves to self only when logged in; otherwise errors.
- Incomplete onboarding cannot access protected surfaces.
- Viewer completion and creator completion route to correct destinations.
- `/trading` is functional and no core flow depends on old exchange tab.
- Creator-only surfaces are inaccessible to viewers.
- Navigation pattern is consistent and role-correct.
- `Coming Soon` appears where expected, without broken links.