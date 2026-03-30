# Twitch TCG: System Documentation

This document provides a comprehensive overview of the Twitch TCG ecosystem, including gameplay mechanics, technical architecture, and the viewer economy.

---

## 🏗️ CORE GAME MECHANICS

### Turn Structure & Combat System
The core gameplay centers on a **3-Slot Battle Arena**. Battles are currently simulated using a best-of-one or best-of-X round structure.

1.  **Deck Composition**: Players build a "Battle Deck" of exactly **3 cards**.
2.  **Phase 1: Coin Flip**: A simulation starts with a coin flip to determine whether the Challenger or the Target (opponent/streamer) attacks first.
3.  **Phase 2: Simultaneous Exchange**:
    *   Combat is simultaneous. When a card attacks, both the attacker and defender deal damage to each other's "Defense" (HP) stat simultaneously.
4.  **Targeting**:
    *   Standard targeting follows a leftmost-living priority.
    *   **Guard Logic**: If any card on the defending side has the **Guard** trait, it *must* be targeted first until defeated.
5.  **Win Conditions**:
    *   A round is won by the side with the most living cards after all exchanges.
    *   If all cards are defeated on both sides simultaneously, it is ruled a **Draw**.

### Gameplay Loops
*   **Support & Collect**: Viewers support the streamer (Subs/Gifts/Bits) to earn cards.
*   **Flex & Trade**: Players showcase their binder and trade with others to complete sets.
*   **Battle**: Players use their collected cards to challenge others or the streamer's "Boss Deck."

---

## 🃏 CARD SYSTEM

### Card Structure
Each card is defined by several core attributes:
*   **Stats**: 
    *   **Attack (ATK)**: Damage dealt per exchange.
    *   **Defense (DEF/HP)**: Amount of damage a card can take before depletion.
    *   *Note: Stats are generated based on a "Rarity Budget" (e.g., Common = 5 total points, Legendary = 15).*
*   **Grade (PSA-style)**:
    *   Cards are graded from **1 to 10** upon granting.
    *   **Genesis Mint (Grade 11)**: A rare 1% "Pristine" grade that overrides standard grading.
*   **Traits/Mechanics**:
    *   **Guard**: Forces opponent targeting.
    *   **Vampire**: Heals 30% of victim's max HP on kill.
    *   **Reanimate**: Revives once per round with 1 HP.
    *   **Mimic**: Copies Stats from the left neighbor and the Trait from the right neighbor.

### Rarities & Obtaining Cards
*   **Rarities**: Common, Uncommon, Rare, Epic, Legendary.
*   **Obtaining**:
    *   **Automated Drops**: Webhooks trigger on Subs (1 card), Re-subs (1 card), and Gift Subs (1 card per gift to the gifter).
    *   **Redemptions**: Custom Twitch Channel Point rewards for "Pulling a Card" or "Initiating a Battle."
    *   **Crafting**: Cards can be sold for **Dust** to buy specific mechanics for other cards.

---

## 🎮 TWITCH INTEGRATION

### Viewer Participation
*   **Chat Commands**: 
    *   `!pull`: Pulls a card (if points/permission available).
    *   `!battle @user`: Challenges another viewer.
    *   `!stats`: Shows collection progress.
*   **Overlay (OBS)**:
    *   **Real-time Reveals**: When a card is granted, the OBS overlay triggers a "Pack Opening" animation.
    *   **Styles**: Streamers can choose between **Standard**, **Cosmic Burst** (glow/spin), and **Brutalist** (jitter/glitch) animation styles.

### Streamer Controls
*   **Creator Dashboard**: Allows streamers to:
    *   Design a custom **Pack Mockup** with foil highlights.
    *   Create custom **Sets** (e.g., Genesis Set).
    *   Upload card art and manage rarity distributions.
    *   Manage the **OBS Queue** (skip/pause reveal animations).

---

## 💰 ECONOMY & PROGRESSION

### Currencies
*   **Cards**: The primary asset. Can be traded or used in battle.
*   **Dust**: Earned by selling unwanted cards. Used to "Buy Mechanics" (e.g., adding Vampire to a favorite card).
*   **Packs**: Obtained via Stripe purchase or streamer-defined milestones.

### Progression
*   **Set Completion**: Tracking "Total Collected vs. Set Total" per streamer.
*   **Binder Customization**: Users can layout their binders with custom themes and "Premium Void" frames.

---

## 🛠️ TECHNICAL IMPLEMENTATION

*   **Backend**: Cloudflare Workers (TypeScript) handling API, Webhooks, and Battle Logic.
*   **Database**: Supabase (PostgreSQL) with **Row Level Security (RLS)** protecting all user assets.
*   **Storage**: Cloudflare R2 for card and pack assets.
*   **Payments**: Stripe integration for pack purchases.
*   **Security**: CSRF protection on all mutation endpoints; JWT-based sessions linked to Twitch ID.
*   **Image Capture**: Custom client-side Canvas capture for "Binder Exporting," featuring recursive Blob-loading to bypass CORS limitations.

---

## 🚀 CURRENT STATE & LAUNCH READINESS

### Current State
*   **Core Systems Alpha**: Battle Engine, Card Granting, and OBS Overlays are 100% functional.
*   **Security Baseline**: RLS is fully implemented across all tables (March 18 Audit).
*   **UI/UX**: "Normal" Binder view and "Premium Export" modes are unified and refined. Standardized branding ("Castle TCG") applied.

### Launch Readiness
*   ✅ **Stable Deployment**: Currently running on Cloudflare/Supabase.
*   ✅ **Mobile Responsive**: Core binder and collection views optimized for mobile.
*   ⚠️ **Pending**: 
    *   Production-ready Stripe keys (currently in Test Mode).
    *   Load testing for high-concurrency "Raid" events (massive simultaneous card drops).
    *   Final legal/Twitch TOS review for prize distribution.

---
*Generated: 2026-03-21*
