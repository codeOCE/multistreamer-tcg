/**
 * profile.js — Public profile page logic for /profile/:username
 * 4-col widget grid: pointer-drag reorder (live FLIP reflow) + edge-handle
 * resize with tier snapping. Layout/widths/order persisted server-side.
 */
(function () {
    'use strict';

    // ── Titles catalogue ────────────────────────────────────────────────────
    // check(s) receives stats merged with { _level }. packs_opened is optional —
    // those titles simply stay locked until the backend exposes the field.
    const TITLES = [
        // The Vault — pack opening
        { id: 'vault_seeker',      name: 'Vault Seeker',      category: 'The Vault',   desc: 'Open your first pack',       check: s => (s.packs_opened || 0) >= 1 },
        { id: 'relic_hunter',      name: 'Relic Hunter',      category: 'The Vault',   desc: 'Open 25 packs',              check: s => (s.packs_opened || 0) >= 25 },
        { id: 'the_obsessed',      name: 'The Obsessed',      category: 'The Vault',   desc: 'Open 100 packs',             check: s => (s.packs_opened || 0) >= 100 },
        { id: 'vault_lord',        name: 'Vault Lord',        category: 'The Vault',   desc: 'Open 500 packs',             check: s => (s.packs_opened || 0) >= 500 },
        // The Keep — collection size
        { id: 'wanderer',          name: 'Wanderer',          category: 'The Keep',    desc: 'Collect 10 cards',           check: s => s.total_cards >= 10 },
        { id: 'keeper',            name: 'Keeper',            category: 'The Keep',    desc: 'Collect 100 cards',          check: s => s.total_cards >= 100 },
        { id: 'lord_of_the_keep',  name: 'Lord of the Keep',  category: 'The Keep',    desc: 'Collect 500 cards',          check: s => s.total_cards >= 500 },
        { id: 'royal_archivist',   name: 'Royal Archivist',   category: 'The Keep',    desc: 'Collect 1,000 cards',        check: s => s.total_cards >= 1000 },
        { id: 'grand_chronicler',  name: 'Grand Chronicler',  category: 'The Keep',    desc: 'Collect 5,000 cards',        check: s => s.total_cards >= 5000 },
        // The Forge — rarity
        { id: 'silverhand',        name: 'Silverhand',        category: 'The Forge',   desc: 'Own a Rare card',            check: s => s.rare_count >= 1 },
        { id: 'the_ambitious',     name: 'The Ambitious',     category: 'The Forge',   desc: 'Own an Epic card',           check: s => s.epic_count >= 1 },
        { id: 'gilded',            name: 'Gilded',            category: 'The Forge',   desc: 'Own a Legendary card',       check: s => s.legendary_count >= 1 },
        { id: 'golden_lord',       name: 'Golden Lord',       category: 'The Forge',   desc: 'Own 10 Legendary cards',     check: s => s.legendary_count >= 10 },
        { id: 'mythweaver',        name: 'Mythweaver',        category: 'The Forge',   desc: 'Own 50 Legendary cards',     check: s => s.legendary_count >= 50 },
        // The Throne — level
        { id: 'the_page',          name: 'The Page',          category: 'The Throne',  desc: 'Reach level 5',              check: s => s._level >= 5 },
        { id: 'sworn_blade',       name: 'Sworn Blade',       category: 'The Throne',  desc: 'Reach level 10',             check: s => s._level >= 10 },
        { id: 'the_baron',         name: 'The Baron',         category: 'The Throne',  desc: 'Reach level 20',             check: s => s._level >= 20 },
        { id: 'overlord',          name: 'Overlord',          category: 'The Throne',  desc: 'Reach level 30',             check: s => s._level >= 30 },
        // The Arena — battles
        { id: 'challenger',        name: 'Challenger',        category: 'The Arena',   desc: 'Win your first battle',      check: s => s.battles_won >= 1 },
        { id: 'the_duelist',       name: 'The Duelist',       category: 'The Arena',   desc: 'Win 10 battles',             check: s => s.battles_won >= 10 },
        { id: 'warlord',           name: 'Warlord',           category: 'The Arena',   desc: 'Win 50 battles',             check: s => s.battles_won >= 50 },
        { id: 'castle_champion',   name: 'Castle Champion',   category: 'The Arena',   desc: 'Win 100 battles',            check: s => s.battles_won >= 100 },
        // The Realm — community
        { id: 'loyalist',          name: 'Loyalist',          category: 'The Realm',   desc: 'Support a creator',          check: s => s.unique_streamers >= 1 },
        { id: 'the_devoted',       name: 'The Devoted',       category: 'The Realm',   desc: 'Support 5 creators',         check: s => s.unique_streamers >= 5 },
        { id: 'castellan',         name: 'Castellan',         category: 'The Realm',   desc: 'Support 20 creators',        check: s => s.unique_streamers >= 20 },
        // The Market — trades
        { id: 'merchant',          name: 'Merchant',          category: 'The Market',  desc: 'Complete a trade',           check: s => s.trades_completed >= 1 },
        { id: 'guild_master',      name: 'Guild Master',      category: 'The Market',  desc: 'Complete 50 trades',         check: s => s.trades_completed >= 50 },
        // The Scriptorium — set completion
        { id: 'set_finisher',      name: 'Set Finisher',      category: 'The Scriptorium', desc: 'Complete your first set',  check: s => (s.sets_completed || 0) >= 1 },
        { id: 'the_completionist', name: 'The Completionist', category: 'The Scriptorium', desc: 'Complete 5 sets',          check: s => (s.sets_completed || 0) >= 5 },
        { id: 'grand_archivist',   name: 'Grand Archivist',   category: 'The Scriptorium', desc: 'Complete 10 sets',         check: s => (s.sets_completed || 0) >= 10 },
    ];

    const DEFAULT_PROFILE_BANNER = '/default_banner.png';

    // ── Backend origin ──────────────────────────────────────────────────────
    function backendBase() {
        if (typeof getCastleBackendOrigin === 'function') {
            try { const o = getCastleBackendOrigin(); if (o) return String(o).replace(/\/$/, ''); } catch (_) {}
        }
        return (window.location && window.location.origin) ? window.location.origin.replace(/\/$/, '') : '';
    }

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── Parse username from URL ─────────────────────────────────────────────
    // Expects /profile/:username — if bare /profile, redirect to own profile
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let profileUsername = pathParts[1] || '';

    if (!profileUsername) {
        // No username in URL — try to resolve via session then redirect
        (async () => {
            try {
                const base = backendBase();
                const res = await fetch(`${base}/api/v2/bootstrap`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const uname = data?.user?.username;
                    if (uname) {
                        window.location.replace(`/profile/${encodeURIComponent(uname)}`);
                        return;
                    }
                }
            } catch (_) {}
            // Not logged in or no username
            window.location.replace('/login?next=/profile');
        })();
        // Stop further execution — redirect is in progress
        return;
    }

    // ── Rarity helpers ──────────────────────────────────────────────────────
    const RARITY_COLOR = {
        legendary: '#fbbf24',
        epic: '#a855f7',
        rare: '#3faaff',
        common: '#64748b',
    };
    function rarityColor(r) { return RARITY_COLOR[(r || '').toLowerCase()] || RARITY_COLOR.common; }
    function rarityClass(r) { return (r || '').toLowerCase(); }

    // ── Card modal ──────────────────────────────────────────────────────────
    let isOwner = false;
    let featuredCardIds = [];
    let featuredCardInfo = {}; // user_card_id -> { name, image_url, rarity } for the selected strip
    let currentModalCard = null;

    function rememberCardInfo(cards) {
        (Array.isArray(cards) ? cards : []).forEach(c => {
            if (c && c.user_card_id) featuredCardInfo[c.user_card_id] = { name: c.name, image_url: c.image_url, rarity: c.rarity };
        });
    }

    const modal    = document.getElementById('pf-card-modal');
    const modalImg = document.getElementById('pf-modal-img');
    const modalName = document.getElementById('pf-modal-name');
    const modalMeta = document.getElementById('pf-modal-meta');
    const pinBtn = document.getElementById('pf-pin-btn');
    const pinLabel = document.getElementById('pf-pin-label');

    function openCardModal(card) {
        if (!modal) return;
        currentModalCard = card;
        modalImg.src = card.image_url || '';
        modalImg.alt = card.name || '';
        modalName.textContent = card.name || '—';
        modalMeta.textContent = `${card.rarity || 'Common'}${card.brand_name ? ' · ' + card.brand_name : ''}${card.mechanic_name ? ' · ' + card.mechanic_name : ''}`;
        
        // Show pin button if owner
        if (isOwner && pinBtn) {
            pinBtn.classList.remove('hidden');
            const isPinned = featuredCardIds.includes(card.user_card_id);
            pinLabel.textContent = isPinned ? 'Unpin from Showcase' : 'Pin to Showcase';
            pinBtn.querySelector('i').className = isPinned ? 'bx bxs-pin' : 'bx bx-pin';
        } else {
            pinBtn?.classList.add('hidden');
        }

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeCardModal() {
        modal?.classList.remove('open');
        document.body.style.overflow = '';
    }
    document.getElementById('pf-modal-close')?.addEventListener('click', closeCardModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeCardModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCardModal(); });

    // ── Save indicator ────────────────────────────────────────────────────────
    let _siPending = 0;
    let _siHideTimer = null;
    function markDirty() {
        _siPending++;
        clearTimeout(_siHideTimer);
        const el = document.getElementById('pf-save-indicator');
        const lbl = document.getElementById('pf-si-label');
        if (!el) return;
        el.classList.remove('saved');
        el.classList.add('visible', 'saving');
        if (lbl) lbl.textContent = 'Saving…';
    }
    function markSaved() {
        _siPending = Math.max(0, _siPending - 1);
        if (_siPending > 0) return;
        const el = document.getElementById('pf-save-indicator');
        const lbl = document.getElementById('pf-si-label');
        if (!el) return;
        el.classList.remove('saving');
        el.classList.add('saved');
        if (lbl) lbl.textContent = 'Saved';
        _siHideTimer = setTimeout(() => {
            el.classList.remove('visible', 'saved');
        }, 1800);
    }

    // Persist featured (showcase) cards and refresh the showcase carousel.
    async function saveFeaturedCards() {
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile/featured-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ featured_card_ids: featuredCardIds })
            });
            // Cache-bust: the profile GET is edge-cached ~60s, so force a fresh copy.
            const res = await fetch(`${base}/api/public/profile/${encodeURIComponent(profileUsername)}?_=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                rememberCardInfo(data.showcase_cards || []);
                buildShowcaseSlots(data.showcase_cards || []);
            }
            if (editMode) buildShowcaseEditGrid();
        } catch (err) {
            console.error('[Profile] featured save failed:', err);
        } finally {
            markSaved();
        }
    }

    // Toggle a card in/out of the showcase (max 10). Returns the new pinned state.
    function toggleFeaturedCard(id) {
        if (!id) return false;
        const isPinned = featuredCardIds.includes(id);
        if (isPinned) {
            featuredCardIds = featuredCardIds.filter(x => x !== id);
        } else {
            if (featuredCardIds.length >= 10) {
                if (typeof showToast === 'function') showToast('You can only feature 10 cards — remove one first.', 'error');
                return false; // limit hit: not added
            }
            featuredCardIds.push(id);
        }
        return featuredCardIds.includes(id);
    }

    pinBtn?.addEventListener('click', async () => {
        if (!currentModalCard || !currentModalCard.user_card_id) return;
        const id = currentModalCard.user_card_id;
        const wasPinned = featuredCardIds.includes(id);
        const newIsPinned = toggleFeaturedCard(id);
        if (newIsPinned === wasPinned) return; // limit hit, no change
        pinLabel.textContent = newIsPinned ? 'Unpin from Showcase' : 'Pin to Showcase';
        pinBtn.querySelector('i').className = newIsPinned ? 'bx bxs-pin' : 'bx bx-pin';
        await saveFeaturedCards();
        if (typeof showToast === 'function') showToast(newIsPinned ? 'Card pinned to showcase!' : 'Card unpinned!', 'success');
    });

    // ── Showcase carousel / grid ─────────────────────────────────────────────
    let showcaseCards = [];
    let showcaseIdx = 0;
    let autoTimer = null;
    const SHOWCASE_AUTO_MS = 3500;
    let showcaseViewMode = 'carousel'; // overridden by DB value in loadProfile

    function setShowcaseView(mode, { save = false } = {}) {
        showcaseViewMode = mode;
        const carouselWrap = document.getElementById('pf-showcase-inner');
        const dotsWrap     = document.getElementById('pf-dots');
        const gridWrap     = document.getElementById('pf-showcase-grid-view');
        const btn          = document.getElementById('pf-showcase-view-toggle');
        const isGrid = mode === 'grid';
        if (carouselWrap) carouselWrap.classList.toggle('hidden', isGrid);
        if (dotsWrap)     dotsWrap.classList.toggle('hidden', isGrid);
        if (gridWrap)     gridWrap.classList.toggle('hidden', !isGrid);
        if (btn) {
            btn.title = isGrid ? 'Switch to carousel' : 'Switch to grid';
            btn.innerHTML = isGrid
                ? '<i class="bx bx-slideshow"></i>'
                : '<i class="bx bx-grid-alt"></i>';
        }
        if (isGrid && autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        if (save && isOwner) {
            markDirty();
            try {
                const base = backendBase();
                const order = getSavedOrder();
                fetch(`${base}/api/viewer/profile-layout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        layout: order,
                        sections: getSavedSections(),
                        widget_widths: widgetWidths,
                        widget_styles: widgetStyles,
                        layout_version: DEFAULT_LAYOUT_VERSION,
                        settings: { showcase_mode: mode }
                    })
                }).then(() => markSaved()).catch(() => markSaved());
            } catch (_) { markSaved(); }
        }
    }

    function buildShowcaseGridView(cards) {
        const wrap = document.getElementById('pf-showcase-grid-view');
        if (!wrap) return;
        if (!cards || cards.length === 0) { wrap.innerHTML = ''; return; }
        wrap.innerHTML = cards.map((card, i) =>
            `<div class="pf-showcase-grid-card" data-index="${i}">
                <img src="${escapeHTML(card.image_url || '')}" alt="${escapeHTML(card.name || '')}" loading="lazy">
            </div>`
        ).join('');
        wrap.querySelectorAll('.pf-showcase-grid-card').forEach(el => {
            el.addEventListener('click', () => openCardModal(showcaseCards[Number(el.dataset.index)]));
        });
    }

    function buildShowcaseSlots(cards) {
        const wrap = document.getElementById('pf-showcase-inner');
        const dots = document.getElementById('pf-dots');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (!cards || cards.length === 0) {
            wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.08);font-size:2rem;"><i class="bx bxs-id-card"></i></div>';
            return;
        }
        showcaseCards = cards;

        // Build one slot per card, same positioning model as collection page.
        cards.forEach((card, i) => {
            const slot = document.createElement('div');
            slot.className = 'pf-showcase-slot';
            slot.dataset.index = String(i);
            slot.setAttribute('data-pos', 'hidden');
            slot.setAttribute('data-rarity', card.rarity || 'Common');
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.src = card.image_url || '';
            img.alt = card.name || '';
            slot.appendChild(img);
            slot.addEventListener('click', () => {
                const pos = slot.dataset.pos;
                const target = Number(slot.dataset.index || 0);
                if (pos === 'center') { openCardModal(showcaseCards[showcaseIdx]); return; }
                setShowcaseIdx(target, { fromUser: true });
            });
            wrap.appendChild(slot);
        });

        // Dots
        if (dots) {
            dots.innerHTML = '';
            cards.forEach((_, i) => {
                const d = document.createElement('button');
                d.className = 'pf-dot';
                d.setAttribute('aria-label', `Card ${i + 1}`);
                d.addEventListener('click', () => setShowcaseIdx(i, { fromUser: true }));
                dots.appendChild(d);
            });
        }

        setShowcaseIdx(0);
        startShowcaseAuto();
        initShowcaseTouchSwipe();

        // Build grid view (pre-built so toggling is instant)
        buildShowcaseGridView(cards);
        setShowcaseView(showcaseViewMode);

        // Wire toggle button (re-bind each time cards are loaded)
        const toggleBtn = document.getElementById('pf-showcase-view-toggle');
        if (toggleBtn) {
            toggleBtn.onclick = () => setShowcaseView(showcaseViewMode === 'carousel' ? 'grid' : 'carousel', { save: true });
        }
    }

    function setShowcaseIdx(idx, options = {}) {
        const cards = showcaseCards;
        if (!cards || cards.length === 0) return;
        const fromUser = !!options.fromUser;
        const cardCount = cards.length;
        showcaseIdx = ((idx % cardCount) + cardCount) % cardCount;

        const slots = document.querySelectorAll('.pf-showcase-slot');
        slots.forEach((slot, i) => {
            const d = ((i - showcaseIdx) % cardCount + cardCount) % cardCount;
            if (d === 0) slot.setAttribute('data-pos', 'center');
            else if (d === 1) slot.setAttribute('data-pos', 'right1');
            else if (d === 2) slot.setAttribute('data-pos', 'right2');
            else if (d === cardCount - 1) slot.setAttribute('data-pos', 'left1');
            else if (d === cardCount - 2) slot.setAttribute('data-pos', 'left2');
            else slot.setAttribute('data-pos', 'hidden');
        });
        document.querySelectorAll('.pf-dot').forEach((d, i) => {
            d.classList.toggle('active', i === showcaseIdx);
        });

        if (fromUser) {
            startShowcaseAuto();
        }
    }

    function startShowcaseAuto() {
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            if (showcaseCards.length > 1) {
                setShowcaseIdx(showcaseIdx + 1);
            }
        }, SHOWCASE_AUTO_MS);
    }

    function initShowcaseTouchSwipe() {
        const wrap = document.getElementById('pf-showcase-inner');
        if (!wrap || wrap.dataset.swipeInit) return;
        wrap.dataset.swipeInit = '1';
        let touchStartX = 0;
        wrap.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
        wrap.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) < 40) return;
            setShowcaseIdx(dx < 0 ? showcaseIdx + 1 : showcaseIdx - 1, { fromUser: true });
        }, { passive: true });
    }

    // ── Stats widget ────────────────────────────────────────────────────────
    function renderStats(user, stats) {
        const title = document.getElementById('pf-stats-title');
        if (title) title.textContent = `${user.display_name}'s Castle Stats`;

        const rows = [
            { label: 'Total cards', val: stats.total_cards },
            { label: 'Creators supported', val: stats.unique_streamers },
            { label: 'Legendary cards', val: stats.legendary_count },
            { label: 'Epic cards', val: stats.epic_count },
            { label: 'Complete sets', val: stats.sets_completed },
            { label: 'Battles won', val: stats.battles_won },
            { label: 'Battles lost', val: stats.battles_lost },
            { label: 'Trades completed', val: stats.trades_completed },
        ];
        const container = document.getElementById('pf-stats-rows');
        if (!container) return;
        container.innerHTML = rows.map(r => `
            <div class="pf-stat-row">
                <span>${escapeHTML(r.label)}</span>
                <span class="val">${Number(r.val || 0).toLocaleString()}</span>
            </div>`).join('');
    }

    // ── Latest pack pull ────────────────────────────────────────────────────
    function renderLatest(cards) {
        const wrap = document.getElementById('pf-latest-inner');
        if (!wrap) return;
        if (!cards || cards.length === 0) {
            wrap.innerHTML = '<p class="text-xs text-void-muted/70 italic py-4 text-center">No cards yet.</p>';
            return;
        }
        wrap.innerHTML = cards.map((c, i) => {
            const color = rarityColor(c.rarity);
            const relTime = c.granted_at ? timeAgo(c.granted_at) : '';
            return `
            <div class="pf-latest-card" data-idx="${i}">
                <img class="pf-latest-thumb" src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name)}" loading="lazy">
                <div class="pf-latest-info">
                    <div class="pf-latest-name">${escapeHTML(c.name || '—')}</div>
                    <div class="pf-latest-meta">${escapeHTML(c.rarity || 'Common')}${c.brand_name ? ' · ' + escapeHTML(c.brand_name) : ''}${relTime ? ' · ' + relTime : ''}</div>
                </div>
                <div class="pf-rarity-dot-sm" style="background:${color};box-shadow:0 0 5px ${color}"></div>
            </div>`;
        }).join('');
        wrap.querySelectorAll('.pf-latest-card').forEach(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            el.addEventListener('click', () => openCardModal(cards[idx]));
        });
    }

    function renderWishlist(items) {
        const wrap = document.getElementById('pf-wishlist-list');
        if (!wrap) return;
        const cards = Array.isArray(items) ? items.filter(i => i && typeof i === 'object' && i.card_id) : [];
        if (cards.length === 0) {
            wrap.innerHTML = '<p class="pf-wishlist-empty">No cards on wishlist yet.</p>';
            return;
        }
        const showX = editMode && isOwner;
        wrap.innerHTML = cards.map((c) => `
            <div class="pf-wishlist-card" data-card-id="${escapeHTML(c.card_id)}" title="${escapeHTML(c.name)}">
                <img src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name)}" loading="lazy">
                <div class="pf-wishlist-card-overlay">
                    <div class="pf-wishlist-card-name">${escapeHTML(c.name)}</div>
                    ${c.set_name ? `<div class="pf-wishlist-card-set">${escapeHTML(c.set_name)}</div>` : ''}
                </div>
                <div class="pf-rarity-pip ${rarityClass(c.rarity)}"></div>
                ${showX ? `<button class="pf-wishlist-card-remove" type="button" aria-label="Remove"><i class="bx bx-x"></i></button>` : ''}
            </div>`).join('');
        if (showX) {
            wrap.querySelectorAll('.pf-wishlist-card-remove').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.closest('.pf-wishlist-card').dataset.cardId;
                    wishlistItems = wishlistItems.filter(i => i.card_id !== id);
                    await saveWishlist(wishlistItems);
                });
            });
        }
    }

    // Steam-style: a dense icon grid + summary stats, with a "Grouped by creator"
    // alternate layout. Both render; CSS shows one based on the widget's data-layout.
    function renderAchievements() {
        const wrap = document.getElementById('pf-achievements-grid');
        if (!wrap) return;
        const all = Array.isArray(unlockedAchievements) ? unlockedAchievements : [];
        if (all.length === 0) {
            wrap.innerHTML = '<p class="pf-achievements-empty">No achievements unlocked yet.</p>';
            return;
        }

        const unlocked = all.length;
        const creators = new Set(all.map(a => a.creator_username || '__general__')).size;
        const pct = achievementsAvgCompletion; // avg completion across collected creators

        const iconTiles = all.map(a => `
            <div class="pf-ach-tile" title="${escapeHTML(a.description || a.name || '')}">
                <div class="pf-ach-icon"><span>${escapeHTML(a.icon || '🏆')}</span></div>
                <div class="pf-ach-tile-name">${escapeHTML(a.name || 'Achievement')}</div>
                <div class="pf-ach-tile-creator">${escapeHTML(a.creator_name || a.brand_name || 'Castle')}</div>
            </div>`).join('');

        const summary = `
            <div class="pf-ach-summary">
                <div class="stat"><div class="num">${unlocked.toLocaleString()}</div><div class="lbl">Achievements</div></div>
                <div class="stat"><div class="num">${creators.toLocaleString()}</div><div class="lbl">Creators</div></div>
                <div class="stat"><div class="num">${pct}<span>%</span></div><div class="lbl">Avg Completion</div></div>
            </div>`;

        // Grouped-by-creator alternate
        const groups = new Map();
        for (const a of all) {
            const key = a.creator_username || '__general__';
            if (!groups.has(key)) {
                groups.set(key, { name: a.brand_name || a.creator_name || (key === '__general__' ? 'Castle' : key), items: [] });
            }
            groups.get(key).items.push(a);
        }
        const grouped = [...groups.values()].map(g => `
            <div class="pf-ach-group">
                <div class="pf-ach-group-head">
                    <i class="bx bxs-crown"></i>
                    <span class="pf-ach-group-name">${escapeHTML(g.name)}</span>
                    <span class="pf-ach-group-count">${g.items.length}</span>
                </div>
                <div class="pf-ach-icon-grid">
                    ${g.items.map(a => `
                        <div class="pf-ach-tile" title="${escapeHTML(a.description || a.name || '')}">
                            <div class="pf-ach-icon"><span>${escapeHTML(a.icon || '🏆')}</span></div>
                            <div class="pf-ach-tile-name">${escapeHTML(a.name || 'Achievement')}</div>
                        </div>`).join('')}
                </div>
            </div>`).join('');

        wrap.innerHTML = `
            <div class="pf-ach-showcase">
                <div class="pf-ach-icon-grid">${iconTiles}</div>
                ${summary}
            </div>
            <div class="pf-ach-grouped">${grouped}</div>`;
    }

    function renderBio(titleId) {
        renderStatusLine(titleId, currentStats, currentStats.total_cards ?? 0);
    }

    function renderStatusLine(titleId, stats, totalCards) {
        const el = document.getElementById('pf-status-line');
        if (!el) return;
        const id = String(titleId || '').trim();
        const def = TITLES.find(t => t.id === id);
        const titleName = def ? def.name : 'Collector';
        const cards = Number(totalCards || 0).toLocaleString();
        const creators = Number(stats?.unique_streamers || 0).toLocaleString();
        el.innerHTML = `<i class="bx bxs-crown" style="font-size:0.7em;margin-right:5px;opacity:0.65;vertical-align:middle;"></i>${escapeHTML(titleName)} \u2022 <strong>${cards}</strong> cards \u2022 <strong>${creators}</strong> creators supported`;
    }

    function renderTitlePicker() {
        const wrap = document.getElementById('pf-title-picker');
        if (!wrap) return;
        const s = { ...currentStats, _level: currentLevel };
        const categories = [...new Set(TITLES.map(t => t.category))];
        let html = '';
        categories.forEach(cat => {
            html += `<div class="pf-title-category-header">${escapeHTML(cat)}</div><div class="pf-title-grid">`;
            TITLES.filter(t => t.category === cat).forEach(t => {
                const unlocked = t.check(s);
                const selected = bioText === t.id;
                const cls = ['pf-title-item', unlocked ? 'unlocked' : 'locked', selected ? 'selected' : ''].filter(Boolean).join(' ');
                const statusIcon = selected
                    ? '<i class="bx bxs-crown"></i>'
                    : unlocked ? '<i class="bx bx-check-circle"></i>' : '<i class="bx bx-lock-alt"></i>';
                html += `<div class="${cls}" data-title-id="${escapeHTML(t.id)}">
                    <span class="pf-title-item-status">${statusIcon}</span>
                    <div class="pf-title-item-name">${escapeHTML(t.name)}</div>
                    <div class="pf-title-item-desc">${escapeHTML(t.desc)}</div>
                </div>`;
            });
            html += `</div>`;
        });
        wrap.innerHTML = html;
        wrap.querySelectorAll('.pf-title-item.unlocked').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.getAttribute('data-title-id');
                bioText = bioText === id ? '' : id;
                renderBio(bioText);
                renderTitlePicker();
            });
        });
    }

    function renderRarityChart(stats) {
        const wrap = document.getElementById('pf-rarity-bars');
        if (!wrap) return;
        const total = Number(stats.total_cards || 0);
        const leg   = Number(stats.legendary_count || 0);
        const epic  = Number(stats.epic_count || 0);
        const rare  = Number(stats.rare_count || 0);
        const common = Math.max(0, total - leg - epic - rare);
        const tiers = [
            { label: 'Legendary', count: leg,    color: '#fbbf24' },
            { label: 'Epic',      count: epic,   color: '#a855f7' },
            { label: 'Rare',      count: rare,   color: '#3faaff' },
            { label: 'Common',    count: common, color: '#64748b' },
        ];
        const maxCount = Math.max(...tiers.map(t => t.count), 1);
        wrap.innerHTML = tiers.map(t => {
            const barW = Math.round((t.count / maxCount) * 100);
            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
            return `
            <div class="pf-rarity-row">
                <div class="pf-rarity-top">
                    <span class="pf-rarity-lbl" style="color:${t.color}">${escapeHTML(t.label)}</span>
                    <span class="pf-rarity-cnt">${t.count.toLocaleString()}<span class="pf-rarity-pct">${pct}%</span></span>
                </div>
                <div class="pf-rarity-track">
                    <div class="pf-rarity-fill" data-w="${barW}" style="background:${t.color}"></div>
                </div>
            </div>`;
        }).join('');
        setTimeout(() => {
            wrap.querySelectorAll('.pf-rarity-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
        }, 300);
    }

    function renderBattleRecord(stats) {
        const wrap = document.getElementById('pf-battle-inner');
        if (!wrap) return;
        const wins   = Number(stats.battles_won  || 0);
        const losses = Number(stats.battles_lost || 0);
        const total  = wins + losses;
        if (total === 0) {
            wrap.innerHTML = '<div class="pf-battle-empty">No battles recorded yet.</div>';
            return;
        }
        const winRate = Math.round((wins / total) * 100);
        wrap.innerHTML = `
            <div class="pf-battle-hero">
                <div class="pf-battle-rate-big">${winRate}<span>%</span></div>
                <div class="pf-battle-rate-sub">Win rate · ${total.toLocaleString()} battles</div>
            </div>
            <div class="pf-battle-numbers">
                <div class="pf-battle-stat">
                    <div class="pf-battle-num" style="color:rgba(var(--void-accent-rgb),1)">${wins.toLocaleString()}</div>
                    <div class="pf-battle-lbl">Wins</div>
                </div>
                <div class="pf-battle-divider">/</div>
                <div class="pf-battle-stat">
                    <div class="pf-battle-num" style="color:rgba(168,85,247,0.9)">${losses.toLocaleString()}</div>
                    <div class="pf-battle-lbl">Losses</div>
                </div>
            </div>
            <div class="pf-battle-bar-track">
                <div class="pf-battle-bar-fill" data-w="${winRate}"></div>
            </div>
            <div class="pf-battle-rate">
                <span class="win">${winRate}% won</span>
                <span class="lose">${100 - winRate}% lost</span>
            </div>`;
        setTimeout(() => {
            const fill = wrap.querySelector('.pf-battle-bar-fill');
            if (fill) fill.style.width = fill.dataset.w + '%';
        }, 400);
    }

    // ── Top Slabs (highest-graded cards) ─────────────────────────────────────
    function renderSlabs(cards) {
        const wrap = document.getElementById('pf-slabs-inner');
        if (!wrap) return;
        const list = Array.isArray(cards) ? cards.filter(c => c && c.image_url) : [];
        if (list.length === 0) {
            wrap.innerHTML = '<div class="pf-battle-empty">No graded cards yet — open packs to earn slabs.</div>';
            return;
        }
        wrap.innerHTML = `<div class="pf-slabs-grid">${list.map((c, i) => {
            const isGenesis = Number(c.grade) >= 11;
            const gradeLabel = isGenesis ? 'GEM' : String(c.grade ?? '—');
            return `
            <div class="pf-slab ${rarityClass(c.rarity)}" data-idx="${i}" title="${escapeHTML(c.name || '')}">
                <img src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name || '')}" loading="lazy">
                <span class="pf-slab-grade ${isGenesis ? 'genesis' : ''}">${escapeHTML(gradeLabel)}</span>
            </div>`;
        }).join('')}</div>`;
        wrap.querySelectorAll('.pf-slab').forEach(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            el.addEventListener('click', () => openCardModal(list[idx]));
        });
    }

    // ── Binders ───────────────────────────────────────────────────────────────
    // Apply the owner's chosen binder selection + order to the full binder list.
    function selectedBinders() {
        const all = Array.isArray(bindersData) ? bindersData : [];
        if (!Array.isArray(shownBinders)) return all; // no selection saved → show all
        const byId = new Map(all.map(b => [b.id, b]));
        return shownBinders.map(id => byId.get(id)).filter(Boolean);
    }

    function renderBinders(binders) {
        if (Array.isArray(binders)) bindersData = binders;
        const wrap = document.getElementById('pf-binders-inner');
        if (!wrap) return;
        const list = selectedBinders();
        if (list.length === 0) {
            wrap.innerHTML = '<div class="pf-battle-empty">No public binders yet.</div>';
            return;
        }
        wrap.innerHTML = `<div class="pf-binders-grid">${list.map(b => {
            const previews = (Array.isArray(b.preview_cards) ? b.preview_cards : []).slice(0, 4);
            const slots = [];
            for (let i = 0; i < 4; i++) {
                const p = previews[i];
                slots.push(p
                    ? `<img src="${escapeHTML(p.baked_image_url || p.image_url || '')}" alt="" loading="lazy">`
                    : '<span class="pf-binder-slot-empty"></span>');
            }
            const href = b.share_token ? `/view/${encodeURIComponent(b.share_token)}` : '#';
            const tag = b.share_token ? 'a' : 'div';
            const hrefAttr = b.share_token ? ` href="${href}"` : '';
            return `<${tag} class="pf-binder"${hrefAttr}>
                <div class="pf-binder-previews">${slots.join('')}</div>
                <div class="pf-binder-name">${escapeHTML(b.name || 'Binder')}</div>
                <div class="pf-binder-count">${Number(b.card_count || 0)} cards</div>
            </${tag}>`;
        }).join('')}</div>`;
    }

    // ── Trinkets (cosmetics — not yet implemented) ────────────────────────────
    function renderTrinkets() {
        const wrap = document.getElementById('pf-trinkets-inner');
        if (!wrap) return;
        wrap.innerHTML = '<div class="pf-battle-empty">Trinkets are coming soon — collect cosmetics to display here.</div>';
    }

    function timeAgo(iso) {
        try {
            const ms = Date.now() - new Date(iso).getTime();
            const s = Math.floor(ms / 1000);
            if (s < 60) return `${s}s ago`;
            const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
            const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
            const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
            const w = Math.floor(d / 7); if (w < 5) return `${w}w ago`;
            const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
            return `${Math.floor(d / 365)}y ago`;
        } catch (_) { return ''; }
    }

    // ── Widget layout ───────────────────────────────────────────────────────
    // Bump this to re-force the curated default layout on every profile.
    const DEFAULT_LAYOUT_VERSION = 2;

    // Allowed grid-column span per widget on the 4-col grid: { min, max, def }
    const WIDGET_WIDTH_RANGE = {
        'widget-showcase':      { min: 3, max: 4, def: 4 },
        'widget-wishlist':      { min: 2, max: 4, def: 4 },
        'widget-trinkets':      { min: 2, max: 4, def: 4 },
        'widget-binders':       { min: 2, max: 4, def: 4 },
        'widget-slabs':         { min: 2, max: 4, def: 4 },
        'widget-achievements':  { min: 1, max: 4, def: 4 },
        'widget-latest':        { min: 1, max: 3, def: 3 },
        'widget-stats':         { min: 1, max: 2, def: 2 },
        'widget-rarity-chart':  { min: 1, max: 2, def: 2 },
        'widget-battle-record': { min: 1, max: 2, def: 2 },
    };

    // Curated default layout (order + spans). Forced on everyone at each version bump.
    const DEFAULT_ORDER = [
        'widget-showcase',
        'widget-stats',
        'widget-rarity-chart',
        'widget-latest',
        'widget-achievements',
        'widget-slabs',
        'widget-binders',
        'widget-wishlist',
        'widget-battle-record',
        'widget-trinkets',
    ];
    const DEFAULT_WIDTHS = {
        'widget-showcase':      4,
        'widget-stats':         2,
        'widget-rarity-chart':  2,
        'widget-latest':        2,
        'widget-achievements':  2,
        'widget-slabs':         2,
        'widget-binders':       2,
        'widget-wishlist':      4,
        'widget-battle-record': 2,
        'widget-trinkets':      2,
    };
    // Hidden by default (still toggleable in the sections panel).
    const DEFAULT_HIDDEN = ['widget-trinkets'];
    const DEFAULT_SECTIONS = DEFAULT_ORDER.filter(id => !DEFAULT_HIDDEN.includes(id));
    const MIN_REQUIRED_SECTIONS = ['widget-showcase'];

    // ── Per-widget content layout (3 options each) ───────────────────────────
    // First entry is the default layout for each widget.
    const WIDGET_LAYOUTS = {
        'widget-showcase':      [{ id: 'carousel', label: 'Carousel' }, { id: 'grid', label: 'Grid' }],
        'widget-stats':         [{ id: 'cards', label: 'Cards' }, { id: 'rows',    label: 'Rows' }],
        'widget-rarity-chart':  [{ id: 'bars',  label: 'Bars'  }, { id: 'pills',   label: 'Pills' }],
        'widget-latest':        [{ id: 'list',  label: 'List'  }, { id: 'gallery', label: 'Gallery' }],
        'widget-wishlist':      [{ id: 'grid',  label: 'Grid'  }, { id: 'list',    label: 'List' }],
        'widget-achievements':  [{ id: 'showcase', label: 'Showcase' }, { id: 'grouped', label: 'Grouped' }],
        'widget-battle-record': [{ id: 'hero',  label: 'Hero'  }, { id: 'compact', label: 'Compact' }],
        'widget-binders':       [{ id: 'cards', label: 'Cards' }, { id: 'list',    label: 'List' }],
        'widget-slabs':         [{ id: 'grid',  label: 'Grid'  }, { id: 'list',    label: 'List' }],
        'widget-trinkets':      [{ id: 'grid',  label: 'Grid'  }, { id: 'list',    label: 'List' }],
    };
    let widgetStyles = {}; // { widgetId: layoutId }

    function getWidgetLayout(id) {
        const opts = WIDGET_LAYOUTS[id];
        if (!opts) return null;
        const l = widgetStyles[id];
        return opts.some(o => o.id === l) ? l : opts[0].id;
    }
    function applyWidgetStyles() {
        document.querySelectorAll('#pf-steam-layout > .pf-widget').forEach(el => {
            const l = getWidgetLayout(el.id);
            if (l) el.dataset.layout = l;
        });
        // Showcase: drive its carousel/grid renderer from the chosen layout
        const sl = getWidgetLayout('widget-showcase');
        if (sl) {
            const mode = sl === 'carousel' ? 'carousel' : 'grid';
            if (typeof setShowcaseView === 'function' && showcaseViewMode !== mode) setShowcaseView(mode);
            else showcaseViewMode = mode;
        }
    }
    function setWidgetStyle(id, value) {
        widgetStyles[id] = value;
        applyWidgetStyles();
    }
    async function saveStyles() {
        await saveLayoutAndSections(getSavedOrder(), getSavedSections());
    }
    let savedLayoutOrder = null;
    let visibleSections = null;
    let wishlistItems = [];
    let bioText = '';
    let currentStats = {};
    let currentLevel = 1;
    let unlockedAchievements = [];
    let pinnedAchievementIds = [];
    let widgetWidths = {}; // { widgetId: columnSpan }
    let forcedDefaultLayout = false; // true when the curated default was forced this load
    let supportedCreators = []; // creators the owner collects (for the compact picker)
    let bindersData = []; // owner's binders (full list from the API)
    let shownBinders = null; // ordered array of binder ids to show (null = show all)
    let achievementsTotal = 0; // total achievements that exist (for completion %)
    let achievementsAvgCompletion = 0; // server-computed avg completion across collected creators

    function normalizeWidgetArray(arr, fallback) {
        if (!Array.isArray(arr)) return [...fallback];
        const allowed = arr.filter(id => typeof id === 'string' && DEFAULT_ORDER.includes(id));
        const unique = [...new Set(allowed)];
        if (unique.length === 0) return [...fallback];
        MIN_REQUIRED_SECTIONS.forEach(id => {
            if (!unique.includes(id)) unique.unshift(id);
        });
        return unique;
    }

    function getSavedOrder() {
        return normalizeWidgetArray(savedLayoutOrder, DEFAULT_ORDER);
    }

    function getSavedSections() {
        return normalizeWidgetArray(visibleSections, DEFAULT_ORDER);
    }

    async function saveLayoutAndSections(layout, sections) {
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile-layout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout, sections, trades_public: tradesPublic, widget_widths: widgetWidths, widget_styles: widgetStyles, shown_binders: shownBinders, layout_version: DEFAULT_LAYOUT_VERSION })
            });
        } catch (_) {} finally { markSaved(); }
    }

    async function saveBannerChoice(bannerId) {
        activeBannerId = bannerId || null;
        const bannerEl = document.getElementById('pf-banner');
        const bannerImg = document.getElementById('pf-banner-img');
        const chosen = collectedBanners.find(b => b.id === bannerId);
        if (chosen && bannerEl && bannerImg) {
            bannerImg.src = chosen.image_url;
            bannerEl.classList.add('has-banner-img');
        } else if (bannerEl && bannerImg) {
            bannerImg.src = DEFAULT_PROFILE_BANNER;
            bannerEl.classList.add('has-banner-img');
        }
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile/banner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banner_id: bannerId || null })
            });
        } catch (_) {} finally { markSaved(); }
    }

    function renderBannerPicker() {
        const wrap = document.getElementById('pf-banner-picker');
        if (!wrap) return;
        const banners = Array.isArray(collectedBanners) ? collectedBanners : [];
        const noneSelected = !activeBannerId;
        let html = `<div class="pf-banner-thumb pf-banner-thumb-none ${noneSelected ? 'selected' : ''}" data-banner-id="">Default</div>`;
        html += banners.map(b => `
            <div class="pf-banner-thumb ${activeBannerId === b.id ? 'selected' : ''}" data-banner-id="${escapeHTML(b.id)}" title="${escapeHTML(b.name || '')}">
                <img src="${escapeHTML(b.image_url)}" alt="${escapeHTML(b.name || '')}" loading="lazy">
            </div>`).join('');
        if (banners.length === 0) {
            html += `<span style="font-size:0.52rem;color:var(--void-muted);font-style:italic;">No banners collected yet — open packs to earn them.</span>`;
        }
        wrap.innerHTML = html;
        wrap.querySelectorAll('.pf-banner-thumb').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.getAttribute('data-banner-id') || null;
                wrap.querySelectorAll('.pf-banner-thumb').forEach(t => t.classList.remove('selected'));
                el.classList.add('selected');
                await saveBannerChoice(id);
            });
        });
    }

    async function loadBannerPicker() {
        const wrap = document.getElementById('pf-banner-picker');
        const status = document.getElementById('pf-banner-picker-status');
        if (!wrap || wrap.dataset.loaded) return;
        wrap.dataset.loaded = '1';
        if (status) status.textContent = 'Loading banners…';
        try {
            const base = backendBase();
            const res = await fetch(`${base}/api/viewer/profile/banners`);
            if (res.ok) collectedBanners = await res.json();
        } catch (_) {}
        if (status) status.textContent = '';
        renderBannerPicker();
    }

    async function saveOrder(arr) {
        // Optimistic local save
        savedLayoutOrder = normalizeWidgetArray(arr, DEFAULT_ORDER);
        await saveLayoutAndSections(savedLayoutOrder, getSavedSections());
    }

    async function saveSections(arr) {
        visibleSections = normalizeWidgetArray(arr, DEFAULT_ORDER);
        applyWidgetVisibility(visibleSections);
        await saveLayoutAndSections(getSavedOrder(), visibleSections);
    }

    async function saveBio(text) {
        bioText = String(text || '').trim();
        renderBio(bioText);
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile/bio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: bioText })
            });
        } catch (_) {} finally { markSaved(); }
    }

    async function saveWishlist(items) {
        wishlistItems = Array.isArray(items)
            ? items.filter(i => i && typeof i === 'object' && i.card_id)
            : [];
        renderWishlist(wishlistItems);
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile/wishlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: wishlistItems })
            });
        } catch (_) {} finally { markSaved(); }
    }

    async function savePinnedAchievements(ids) {
        pinnedAchievementIds = Array.isArray(ids) ? ids : [];
        renderAchievements();
        markDirty();
        try {
            const base = backendBase();
            await fetch(`${base}/api/viewer/profile/pinned-achievements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ achievement_ids: pinnedAchievementIds })
            });
        } catch (_) {} finally { markSaved(); }
    }

    function applyWidgetOrder(order) {
        const grid = document.getElementById('pf-steam-layout');
        if (!grid) return;
        order.forEach(id => {
            const el = document.getElementById(id);
            if (el) grid.appendChild(el);
        });
    }

    // Clamp a desired column span to a widget's allowed range (fallback to default).
    function clampWidth(id, width) {
        const range = WIDGET_WIDTH_RANGE[id];
        if (!range) return 4;
        const n = Number.isFinite(width) ? Math.round(width) : range.def;
        return Math.max(range.min, Math.min(range.max, n));
    }

    function getWidgetWidth(id) {
        const saved = widgetWidths && widgetWidths[id];
        return clampWidth(id, saved != null ? saved : (WIDGET_WIDTH_RANGE[id]?.def ?? 4));
    }

    // Apply saved/default column spans as pf-w-N classes on each widget.
    function applyWidgetWidths() {
        Object.keys(WIDGET_WIDTH_RANGE).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const w = getWidgetWidth(id);
            el.classList.remove('pf-w-1', 'pf-w-2', 'pf-w-3', 'pf-w-4');
            el.classList.add(`pf-w-${w}`);
        });
    }

    // Persist widget widths (owner only) via the shared layout save flow.
    async function saveWidths() {
        await saveLayoutAndSections(getSavedOrder(), getSavedSections());
    }

    const WIDTH_LABELS = { 1: '¼', 2: '½', 3: '¾', 4: 'Full' };

    // Build the edit-mode width-button bar inside each widget (owner only).
    function buildWidthBars() {
        if (!isOwner) return;
        Object.keys(WIDGET_WIDTH_RANGE).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            let bar = el.querySelector(':scope > .pf-width-bar');
            if (bar) bar.remove();
            const range = WIDGET_WIDTH_RANGE[id];
            if (!range || range.min === range.max) return; // no choices to offer
            bar = document.createElement('div');
            bar.className = 'pf-width-bar';
            const current = getWidgetWidth(id);
            for (let w = range.min; w <= range.max; w++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pf-width-btn' + (w === current ? ' active' : '');
                btn.dataset.width = String(w);
                btn.textContent = WIDTH_LABELS[w] || String(w);
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    widgetWidths[id] = w;
                    applyWidgetWidths();
                    bar.querySelectorAll('.pf-width-btn').forEach(b =>
                        b.classList.toggle('active', b.dataset.width === String(w)));
                    saveWidths();
                });
                bar.appendChild(btn);
            }
            el.appendChild(bar);
        });
    }

    function applyWidgetVisibility(sectionIds) {
        const visible = new Set(normalizeWidgetArray(sectionIds, DEFAULT_ORDER));
        DEFAULT_ORDER.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('hidden', !visible.has(id));
        });
    }

    // ── Showcase count badge (live in edit mode) ─────────────────────────────
    function updateShowcaseCount() {
        const countEl = document.getElementById('pf-sc-count');
        if (countEl) countEl.textContent = `${featuredCardIds.length} / 10 selected`;
    }
    // ── Showcase edit grid ────────────────────────────────────────────────────
    function buildShowcaseEditGrid() {
        const wrap = document.getElementById('pf-showcase-edit-grid');
        if (!wrap) return;
        const MAX = 10;
        const filled = featuredCardIds.map(id => ({ id, info: featuredCardInfo[id] || {} }));
        const emptyCount = Math.max(0, MAX - filled.length);
        let html = filled.map(({ id, info }) => `
            <div class="pf-sc-edit-slot" data-id="${escapeHTML(id)}">
                <img src="${escapeHTML(info.image_url || '')}" alt="${escapeHTML(info.name || '')}" loading="lazy">
                <button class="pf-sc-edit-slot-x" type="button" aria-label="Remove"><i class="bx bx-x"></i></button>
            </div>`).join('');
        for (let i = 0; i < emptyCount; i++) {
            html += `<div class="pf-sc-edit-empty"><i class="bx bx-plus"></i></div>`;
        }
        wrap.innerHTML = html;
        wrap.querySelectorAll('.pf-sc-edit-slot-x').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.closest('.pf-sc-edit-slot').dataset.id;
                featuredCardIds = featuredCardIds.filter(x => x !== id);
                updateShowcaseCount();
                buildShowcaseEditGrid();
                await saveFeaturedCards();
            });
        });
        wrap.querySelectorAll('.pf-sc-edit-empty').forEach(el => {
            el.addEventListener('click', () => openCompactPicker('showcase'));
        });
        updateShowcaseCount();
    }

    // ── Compact card picker ───────────────────────────────────────────────────
    let _cpType = null;
    let _cpCatalog = [];
    let _cpSearchTimer = null;

    function openCompactPicker(type) {
        _cpType = type;
        _cpCatalog = [];
        const picker = document.getElementById('pf-compact-picker');
        const title  = document.getElementById('pf-cp-title');
        const crWrap = document.getElementById('pf-cp-creators');
        const search = document.getElementById('pf-cp-search');
        const status = document.getElementById('pf-cp-status');
        const grid   = document.getElementById('pf-cp-grid');
        if (!picker) return;

        if (title) title.textContent = type === 'showcase' ? 'Add to Showcase' : 'Add to Wishlist';
        if (grid) grid.innerHTML = '';
        if (status) status.textContent = '';

        if (search) {
            search.classList.remove('hidden');
            search.value = '';
            if (!search.dataset.cpInit) {
                search.dataset.cpInit = '1';
                search.addEventListener('input', () => {
                    clearTimeout(_cpSearchTimer);
                    _cpSearchTimer = setTimeout(() => {
                        const q = search.value.trim().toLowerCase();
                        const filtered = q ? _cpCatalog.filter(c => (c.name || '').toLowerCase().includes(q)) : _cpCatalog;
                        _cpRenderGrid(filtered);
                    }, 180);
                });
            }
        }

        if (crWrap) {
            const creators = Array.isArray(supportedCreators) ? supportedCreators : [];
            if (creators.length === 0) {
                crWrap.innerHTML = '<span style="font-size:0.55rem;color:var(--void-muted);font-style:italic;">No creators found.</span>';
            } else {
                crWrap.innerHTML = creators.map(c => {
                    const name = c.brand_name || c.username || 'Creator';
                    const color = c.color || 'rgba(var(--void-accent-rgb),0.85)';
                    const key = type === 'showcase' ? (c.streamer_id || c.username) : c.username;
                    return `<button type="button" class="pf-wl-creator" data-key="${escapeHTML(key)}" style="--c:${escapeHTML(color)}">${escapeHTML(name)}</button>`;
                }).join('');
                crWrap.querySelectorAll('.pf-wl-creator').forEach(btn => {
                    btn.addEventListener('click', () => {
                        crWrap.querySelectorAll('.pf-wl-creator').forEach(b => b.classList.toggle('active', b === btn));
                        _cpLoadCards(btn.dataset.key);
                    });
                });
            }
        }

        picker.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCompactPicker() {
        const picker = document.getElementById('pf-compact-picker');
        if (!picker) return;
        picker.classList.remove('open');
        document.body.style.overflow = '';
        if (_cpType === 'wishlist') renderWishlist(wishlistItems);
        _cpType = null;
        _cpCatalog = [];
    }

    async function _cpLoadCards(key) {
        const status = document.getElementById('pf-cp-status');
        const grid   = document.getElementById('pf-cp-grid');
        if (status) status.textContent = 'Loading…';
        if (grid) grid.innerHTML = '';
        try {
            const base = backendBase();
            let cards;
            if (_cpType === 'showcase') {
                const res = await fetch(`${base}/api/viewer/cards?streamer=${encodeURIComponent(key)}`);
                if (!res.ok) throw new Error('cards');
                const raw = await res.json();
                cards = Array.isArray(raw) ? raw : [];
                rememberCardInfo(cards);
                _cpCatalog = cards;
            } else {
                const res = await fetch(`${base}/api/public/catalog?streamer=${encodeURIComponent(key)}`);
                if (!res.ok) throw new Error('catalog');
                const raw = await res.json();
                const creator = (Array.isArray(supportedCreators) ? supportedCreators : [])
                    .find(c => c.username === key) || {};
                const brandName = creator.brand_name || creator.username || '';
                _cpCatalog = (Array.isArray(raw) ? raw : []).map(c => ({
                    card_id: c.id, user_card_id: c.id, name: c.name,
                    image_url: c.image_url, rarity: c.rarity, set_name: c.set_name || null,
                    brand_name: brandName, streamer_username: key
                }));
                cards = _cpCatalog;
            }
            if (status) {
                if (!cards.length) {
                    status.textContent = 'No cards found.';
                } else if (_cpType === 'showcase') {
                    const remaining = 10 - featuredCardIds.length;
                    status.textContent = `${cards.length} card${cards.length !== 1 ? 's' : ''} · ${remaining} slot${remaining !== 1 ? 's' : ''} remaining`;
                } else {
                    status.textContent = `${cards.length} card${cards.length !== 1 ? 's' : ''}`;
                }
            }
            _cpRenderGrid(cards);
        } catch (_) {
            if (status) status.textContent = 'Failed to load cards.';
        }
    }

    function _cpRenderGrid(cards) {
        const grid = document.getElementById('pf-cp-grid');
        if (!grid) return;
        if (!cards || cards.length === 0) { grid.innerHTML = ''; return; }

        const pickedShowcase = new Set(featuredCardIds);
        const pickedWishlist = new Set((wishlistItems || []).map(i => i.card_id));

        grid.innerHTML = cards.map(c => {
            const isSelected = _cpType === 'showcase'
                ? pickedShowcase.has(c.user_card_id)
                : pickedWishlist.has(c.card_id);
            return `<div class="pf-wl-result ${isSelected ? 'selected' : ''}" data-uid="${escapeHTML(c.user_card_id || '')}" data-cid="${escapeHTML(c.card_id || '')}" title="${escapeHTML(c.name || '')}">
                <img src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name || '')}" loading="lazy">
                <div class="pf-wl-result-check"><i class="bx bx-check"></i></div>
                <div class="pf-wl-result-name">${escapeHTML(c.name || '')}</div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.pf-wl-result').forEach((el, i) => {
            el.addEventListener('click', async () => {
                const card = cards[i];
                if (_cpType === 'showcase') {
                    const uid = card.user_card_id;
                    if (featuredCardIds.includes(uid)) return;
                    if (featuredCardIds.length >= 10) {
                        const s = document.getElementById('pf-cp-status');
                        if (s) s.textContent = 'Showcase full (10 max) — remove a card first.';
                        return;
                    }
                    featuredCardIds.push(uid);
                    el.classList.add('selected');
                    buildShowcaseEditGrid();
                    await saveFeaturedCards();
                    closeCompactPicker();
                } else {
                    const cid = card.card_id;
                    const idx = wishlistItems.findIndex(w => w.card_id === cid);
                    if (idx >= 0) {
                        wishlistItems.splice(idx, 1);
                        el.classList.remove('selected');
                    } else if (wishlistItems.length < 20) {
                        wishlistItems.push(card);
                        el.classList.add('selected');
                    }
                    await saveWishlist(wishlistItems);
                }
            });
        });
    }

    document.getElementById('pf-cp-close')?.addEventListener('click', closeCompactPicker);
    document.getElementById('pf-compact-picker')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('pf-compact-picker')) closeCompactPicker();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('pf-compact-picker')?.classList.contains('open')) {
            closeCompactPicker();
        }
    });

    // ── Binder selector: toggle which show + drag to reorder ─────────────────
    function binderRowsForEditor() {
        const all = Array.isArray(bindersData) ? bindersData : [];
        if (!Array.isArray(shownBinders)) return all.map(b => ({ b, shown: true }));
        const byId = new Map(all.map(b => [b.id, b]));
        const shownSet = new Set(shownBinders);
        const ordered = shownBinders.map(id => byId.get(id)).filter(Boolean).map(b => ({ b, shown: true }));
        all.forEach(b => { if (!shownSet.has(b.id)) ordered.push({ b, shown: false }); });
        return ordered;
    }
    function syncBindersTab() {
        const wrap = document.getElementById('pf-binders-selector');
        if (!wrap) return;
        const rows = binderRowsForEditor();
        if (rows.length === 0) {
            wrap.innerHTML = '<div class="pf-wishlist-empty" style="padding:2px 0;">You have no public binders yet.</div>';
            return;
        }
        wrap.innerHTML = rows.map(({ b, shown }) => `
            <div class="pf-binder-row" data-id="${escapeHTML(b.id)}" draggable="true">
                <span class="pf-binder-row-grip"><i class="bx bxs-dots-vertical"></i></span>
                <span class="pf-binder-row-name">${escapeHTML(b.name || 'Binder')}<small>${Number(b.card_count || 0)} cards</small></span>
                <label class="pf-mini-switch"><input type="checkbox" ${shown ? 'checked' : ''}><span class="pf-switch"></span></label>
            </div>`).join('');
        wrap.querySelectorAll('.pf-binder-row input').forEach(input =>
            input.addEventListener('change', () => commitBinderSelection(wrap)));
        initBinderDrag(wrap);
    }
    function commitBinderSelection(wrap) {
        const rows = [...wrap.querySelectorAll('.pf-binder-row')];
        shownBinders = rows.filter(r => r.querySelector('input')?.checked).map(r => r.dataset.id);
        renderBinders();
        saveLayoutAndSections(getSavedOrder(), getSavedSections());
    }
    function initBinderDrag(wrap) {
        let dragEl = null;
        wrap.querySelectorAll('.pf-binder-row').forEach(row => {
            row.addEventListener('dragstart', (e) => { dragEl = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
            row.addEventListener('dragend', () => { row.classList.remove('dragging'); dragEl = null; commitBinderSelection(wrap); });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dragEl || dragEl === row) return;
                const r = row.getBoundingClientRect();
                wrap.insertBefore(dragEl, (e.clientY > r.top + r.height / 2) ? row.nextSibling : row);
            });
        });
    }

    function syncSectionsPanel() { /* no-op: no drawer */ }

    function getPinnedAchievementsForDisplay() {
        const all = Array.isArray(unlockedAchievements) ? unlockedAchievements : [];
        const pins = Array.isArray(pinnedAchievementIds) ? pinnedAchievementIds : [];
        if (pins.length === 0) return all.slice(0, 6);
        const byId = new Map(all.map((a) => [a.id, a]));
        const selected = pins.map((id) => byId.get(id)).filter(Boolean);
        return selected.length > 0 ? selected.slice(0, 6) : all.slice(0, 6);
    }

    let tradesPublic = false;
    let activeBannerId = null;
    let collectedBanners = [];

    // ── Widget interactions: pointer-based reorder + edge-handle resize ───────
    function pfGrid() { return document.getElementById('pf-steam-layout'); }

    // Wrap each widget's content (everything except the title + edit handles) in a
    // scrollable body so every tile can be a fixed, uniform height. Idempotent.
    function wrapWidgetBodies() {
        const grid = pfGrid();
        if (!grid) return;
        grid.querySelectorAll(':scope > .pf-widget').forEach(widget => {
            if (widget.querySelector(':scope > .pf-widget-body')) return;
            const body = document.createElement('div');
            body.className = 'pf-widget-body';
            [...widget.children].forEach(ch => {
                if (ch.classList.contains('pf-drag-handle')) return;
                if (ch.classList.contains('pf-edit-toolbar')) return;
                if (ch.classList.contains('pf-width-bar')) return;
                if (ch.classList.contains('pf-resize-handle')) return;
                if (ch.classList.contains('pf-widget-title')) return;
                if (ch.classList.contains('pf-widget-inline-editor')) return;
                if (ch.classList.contains('pf-hide-btn')) return;
                if (ch.classList.contains('pf-style-cycle')) return;
                if (ch.id === 'pf-showcase-edit-grid') return;
                if (ch.id === 'pf-wishlist-add-btn') return;
                if (ch.id === 'pf-binders-selector') return;
                body.appendChild(ch);
            });
            widget.appendChild(body);
        });
    }

    function orderedVisibleWidgets() {
        const grid = pfGrid();
        if (!grid) return [];
        return [...grid.querySelectorAll(':scope > .pf-widget')].filter(el => !el.classList.contains('hidden'));
    }

    // Number of columns the grid is currently rendering (4 / 2 / 1 responsive).
    function gridColumnCount() {
        const grid = pfGrid();
        if (!grid) return 4;
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        return Math.max(1, cols);
    }

    // After a drop, shrink the dropped widget to fill leftover space in its row
    // (e.g. dropped beside a ½ widget → snaps to ½). Desktop 4-col only.
    function autoFillDropped(id) {
        if (gridColumnCount() !== 4) return;
        const range = WIDGET_WIDTH_RANGE[id];
        if (!range) return;
        let col = 0; // columns filled in the current row (0..4)
        for (const el of orderedVisibleWidgets()) {
            const wid = el.id;
            const w = getWidgetWidth(wid);
            const remaining = 4 - col; // gap before placing this widget
            if (wid === id) {
                if (remaining > 0 && remaining < 4 && range.min <= remaining) {
                    widgetWidths[id] = Math.min(range.max, remaining);
                }
                return;
            }
            if (w > remaining) col = 0; // wraps to next row
            col += w;
            if (col >= 4) col = 0;
        }
    }

    // Edge handle for drag-to-resize (owner only; CSS-hidden unless editing).
    function buildResizeHandles() {
        if (!isOwner) return;
        Object.keys(WIDGET_WIDTH_RANGE).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const range = WIDGET_WIDTH_RANGE[id];
            const existing = el.querySelector(':scope > .pf-resize-handle');
            if (!range || range.min === range.max) { if (existing) existing.remove(); return; }
            if (existing) return;
            const handle = document.createElement('div');
            handle.className = 'pf-resize-handle';
            handle.title = 'Drag to resize';
            handle.dataset.resizeFor = id;
            el.appendChild(handle);
        });
    }

    // Edit-mode button on each tile that cycles its layout variants.
    function buildStyleButtons() {
        if (!isOwner) return;
        document.querySelectorAll('#pf-steam-layout > .pf-widget').forEach(el => {
            const opts = WIDGET_LAYOUTS[el.id];
            let btn = el.querySelector(':scope > .pf-style-cycle');
            if (!opts || opts.length < 2) { if (btn) btn.remove(); return; }
            if (btn) return;
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pf-style-cycle';
            btn.title = 'Change layout';
            btn.innerHTML = '<i class="bx bx-layout"></i>';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cur = getWidgetLayout(el.id);
                const idx = opts.findIndex(o => o.id === cur);
                const next = opts[(idx + 1) % opts.length];
                setWidgetStyle(el.id, next.id);
                saveStyles();
                if (typeof syncStylesTab === 'function') syncStylesTab();
                if (typeof showToast === 'function') showToast(`Layout: ${next.label}`, 'info');
            });
            el.appendChild(btn);
        });
    }

    // ── Per-widget hide/show button ───────────────────────────────────────────
    function buildHideButtons() {
        if (!isOwner) return;
        const visible = new Set(getSavedSections());
        document.querySelectorAll('#pf-steam-layout > .pf-widget').forEach(el => {
            let btn = el.querySelector(':scope > .pf-hide-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pf-hide-btn';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = el.id;
                    if (MIN_REQUIRED_SECTIONS.includes(id)) {
                        if (typeof showToast === 'function') showToast('This widget cannot be hidden', 'info');
                        return;
                    }
                    const cur = getSavedSections();
                    const isVis = cur.includes(id);
                    const next = isVis ? cur.filter(s => s !== id) : [...cur, id];
                    saveSections(next).then(() => buildHideButtons());
                });
                el.appendChild(btn);
            }
            const isVis = visible.has(el.id);
            const isRequired = MIN_REQUIRED_SECTIONS.includes(el.id);
            btn.innerHTML = isVis ? '<i class="bx bx-hide"></i>' : '<i class="bx bx-show"></i>';
            btn.title = isVis ? 'Hide widget' : 'Show widget';
            btn.style.opacity = isRequired ? '0.3' : '';
            btn.style.cursor = isRequired ? 'not-allowed' : '';
        });
    }

    function openPickerModal() { /* no-op: editing happens inline on the widget */ }

    // ── Unified per-widget edit toolbar ───────────────────────────────────────
    // One control bar per widget (drag anywhere on it to reorder). Holds the
    // width segmented control, layout toggle, and hide/show — replacing the old
    // scattered chips + edge-drag resize.
    function buildEditToolbars() {
        if (!isOwner) return;
        const visible = new Set(getSavedSections());
        document.querySelectorAll('#pf-steam-layout > .pf-widget').forEach(el => {
            const id = el.id;
            const old = el.querySelector(':scope > .pf-edit-toolbar');
            if (old) old.remove();

            const isVis = visible.has(id);
            const isRequired = MIN_REQUIRED_SECTIONS.includes(id);

            const tb = document.createElement('div');
            tb.className = 'pf-edit-toolbar' + (isVis ? '' : ' is-hidden');

            // Left: drag affordance (whole bar drags) + name when collapsed
            const left = document.createElement('div');
            left.className = 'pf-tb-left';
            left.innerHTML = isVis
                ? '<i class="bx bxs-grid-alt pf-tb-grip"></i>'
                : `<i class="bx bx-show pf-tb-grip" style="opacity:.5"></i><span class="pf-tb-name">${escapeHTML(WIDGET_NAMES[id] || id)}</span>`;
            tb.appendChild(left);

            const right = document.createElement('div');
            right.className = 'pf-tb-right';

            if (isVis) {
                // Width segmented control (only tiers this widget allows)
                const range = WIDGET_WIDTH_RANGE[id];
                if (range && range.min !== range.max) {
                    const seg = document.createElement('div');
                    seg.className = 'pf-tb-seg';
                    const cur = getWidgetWidth(id);
                    for (let w = range.min; w <= range.max; w++) {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.className = 'pf-tb-segbtn' + (w === cur ? ' active' : '');
                        b.dataset.width = String(w);
                        b.textContent = WIDTH_LABELS[w] || String(w);
                        b.title = 'Set width';
                        b.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            widgetWidths[id] = w;
                            applyWidgetWidths();
                            seg.querySelectorAll('.pf-tb-segbtn').forEach(x =>
                                x.classList.toggle('active', x.dataset.width === String(w)));
                            saveWidths();
                        });
                        seg.appendChild(b);
                    }
                    right.appendChild(seg);
                }

                // Layout toggle (widgets with >1 layout variant)
                const opts = WIDGET_LAYOUTS[id];
                if (opts && opts.length >= 2) {
                    const lb = document.createElement('button');
                    lb.type = 'button';
                    lb.className = 'pf-tb-btn';
                    const curOpt = opts.find(o => o.id === getWidgetLayout(id)) || opts[0];
                    lb.innerHTML = `<i class="bx bx-layout"></i><span>${escapeHTML(curOpt.label)}</span>`;
                    lb.title = 'Change layout';
                    lb.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const idx = opts.findIndex(o => o.id === getWidgetLayout(id));
                        const next = opts[(idx + 1) % opts.length];
                        setWidgetStyle(id, next.id);
                        saveStyles();
                        lb.querySelector('span').textContent = next.label;
                    });
                    right.appendChild(lb);
                }
            }

            // Hide / show toggle (always present)
            const hb = document.createElement('button');
            hb.type = 'button';
            hb.className = 'pf-tb-btn pf-tb-icon' + (isVis ? '' : ' pf-tb-show');
            hb.innerHTML = isVis ? '<i class="bx bx-hide"></i>' : '<i class="bx bx-plus"></i><span>Show</span>';
            hb.title = isVis ? 'Hide widget' : 'Show widget';
            hb.classList.toggle('pf-tb-icon', isVis);
            if (isRequired) { hb.style.opacity = '0.3'; hb.style.cursor = 'not-allowed'; }
            hb.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (isRequired) { if (typeof showToast === 'function') showToast('This widget cannot be hidden', 'info'); return; }
                const cur = getSavedSections();
                const nowVis = cur.includes(id);
                const next = nowVis ? cur.filter(s => s !== id) : [...cur, id];
                saveSections(next).then(() => buildEditToolbars());
            });
            right.appendChild(hb);

            tb.appendChild(right);
            el.appendChild(tb);
        });
    }


    const WIDGET_NAMES = {
        'widget-showcase': 'Showcase', 'widget-stats': 'Castle Stats',
        'widget-rarity-chart': 'Collection Breakdown', 'widget-latest': 'Latest Pack Pull',
        'widget-wishlist': 'Wishlist', 'widget-achievements': 'Achievements',
        'widget-battle-record': 'Battle Record', 'widget-binders': 'Binders',
        'widget-slabs': 'Top Slabs', 'widget-trinkets': 'Trinkets',
    };

    // Build the drawer "Styles" tab: per-widget Look (treatment) + Layout pickers.
    function syncStylesTab() {
        const wrap = document.getElementById('pf-styles-list');
        if (!wrap) return;
        const visible = new Set(getSavedSections());
        wrap.innerHTML = DEFAULT_ORDER.filter(id => visible.has(id) && document.getElementById(id) && WIDGET_LAYOUTS[id]).map(id => {
            const cur = getWidgetLayout(id);
            const segs = WIDGET_LAYOUTS[id].map(o =>
                `<button class="pf-seg ${o.id === cur ? 'active' : ''}" data-widget="${id}" data-val="${o.id}">${escapeHTML(o.label)}</button>`
            ).join('');
            return `<div class="pf-style-card">
                <div class="pf-style-name">${escapeHTML(WIDGET_NAMES[id] || id)}</div>
                <div class="pf-seg-group">${segs}</div>
            </div>`;
        }).join('');
        wrap.querySelectorAll('.pf-seg').forEach(btn => {
            btn.addEventListener('click', () => {
                setWidgetStyle(btn.dataset.widget, btn.dataset.val);
                btn.parentElement.querySelectorAll('.pf-seg').forEach(b => b.classList.toggle('active', b === btn));
                saveStyles();
            });
        });
    }

    let activeResize = null; // { id, el }

    function onResizeMove(e) {
        if (!activeResize) return;
        const { id, el } = activeResize;
        const grid = pfGrid();
        const colCount = gridColumnCount();
        if (colCount !== 4) return; // resizing only meaningful at full grid
        const gridStyle = getComputedStyle(grid);
        const gap = parseFloat(gridStyle.columnGap) || 14;
        const inner = grid.clientWidth
            - parseFloat(gridStyle.paddingLeft || '0')
            - parseFloat(gridStyle.paddingRight || '0');
        const colW = (inner - (colCount - 1) * gap) / colCount;
        const rect = el.getBoundingClientRect();
        const spanPx = e.clientX - rect.left;
        let span = Math.round((spanPx + gap) / (colW + gap));
        const range = WIDGET_WIDTH_RANGE[id];
        span = Math.max(range.min, Math.min(range.max, colCount, span));
        if (span !== getWidgetWidth(id)) {
            widgetWidths[id] = span;
            applyWidgetWidths();
            // keep width buttons in sync
            const bar = el.querySelector(':scope > .pf-width-bar');
            if (bar) bar.querySelectorAll('.pf-width-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.width === String(span)));
        }
    }

    function endResize() {
        if (!activeResize) return;
        activeResize.el.classList.remove('pf-resizing');
        document.body.classList.remove('pf-grid-dragging');
        window.removeEventListener('pointermove', onResizeMove);
        window.removeEventListener('pointerup', endResize);
        activeResize = null;
        saveWidths();
    }

    let activeDrag = null; // { id, el, startX, startY, started }

    // Snapshot positions of all visible widgets for FLIP animation.
    function snapshotRects() {
        const m = new Map();
        orderedVisibleWidgets().forEach(el => m.set(el, el.getBoundingClientRect()));
        return m;
    }

    // FLIP: animate every visible widget (except the dragged one) from its
    // previous position to its new one so the grid reflows smoothly.
    function flipReflow(prevRects, exceptEl) {
        orderedVisibleWidgets().forEach(el => {
            if (el === exceptEl) return;
            const prev = prevRects.get(el);
            if (!prev) return;
            const now = el.getBoundingClientRect();
            const dx = prev.left - now.left;
            const dy = prev.top - now.top;
            if (!dx && !dy) return;
            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            void el.offsetWidth; // force reflow so the start transform applies
            el.style.transition = 'transform 0.15s cubic-bezier(0.2,0,0,1)';
            el.style.transform = '';
            clearTimeout(el._pfFlipTimer);
            el._pfFlipTimer = setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 180);
        });
    }

    // The visible widget the pointer is physically hovering over (not just nearest).
    // Returns null when over a gap or off the grid, so dragging there does nothing.
    function widgetUnderPoint(x, y) {
        for (const el of orderedVisibleWidgets()) {
            if (el === activeDrag.el) continue;
            const r = el.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { el, r };
        }
        return null;
    }

    const REORDER_COOLDOWN_MS = 28; // min time between swaps — small, just debounces

    function onDragMove(e) {
        if (!activeDrag) return;
        if (!activeDrag.started) {
            // Larger start threshold so a click/nudge doesn't begin a drag
            if (Math.abs(e.clientX - activeDrag.startX) < 6 && Math.abs(e.clientY - activeDrag.startY) < 6) return;
            activeDrag.started = true;
            activeDrag.el.classList.add('pf-dragging');
            document.body.classList.add('pf-grid-dragging');
        }
        const el = activeDrag.el;
        const hit = widgetUnderPoint(e.clientX, e.clientY);
        if (!hit) return; // only reorder when hovering a real widget

        // Dead band around the target's center: ignore the middle third so the
        // pointer must clearly cross past center before a swap triggers.
        const center = hit.r.left + hit.r.width / 2;
        const margin = Math.min(12, hit.r.width * 0.05);
        let after;
        if (e.clientX > center + margin) after = true;
        else if (e.clientX < center - margin) after = false;
        else return; // inside dead band — hold position

        // Cooldown to stop rapid flip-flopping
        const now = performance.now();
        if (activeDrag.lastSwap && (now - activeDrag.lastSwap) < REORDER_COOLDOWN_MS) return;

        const grid = pfGrid();
        let ref = after ? hit.el.nextElementSibling : hit.el;
        if (ref === el) ref = el.nextElementSibling;
        if (ref === el) return;
        if (el.nextElementSibling === ref) return; // already in that slot — no move

        const prev = snapshotRects();
        grid.insertBefore(el, ref);
        flipReflow(prev, el);
        activeDrag.lastSwap = now;
    }

    function endDrag() {
        if (!activeDrag) return;
        const { el, started, id } = activeDrag;
        el.classList.remove('pf-dragging');
        document.body.classList.remove('pf-grid-dragging');
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', endDrag);
        activeDrag = null;
        if (!started) return;

        // Auto-fill leftover row space for the dropped widget, then persist.
        const prev = snapshotRects();
        autoFillDropped(id);
        applyWidgetWidths();
        flipReflow(prev, null);
        const grid = pfGrid();
        const newOrder = [...grid.querySelectorAll(':scope > .pf-widget')].map(w => w.id);
        saveOrder(newOrder); // saveOrder body also persists current widget_widths
    }

    // Single delegated pointerdown on the grid handles both reorder and resize.
    function initWidgetInteractions() {
        const grid = pfGrid();
        if (!grid || grid.dataset.pfInteract) return;
        grid.dataset.pfInteract = '1';
        grid.addEventListener('pointerdown', (e) => {
            if (!editMode || !isOwner) return;
            // Reorder by grabbing anywhere on the widget's edit toolbar
            // (but not on its buttons — those handle width / layout / hide).
            const tb = e.target.closest('.pf-edit-toolbar');
            if (!tb || e.target.closest('button')) return;
            const el = tb.closest('.pf-widget');
            if (!el || el.classList.contains('hidden')) return; // can't reorder a hidden ghost
            e.preventDefault();
            activeDrag = { id: el.id, el, startX: e.clientX, startY: e.clientY, started: false, dropInfo: null };
            window.addEventListener('pointermove', onDragMove);
            window.addEventListener('pointerup', endDrag);
        });
    }

    let editMode = false;
    function setEditMode(on) {
        editMode = on;
        document.body.classList.toggle('pf-editing', on);
        const btn = document.getElementById('pf-edit-btn');
        const label = document.getElementById('pf-edit-label');
        if (btn) btn.classList.toggle('active', on);
        if (label) label.textContent = on ? 'Done editing' : 'Edit layout';
        if (on) {
            buildEditToolbars();
            buildShowcaseEditGrid();
            syncBindersTab();
            renderWishlist(wishlistItems);
        } else {
            closeCompactPicker();
            buildShowcaseEditGrid();
            renderWishlist(wishlistItems);
            // Clear any lingering save indicator when leaving edit mode
            clearTimeout(_siHideTimer);
            const si = document.getElementById('pf-save-indicator');
            if (si) si.classList.remove('visible', 'saving', 'saved');
            _siPending = 0;
        }
    }

    document.getElementById('pf-edit-btn')?.addEventListener('click', () => {
        if (!isOwner) return;
        setEditMode(!editMode);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editMode && !document.getElementById('pf-compact-picker')?.classList.contains('open')) setEditMode(false);
    });

    document.getElementById('pf-wishlist-add-btn')?.addEventListener('click', () => {
        openCompactPicker('wishlist');
    });

    document.getElementById('pf-trade-offer-btn')?.addEventListener('click', () => {
        window.location.href = `/trade/offer?to=${encodeURIComponent(profileUsername)}`;
    });

    // ── Copy castle code ───────────────────────────────────────────────────
    document.getElementById('pf-copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('pf-code')?.textContent?.trim();
        if (!code || code === '—') return;
        navigator.clipboard.writeText(code).then(() => {
            if (typeof showToast === 'function') showToast('Castle code copied!', 'success');
        }).catch(() => {});
    });

    // ── Global nav user dropdown ──────────────────────────────────────────────
    function setupNavUser(user) {
        if (!user) return;
        window.currentUser = { ...user, avatar: user.avatar_url || user.avatar };
        const navAvatar  = document.getElementById('nav-avatar');
        const menuAvatar = document.getElementById('nav-user-menu-avatar');
        if (navAvatar)  navAvatar.src  = window.currentUser.avatar || '';
        if (menuAvatar) menuAvatar.src = window.currentUser.avatar || '';
        const preview = document.getElementById('nav-user-preview');
        if (preview) { preview.classList.remove('hidden'); preview.style.display = 'flex'; }
        window.initNavUserMenu?.();
        window.updateNavUserMenuLabels?.();
    }

    // ── Main load ───────────────────────────────────────────────────────────
    async function loadProfile() {
        if (!profileUsername) return;
        const base = backendBase();
        try {
            const bannerEl = document.getElementById('pf-banner');
            const bannerImg = document.getElementById('pf-banner-img');
            if (bannerEl && bannerImg) {
                bannerImg.src = DEFAULT_PROFILE_BANNER;
                bannerEl.classList.add('has-banner-img');
            }
            const [res, meRes] = await Promise.all([
                fetch(`${base}/api/public/profile/${encodeURIComponent(profileUsername)}`),
                fetch(`${base}/api/v2/bootstrap`, { credentials: 'include' }).catch(() => null)
            ]);
            if (!res.ok) {
                document.getElementById('pf-loading')?.classList.add('hidden');
                document.getElementById('pf-not-found')?.classList.remove('hidden');
                return;
            }
            const data = await res.json();
            const { user, stats, showcase_cards, trophy_cards, latest_cards, achievements } = data;
            supportedCreators = Array.isArray(data.supported_creators) ? data.supported_creators : [];

            // Update page title
            document.title = `${user.display_name} · Castle TCG`;

            // Hero
            const avatarEl = document.getElementById('pf-avatar');
            if (avatarEl) avatarEl.src = user.avatar_url || '/assets/default-avatar.png';
            const nameEl = document.getElementById('pf-name');
            if (nameEl) nameEl.textContent = user.display_name || user.username;
            const codeEl = document.getElementById('pf-code');
            if (codeEl) codeEl.textContent = user.trade_code || '—';
            const roleText = document.getElementById('pf-role-text');
            const roleBadge = document.getElementById('pf-role-badge');
            if (user.is_creator) {
                if (roleText) roleText.textContent = 'Creator';
                roleBadge?.classList.add('creator');
                roleBadge?.querySelector('i')?.classList.replace('fa-user', 'fa-star');
            } else {
                if (roleText) roleText.textContent = 'Collector';
            }
            const showcaseTitle = document.getElementById('pf-showcase-title-text');
            if (showcaseTitle) showcaseTitle.textContent = `${user.display_name}'s Collection`;
            const levelEl = document.getElementById('pf-level');
            const totalCards = Number(stats?.total_cards || 0);
            // Use server-computed level when available; fall back to client formula for legacy responses
            const derivedLevel = stats?.level != null
                ? Math.max(1, Number(stats.level))
                : Math.max(1, Math.floor(Math.sqrt(totalCards / 8)) + 1);
            currentStats = stats || {};
            currentLevel = derivedLevel;
            if (levelEl) levelEl.textContent = String(derivedLevel);

            // XP bar fill
            const cardsForCurrent = Math.pow(derivedLevel - 1, 2) * 8;
            const cardsForNext    = Math.pow(derivedLevel, 2) * 8;
            const xpProgress = cardsForNext > cardsForCurrent
                ? Math.min(1, (totalCards - cardsForCurrent) / (cardsForNext - cardsForCurrent))
                : 1;
            const xpFill = document.getElementById('pf-xp-fill');
            if (xpFill) setTimeout(() => { xpFill.style.width = `${Math.round(xpProgress * 100)}%`; }, 200);
            const xpNextLabel = document.getElementById('pf-xp-next-label');
            if (xpNextLabel) xpNextLabel.textContent = `Lvl ${derivedLevel + 1}`;
            renderStatusLine(bioText, stats, totalCards);

            // Security: Only show edit button if we are the owner
            const editBtn = document.getElementById('pf-edit-btn');
            isOwner = false;
            let meUser = null;
            try {
                if (meRes && meRes.ok) {
                    const meData = await meRes.json();
                    meUser = meData?.user || null;
                    if (meUser?.username?.toLowerCase() === profileUsername.toLowerCase()) {
                        isOwner = true;
                    }
                }
            } catch (_) {}

            // Light up the global nav user dropdown for logged-in visitors
            setupNavUser(meUser);

            if (window.castleNav) castleNav.autoInit();

            if (editBtn) {
                if (!isOwner) editBtn.style.display = 'none';
                else editBtn.style.display = 'inline-flex';
            }
            // Assign layout from DB
            if (user.profile_layout) {
                savedLayoutOrder = user.profile_layout;
            }
            if (user.profile_sections) {
                visibleSections = user.profile_sections;
            }
            let savedLayoutVersion = null;
            if (user.profile_settings && typeof user.profile_settings === 'object') {
                const dbMode = user.profile_settings.showcase_mode;
                if (dbMode === 'carousel' || dbMode === 'grid') {
                    showcaseViewMode = dbMode;
                }
                const savedWidths = user.profile_settings.widget_widths;
                if (savedWidths && typeof savedWidths === 'object') {
                    widgetWidths = {};
                    Object.keys(WIDGET_WIDTH_RANGE).forEach(id => {
                        if (savedWidths[id] != null) widgetWidths[id] = clampWidth(id, Number(savedWidths[id]));
                    });
                }
                const savedStyles = user.profile_settings.widget_styles;
                if (savedStyles && typeof savedStyles === 'object') {
                    widgetStyles = {};
                    Object.entries(savedStyles).forEach(([id, v]) => {
                        const val = typeof v === 'string' ? v : (v && v.l);
                        if (WIDGET_LAYOUTS[id] && WIDGET_LAYOUTS[id].some(o => o.id === val)) widgetStyles[id] = val;
                    });
                }
                savedLayoutVersion = Number(user.profile_settings.layout_version) || null;
                if (Array.isArray(user.profile_settings.shown_binders)) {
                    shownBinders = user.profile_settings.shown_binders.filter(id => typeof id === 'string');
                }
            }

            // Force the curated default whenever the stored layout predates the
            // current version. Owners get it persisted (stamped) on their visit.
            if (savedLayoutVersion !== DEFAULT_LAYOUT_VERSION) {
                savedLayoutOrder = [...DEFAULT_ORDER];
                visibleSections = [...DEFAULT_SECTIONS];
                widgetWidths = { ...DEFAULT_WIDTHS };
                forcedDefaultLayout = true;
            }
            if (user.featured_card_ids) {
                featuredCardIds = user.featured_card_ids;
            }
            if (typeof user.bio === 'string') {
                bioText = user.bio;
            }
            if (Array.isArray(user.wishlist_items)) {
                wishlistItems = user.wishlist_items;
            }
            if (Array.isArray(achievements)) {
                unlockedAchievements = achievements.slice(0, 300);
            }
            achievementsTotal = Number(data.achievements_total) || 0;
            achievementsAvgCompletion = Number(data.achievements_avg_completion) || 0;
            if (Array.isArray(user.profile_pinned_achievements)) {
                pinnedAchievementIds = user.profile_pinned_achievements
                    .map((id) => String(id || '').trim())
                    .filter((id) => id.length > 0)
                    .slice(0, 6);
            }
            if (typeof user.trades_public === 'boolean') {
                tradesPublic = user.trades_public;
            }
            // Trade offer button — visible to visitors only when owner has trades enabled
            const tradeBtn = document.getElementById('pf-trade-offer-btn');
            if (tradeBtn) {
                if (!isOwner && tradesPublic) tradeBtn.classList.remove('hidden');
                else tradeBtn.classList.add('hidden');
            }
            if (user.active_banner_id) {
                activeBannerId = String(user.active_banner_id);
            }
            if (user.active_banner_url) {
                if (bannerEl && bannerImg) {
                    bannerImg.src = user.active_banner_url;
                    bannerEl.classList.add('has-banner-img');
                }
            }

            // Apply saved widget order + widths
            applyWidgetOrder(getSavedOrder());
            applyWidgetVisibility(getSavedSections());
            applyWidgetWidths();
            applyWidgetStyles();
            wrapWidgetBodies();
            syncSectionsPanel();

            // Persist the forced default once so it stamps the new version for this owner.
            if (forcedDefaultLayout && isOwner) {
                saveLayoutAndSections(getSavedOrder(), getSavedSections());
            }

            // Render widgets
            rememberCardInfo(showcase_cards || []);
            buildShowcaseSlots(showcase_cards || []);
            renderBio(bioText);
            renderStats(user, stats || {});
            renderRarityChart(stats || {});
            renderLatest(latest_cards || []);
            renderWishlist(wishlistItems);
            renderAchievements();
            renderBattleRecord(stats || {});
            renderSlabs(data.top_graded || []);
            renderBinders(data.binders || []);
            renderTrinkets();

            // Init reorder interactions + per-widget edit toolbars (hidden until editing)
            initWidgetInteractions();
            buildEditToolbars();

            // Show page
            document.getElementById('pf-loading')?.classList.add('hidden');
            document.getElementById('pf-page')?.classList.remove('hidden');

        } catch (err) {
            console.error('[Profile] Load error:', err);
            document.getElementById('pf-loading')?.classList.add('hidden');
            document.getElementById('pf-not-found')?.classList.remove('hidden');
        }
    }

    // Keyboard nav for showcase
    document.addEventListener('keydown', (e) => {
        if (modal?.classList.contains('open')) return;
        if (showcaseCards.length <= 1) return;
        if (e.key === 'ArrowLeft')  setShowcaseIdx(showcaseIdx - 1, { fromUser: true });
        if (e.key === 'ArrowRight') setShowcaseIdx(showcaseIdx + 1, { fromUser: true });
    });

    document.addEventListener('DOMContentLoaded', loadProfile);
})();
