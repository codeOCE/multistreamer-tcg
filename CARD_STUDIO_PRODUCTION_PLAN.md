# Card Studio — Production-Ready Implementation Plan
**Last updated:** 2026-04-16  
**Audited files:** `public/card-studio.html` · `public/card-studio.js`

---

## Baseline Audit — What Ships Today

Full feature inventory as of April 16 audit. Everything below is **implemented and verified in code**.

### Core Canvas & Tools

| Feature | Status | Notes |
|---|---|---|
| Fabric.js 5.3 canvas | ✅ | Stable — v6 upgrade is a future item |
| Select (V) | ✅ | Transform, rotate, scale |
| Text (T) | ✅ | 26 curated Google Fonts + custom import |
| Brush / Draw (B) | ✅ | Pencil with size + opacity |
| Eraser (E) | ✅ | Destination-out masking |
| Fill (F) | ✅ | Flood fill recent color onto shapes |
| Eyedropper (K) | ✅ | 96px magnifier with hex + RGB readout |
| Shapes — 20-shape catalog | ✅ | Rect, Circle, Rounded Rect, Triangle, Diamond, Rt. Triangle, Pentagon, Star, Starburst, 6-pt Star, Arrow, Double Arrow, Heart, Cloud, Crescent, Speech Bubble, Droplet, Plus, Hexagon, Line |
| Add Image (I) | ✅ | Multi-file upload with progress bar |
| Crop (C) | ✅ | Draggable crop overlay, applied as `clipPath` |
| Zoom (Z) | ✅ | Alt+click to zoom out; Ctrl+Wheel to scroll-zoom |
| Hand / Pan (H / Space) | ✅ | Restores previous tool on keyup |
| Lasso Select (A) | ✅ | Freeform polygon lasso |
| Magic Select (Q) | ✅ | Click-colour isolation tool |
| Measure (M) | ✅ | Live distance + angle readout with SVG line |
| Frame / Clip Container (N) | ✅ | Clip-masking frame container |
| Dodge (D) | ✅ | Lighten brush using `screen` composite |
| Burn (Shift+D) | ✅ | Darken brush using `multiply` composite |
| Blur brush | ✅ | Soft blur via free-drawing layer |
| Focus Mode (Shift+F) | ✅ | Dims all non-selected layers |

### Layer Management

| Feature | Status | Notes |
|---|---|---|
| Drag-and-drop reorder | ✅ | Sortable.js |
| Visibility & Lock toggles | ✅ | Per-layer |
| Inline rename (double-click) | ✅ | |
| Layer thumbnails | ✅ | Per-layer canvas thumbnails |
| Group / Ungroup (Ctrl+G) | ✅ | Context menu + keyboard |
| Auto Layout on Groups | ✅ | Figma-style flex layout; horizontal or vertical |
| Mask (context bar) | ✅ | Apply shape as `clipPath` on layer below |

### Properties Panel

| Feature | Status | Notes |
|---|---|---|
| Position / Size / Rotation | ✅ | Numeric inputs |
| Opacity slider | ✅ | |
| Blend Modes (16 CSS modes) | ✅ | On shapes, images, and multi-select |
| Text: font, size, bold, italic, underline | ✅ | |
| Text: letter spacing (`charSpacing`) | ✅ | |
| Text: line height | ✅ | |
| Text: shadow — color, blur, X/Y offset | ✅ | `fabric.Shadow` |
| Text: stroke color + width | ✅ | |
| Shape: fill (solid or gradient) | ✅ | |
| Shape: stroke color + width | ✅ | |
| Shape: corner radius | ✅ | |
| Image: flip H/V | ✅ | |
| Image: brightness / contrast / saturation | ✅ | Fabric.js filters with sliders |
| Image: crop button | ✅ | Launches crop mode |
| Multi-select: opacity | ✅ | |
| Multi-select: blend mode | ✅ | |
| Multi-select: align (6 directions) | ✅ | |
| Multi-select: distribute H/V | ✅ | |
| Multi-select: delete all | ✅ | |

### Canvas Aids & UX

| Feature | Status | Notes |
|---|---|---|
| Smart Guides (object-to-object snap) | ✅ | Edge + center snapping with live guide lines |
| Grid + Snap to Grid (G) | ✅ | 10px grid |
| Zoom — Ctrl+Wheel, +/- buttons, fit (0) | ✅ | Up to 5× |
| Undo / Redo 60-step (Ctrl+Z/Y) | ✅ | `_csHistory[]` |
| Undo/Redo disabled state | ✅ | Buttons disable at stack boundaries |
| History dropdown | ✅ | ▾ next to Undo shows step-by-step list |
| Arrow key nudge — 1px / Shift+10px | ✅ | |
| Ctrl+A Select All | ✅ | |
| Escape — deselect / cancel crop | ✅ | |
| Clipboard Cut/Copy/Paste (Ctrl+X/C/V) | ✅ | Internal clipboard with +14/+14 paste offset |
| Duplicate (Ctrl+D) | ✅ | |
| Right-click context menu | ✅ | Copy, Cut, Paste, Duplicate, Z-order, Align, Group, Delete |
| Alignment toolbar (multi-select, topbar) | ✅ | 6 directions |
| Template ghost overlay (Ctrl+Shift+G) | ✅ | 35% opacity overlay |
| Trait zone overlay toggle | ✅ | |
| Keyboard shortcut modal (?) | ✅ | Two-column grid modal |
| Responsive layout | ✅ | 3 breakpoints: 1400 / 1200 / 1024px (drawer mode) |
| Custom scrollbars on all panels | ✅ | |
| Spring animation on tool select | ✅ | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### Color & Gradients

| Feature | Status | Notes |
|---|---|---|
| Void color picker (custom HSV) | ✅ | Replaces native `<input type=color>` |
| Gradient tab in color picker | ✅ | Linear + Radial, multi-stop, insert/delete/reverse |
| Recent color swatches (max 10) | ✅ | Persisted in localStorage |
| Fill / Stroke color swapper in toolstrip | ✅ | |
| Interactive gradient handles on canvas | ✅ | Draggable endpoint handles |
| Background: solid / gradient / transparent | ✅ | Gradient with angle slider |

### Export & Save

| Feature | Status | Notes |
|---|---|---|
| Save Card — upload to server | ✅ | `csSave()` at 750×1050px (multiplier 1.5) |
| Export dropdown — PNG 2× (1000×1400) | ✅ | `csExportLocal('png', 2)` |
| Export dropdown — PNG 3× print (1500×2100) | ✅ | `csExportLocal('png', 3)` |
| Export dropdown — JPG 2× web | ✅ | `csExportLocal('jpeg', 2)` |
| Foil / shiny alpha-mask export | ✅ | Greyscale mask blob |
| Session recovery (localStorage, 60s) | ✅ | Prompts on re-open |
| Draft saved indicator (topbar dot) | ✅ | Visual indicator present |

### TCG-Specific Features

| Feature | Status | Notes |
|---|---|---|
| Trait Zone — place, resize, save/load templates | ✅ | Genesis support |
| Trait zone visual browser | ✅ | Modal grid with thumbnails |
| Font browser — categorized + search | ✅ | 26 curated fonts |
| Image library — upload, add to canvas | ✅ | |
| Canvas drag-and-drop upload | ✅ | Drop to upload modal |
| Stat Components (ATK / DEF) | ✅ | One-click text element placer |
| Card Frame swapper | ✅ | Visual grid to swap template frames |
| Rarity overlay rendering | ✅ | Auto-applies blend/sheen layer by rarity |
| CSRF protection on all mutations | ✅ | `X-CSRF-Token` header |
| Image proxy (avoid canvas taint) | ✅ | `/api/img-proxy` |
| Proxy image loading | ✅ | |

---

## Remaining Gaps — What's Actually Missing

These are the only features not yet implemented as of April 16.

### High Priority

#### G1 — AI Background Removal
**Advertised in `CARD_STUDIO_OVERVIEW.md`** as a shipped feature, but there is **no implementation** in `card-studio.js`. No call to any background removal API (e.g. `remove.bg`, Cloudflare AI, or otherwise).  
**Implementation path:**
- Add a "Remove Background" button in the image properties panel
- Call a Cloudflare Worker endpoint that proxies to `remove.bg` or uses Cloudflare AI's `@cf/img2img` model
- Replace the image `src` on the canvas with the result via `/api/img-proxy`

#### G2 — Lock Aspect Ratio Toggle
**W/H numeric inputs exist in the properties panel but there is no chain-link button** to lock the ratio.  
**Implementation:**
```js
// In _csRenderPropsPanel, between W and H inputs:
<button id="cs-lock-ratio" onclick="_csToggleLockRatio()" title="Lock aspect ratio">
    <i class="fa-solid fa-link"></i>
</button>
// When locked: changing W scales H = newW * (origH / origW)
```

---

### Medium Priority

#### ~~G3 — SVG Import~~ ✅ Done (2026-04-16)
`_csAddSvgToCanvas` helper added. Both `_csHandleImageFile` and `csAddLibImageByUrl` detect `image/svg+xml` mime type or `.svg` URLs and route through `fabric.loadSVGFromURL` → `fabric.util.groupSVGElements`. File inputs updated to accept SVG. Upload modal hint updated.

#### G4 — Server-Side Draft Sync
The draft dot indicator exists in the topbar but the `PATCH /api/creator/cards/:id/draft` endpoint needs to be confirmed/implemented.  
**Implementation:**
- Backend: `PATCH /api/creator/cards/:id/draft` — accepts `{ layer_data }`, saves without publishing
- Frontend: Call every 2 minutes when `_csHasUnsavedChanges`, show/hide `#cs-draft-dot` + `#cs-draft-lbl` on success

---

### Low Priority / Phase 4

#### G5 — Print-Ready PDF Export
Not feasible purely client-side for CMYK. Options:
- **Simple:** `jsPDF` client-side — embed 3× PNG at 300dpi into an RGB PDF with 3mm bleed
- **Professional:** Cloudflare Worker / Puppeteer endpoint for CMYK-safe PDF

#### G6 — Rulers with Draggable Guides
Draggable ruler guides like Figma/Photoshop. High complexity, medium impact.
- Two ruler bars along top and left edges
- Draggable guide lines that snap to objects
- Store guides in canvas JSON `data` field

#### G7 — Fabric.js v6 Upgrade
**Current:** `fabric.js/5.3.0`  
**Target:** v6 (ES modules, TypeScript, improved WebGL, EraserBrush first-class)  
**Risk:** API changes require testing all canvas operations. Do in a feature branch.

#### G8 — Collaborative Editing
Real-time multiplayer via Yjs or Cloudflare Durable Objects. Architectural — not a sprint task.

#### G9 — Multiple Artboard Presets
Allow creators to choose card dimensions (standard TCG, mini, poker, custom). Requires normalizing `traitArea` coordinate scaling.

---

## Implementation Priority Order

```
Immediate (before public launch):
  G1  AI Background Removal     ← advertised as shipped, must deliver
  G2  Lock aspect ratio toggle  ← 30 min, quality-of-life gap

Near-term:
  G3  SVG import                ← ✅ Done
  G4  Server-side draft sync    ← ✅ Done (backend + frontend both implemented)

Phase 4 (post-launch):
  G5  PDF export (basic jsPDF)  ← 2 days
  G6  Rulers / draggable guides ← 1 week
  G7  Fabric.js v6 upgrade      ← 1 day (feature branch)
  G8  Collaborative editing     ← architectural, future consideration
  G9  Multiple artboard presets ← 1 sprint
```

---

## Verification Checklist

Before each phase ships, verify:

**Canvas correctness**
- [ ] Undo/Redo chain consistent after complex edits (draw → resize → undo × 3)
- [ ] Canvas serializes/deserializes without losing object data (layer names, shiny flag, originalUrl)
- [ ] Foil mask exports correctly for multi-layer shiny cards
- [ ] Export at multiplier:1.5 produces exactly 750×1050 px output

**Keyboard shortcuts**
- [ ] All documented shortcuts fire correctly
- [ ] Shortcuts do NOT fire when typing in any `<input>` or `<textarea>`
- [ ] Escape always exits current tool / deselects

**Upload & proxy**
- [ ] Image uploads with PNG, JPG, WebP
- [ ] SVG uploads (after G3 is implemented)
- [ ] Images load via proxy on canvas without CORS errors
- [ ] 10MB file size limit enforced client + server side

**Responsive**
- [ ] Studio usable at 1280×800 (13" laptop)
- [ ] Left drawer opens/closes at 1024px
- [ ] No panel overflow at 1920×1080

**Session recovery**
- [ ] Auto-save fires every 60s when `_csHasUnsavedChanges`
- [ ] Recovery prompt appears correctly on reload
- [ ] Declining recovery clears localStorage entry

**Export quality**
- [ ] Saved card art is 750×1050 px (multiplier 1.5)
- [ ] Transparent-background cards export as PNG, not JPEG
- [ ] Local download works in Chrome, Firefox, Safari, Edge
- [ ] 3× PNG export produces 1500×2100 px
