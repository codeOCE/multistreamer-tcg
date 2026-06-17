# Creator Castle TCG — TODO Audit & Plan

Status legend:
- `[x]` **Done** — verified in code this session.
- `[~]` **Partial** — some of it exists; gaps noted.
- `[ ]` **Not started** — no implementation found.
- `[?]` **Verify** — relevant code exists but the *bug fix / behaviour* can only be confirmed by running the app. Marked done-in-code is not the same as done-in-practice.

> Audit method: static code search across `public/` and `src/index.ts`. Runtime bugs (things that "don't update", "don't open", "don't sync") cannot be confirmed fixed without a live click-through. Those are `[?]`.

---

## Critical Bugs

- [?] **Onboarding uses streamer name, not game name.** Onboarding stores `brand_name` ([onboarding.js:277](public/onboarding.js#L277), [:999](public/onboarding.js#L999)). Need to confirm the *label/copy* the user sees says "streamer/brand" not "game".
- [ ] **"Sync Follows" wording.** Backend `sync_follows` flow exists ([src/index.ts:6863](src/index.ts#L6863)) but the button copy hasn't been reworded to explain its purpose.
- [?] **Collections not opening after actions.** Open-collection code paths exist; needs runtime check after pack open / trade / etc.
- [?] **Followed creators not appearing.** Follows are fetched and matched server-side ([src/index.ts:6863-6907](src/index.ts#L6863-L6907)) and rendered in the viewer hub. Verify they actually surface in the UI.
- [ ] **Follow creators from the streamer landing page.** No follow control found on the public landing/streamer page.
- [?] **Pack opening shows 3 packs when user owns fewer.** See Pack display rules below — needs the clamp logic verified.
- [?] **Pack count not updating on the final pack ("1 pack remaining").** Runtime state-update bug; verify counter decrements on last pack.
- [?] **Favourites not syncing across platform.** `favorite_ids` ride along in bootstrap; verify writes propagate everywhere (hub, collection, profile).
- [x] **Hide "Switch to Creator" for non-creators.** Done — injected only when `u.is_creator` ([nav-user-menu.js:520-536](public/nav-user-menu.js#L520-L536)).
- [?] **Leaderboard updates after receiving cards.** Leaderboard has a Redis cache (60s) server-side; verify it reflects new cards in reasonable time / busts on grant.
- [ ] **Favourite card glow during pack opening.** No favourite-glow hook found in pack reveal.
- [~] **Fragment animation delay / jank.** `anvil-smash.js` exists (new, untracked) — the planned card-smash-on-anvil effect ([[project_fragments_anvil_anim]]). Treat as in-progress; finish + de-jank.

## Pack Opening Improvements

- [?] **Display rules (1→1, 2→2, 3+→max 3).** Verify the clamp in pack-opening rendering. If absent, add `Math.min(3, packsOwned)` to the stack builder.
- [ ] **Reduce pack-opening hitbox size.** No deliberate hitbox sizing found; the drag/click target is likely the whole stack.
- [~] **Convert card images to PNGs where appropriate.** High-fidelity Genesis visuals + cache-busting landed (commit `db48243`); confirm remaining raster paths.
- [ ] **Remove "drag to inspect".** Still present ([pack-opening.js:762](public/pack-opening.js#L762) "Stack drag-to-inspect").
- [~] **Click cards to flip.** `flipTopCard` exists ([pack-opening.js:643](public/pack-opening.js#L643)); confirm a plain click (not drag) triggers it and make it the primary interaction once drag is removed.
- [ ] **Dynamically resize "You got X cards" text.** No dynamic sizing found.
- [~] **Duplicate burned for fragments → grey out + show conversion.** Burn endpoint + "+N Fragments" toast exist ([pack-opening.js:1125-1136](public/pack-opening.js#L1125-L1136)); the grey-out + "fragment conversion instead of card" visual still needs building.

## Navigation & UX

- [x] **My Collection in main nav.** Present for both roles ([castle-nav.js:19](public/castle-nav.js#L19), [:28](public/castle-nav.js#L28)) and in the user dropdown ([nav-user-menu.js:502](public/nav-user-menu.js#L502)).
- [ ] **Home icon → My Collection / All Binders.** No home affordance in `castle-nav.js`.
- [ ] **"View Profile" → "My Profile".** Still reads "View Profile" ([nav-user-menu.js:512](public/nav-user-menu.js#L512)).
- [?] **Consistent "Open Packs" / "Buy Packs" wording & colour.** Mixed copy exists ("Buy Packs" [my-collection.js:317](public/my-collection.js#L317), "OPEN PACKS" filler text). Needs a consistency pass across pages.
- [~] **Dark-theme contrast.** Ongoing/subjective; collect specific low-contrast spots.

## Creator Features

- [ ] **Gate creator functionality behind a paywall.** No paywall / entitlement gating found.
- [ ] **Choose which card set is distributed via Twitch subs vs website purchases.** No per-channel set-distribution setting found.
- [ ] **Final submission button when uploading custom cards.** No submit/publish control in [card-creator.html](public/card-creator.html).

## Collection & Binder Improvements

- [ ] **Clickable rarity breakdown (view cards by rarity).** No click handler on the breakdown found.
- [x] **Collection visibility public/private.** Privacy toggle exists (`collection_public`) in [settings.html:366](public/settings.html#L366). Verify it actually hides the public collection.
- [ ] **Move "New Binder" button to the main binders page.** Not found on `streamer-binders.js`.
- [ ] **Binder carousel (favourites first, click-drag).** Not implemented.
- [ ] **Merge /binders and /binder (animated expand).** Future; not implemented.

## Marketplace Improvements

- [x] **Direct (peer-to-peer) trading on the marketplace.** Added this session — "Direct Trades" sidebar action + Castle-Code 3-step flow ([trading.js](public/trading.js), [trading.html](public/trading.html)).
- [x] **Find Traders (wishlist matches).** Present, and now launches a direct trade ([trading.js:1704](public/trading.js#L1704)).
- [ ] **"Your Offers" tab (offers *you've made*).** Only offers-received-per-listing exists; no aggregated outgoing-offers view.
- [~] **Display listing owner on entries.** Shown in the card-detail modal ("Listed by …" [trading.js:1459](public/trading.js#L1459)); add it to the grid tiles too.
- [ ] **Marketplace popup actions: wishlist card / filter by that card.** Not in the card-detail modal actions.

## Profile & Social

- [?] **Creator/Collector tags visually distinct from buttons.** Profile renders role tags; verify they don't look clickable.
- [~] **Follow functionality everywhere relevant.** Backend follows exist; surface follow buttons on landing, profile, hub, and creator cards.

## Battle System

- [ ] **Trigger labels on traits (Start of Combat, On Attack, On Death, …).** No trigger-label rendering in `battle.js`.
- [ ] **Make revive mechanics clearer.** Not found.
- [ ] **Revive behaviour: return with combat attack value + 1 health.** Not found; needs engine change in arena/battle logic.

## Moderation & Safety

- [ ] **Report function for unflagged AI artwork.** No report control found.

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

### Phase 1 — Quick wins (hours, low risk)
1. **"View Profile" → "My Profile"** — one string in [nav-user-menu.js:512](public/nav-user-menu.js#L512).
2. **Home icon in nav** — add a left-most nav item (house icon) → `/my-collection`, with a secondary "All Binders" target. Idea: clicking the Castle logo already could route home; add an explicit icon for clarity.
3. **Sync Follows copy** — reword button + add a one-line helper ("Pulls the channels you follow on Twitch so their cards/hubs show up here").
4. **Open/Buy Packs consistency** — pick one verb+colour per action (Buy = accent fill, Open = ghost) and apply across my-collection, pack-opening, dashboard.
5. **Listing owner on grid tiles** — reuse `listing.lister.username` already loaded; add a small "by @name" line to the marketplace card tile.

### Phase 2 — Pack-opening overhaul (one focused pass)
- Remove drag-to-inspect ([pack-opening.js:762](public/pack-opening.js#L762)); make **click = flip** the only interaction.
- Add **pack-count clamp** (`Math.min(3, owned)`) and fix the **last-pack counter** decrement.
- **Duplicate → fragment** treatment: grey the card, swap the "You got a card" reveal for a "+N Fragments" conversion card.
- **Dynamic result text** sizing via `clamp()` keyed off card count (per [[feedback_responsiveness]] — no hardcoded px).
- **Favourite glow** on reveal when `favorite_ids` includes the card.
- Finish the **anvil fragment animation** ([[project_fragments_anvil_anim]]) and remove the delay/jank.

### Phase 3 — Collection & binder UX
- **Clickable rarity breakdown** → filter the grid by that rarity (reuse existing filter state).
- **Move "New Binder"** to the binders index; add the **favourites-first carousel** with click-drag.
- Verify **collection public/private** actually gates the public view.

### Phase 4 — Marketplace depth
- **"Your Offers" tab**: new endpoint `GET /api/market/my-offers` (offers where `offerer_twitch_id = me`, joined to listing) + a sidebar action mirroring "Your listings".
- **Card-detail popup actions**: "Wishlist this card" + "Filter market by this card".

### Phase 5 — Social / discovery
- **Follow buttons everywhere** (landing, streamer profile, creator cards) backed by the existing follows data.
- **Creator/Collector tags** restyled as non-interactive badges.
- **Creator discovery** flow improvements.

### Phase 6 — Battle clarity
- **Trigger labels** on trait chips (map mechanic → trigger phase).
- **Revive**: clarify in UI + change engine so revived units return with their combat attack value and 1 HP.

### Phase 7 — Trust & monetisation (larger, product decisions needed)
- **Creator paywall / entitlements** (gate creator tools).
- **Per-set distribution** setting (Twitch subs vs web).
- **Custom-card submit/publish** button + review state.
- **Report AI artwork** flow (+ moderation queue).
- **Promo limits** (frequency cap + recurring weekly charge).

---

### Open questions for you
- Paywall: which creator features sit behind it, and what's the price model? (changes Phase 7 scope a lot)
- "Merge /binders and /binder": is this a real near-term goal or a someday-idea? It's the biggest single item here.
- Revive change: is the "return with combat attack value + 1 HP" the final rule, or still being playtested?
