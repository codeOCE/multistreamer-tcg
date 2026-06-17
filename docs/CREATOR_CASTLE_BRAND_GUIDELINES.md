# Creator Castle Brand Guidelines

**Purpose:** Give designers, developers, and LLMs enough *principles* to build new sites, tools, and surfaces that feel like the same family as **Creator Castle** and products such as **Castle TCG**—without copying any single page layout.

**Audience:** Anyone generating UI, copy, or design tokens for the Creator Castle ecosystem.

---

## 1. Brand architecture

### 1.1 Hierarchy

| Layer | Name | Role |
|-------|------|------|
| **Parent brand** | **Creator Castle** | The operating brand: creator economy, community, tooling. Owns trust, tone, and visual system. |
| **Product brands** | **Castle TCG** (and future Castle products) | Named offerings under the parent. Each has a clear job; all share the parent look and voice. |
| **Infrastructure** | Castle, Castle code, Creator Castle domains | Shared identity layer (accounts, codes, CDN assets). Not consumer-facing brand names on their own. |

**Rule:** Lead with the **product name** in product UIs (e.g. page title `Creator Dashboard | Castle TCG`). Use **Creator Castle** when speaking about the company, legal entity, cross-product hub, or “everything we build for creators.”

### 1.2 Naming and wordmarks

- **Parent:** “Creator Castle” — two words, title case in prose; never “CreatorCastle” in body copy unless required by a handle/URL.
- **Product:** “Castle TCG” — “Castle” in primary text color; “TCG” in **brand accent** when styled as a split wordmark (`Castle` + accent `TCG`).
- **Avoid:** Legacy or internal names (e.g. StreamCards, mulistreamer) in user-facing copy unless historically required.
- **People:** Prefer **Creator** and **Collector** (or **fan**) over “streamer” / “viewer” in new marketing and onboarding. Dashboard and nav may still say “streamer” where tied to platform APIs—normalize to Creator/Collector in fresh surfaces.

### 1.3 Domains and URLs (reference)

- Parent / hub: `creatorcastle.gg`
- Product example: `tcg.creatorcastle.gg`
- Asset CDN: `cdn.codeoce.com` (logos, creator packs, shared media)

New products should use subdomains or paths under Creator Castle, not unrelated domains, unless there is a deliberate spin-out brand.

---

## 2. Brand personality

### 2.1 Positioning

Creator Castle sits at the intersection of:

- **Premium creator tooling** (confident, polished, SaaS-grade)
- **Collectible culture** (cards, rarity, flex, community status)
- **Live platform energy** (Twitch and allies—not a generic “Web3 marketplace”)

It should feel **aspirational but approachable**: built for creators who take their community seriously, and fans who want to *show* support, not just click a button.

### 2.2 Voice principles

| Do | Don’t |
|----|--------|
| Short, punchy lines; strong verbs | Long paragraphs on heroes and CTAs |
| Imperatives that reward participation: collect, trade, support, flex, build | Passive corporate filler (“leverage synergies”) |
| Inclusive “together” framing (creators **and** fans) | Talk down to collectors or treat creators as interchangeable |
| Confident, slightly competitive (flex, complete the set) | Aggressive hustle culture or crypto hype |
| Plain English for UI labels | Internal jargon (void, SaaS class names) in user copy |

**Body copy:** One or two sentences max above the fold. Warm, specific, community-focused.

**Microcopy (buttons, tabs, badges):** `UPPERCASE`, wide letter-spacing, small size (9–12px), **bold/black** weight — reads as “control panel” / tactical UI, not a blog.

### 2.3 Lexicon (preferred terms)

| Concept | Preferred | Notes |
|---------|-----------|--------|
| Content owner | Creator | Not “talent” or “partner” in product UI |
| Fan / player | Collector | “Viewer” only when tied to Twitch role |
| User ID | Castle code | Monospace, often uppercase when displayed |
| Card economy | Collection, binder, pack, trade, battle | TCG-native words |
| Creator tools | Dashboard, Card Studio (if applicable) | Product-specific |
| Rarity | Common, Rare, Epic, Legendary | See §5.4 — semantic colors, not brand colors |

---

## 3. Visual identity: the “Void” system

The shared design language is internally called **Void** (CSS tokens prefixed `--void-`). Externally, describe it as **Creator Castle dark** or **Castle dark UI**—not “Void theme” to end users.

### 3.1 Design intent

- **Dark-first:** Deep, near-black canvas so card art and accent blue pop.
- **Electric clarity:** One primary accent (Castle blue)—not rainbow gradients on chrome.
- **Depth without clutter:** Glass panels, soft borders, ambient glow—not skeuomorphic textures.
- **Collectible respect:** UI recedes; card imagery and rarity are the heroes.
- **Subtle tech texture:** Very light scanline or noise overlay at low opacity is acceptable; must not harm readability.

### 3.2 Color tokens (canonical)

Implement as CSS variables; consume via utilities or components—**do not** scatter unrelated hex values.

#### Core brand palette

| Token | Hex / value | Use |
|-------|-------------|-----|
| `--void-bg` | `#05070a` | Page background |
| `--void-bg-alt` | `#0a0c10` | Elevated sections, wells |
| `--void-text` | `#fcfaf7` | Primary text (slightly warm white) |
| `--void-muted` | `#64748b` (Tailwind slate-500 family) | Secondary text, hints |
| `--void-accent` | `#3faaff` | Primary brand blue: CTAs, links, focus, active nav |
| `--void-accent-rgb` | `63, 170, 255` | Glows, borders, `rgba()` shadows |
| `--void-border` | `rgba(63, 170, 255, 0.1)` | Subtle accent-tinted dividers |
| `--void-glass` | `rgba(10, 12, 16, 0.85)` | Modals, dropdowns |

#### Light mode (optional)

Class or root: `castle-light-mode`. Inverts surfaces to `#f8fafc` / `#f1f5f9`, text to `#0f172a`, **keeps the same accent blue**. Light mode is a preference, not a separate brand.

#### Semantic colors (not brand)

Use only where meaning is fixed:

| Token | Hex | Meaning |
|-------|-----|---------|
| `--rarity-common` | `#94a3b8` | Common cards |
| `--rarity-rare` | `#3faaff` | Rare (aligns with brand blue) |
| `--rarity-epic` | `#a855f7` | Epic |
| `--rarity-legendary` | `#fbbf24` | Legendary |
| `--source-twitch-bits` | `#facc15` | Grants/purchases via Twitch Bits |
| `--source-castle-site` | `#3faaff` | Grants/purchases via Castle / website |

**Platform brand colors** (e.g. Twitch purple `#9146FF`) are allowed **only** on platform-specific buttons or badges—not as a substitute for Castle blue.

#### Anti-patterns

- Random indigo/violet (`#6366f1`) for primary actions on Castle surfaces.
- Bright green/teal as primary accent on new pages (legacy one-offs).
- Pure `#000` / `#fff` for large fields—use void tokens.
- Gradients on every button; reserve gradients for card holo / hero moments.

### 3.3 Typography

Load from Google Fonts unless a product has a documented exception.

| Role | Family | Weights | Usage |
|------|--------|---------|--------|
| **Body / UI** | **Inter** | 300–800 | Paragraphs, forms, tables, dense UI |
| **Header** | **Space Grotesk** | 300–700 | Section titles, stats, card names in UI chrome |
| **Display** | **Outfit** | 400–900 | Hero headlines, marketing beats, large italic uppercase |

**Body defaults:** Slight negative letter-spacing (`-0.01em`), antialiased.

**Display headlines:** `font-black` (900), `uppercase`, tight tracking (`tracking-tighter`), often **italic** on largest heroes.

**UI chrome labels:** `text-[9px]`–`text-[11px]`, `font-black`, `uppercase`, `tracking-widest` or `tracking-[0.2em]`.

**Data / Castle code:** Monospace or mono styling, `tracking-wider`, uppercase when shown as an ID.

### 3.4 Logo and marks

| Asset | URL | When |
|-------|-----|------|
| Castle mark (light UI) | `https://cdn.codeoce.com/logo/logo_white.png` | Dark backgrounds, default favicon on dark |
| Castle mark (dark UI) | `https://cdn.codeoce.com/logo/logo_black.png` | Light backgrounds / light favicon |

**Usage rules:**

- Place mark in a **rounded container** (`rounded-2xl`), subtle `bg-void-accent/10`, light shadow with accent tint—not bare on busy backgrounds.
- Class for images: `brand-castle-mark` — `object-fit: contain`, non-interactive.
- In light mode, invert mark via `filter: brightness(0)` if using the white asset on light bg.
- **Do not** redraw the castle, swap icons (lightning bolts, generic shields), or use emoji as logo substitutes.
- Product wordmark beside mark: **Castle** + accent **TCG** (or future product suffix) using display font.

### 3.5 Iconography

- **Boxicons** (`bx`, `bxs`) for UI icons—outline for nav, solid for emphasis in small tiles.
- Keep icon size aligned to label (often `text-xs` with `text-[10px]` labels).
- No mixed icon families on the same screen without reason.

---

## 4. Layout and composition

### 4.1 Spatial rules

- **Max content width:** Marketing `~1400px`; forms/dashboards `~4xl–7xl` with generous horizontal padding (`px-6`–`px-8`).
- **Vertical rhythm:** Large section gaps on marketing; tighter density in dashboards.
- **Cards and binders:** Grid with consistent aspect ratio for card thumbnails; let art define silhouette—avoid heavy boxes around every card.
- **Fixed nav:** Top bar, `h-20`, `backdrop-blur-2xl`, `border-b border-white/5`, semi-transparent `bg-void-bg/40`.

### 4.2 Surfaces

| Pattern | Definition |
|---------|------------|
| **Ambient background** | Fixed full-viewport layer: dual soft **radial gradients** in accent blue at 3–6% opacity on `--void-bg`. Class concept: `saas-bg-glow`. |
| **Glass panel** | `backdrop-filter: blur(20px)`, `bg` ~60% void, border `white/5`, radius `1.5rem`, deep shadow. Hover: slightly stronger accent border. |
| **Inset panel** | `bg-white/[0.03–0.05]`, `border-white/5–10`, `rounded-xl`–`3xl`. |
| **Floating card showcase** | Large radius (`3rem`), border `white/5`, optional vertical mask fade for marquee columns. |

### 4.3 Corner radius scale

- Buttons / inputs: `0.75rem`–`1rem` (`rounded-xl`)
- Nav pills / tabs: `rounded-2xl`–`rounded-3xl`
- Modals / heroes: `rounded-3xl` and up
- Avoid sharp `rounded-none` except data tables.

### 4.4 Borders and dividers

- Default: `rgba(255,255,255,0.05–0.10)` on dark.
- Focus/active: accent at `0.35–0.9` opacity, optional outer glow `0 0 0 3px rgba(accent, 0.18)`.
- Avoid heavy 2px neutral gray borders everywhere—prefer thin, low-contrast lines.

---

## 5. Components (behavioral spec)

Build new UIs from these **patterns**, not from copying one HTML file.

### 5.1 Primary button (`saas-button`)

- Background: `--void-accent`
- Text: `--void-bg` (dark on blue), `font-weight: 800`, `uppercase`, `letter-spacing: 0.1em`
- Shadow: accent-tinted, lifts `translateY(-2px)` on hover, slight brightness increase
- Radius: ~`1rem`; padding generous on marketing CTAs

### 5.2 Secondary button (`saas-button-secondary`)

- Background: `white/5`, border `white/10`, text white (dark mode)
- Hover: slightly brighter fill, subtle shadow, small lift
- Same uppercase tracking as primary

### 5.3 Navigation tabs

- Container: pill rail with `bg-white/[0.04]`, `border-white/5`, inner padding
- Tab: `text-[10px]`, `font-black`, `uppercase`, `tracking-widest`
- Inactive: `--void-muted`; active: accent background tint or accent text
- Transition: `ease-premium` (~0.16, 1, 0.3, 1), ~500ms for sliding indicators

### 5.4 Selects and dropdowns (`void-dropdown`)

- Trigger: dark fill `rgba(5,7,10,0.75)`, **1.5px** accent border, bold small caps label
- Menu: near-opaque void bg, accent border, blur, accent scrollbar thumb
- Selected/hover option: accent text + `accent/10` background

### 5.5 Toasts

- Dark glass, accent border hint, slide-in with `--ease-tactical`
- Light mode: white toast, soft shadow—not neon

### 5.6 Motion

| Easing token | Curve | Use |
|--------------|-------|-----|
| `--ease-tactical` | `cubic-bezier(0.19, 1, 0.22, 1)` | Snappy UI: toasts, toggles, slides |
| `--ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` | Heroes, card flips, tab indicator |

**Marketing:** Slow vertical floats for card columns (20–25s loops). **Product:** Respect `prefers-reduced-motion` and user prefs (`castle-reduce-motion`, `castle-no-animations`, `castle-photosensitivity`)—disable holo/shimmer and large parallax when set.

### 5.7 Card interactions (TCG products)

- 3D tilt and flip on detail views are signature interactions—use sparingly outside card contexts.
- Holofoil layers: pointer-driven on rare+ ; never mandatory for basic UI chrome.

---

## 6. Imagery and content

### 6.1 Photography and illustration

- Prefer **real card art** and **creator-provided assets** over stock photos.
- Marketing may use floating card grids; always respect aspect ratio (~TCG card proportion).
- No generic “people shaking hands” corporate stock.

### 6.2 Creator customization

- Creator packs, avatars, and banners live on CDN under creator IDs—UI chrome stays Void; **creator brand colors belong on cards/packs**, not global nav recoloring per creator (except dedicated creator landing pages if explicitly designed).

### 6.3 Empty and error states

- Tone: helpful, brief, still on-brand (muted text + single clear CTA).
- Avoid cutesy mascots unless introduced as a formal sub-brand.

---

## 7. Accessibility and inclusion

Non-negotiable for all new surfaces:

- **Contrast:** Accent on dark meets WCAG for text and controls; test light mode separately.
- **Motion:** Honor system `prefers-reduced-motion` and Castle preference flags.
- **Photosensitivity:** Ability to disable flash/shimmer/holo animations.
- **Focus:** Visible accent focus rings on interactive elements—never `outline: none` without replacement.
- **Touch targets:** Minimum ~44px for primary actions on mobile.

---

## 8. Building a new site in this family

### 8.1 Checklist for LLMs / builders

1. Set `:root` Void tokens (§3.2); wire Tailwind or equivalent to the same names.
2. Load Inter + Space Grotesk + Outfit; assign roles per §3.3.
3. Add `saas-bg-glow` (or equivalent) on `body`.
4. Header: castle mark + product wordmark + optional Creator Castle “byline” in footer/legal only.
5. Use **one** primary CTA style and **one** secondary; reuse nav tab pattern for section switching.
6. Write hero in display uppercase; body in Inter; labels in micro-uppercase.
7. Keep Twitch/platform colors scoped to platform actions.
8. Implement light mode only if the product is consumer-facing long-form reading—not required for obs tools.
9. Link legal/support to Creator Castle entity naming used in Terms.

### 8.2 What can vary by product

- Page structure and feature set
- Illustration of workflows (onboarding steps, dashboards)
- Density (trading floor vs. marketing landing)
- Product-specific accent **tint** is **not** allowed—stay on `#3faaff` unless leadership approves a sub-brand

### 8.3 Footer and legal minimum

- © Creator Castle (or legal entity name from Terms)
- Links: Terms, Privacy, Support/contact
- Product name in `<title>`: `{Page} | {Product}` e.g. `Queue Control · Castle TCG`

---

## 9. Quick reference (copy-paste tokens)

```css
:root {
  --void-bg: #05070a;
  --void-bg-alt: #0a0c10;
  --void-accent: #3faaff;
  --void-accent-rgb: 63, 170, 255;
  --void-text: #fcfaf7;
  --void-muted: #64748b;
  --void-border: rgba(63, 170, 255, 0.1);
  --void-glass: rgba(10, 12, 16, 0.85);

  --rarity-common: #94a3b8;
  --rarity-rare: #3faaff;
  --rarity-epic: #a855f7;
  --rarity-legendary: #fbbf24;

  --source-twitch-bits: #facc15;
  --source-castle-site: #3faaff;

  --ease-tactical: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Fonts:** `Inter` (body), `Space Grotesk` (header), `Outfit` (display)

**Mark (dark UI):** `https://cdn.codeoce.com/logo/logo_white.png`

---

## 10. Document control

- **Derived from:** Castle TCG production UI (Void tokens, Castle TCG copy patterns, shared `styles.css` / Tailwind theme).
- **Not a substitute for:** Legal marks registration, trademark usage policy, or creator-specific brand approvals.
- **When in doubt:** Match parent **Creator Castle** gravitas and **Castle blue** discipline; let card art and creators supply the color variety—not the chrome.
