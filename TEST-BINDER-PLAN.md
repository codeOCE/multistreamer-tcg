# test-binder.html — Combined Binder Page Plan

## Goal
Merge `streamer-binders.html` (the tile picker) and `testbinder.html` (the open binder view)
into a single page `test-binder.html`.

### UX Flow
1. Page loads → sticky shelf at top shows all binders as small tiles
2. User clicks a tile → animated sequence plays:
   - Tile **flies** from shelf to center of screen, growing larger
   - **Zipper** slides down the binder face (unzips)
   - **Cover flips open** (rotateY perspective animation)
   - Book content fades in below
3. Shelf stays visible — clicking any tile switches the open binder (re-runs animation)

---

## Animation Sequence (timings)

| Phase | Duration | What happens |
|-------|----------|--------------|
| Fly   | 0–420ms  | Tile clones to fixed overlay, transitions to center at ~200px wide |
| Unzip | 420–860ms | Zipper pull slides top→bottom; seam crack grows downward |
| Open  | 860–1340ms | Cover does `rotateY(0 → -92deg)` — disappears at ~90° (backface-visibility: hidden) |
| Fade  | 1340–1590ms | Fly overlay fades out; book content already rendered below |

---

## Source Files
- `public/streamer-binders.html` — binder tile CSS (`.binder-book`, `.binder-spine-strip`, etc.)
- `public/streamer-binders.js` — tile rendering + drag-to-reorder logic
- `public/testbinder.html` — full binder page (book flip, card inspect, modals, all JS)

---

## Task List

### Phase 1 — Research & Planning
- [x] Read `streamer-binders.html` (layout, CSS, tile classes)
- [x] Read `streamer-binders.js` (tile rendering, binder data flow)
- [x] Read `testbinder.html` CSS (book, cards, flip leaves, modals — all ~1100 lines)
- [x] Read `testbinder.html` HTML body (nav, panels, book markup, modals)
- [x] Read `testbinder.html` JS (boot, renderBinderTabs, switchBinder, flip, openInspect, etc.)
- [x] Design animation sequence and timings
- [x] Plan CSS structure for new page (what to keep / remove / add)
- [x] Plan JS modifications (renderShelfTiles, openBinderWithAnimation, etc.)

---

### Phase 2 — Write `test-binder.html`

#### 2a. Head + CSS block
- [x] `<head>` meta / font / CSS link tags (same as testbinder.html)
- [x] CSS: variables (`--accent`, `--pg-w`, `--pg-h`, `--flip-half`, etc.)
- [x] CSS: binder book tile visuals (from streamer-binders.html — `.binder-book`, `.binder-spine-strip`, `.binder-face`, `.binder-weave`, `.binder-sheen`, `.binder-stitch`, `.binder-zipper`, `.binder-etched`, `.binder-etch-name`, `.binder-card-count`)
- [x] CSS: shelf (`#tb-shelf`, `#tb-shelf-header`, `#tb-shelf-grid`, `.tb-shelf-tile`, `.tb-shelf-tile-name`)
- [x] CSS: fly overlay (`#tb-fly`, `#tb-fly-backdrop`, `#tb-fly-binder`, `#tb-fly-book-inner`, `.tb-fly-spine`, `#tb-fly-cover`, `#tb-fly-zip-pull`, `#tb-fly-zip-seam`, `#tb-fly-binder-name`)
- [x] CSS: fly animation keyframes (`@keyframes tbCoverOpen`)
- [x] CSS: content shell (`#tb-content-shell` 2-col flex, responsive)
- [x] CSS: center area (center-header, center-title, center-arrow, share-btn) — from testbinder.html
- [x] CSS: book + pages (book-wrap, b-page, book-spine, card-grid, card-slot, rarity, holo/shine) — from testbinder.html
- [x] CSS: flip leaves (b-leaf, depart/arrive keyframes, shadow overlays) — from testbinder.html
- [x] CSS: book nav row (book-nav-btn, page-indicator) — from testbinder.html
- [x] CSS: right panel (right-progress, prog-*, achievement-row, ach-*) — from testbinder.html
- [x] CSS: sort/view controls bar (binder-controls, bc-btn, bc-divider) — from testbinder.html
- [x] CSS: all modals (inspect, create-binder, buy-packs, share, toast, card-detail, card-report) — from testbinder.html
- [x] CSS: share capture / watermark footer — from testbinder.html

#### 2b. HTML body
- [x] Nav (identical to testbinder.html)
- [x] `#tb-shelf` — header row (title + "Get Packs" + "New Binder" buttons) + empty `#tb-shelf-grid`
- [x] `#tb-content-shell` wrapper opens
- [x] `<main id="main-area">` — center-header, binder-controls, share-view-banner, binder-capture-target (book-wrap + book + pages + flip leaves + watermark footer), book-nav
- [x] `<aside id="right-panel">` — right-progress block + achievement-list
- [x] `#tb-content-shell` closes
- [x] `#tb-fly` overlay — backdrop + binder (book-inner + spine + cover with weave/sheen/stitch/zip-pull/zip-seam/name)
- [x] All modals (buy-packs, create-binder, share, toast, card-detail, card-report)

#### 2c. JavaScript
- [x] State variables (same as testbinder.html + `let _animating = false`, `let sbAccentRgb = '139,92,246'`)
- [x] `applyStreamerTheme` — keep, also updates `sbAccentRgb`
- [x] `boot / init` — same as testbinder.html (remove `left-channel-link` reference, left pack panel calls are no-ops)
- [x] `setupNavUser` — unchanged
- [x] `renderLeftPacks` / `setPackTab` / `openBuyPacksModal` — keep (modal still exists)
- [x] `ensureCsrf` / `writeFetch` / `resolveCardImageUrl` — unchanged
- [x] `currentCards` / `getDisplayCards` / `totalSpreads` — unchanged
- [x] `buildSlot` / `renderGrid` / `renderSpread` / `renderProgress` — unchanged
- [x] `renderAchievements` — unchanged
- [x] **NEW** `getBinderName(id)` — helper that returns display name for a binder id
- [x] **NEW** `renderShelfTiles()` — renders `.tb-shelf-tile` elements into `#tb-shelf-grid`
- [x] **REPLACE** `renderBinderTabs()` — now updates center-title + calls `renderShelfTiles()`
- [x] `switchBinder(id)` — unchanged (calls renderBinderTabs which calls renderShelfTiles)
- [x] **NEW** `openBinderWithAnimation(id, tileEl)` — 4-phase animation, switches binder mid-open
- [x] `setSort` / `setView` — unchanged
- [x] `toggleBinderPrivacy` / `updateCopyLinkBtn` / `copyBinderLink` — unchanged
- [x] `openCreateBinder` / `closeCreateBinder` / `submitCreateBinder` / `deleteBinder` — unchanged
- [x] `shareBinder` / `generateShareCapture` / `selectPageMode` — unchanged
- [x] Card inspect / `openInspect` / `closeInspect` / card report — unchanged
- [x] `flip(dir)` — unchanged
- [x] `escapeHTML` / `showToast` — unchanged
- [x] Event wiring (prev/next buttons, keyboard nav) — unchanged

---

### Phase 3 — Wire up & Test
- [x] Verify page loads and shelf renders binder tiles
- [x] Verify animation plays on tile click (fly → unzip → open → book shows)
- [x] Verify binder switching works (click different shelf tile)
- [x] Verify page flipping (prev/next, keyboard arrows) works
- [x] Verify card inspect modal opens and closes
- [x] Verify create binder modal works
- [x] Verify share/export works
- [x] Verify URL param `?binder=<id>` auto-selects without animation

---

## Key DOM IDs in new page

| ID | Purpose |
|----|---------|
| `#tb-shelf` | Sticky shelf container |
| `#tb-shelf-grid` | Flex row of `.tb-shelf-tile` elements |
| `#tb-fly` | Full-screen fixed overlay for animation |
| `#tb-fly-backdrop` | Dims the page during animation |
| `#tb-fly-binder` | Absolutely positioned binder box (transitions) |
| `#tb-fly-book-inner` | Visual background + border-radius of binder |
| `.tb-fly-spine` | 18px left spine strip |
| `#tb-fly-cover` | Right portion of cover (rotates open) |
| `#tb-fly-zip-pull` | Zipper pull element (slides down) |
| `#tb-fly-zip-seam` | Vertical crack line (grows down) |
| `#tb-fly-binder-name` | Binder name text on the flying cover |
| `#tb-content-shell` | 2-col flex: main-area + right-panel |

---

## Notes
- Left sidebar (pack opening) is removed. "Get Packs" button lives in the shelf header.
- `renderLeftPacks` / `applyLeftPackImages` are kept in JS but are no-ops (DOM elements absent).
- The fly overlay uses `position: fixed; inset: 0` — `#tb-fly-binder` is `position: absolute` inside it, sized/positioned via JS.
- Animation lock `_animating` prevents double-triggers; mid-animation clicks call `switchBinder` directly.
- `renderBinderTabs` function name kept so all existing callers (switchBinder, submitCreateBinder, deleteBinder, toggleBinderPrivacy) work unchanged.
