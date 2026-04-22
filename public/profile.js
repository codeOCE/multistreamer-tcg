/**
 * profile.js — Public profile page logic for /profile/:username
 * Widgets: showcase carousel, castle stats, trophy cabinet, latest pack pull.
 * Drag-and-drop layout persisted to localStorage.
 */
(function () {
    'use strict';

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
        rare: '#3b82f6',
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
            pinBtn.querySelector('i').className = isPinned ? 'bx bxs-pin' : 'bx bxs-pin';
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
        pinBtn.querySelector('i').className = newIsPinned ? 'bx bxs-pin' : 'bx bxs-pin';

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

    // ── Showcase carousel ───────────────────────────────────────────────────
    let showcaseCards = [];
    let showcaseIdx = 0;
    let autoTimer = null;
    const SHOWCASE_AUTO_MS = 3500;

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
        if (!Array.isArray(items) || items.length === 0) {
            wrap.innerHTML = '<p class="pf-wishlist-empty">No wishlist items yet.</p>';
            return;
        }
        wrap.innerHTML = items.map((item) => `
            <div class="pf-wishlist-item">
                <i class="bx bxs-star"></i>
                <span>${escapeHTML(item)}</span>
            </div>
        `).join('');
    }

    function timeAgo(iso) {
        try {
            const ms = Date.now() - new Date(iso).getTime();
            const s = Math.floor(ms / 1000);
            if (s < 60) return `${s}s ago`;
            const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
            const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
            const d = Math.floor(h / 24); return `${d}d ago`;
        } catch (_) { return ''; }
    }

    // ── Drag-and-drop widget layout ─────────────────────────────────────────
    const DEFAULT_ORDER = ['widget-showcase', 'widget-stats', 'widget-trophy', 'widget-latest', 'widget-wishlist'];
    const MIN_REQUIRED_SECTIONS = ['widget-showcase'];
    let savedLayoutOrder = null;
    let visibleSections = null;
    let wishlistItems = [];

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
                    body: JSON.stringify({ layout, sections })
                });
            }
        } catch (_) {}
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

    async function saveWishlist(items) {
        wishlistItems = Array.isArray(items) ? items : [];
        renderWishlist(wishlistItems);
        try {
            const base = backendBase();
            const token = localStorage.getItem('castle_token');
            if (token) {
                await fetch(`${base}/api/viewer/profile/wishlist`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ items: wishlistItems })
                });
            }
        } catch (_) {}
    }

    function applyWidgetOrder(order) {
        const grid = document.getElementById('pf-widgets');
        if (!grid) return;
        order.forEach(id => {
            const el = document.getElementById(id);
            if (el) grid.appendChild(el);
        });
        // Showcase always stays full-width (grid-column: 1 / -1)
        const showcase = document.getElementById('widget-showcase');
        if (showcase) showcase.style.gridColumn = '1 / -1';
    }

    function applyWidgetVisibility(sectionIds) {
        const visible = new Set(normalizeWidgetArray(sectionIds, DEFAULT_ORDER));
        DEFAULT_ORDER.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('hidden', !visible.has(id));
        });
    }

    function syncSectionsPanel() {
        const visible = new Set(getSavedSections());
        document.querySelectorAll('#pf-sections-panel input[type="checkbox"]').forEach((input) => {
            const id = input.value;
            input.checked = visible.has(id);
            if (MIN_REQUIRED_SECTIONS.includes(id)) {
                input.disabled = true;
            }
        });
        const editor = document.getElementById('pf-wishlist-editor');
        if (editor) editor.value = (wishlistItems || []).join('\n');
    }

    let dragSrcId = null;

    function initDragAndDrop() {
        const grid = document.getElementById('pf-widgets');
        if (!grid) return;

        grid.querySelectorAll('.pf-widget').forEach(widget => {
            widget.addEventListener('dragstart', (e) => {
                dragSrcId = widget.id;
                widget.classList.add('drag-active');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', widget.id);
            });
            widget.addEventListener('dragend', () => {
                widget.classList.remove('drag-active');
                grid.querySelectorAll('.pf-widget').forEach(w => w.classList.remove('drag-over'));
            });
            widget.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                grid.querySelectorAll('.pf-widget').forEach(w => w.classList.remove('drag-over'));
                if (widget.id !== dragSrcId) widget.classList.add('drag-over');
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

                // Swap DOM order
                const allWidgets = [...grid.querySelectorAll('.pf-widget')];
                const srcIdx = allWidgets.indexOf(src);
                const tgtIdx = allWidgets.indexOf(widget);
                if (srcIdx < tgtIdx) {
                    grid.insertBefore(src, widget.nextSibling);
                } else {
                    grid.insertBefore(src, widget);
                }

                // Ensure showcase stays full-width
                const showcase = document.getElementById('widget-showcase');
                if (showcase) showcase.style.gridColumn = '1 / -1';

                // Save
                const newOrder = [...grid.querySelectorAll('.pf-widget')].map(w => w.id);
                saveOrder(newOrder);
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
    document.getElementById('pf-save-sections')?.addEventListener('click', async () => {
        if (!isOwner) return;
        const selected = [];
        document.querySelectorAll('#pf-sections-panel input[type="checkbox"]:checked').forEach((input) => {
            selected.push(input.value);
        });
        await saveSections(selected);
        const editor = document.getElementById('pf-wishlist-editor');
        const lines = String(editor?.value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .slice(0, 20);
        await saveWishlist(lines);
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
            const res = await fetch(`${base}/api/public/profile/${encodeURIComponent(profileUsername)}`);
            if (!res.ok) {
                document.getElementById('pf-loading')?.classList.add('hidden');
                document.getElementById('pf-not-found')?.classList.remove('hidden');
                return;
            }
            const data = await res.json();
            const { user, stats, showcase_cards, trophy_cards, latest_cards } = data;

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
            const showcaseTitle = document.getElementById('pf-showcase-title');
            if (showcaseTitle) showcaseTitle.textContent = `${user.display_name}'s Collection`;

            // Security: Only show edit button if we are the owner
            const editBtn = document.getElementById('pf-edit-btn');
            isOwner = false;
            try {
                // Determine owner via session cookie using our main bootstrap endpoint
                const meRes = await fetch(`${base}/api/v2/bootstrap`, { credentials: 'include' });
                if (meRes.ok) {
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
            if (user.featured_card_ids) {
                featuredCardIds = user.featured_card_ids;
            }
            if (Array.isArray(user.wishlist_items)) {
                wishlistItems = user.wishlist_items;
            }

            // Apply saved widget order
            applyWidgetOrder(getSavedOrder());
            applyWidgetVisibility(getSavedSections());
            syncSectionsPanel();

            // Render widgets
            buildShowcaseSlots(showcase_cards || []);
            renderStats(user, stats || {});
            renderTrophy(trophy_cards || []);
            renderLatest(latest_cards || []);
            renderWishlist(wishlistItems);

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
