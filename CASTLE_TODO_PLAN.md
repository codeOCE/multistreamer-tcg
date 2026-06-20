# Creator Castle TCG — TODO Audit & Plan

Status legend:
- `[x]` **Done** — verified in code this session.
- `[~]` **Partial** — some of it exists; gaps noted.
- `[ ]` **Not started** — no implementation found.
- `[?]` **Verify** — relevant code exists but the *bug fix / behaviour* can only be confirmed by running the app. Marked done-in-code is not the same as done-in-practice.

> Audit method: static code search across `public/` and `src/index.ts`. Runtime bugs (things that "don't update", "don't open", "don't sync") cannot be confirmed fixed without a live click-through. Those are `[?]`.

---

## Critical Bugs

- [x] **Onboarding label verified.** Stores `brand_name`; label correctly says "Collection Name" ([onboarding.html:288](public/onboarding.html#L288)).
- [x] **"Sync Follows" wording.** Reworded the collector onboarding step 2 to explain purpose ("Bring your follows with you…") in [onboarding.html:796](public/onboarding.html#L796) + mirrored to onboarding-test.html.
- [?] **Collections not opening after actions.** Open-collection code paths exist; needs runtime check after pack open / trade / etc.
- [?] **Followed creators not appearing.** Follows are fetched and matched server-side ([src/index.ts:6863-6907](src/index.ts#L6863-L6907)) and rendered in the viewer hub. Verify they actually surface in the UI.
- [x] **Follow creators from the streamer landing page.** Implemented in collection.js — "Favourite" button hidden until login, shows/hides filled star based on follow state ([collection.js:188-249](public/collection.js#L188-L249)).
- [?] **Pack opening shows 3 packs when user owns fewer.** See Pack display rules below — needs the clamp logic verified.
- [?] **Pack count not updating on the final pack ("1 pack remaining").** Runtime state-update bug; verify counter decrements on last pack.
- [?] **Favourites not syncing across platform.** `favorite_ids` ride along in bootstrap; verify writes propagate everywhere (hub, collection, profile).
- [x] **Hide "Switch to Creator" for non-creators.** Done — injected only when `u.is_creator` ([nav-user-menu.js:520-536](public/nav-user-menu.js#L520-L536)).
- [?] **Leaderboard updates after receiving cards.** Leaderboard has a Redis cache (60s) server-side; verify it reflects new cards in reasonable time / busts on grant.
- [x] **Favourite card glow during pack opening.** Favouriting a revealed card now glows the card (`.is-fav`), not just the button ([pack-opening.js](public/pack-opening.js), [pack-opening.html](public/pack-opening.html)).
- [x] **Fragment animation delay / jank.** Anvil smash now fires immediately and runs the burn network call in parallel (was waiting on the round-trip), with optimistic-undo on failure ([magic-dust.html](public/magic-dust.html)). Art still placeholder ([[project_fragments_anvil_anim]]).

## Pack Opening Improvements

- [x] **Display rules (1→1, 2→2, 3+→max 3).** Pack pile now shows only as many images as owned (max 3) in both binder ([binder.html](public/binder.html) `setPackTab`) and my-collection ([my-collection.js](public/my-collection.js) `loadPendingPacks`).
- [ ] **Reduce pack-opening hitbox size.** No deliberate hitbox sizing found; the drag/click target is likely the whole stack.
- [~] **Convert card images to PNGs where appropriate.** High-fidelity Genesis visuals + cache-busting landed (commit `db48243`); confirm remaining raster paths.
- [x] **Remove "drag to inspect".** Dead drag handler removed; hint reworded to "Tap card to flip".
- [x] **Click cards to flip.** Tap detection added to the reveal: tap an un-revealed card to flip it up, tap a revealed card to flip to its back and back again ([pack-opening.js](public/pack-opening.js)).
- [x] **Dynamically resize "You got X cards" text.** Result tiles + title now scale with haul size via CSS vars set from the card count ([pack-opening.js](public/pack-opening.js) `showResults`).
- [x] **Duplicate cards → mark + show fragment value.** Decision: keep multiples, just mark. Pack-open API now returns `is_duplicate` ([src/index.ts](src/index.ts)); reveal shows a "Duplicate · +N if burned" badge and the results grid tags dupes, with the existing burn button intact ([pack-opening.js](public/pack-opening.js), [pack-opening.html](public/pack-opening.html)).
- [x] **Fix final-pack counter ("1 pack remaining").** Chip now counts down the moment a batch starts opening, so the last pack reads 0 during its reveal ([pack-opening.js](public/pack-opening.js)).

## Navigation & UX

- [x] **My Collection in main nav.** Present for both roles ([castle-nav.js:19](public/castle-nav.js#L19), [:28](public/castle-nav.js#L28)) and in the user dropdown ([nav-user-menu.js:502](public/nav-user-menu.js#L502)).
- [x] **Home icon → My Collection.** Icon-only house button prepended to the nav, links to `/my-collection` ([castle-nav.js](public/castle-nav.js#L18)).
- [x] **"View Profile" → "My Profile".** Renamed in the nav dropdown ([nav-user-menu.js:512](public/nav-user-menu.js#L512)).
- [x] **Consistent pack wording.** Standardised the get/buy action to "Get Packs" across binder, my-collection (panel + modal + per-binder CTA); kept "Open Pack" / "Unopened Packs" for the distinct opening action.
- [~] **Dark-theme contrast.** Ongoing/subjective; collect specific low-contrast spots.

## Creator Features

- [~] **Gate creator functionality behind a paywall.** Entitlement foundation built (disabled / free for now): `streamers.has_creator_access` (default true grandfathers existing), `CREATOR_PAYWALL_ENABLED` switch + `assertCreatorAccess()` at the `checkCreator` chokepoint. Purchase flow + upgrade UI + price still to do when monetising.
- [ ] **Choose which card set is distributed via Twitch subs vs website purchases.** No per-channel set-distribution setting found.
- [x] **Final submission button when uploading custom cards.** The save action is now an explicit **"Publish Card"** button with a one-time confirm for new cards (edits save silently as "Save Changes"), wrapping the existing `csSave` in [card-creator.html](public/card-creator.html). Kept instant-live (no draft state).

## Collection & Binder Improvements

- [x] **Clickable rarity breakdown (view cards by rarity).** Profile "Collection Breakdown" rows are now clickable → open a modal of that rarity's cards, backed by a new privacy-respecting `GET /api/public/profile/:username/cards?rarity=` endpoint ([src/index.ts](src/index.ts), [profile.js](public/profile.js), [profile.html](public/profile.html)). (collection.js per-creator page already had clickable rarity pills.)
- [x] **Collection visibility public/private.** Verified: `collection_public === false` gates the public profile (stats/showcase/latest/slabs via `hideCollection`) + the new rarity drill-down, and new binders default to private when it's off ([src/index.ts:8792](src/index.ts#L8792), [:9437](src/index.ts#L9437)).
- [x] **Move "New Binder" button to the main binders page.** Already correct in the unified binder page: the New Binder button sits on the shelf/index ([binder.html:1480](public/binder.html#L1480)), not inside an individual binder.
- [~] **Binder carousel (favourites first, click-drag).** DROPPED (2026-06-18) — direction changed since the list was made; the unified binder.html shelf supersedes this. Not building.
- [x] **Binder starring.** Star a user binder to pin it to the front of the shelf; stored in `profile_settings.ui_prefs.favourite_binders` via `PATCH /api/user/ui-prefs`, with favourites-first ordering ([binder.html](public/binder.html), [src/index.ts](src/index.ts)).
- [ ] **Merge /binders and /binder (animated expand).** Future; not implemented.

## Marketplace Improvements

- [x] **Direct (peer-to-peer) trading on the marketplace.** Added this session — "Direct Trades" sidebar action + Castle-Code 3-step flow ([trading.js](public/trading.js), [trading.html](public/trading.html)).
- [x] **Find Traders (wishlist matches).** Present, and now launches a direct trade ([trading.js:1704](public/trading.js#L1704)).
- [x] **"Your Offers" tab (offers *you've made*).** Sidebar action + modal showing each outgoing offer (your card → their listing) with status and a Retract button, backed by new `GET /api/market/my-offers`. Owners can now also **Decline** individual offers (new `POST /api/market/offers/:id/decline` + Decline button in Offers Received), with a notification to the offerer.
- [x] **Display listing owner on entries.** Shown in the card-detail modal ("Listed by …") and on the grid tiles ("by @name" / "Your listing") in [trading.js](public/trading.js).
- [x] **Marketplace popup actions: wishlist card / filter by that card.** Listing popup now has Wishlist + Filter buttons ([trading.js](public/trading.js) `tDetailWishlist`/`tDetailFilter`, [trading.html](public/trading.html)); shared `addCardToWishlist` helper also used by the belt peek.

## Profile & Social

- [x] **Creator/Collector tags visually distinct from buttons.** Profile role badge restyled as a borderless, transparent, `cursor:default` status label (no longer button-like) ([profile.html](public/profile.html#L224)).
- [x] **Favourite-a-creator surfaced everywhere.** Creator relationship (`user_favorites`) is shown as **Favourite (star)** on both the my-collection creator tiles and the streamer collection page (new `GET /api/favorites/check` for state). (Note: terminology settled on "Favourite ⭐" for creators; binder starring is a separate per-binder thing.)

## Battle System

- [ ] **Trigger labels on traits (Start of Combat, On Attack, On Death, …).** No trigger-label rendering in `battle.js`.
- [ ] **Make revive mechanics clearer.** Not found.
- [ ] **Revive behaviour: return with combat attack value + 1 health.** Not found; needs engine change in arena/battle logic.

## Moderation & Safety

- [x] **Report function for unflagged AI artwork.** Report submission already existed (button + modal + `POST /api/cards/:id/report` + `card_reports` table). Built the missing **admin moderation queue**: `GET /api/admin/reports` (grouped by card) + `POST /api/admin/reports/resolve`, a "Content Reports" panel in the System Console ([views/modals.html](public/views/modals.html)), and [admin-reports.js](public/admin-reports.js) with Dismiss + Remove-card actions. Decision: flag-for-review only (card stays live unless an admin removes it).

## Monetisation

- [ ] **Promo limits (frequency cap + recurring weekly cost to rerun).** Not implemented.

## Future Ideas

- [~] **Wishlist integration throughout.** Wishlist exists (matches, profile wishlist); spread it into binder/collection/marketplace popups.
- [ ] **Improve card carousel interactions.**
- [ ] **Enhance binder animations/transitions.**
- [ ] **Improve collection browsing UX.**
- [ ] **Improve creator discovery flows.**

---

## Suggested execution plan (by leverage)

### Phase 1 — Quick wins (hours, low risk) — DONE
1. [x] **"View Profile" → "My Profile"** — [nav-user-menu.js:512](public/nav-user-menu.js#L512).
2. [x] **Home icon in nav** — icon-only house button → `/my-collection` ([castle-nav.js](public/castle-nav.js#L18)).
3. [x] **Sync Follows copy** — reworded onboarding step 2 (+ test mirror).
4. [x] **Get Packs consistency** — unified to "Get Packs" across binder + my-collection.
5. [x] **Listing owner on grid tiles** — "by @name" / "Your listing" on marketplace tiles.

### Phase 2 — Pack-opening overhaul (one focused pass)
- Remove drag-to-inspect ([pack-opening.js:762](public/pack-opening.js#L762)); make **click = flip** the only interaction.
- Add **pack-count clamp** (`Math.min(3, owned)`) and fix the **last-pack counter** decrement.
- **Duplicate → fragment** treatment: grey the card, swap the "You got a card" reveal for a "+N Fragments" conversion card.
- **Dynamic result text** sizing via `clamp()` keyed off card count (per [[feedback_responsiveness]] — no hardcoded px).
- **Favourite glow** on reveal when `favorite_ids` includes the card.
- Finish the **anvil fragment animation** ([[project_fragments_anvil_anim]]) and remove the delay/jank.

### Phase 3 — Collection & binder UX — DONE
- [x] **Clickable rarity breakdown** → profile drill-down modal of that rarity's cards.
- [x] **"New Binder"** already on the binders index (shelf). Carousel **dropped** (direction changed).
- [x] Verified **collection public/private** gates the public profile view.

### Phase 4 — Marketplace depth — DONE
- [x] **Card-detail popup actions**: Wishlist + Filter-by-card buttons on the listing popup.
- [x] **"Your Offers" tab**: outgoing offers list + retract; owners can decline individual offers.

### Phase 5 — Social / discovery
- [x] **Favourite a creator** (star) reusing user_favorites: my-collection tiles + collection-page button + check endpoint.
- [x] **Creator/Collector tags** restyled as non-interactive badges.
- [x] **Binder starring** (favourite a binder → pin to front of shelf).
- [ ] **Creator discovery** flow improvements (future).

### Phase 6 — Battle clarity
- **Trigger labels** on trait chips (map mechanic → trigger phase).
- **Revive**: clarify in UI + change engine so revived units return with their combat attack value and 1 HP.

### Phase 7 — Trust & monetisation (larger, product decisions needed)
- [x] **Custom-card submit/publish** button (instant-live "Publish Card" + confirm).
- [x] **Report AI artwork** flow + admin moderation queue (flag-for-review).
- [~] **Creator paywall / entitlements** — foundation built, **disabled ("free for now")**. Decisions: one-time unlock, gate all creator features, grandfather existing. Added `streamers.has_creator_access` (default `true` → grandfathers existing + auto-grants new), a `CREATOR_PAYWALL_ENABLED=false` switch + `assertCreatorAccess()` gate at the `checkCreator` chokepoint, and a `POST /api/creator/unlock-access` endpoint ([src/index.ts](src/index.ts)). The creator onboarding ends in a single **"Become a Creator & Launch"** button. **Handle is now deferred until that step:** at creator login the streamer row is created with a non-public `pending:<id>` placeholder username (Twitch + Kick OAuth + checkCreator auto-onboard), and the real handle is claimed only at `POST /api/creator/provision` (claims slug + `is_active=true` + `has_creator_access=true`), so abandoned signups never reserve a handle. Onboarding stages the chosen handle client-side (`pendingSlug`) and commits at provision. To monetise: flip `CREATOR_PAYWALL_ENABLED`, require a Stripe one-time purchase before provision, set price.
- [x] **Per-set distribution** — creators pick up to **3 active sets** (cap enforced on POST+PUT `/api/creator/sets`); Twitch reward packs (subs/resubs/gifts/bits/channel-points) now issue a **"choose your set" credit** (`pack_sessions.roll_on_open`) instead of pre-rolling, and the viewer picks a set (or "Surprise me") in the pack-opening lobby — cards roll at open via `bulkGrant(restrictSetIds)`. Earned-pack notifications point viewers to tcg.creatorcastle.gg. Tradeoff: no instant on-stream reveal at sub-time (reveal happens when the viewer opens). Website/store packs unchanged. Kick reward grants NOT converted (Twitch-only per scope).
- [ ] **Promo limits** — decision: **per-rerun one-time fee**. Not built.

---

### Open questions for you
- Paywall: which creator features sit behind it, and what's the price model? (changes Phase 7 scope a lot)
- "Merge /binders and /binder": is this a real near-term goal or a someday-idea? It's the biggest single item here.
- Revive change: is the "return with combat attack value + 1 HP" the final rule, or still being playtested?
