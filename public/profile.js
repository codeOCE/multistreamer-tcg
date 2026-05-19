/**
 * profile.js — Public profile page logic for /profile/:username
 * Widgets: showcase carousel, castle stats, trophy cabinet, latest pack pull.
 * Drag-and-drop layout persisted to localStorage.
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
    let currentModalCard = null;

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

    pinBtn?.addEventListener('click', async () => {
        if (!currentModalCard || !currentModalCard.user_card_id) return;
        const id = currentModalCard.user_card_id;
        const isPinned = featuredCardIds.includes(id);
        
        if (isPinned) {
            featuredCardIds = featuredCardIds.filter(x => x !== id);
        } else {
            if (featuredCardIds.length >= 10) {
                if (typeof showToast === 'function') showToast('Showcase is limited to 10 cards.', 'info');
                return;
            }
            featuredCardIds.push(id);
        }
        
        // Update UI
        const newIsPinned = featuredCardIds.includes(id);
        pinLabel.textContent = newIsPinned ? 'Unpin from Showcase' : 'Pin to Showcase';
        pinBtn.querySelector('i').className = newIsPinned ? 'bx bxs-pin' : 'bx bx-pin';

        // Persist
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            await fetch(`${base}/api/viewer/profile/featured-cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ featured_card_ids: featuredCardIds })
            });
            
            // Reload showcase content to reflect changes immediately
            const res = await fetch(`${base}/api/public/profile/${encodeURIComponent(profileUsername)}`);
            if (res.ok) {
                const data = await res.json();
                buildShowcaseSlots(data.showcase_cards || []);
            }

            if (typeof showToast === 'function') {
                showToast(newIsPinned ? 'Card pinned to showcase!' : 'Card unpinned!', 'success');
            }
        } catch (err) {
            console.error('[Profile] Pin failed:', err);
        }
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
            try {
                const base = backendBase();
                const token = localStorage.getItem('castle_token');
                if (token) {
                    const order = getSavedOrder();
                    fetch(`${base}/api/viewer/profile-layout`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            layout: order,
                            sections: getSavedSections(),
                            sidebar_widgets: [...sidebarWidgetIds],
                            settings: { showcase_mode: mode }
                        })
                    }).catch(() => {});
                }
            } catch (_) {}
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
            { label: 'Rare cards', val: stats.rare_count },
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

    // ── Trophy cabinet ──────────────────────────────────────────────────────
    function renderTrophy(cards) {
        const grid = document.getElementById('pf-trophy-grid');
        if (!grid) return;
        if (!cards || cards.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1;padding:8px 2px 6px;color:var(--void-muted);font-size:0.63rem;font-style:italic;">No trophies yet — pin your best cards here.</p>';
            return;
        }
        const slots = [];
        for (let i = 0; i < 8; i++) {
            const card = cards[i];
            if (card) {
                const rc = rarityClass(card.rarity);
                slots.push(`
                    <div class="pf-trophy-slot ${rc}" data-idx="${i}" title="${escapeHTML(card.name)}">
                        <img src="${escapeHTML(card.image_url || '')}" alt="${escapeHTML(card.name)}" loading="lazy">
                        <div class="pf-rarity-pip ${rc}"></div>
                    </div>`);
            } else {
                slots.push('<div class="pf-trophy-slot empty"></div>');
            }
        }
        grid.innerHTML = slots.join('');
        grid.querySelectorAll('.pf-trophy-slot:not(.empty)').forEach(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            el.addEventListener('click', () => openCardModal(cards[idx]));
        });
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
        wrap.innerHTML = cards.map((c) => `
            <div class="pf-wishlist-card" title="${escapeHTML(c.name)}">
                <img src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name)}" loading="lazy">
                <div class="pf-wishlist-card-overlay">
                    <div class="pf-wishlist-card-name">${escapeHTML(c.name)}</div>
                    ${c.set_name ? `<div class="pf-wishlist-card-set">${escapeHTML(c.set_name)}</div>` : ''}
                </div>
                <div class="pf-rarity-pip ${rarityClass(c.rarity)}"></div>
            </div>`).join('');
    }

    function renderAchievements(items) {
        const wrap = document.getElementById('pf-achievements-grid');
        if (!wrap) return;
        if (!Array.isArray(items) || items.length === 0) {
            wrap.innerHTML = '<p class="pf-achievements-empty">No achievements unlocked yet.</p>';
            return;
        }
        wrap.innerHTML = items.slice(0, 6).map((ach) => {
            const creatorParts = [ach.creator_name, ach.brand_name].filter(Boolean).map(escapeHTML);
            const creatorLine = creatorParts.length
                ? `<span class="pf-ach-creator"><i class="bx bxs-crown"></i>${creatorParts.join(' · ')}</span>`
                : '';
            const timeLine = ach.unlocked_at
                ? `<span>${escapeHTML(timeAgo(ach.unlocked_at))}</span>`
                : '';
            return `
            <div class="pf-achievement-card">
                <div class="icon">${escapeHTML(ach.icon || '🏆')}</div>
                <div>
                    <div class="title">${escapeHTML(ach.name || ach.id || 'Achievement')}</div>
                    <div class="meta">${creatorLine}${timeLine}</div>
                </div>
            </div>`;
        }).join('');
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
        wrap.innerHTML = tiers.map(t => `
            <div class="pf-rarity-pill">
                <span class="pf-rarity-pill-label">${escapeHTML(t.label)}</span>
                <span class="pf-rarity-pill-count" style="color:${t.color}">${t.count.toLocaleString()}</span>
            </div>`).join('');
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
                <span class="win">${winRate}% win rate</span>
                <span class="lose">${100 - winRate}% loss rate</span>
            </div>`;
        setTimeout(() => {
            const fill = wrap.querySelector('.pf-battle-bar-fill');
            if (fill) fill.style.width = fill.dataset.w + '%';
        }, 400);
    }

    function renderCreators(creators) {
        const wrap = document.getElementById('pf-creators-inner');
        if (!wrap) return;
        if (!Array.isArray(creators) || creators.length === 0) {
            wrap.innerHTML = '<div class="pf-battle-empty">No creators supported yet.</div>';
            return;
        }
        const chips = creators.map(c => {
            const color = c.color || 'rgba(var(--void-accent-rgb),0.8)';
            const name = escapeHTML(c.brand_name || c.username || 'Unknown');
            return `<div class="pf-creator-chip">
                <span class="pf-creator-dot" style="background:${escapeHTML(color)};box-shadow:0 0 6px ${escapeHTML(color)}44;"></span>
                <span class="pf-creator-name">${name}</span>
                <span class="pf-creator-count">${c.count}</span>
            </div>`;
        }).join('');
        wrap.innerHTML = `<div class="pf-creators-grid">${chips}</div>`;
    }

    function renderSets(sets) {
        const wrap = document.getElementById('pf-sets-inner');
        if (!wrap) return;
        if (!Array.isArray(sets) || sets.length === 0) {
            wrap.innerHTML = '<div class="pf-battle-empty">No card sets collected yet.</div>';
            return;
        }
        const maxOwned = Math.max(...sets.map(s => s.unique_owned), 1);
        wrap.innerHTML = sets.map(s => {
            const barW = Math.round((s.unique_owned / maxOwned) * 100);
            const label = s.total_in_set > s.unique_owned
                ? `${s.unique_owned} / ${s.total_in_set}`
                : `${s.unique_owned}`;
            return `<div class="pf-set-row">
                <div class="pf-set-info">
                    <div class="pf-set-name">${escapeHTML(s.set_name)}</div>
                    ${s.set_code ? `<div class="pf-set-code">${escapeHTML(s.set_code)}</div>` : ''}
                </div>
                <div class="pf-set-bar-wrap">
                    <div class="pf-set-bar-fill" data-w="${barW}"></div>
                </div>
                <span class="pf-set-count">${escapeHTML(label)}</span>
            </div>`;
        }).join('');
        setTimeout(() => {
            wrap.querySelectorAll('.pf-set-bar-fill').forEach(el => {
                el.style.width = el.dataset.w + '%';
            });
        }, 400);
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
    let sidebarWidgetIds = new Set(['widget-stats', 'widget-rarity-chart', 'widget-wishlist']);

    // 'sidebar' = sidebar only, 'main' = main column only, 'any' = either
    const WIDGET_ZONE = {
        'widget-showcase':     'main',
        'widget-stats':        'sidebar',
        'widget-rarity-chart': 'sidebar',
        'widget-wishlist':     'any',
        'widget-trophy':       'main',
        'widget-latest':       'main',
        'widget-achievements': 'main',
        'widget-battle-record':'any',
        'widget-creators':     'any',
        'widget-sets':         'main',
    };

    const DEFAULT_ORDER = [
        'widget-showcase',
        'widget-stats',
        'widget-rarity-chart',
        'widget-trophy',
        'widget-latest',
        'widget-wishlist',
        'widget-achievements',
        'widget-battle-record',
        'widget-creators',
        'widget-sets',
    ];
    const MIN_REQUIRED_SECTIONS = ['widget-showcase'];
    let savedLayoutOrder = null;
    let visibleSections = null;
    let wishlistItems = [];
    let bioText = '';
    let currentStats = {};
    let currentLevel = 1;
    let unlockedAchievements = [];
    let pinnedAchievementIds = [];

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
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile-layout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ layout, sections, trades_public: tradesPublic, sidebar_widgets: [...sidebarWidgetIds] })
                });
            }
        } catch (_) {}
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
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile/banner`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ banner_id: bannerId || null })
                });
            }
        } catch (_) {}
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
            const token = localStorage.getItem('castle_token');
            const res = await fetch(`${base}/api/viewer/profile/banners`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
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
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile/bio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ bio: bioText })
                });
            }
        } catch (_) {}
    }

    async function saveWishlist(items) {
        wishlistItems = Array.isArray(items)
            ? items.filter(i => i && typeof i === 'object' && i.card_id)
            : [];
        renderWishlist(wishlistItems);
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile/wishlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ items: wishlistItems })
                });
            }
        } catch (_) {}
    }

    async function savePinnedAchievements(ids) {
        pinnedAchievementIds = Array.isArray(ids) ? ids : [];
        renderAchievements(getPinnedAchievementsForDisplay());
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile/pinned-achievements`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ achievement_ids: pinnedAchievementIds })
                });
            }
        } catch (_) {}
    }

    function applyWidgetOrder(order) {
        const sidebar = document.getElementById('pf-sidebar-widgets');
        const main = document.getElementById('pf-main-widgets');
        if (!sidebar || !main) return;
        order.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const zone = WIDGET_ZONE[id] || 'any';
            if (zone === 'sidebar' || (zone === 'any' && sidebarWidgetIds.has(id))) {
                sidebar.appendChild(el);
            } else if (id === 'widget-trophy' || id === 'widget-latest') {
                const row2 = document.getElementById('pf-row2');
                if (row2) row2.appendChild(el);
            } else {
                main.appendChild(el);
            }
        });
        // Ensure sidebar-only widgets are not tracked in sidebarWidgetIds (they're always sidebar)
        Object.entries(WIDGET_ZONE).forEach(([id, zone]) => {
            if (zone === 'sidebar') sidebarWidgetIds.delete(id);
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

    let _wlSearchTimer = null;

    function syncWishlistChips() {
        const cards = Array.isArray(wishlistItems) ? wishlistItems.filter(i => i && i.card_id) : [];
        const label = document.getElementById('pf-wishlist-current-label');
        const wrap  = document.getElementById('pf-wishlist-current');
        if (!wrap) return;
        if (cards.length === 0) {
            if (label) label.classList.add('hidden');
            wrap.innerHTML = '';
            return;
        }
        if (label) label.classList.remove('hidden');
        wrap.innerHTML = cards.map((c) => `
            <span class="pf-wl-chip" data-card-id="${escapeHTML(c.card_id)}">
                <i class="bx bx-x"></i>${escapeHTML(c.name)}
            </span>`).join('');
        wrap.querySelectorAll('.pf-wl-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const id = chip.getAttribute('data-card-id');
                wishlistItems = wishlistItems.filter(i => i.card_id !== id);
                syncWishlistChips();
                document.querySelectorAll(`.pf-wl-result[data-card-id="${id}"]`).forEach(el => el.classList.remove('selected'));
            });
        });
    }

    function renderWishlistSearchResults(cards) {
        const wrap   = document.getElementById('pf-wishlist-search-results');
        const status = document.getElementById('pf-wishlist-search-status');
        if (!wrap) return;
        if (!cards || cards.length === 0) {
            wrap.innerHTML = '';
            if (status) status.textContent = 'No cards found.';
            return;
        }
        if (status) status.textContent = '';
        const current = new Set((wishlistItems || []).map(i => i.card_id));
        wrap.innerHTML = cards.map((c) => `
            <div class="pf-wl-result ${current.has(c.card_id) ? 'selected' : ''}" data-card-id="${escapeHTML(c.card_id)}" title="${escapeHTML(c.name)}">
                <img src="${escapeHTML(c.image_url || '')}" alt="${escapeHTML(c.name)}" loading="lazy">
                <div class="pf-wl-result-check"><i class="bx bx-check"></i></div>
                <div class="pf-wl-result-name">${escapeHTML(c.name)}</div>
            </div>`).join('');
        wrap.querySelectorAll('.pf-wl-result').forEach((el, i) => {
            el.addEventListener('click', () => {
                const card = cards[i];
                const idx = wishlistItems.findIndex(w => w.card_id === card.card_id);
                if (idx >= 0) {
                    wishlistItems.splice(idx, 1);
                } else if (wishlistItems.length < 20) {
                    wishlistItems.push(card);
                }
                el.classList.toggle('selected', wishlistItems.some(w => w.card_id === card.card_id));
                syncWishlistChips();
            });
        });
    }

    function initWishlistPicker() {
        const input = document.getElementById('pf-wishlist-search-input');
        if (!input || input.dataset.wlInit) return;
        input.dataset.wlInit = '1';
        const status = document.getElementById('pf-wishlist-search-status');
        input.addEventListener('input', () => {
            const q = input.value.trim();
            clearTimeout(_wlSearchTimer);
            if (q.length < 2) {
                document.getElementById('pf-wishlist-search-results').innerHTML = '';
                if (status) status.textContent = q.length === 1 ? 'Type at least 2 characters…' : '';
                return;
            }
            if (status) status.textContent = 'Searching…';
            _wlSearchTimer = setTimeout(async () => {
                try {
                    const base = backendBase();
                    const res = await fetch(`${base}/api/public/cards/search?q=${encodeURIComponent(q)}&limit=16`);
                    if (res.ok) renderWishlistSearchResults(await res.json());
                } catch (_) {
                    if (status) status.textContent = 'Search failed.';
                }
            }, 320);
        });
    }

    function syncSectionsPanel() {
        const visible = new Set(getSavedSections());
        document.querySelectorAll('#pf-sections-panel input[type="checkbox"]').forEach((input) => {
            if (input.id === 'pf-trades-public-toggle') return;
            const id = input.value;
            input.checked = visible.has(id);
            if (MIN_REQUIRED_SECTIONS.includes(id)) {
                input.disabled = true;
            }
        });
        const tradesToggle = document.getElementById('pf-trades-public-toggle');
        if (tradesToggle) tradesToggle.checked = !!tradesPublic;
        renderTitlePicker();
        syncWishlistChips();
        initWishlistPicker();
        loadBannerPicker();
        const picker = document.getElementById('pf-achievement-picker');
        if (picker) {
            if (!Array.isArray(unlockedAchievements) || unlockedAchievements.length === 0) {
                picker.innerHTML = '<div class="pf-wishlist-empty" style="padding:2px 0;">Unlock achievements to pin them.</div>';
            } else {
                const selected = new Set(pinnedAchievementIds);
                picker.innerHTML = unlockedAchievements.map((ach) => `
                    <label class="pf-achievement-pick">
                        <input type="checkbox" data-achievement-id="${escapeHTML(ach.id || '')}" ${selected.has(ach.id) ? 'checked' : ''}>
                        <span class="icon">${escapeHTML(ach.icon || '🏆')}</span>
                        <span>${escapeHTML(ach.name || ach.id || 'Achievement')}</span>
                    </label>
                `).join('');
            }
        }
    }

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

    let dragSrcId = null;

    function initDragAndDrop() {
        ['pf-sidebar-widgets', 'pf-main-widgets'].forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.querySelectorAll('.pf-widget').forEach(widget => {
                widget.addEventListener('dragstart', (e) => {
                    dragSrcId = widget.id;
                    widget.classList.add('drag-active');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', widget.id);
                });
                widget.addEventListener('dragend', () => {
                    widget.classList.remove('drag-active');
                    document.querySelectorAll('.pf-widget').forEach(w => w.classList.remove('drag-over'));
                });
                widget.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const zone = WIDGET_ZONE[dragSrcId] || 'any';
                    const allowed = zone === 'any'
                        || (zone === 'sidebar' && containerId === 'pf-sidebar-widgets')
                        || (zone === 'main'    && containerId === 'pf-main-widgets');
                    e.dataTransfer.dropEffect = allowed ? 'move' : 'none';
                    document.querySelectorAll('.pf-widget').forEach(w => w.classList.remove('drag-over'));
                    if (allowed && widget.id !== dragSrcId) widget.classList.add('drag-over');
                });
                widget.addEventListener('dragleave', () => {
                    widget.classList.remove('drag-over');
                });
                widget.addEventListener('drop', (e) => {
                    e.preventDefault();
                    widget.classList.remove('drag-over');
                    if (!dragSrcId || dragSrcId === widget.id) return;
                    const src = document.getElementById(dragSrcId);
                    if (!src) return;

                    // Enforce zone rules
                    const zone = WIDGET_ZONE[dragSrcId] || 'any';
                    if (zone === 'sidebar' && container.id !== 'pf-sidebar-widgets') return;
                    if (zone === 'main'    && container.id !== 'pf-main-widgets') return;

                    if (src.parentElement === container) {
                        const allWidgets = [...container.querySelectorAll(':scope > .pf-widget')];
                        const srcIdx = allWidgets.indexOf(src);
                        const tgtIdx = allWidgets.indexOf(widget);
                        if (srcIdx < 0 || tgtIdx < 0) return;
                        if (srcIdx < tgtIdx) {
                            container.insertBefore(src, widget.nextSibling);
                        } else {
                            container.insertBefore(src, widget);
                        }
                    } else {
                        if (container.id === 'pf-sidebar-widgets') {
                            sidebarWidgetIds.add(dragSrcId);
                        } else {
                            sidebarWidgetIds.delete(dragSrcId);
                        }
                        container.insertBefore(src, widget);
                    }

                    const newOrder = [
                        ...[...document.getElementById('pf-sidebar-widgets').querySelectorAll(':scope > .pf-widget')].map(w => w.id),
                        ...[...document.getElementById('pf-main-widgets').querySelectorAll('.pf-widget')].map(w => w.id),
                    ];
                    saveOrder(newOrder);
                });
            });
        });
    }

    let editMode = false;
    let sectionsOpen = false;
    function setEditMode(on) {
        editMode = on;
        document.body.classList.toggle('pf-editing', on);
        const btn = document.getElementById('pf-edit-btn');
        const label = document.getElementById('pf-edit-label');
        if (btn) btn.classList.toggle('active', on);
        if (label) label.textContent = on ? 'Done editing' : 'Edit layout';

        // Enable/disable draggable
        document.querySelectorAll('.pf-widget').forEach(w => {
            w.setAttribute('draggable', on ? 'true' : 'false');
        });
        if (!on) {
            sectionsOpen = false;
            document.getElementById('pf-sections-panel')?.classList.add('hidden');
            document.getElementById('pf-sections-btn')?.classList.remove('active');
        }
    }

    document.getElementById('pf-edit-btn')?.addEventListener('click', () => setEditMode(!editMode));
    document.getElementById('pf-sections-btn')?.addEventListener('click', () => {
        if (!isOwner || !editMode) return;
        sectionsOpen = !sectionsOpen;
        document.getElementById('pf-sections-btn')?.classList.toggle('active', sectionsOpen);
        document.getElementById('pf-sections-panel')?.classList.toggle('hidden', !sectionsOpen);
        if (sectionsOpen) syncSectionsPanel();
    });
    document.getElementById('pf-trade-offer-btn')?.addEventListener('click', () => {
        window.location.href = `/trade/offer?to=${encodeURIComponent(profileUsername)}`;
    });

    document.getElementById('pf-save-sections')?.addEventListener('click', async () => {
        if (!isOwner) return;
        const tradesToggle = document.getElementById('pf-trades-public-toggle');
        if (tradesToggle) tradesPublic = tradesToggle.checked;
        const selected = [];
        document.querySelectorAll('#pf-sections-panel input[type="checkbox"]:checked').forEach((input) => {
            if (input.id === 'pf-trades-public-toggle') return;
            selected.push(input.value);
        });
        await saveSections(selected);
        await saveBio(bioText);
        await saveWishlist(wishlistItems);
        const selectedAchievementIds = [];
        document.querySelectorAll('#pf-achievement-picker input[type="checkbox"]:checked').forEach((input) => {
            const id = String(input.getAttribute('data-achievement-id') || '').trim();
            if (id) selectedAchievementIds.push(id);
        });
        await savePinnedAchievements(selectedAchievementIds.slice(0, 6));
        if (typeof showToast === 'function') showToast('Profile sections updated.', 'success');
    });

    // ── Copy castle code ───────────────────────────────────────────────────
    document.getElementById('pf-copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('pf-code')?.textContent?.trim();
        if (!code || code === '—') return;
        navigator.clipboard.writeText(code).then(() => {
            if (typeof showToast === 'function') showToast('Castle code copied!', 'success');
        }).catch(() => {});
    });

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
            try {
                if (meRes && meRes.ok) {
                    const meData = await meRes.json();
                    if (meData?.user?.username?.toLowerCase() === profileUsername.toLowerCase()) {
                        isOwner = true;
                    }
                }
            } catch (_) {}
            
            if (editBtn) {
                if (!isOwner) editBtn.style.display = 'none';
                else editBtn.style.display = 'inline-flex';
            }
            const sectionsBtn = document.getElementById('pf-sections-btn');
            if (sectionsBtn) {
                if (!isOwner) sectionsBtn.classList.add('hidden');
                else sectionsBtn.classList.remove('hidden');
            }

            // Assign layout from DB
            if (user.profile_layout) {
                savedLayoutOrder = user.profile_layout;
            }
            if (user.profile_sections) {
                visibleSections = user.profile_sections;
            }
            if (Array.isArray(user.profile_sidebar_widgets)) {
                sidebarWidgetIds = new Set(user.profile_sidebar_widgets);
            }
            if (user.profile_settings && typeof user.profile_settings === 'object') {
                const dbMode = user.profile_settings.showcase_mode;
                if (dbMode === 'carousel' || dbMode === 'grid') {
                    showcaseViewMode = dbMode;
                }
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
                unlockedAchievements = achievements.slice(0, 24);
            }
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

            // Apply saved widget order
            applyWidgetOrder(getSavedOrder());
            applyWidgetVisibility(getSavedSections());
            syncSectionsPanel();

            // Render widgets
            buildShowcaseSlots(showcase_cards || []);
            renderBio(bioText);
            renderStats(user, stats || {});
            renderRarityChart(stats || {});
            renderTrophy(trophy_cards || []);
            renderLatest(latest_cards || []);
            renderWishlist(wishlistItems);
            renderAchievements(getPinnedAchievementsForDisplay());
            renderBattleRecord(stats || {});
            renderCreators(data.supported_creators || []);
            renderSets(data.set_breakdown || []);

            // Init drag
            initDragAndDrop();

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
