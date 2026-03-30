# StreamCards -- Design Document

## Overview

StreamCards is a landing page for a **TCG (Trading Card Game) Twitch integration** that works with every streamer. Viewers collect, trade, and battle digital cards earned from watching their favorite streams. The design draws inspiration from dark-themed NFT/collectible marketplaces (Munity, Mystique) blended with gaming and streaming culture.

---

## Brand Identity

- **Name:** StreamCards
- **Tagline:** "Collect, Trade & Battle Stream Cards"
- **Logo:** A teal lightning-bolt icon (`Zap`) inside a rounded square, paired with the "StreamCards" wordmark in Space Grotesk bold.
- **Tone:** Premium gaming collectible -- confident, community-driven, slightly futuristic.

---

## Color System

| Token              | Value (OKLCH)              | Description                            |
| ------------------- | -------------------------- | -------------------------------------- |
| `--background`      | `oklch(0.13 0.01 260)`    | Deep navy-black page background        |
| `--card`            | `oklch(0.17 0.015 260)`   | Slightly lighter card/panel surfaces   |
| `--primary`         | `oklch(0.72 0.19 195)`    | Teal/cyan -- main brand accent         |
| `--accent`          | `oklch(0.65 0.24 25)`     | Warm orange -- secondary highlight     |
| `--foreground`      | `oklch(0.95 0.01 260)`    | Near-white text                        |
| `--muted-foreground`| `oklch(0.60 0.02 260)`    | Dimmed secondary text                  |
| `--border`          | `oklch(0.25 0.02 260)`    | Subtle dividers and card edges         |

Additional rarity-specific palette used on cards:

- **Legendary:** Amber/gold `bg-amber-500/80`
- **Epic:** Primary teal or purple `oklch(0.70 0.18 300)`
- **Rare:** Primary teal `bg-primary`
- **Common:** Muted/secondary tones

All colors go through CSS custom properties and are applied via Tailwind utility classes (`bg-background`, `text-primary`, etc.). No raw hex or direct color classes like `bg-white` or `text-black` are used.

---

## Typography

| Role     | Font Family    | Source         | Usage                               |
| -------- | -------------- | -------------- | ----------------------------------- |
| Body     | Inter          | Google Fonts   | All paragraph text, labels, UI copy |
| Headings | Space Grotesk  | Google Fonts   | All headings, stats, card names     |

Applied via CSS variables:
- `--font-sans` maps to Inter (used via `font-sans` class)
- `--font-heading` maps to Space Grotesk (applied inline via `fontFamily`)
- `--font-mono` maps to Geist Mono (available but not prominently used)

Heading sizes scale responsively: `text-4xl` on mobile up to `text-7xl` on large screens. Body text uses `text-base` / `text-lg` with `leading-relaxed` (line-height 1.625).

---

## Layout & Structure

The page uses a single-column flow composed of full-width sections, each internally constrained to `max-w-7xl` with `px-6` horizontal padding.

### Section Order (top to bottom)

1. **Navbar** (fixed)
2. **Hero Section**
3. **How It Works**
4. **Featured Streamers**
5. **Card Showcase**
6. **Stats Section**
7. **Integrations**
8. **CTA + FAQ**
9. **Footer**

---

## Section Breakdown

### 1. Navbar

- **Position:** Fixed top, full width, `z-50`
- **Background:** `bg-background/80 backdrop-blur-xl` with a bottom border
- **Left:** Logo (Zap icon + "StreamCards" wordmark)
- **Center:** Navigation links -- How It Works, Streamers, Cards, Stats (hidden on mobile)
- **Right:** "Log In" ghost button + "Get Started" primary button
- **Mobile:** Hamburger icon toggles a dropdown panel with the same links and buttons stacked vertically

### 2. Hero Section

- **Layout:** Two-column flex on desktop (`lg:flex-row`), stacked on mobile
- **Background:** Full-bleed hero image (`hero-bg.jpg`) at 40% opacity, overlaid with a gradient fade to background
- **Decorative:** Two large blurred circles (primary and accent at 10% opacity) for atmospheric glow
- **Left Column:**
  - Badge pill: pulsing green dot + "TCG Twitch Integration"
  - Main heading: "Collect, Trade & Battle **Stream Cards**" -- "Stream Cards" uses a teal gradient (`from-primary to-primary/60 bg-clip-text text-transparent`)
  - Subheading paragraph in muted text
  - Two buttons: "Start Collecting" (primary, with arrow icon) and "Add to Your Stream" (outline)
  - Three stat counters (12K+ Streamers, 850K+ Cards, 2.5M+ Viewers) separated by vertical dividers
- **Right Column:** Three vertically-scrolling card columns
  - Column 1 scrolls **up** (30s loop), column 2 scrolls **down** (35s loop), column 3 scrolls **up** (28s loop)
  - Each column is 160-200px wide and contains 5 unique card images duplicated for seamless looping
  - Cards are 240px tall with rounded corners, border, and a bottom gradient overlay showing rarity badge + card name
  - Top and bottom fade masks (`bg-gradient-to-b/t from-background`) hide the scroll edges
  - Animation uses inline `@keyframes` injected via `<style>` with `translateY` calculated from card count, height, and gap
  - Rarity badges: Legendary (amber), Epic (teal), Rare (orange)
  - Container height: 500px mobile, 560px tablet, 640px desktop

### 3. How It Works

- **Background:** Subtle gradient overlay (`via-secondary/30`)
- **Header:** "How It Works" label in primary, heading "Stream to Card in 3 Steps", descriptive paragraph
- **Content:** 3-column grid (`md:grid-cols-3`) of step cards
  - Each card: icon in teal circle, large step number (01/02/03) in faded text, title, description
  - Small arrow icons between cards on desktop (`absolute -right-3 top-1/2`)
  - Steps: Connect Your Channel, Viewers Collect Cards, Trade & Battle
  - Cards have `hover:border-primary/40` interaction

### 4. Featured Streamers

- **Header:** "Top Collections" label, "Featured Streamers" heading
- **Content:** Two horizontal auto-scrolling marquee rows of streamer pills
  - **Row 1:** Scrolls left using `animate-[scroll_30s_linear_infinite]`
  - **Row 2:** Scrolls right using `animate-[scroll-reverse_35s_linear_infinite]`
  - Each pill: circular avatar (40px), name with verified checkmark (teal SVG), card count in primary color, category badge (FPS, Variety, Survival)
  - Streamers are duplicated (`[...streamers, ...streamers]`) for seamless loop
  - Pill styling: `rounded-full border bg-card`, hover highlights border

### 5. Card Showcase

- **Background:** Subtle gradient overlay
- **Header:** "Card Gallery" label, "Discover Unique Cards" heading, "Explore More" outline button
- **Filters:** Row of pill buttons for rarity categories (All, Legendary, Epic, Rare, Common)
  - Active filter: `border-primary bg-primary/10 text-primary`
  - Inactive: `border-border bg-card text-muted-foreground`
  - Client-side state via `useState`
- **Grid:** 4-column grid (`lg:grid-cols-4`, 2-col on tablet, 1-col on mobile)
  - Each card: image with `aspect-[3/4]`, gradient overlay from bottom, card name + rarity badge, "by {owner}" credit, ATK (accent color) and DEF (primary color) stats
  - Rarity badge colors: Legendary (gold with custom oklch), Epic (purple oklch), Rare (primary teal), Common (muted)
  - Hover: `border-primary/40`, shadow, image scales up 5%

### 6. Stats Section

- **Layout:** 4-column grid (`lg:grid-cols-4`)
- **Cards:** Each stat card has an icon in a teal circle, large bold value (Space Grotesk), label, description
- **Stats:** 12,400+ Streamers, 850K+ Cards Collected, 320K+ Battles Played, 2.5M+ Active Viewers
- **Icons:** MonitorPlay, Layers, Swords, Users (all from lucide-react)
- **Hover:** `border-primary/40`

### 7. Integrations

- **Container:** Large rounded card (`rounded-3xl border bg-card`) with generous padding
- **Header:** "Integrations" label, "Works With Your Favorite Tools" heading
- **Grid:** 3-column grid (`lg:grid-cols-3`) of integration items
  - Each item: icon in teal circle + name + short description
  - Integrations: Twitch, Discord, OBS, StreamElements, Streamlabs, Any Platform (API)
  - Hover: `border-primary/40`

### 8. CTA + FAQ

- **Container:** Large rounded card with decorative blurred circles in top-left and bottom-right corners
- **Layout:** 2-column grid on desktop
- **Left:** Heading "Ready to Power Up Your Stream?", description, two buttons (Launch StreamCards with Zap icon, Learn More with arrow)
- **Right:** FAQ accordion using native `<details>/<summary>` elements
  - 3 questions: free pricing, card acquisition, card customization
  - Arrow icon rotates 90deg on open (`group-open:rotate-90`)
  - Each item: `rounded-xl border bg-background/50`

### 9. Footer

- **Background:** `bg-card` with top border
- **Layout:** 5-column grid (1 brand column + 4 link columns)
- **Brand column:** Logo + tagline paragraph
- **Link columns:** Product, Streamers, Community, Legal -- each with 3-4 text links
- **Bottom bar:** Copyright "2026 StreamCards" on left, social icons (Twitter/X, Discord, GitHub) on right
- **Social icons:** Inline SVGs, `text-muted-foreground hover:text-foreground`

---

## Animations & Motion

| Animation        | Type               | Duration | Easing | Used In              |
| ---------------- | ------------------ | -------- | ------ | -------------------- |
| `scrollUp`       | `translateY` loop  | 28-30s   | linear | Hero card columns    |
| `scrollDown`     | `translateY` loop  | 35s      | linear | Hero card column 2   |
| `scroll`         | `translateX` loop  | 30s      | linear | Streamer marquee row 1 |
| `scroll-reverse` | `translateX` loop  | 35s      | linear | Streamer marquee row 2 |
| `pulse`          | Built-in Tailwind  | default  | ease   | Badge indicator dot  |

All scroll animations duplicate their content to create seamless infinite loops. Hero card columns use calculated `translateY` values based on `CARD_HEIGHT * count + GAP * count`. Streamer marquees use `translateX(-50%)` with doubled content.

Hover transitions throughout: `duration-300` on borders/shadows, `duration-500` on image scale transforms.

---

## Responsive Behavior

| Breakpoint | Key Changes                                                   |
| ---------- | ------------------------------------------------------------- |
| Base       | Single column, stacked layout, smaller headings, compact spacing |
| `sm`       | Two-column grids, larger hero card columns, button row        |
| `md`       | Navbar links visible, 3-col how-it-works grid, 2-col card grid |
| `lg`       | Hero side-by-side, 4-col card grid, 3-col integrations, full stats row, footer columns |

Mobile navigation uses a toggled dropdown panel with the same links and buttons as desktop.

---
