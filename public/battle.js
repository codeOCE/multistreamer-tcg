(function () {
    'use strict';

    const BACKEND = (() => {
        const m = document.querySelector('meta[name="castle-public-url"]');
        return m ? m.content.replace(/\/$/, '') : '';
    })();

    // Extract streamer from ?streamer= OR /{slug}/battle path
    const params = new URLSearchParams(location.search);
    let STREAMER = params.get('streamer') || '';
    if (!STREAMER) {
        const BARE_PAGES = new Set([
            'dashboard','onboarding','arena','privacy','terms','cookies',
            'arena-test','404','my-collection','battle','profile','settings',
            'card-studio','card-creator','stream-features','login','logout',
            'auth','trading','coming-soon','magic-dust','binder','binders',
        ]);
        const parts = location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
        if (parts.length >= 2 && parts[1] === 'battle' && !BARE_PAGES.has(parts[0])) {
            STREAMER = parts[0];
        }
    }

    let currentUser   = null;
    let streamerData  = null;
    let savedDecks    = [];
    let userCards     = [];
    let cardsLoaded   = false;
    let activeDeckIdx = 0;
    let activeDeckId  = null;
    let pickerSlot    = null;
    let pendingSlots  = { 1: null, 2: null, 3: null };
    let csrfToken     = null;
    let userRank      = null;
    const pickerFilters = { rarity: null, traits: new Set(), query: '' };

    // MMR tier system. Threshold = minimum rating for the tier.
    const RANK_TIERS = [
        { name: 'Master',   min: 1700, color: '#c084fc' },
        { name: 'Diamond',  min: 1500, color: '#67e8f9' },
        { name: 'Platinum', min: 1300, color: '#94e2d5' },
        { name: 'Gold',     min: 1100, color: '#fbbf24' },
        { name: 'Silver',   min: 900,  color: '#c0c5cc' },
        { name: 'Bronze',   min: 0,    color: '#b08968' },
    ];
    function getTier(rating) {
        if (rating == null) return null;
        return RANK_TIERS.find(t => rating >= t.min) || RANK_TIERS[RANK_TIERS.length - 1];
    }

    async function ensureCsrfToken() {
        if (csrfToken) return csrfToken;
        try {
            const res = await fetch(`${BACKEND}/api/csrf`, { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.token) csrfToken = data.token;
            return csrfToken;
        } catch (e) {
            console.error('[Battle] CSRF token fetch failed:', e);
            return null;
        }
    }

    function jsonHeaders() {
        const h = { 'Content-Type': 'application/json' };
        if (csrfToken) h['X-CSRF-Token'] = csrfToken;
        return h;
    }

    /* ── Nav user ────────────────────────────────────────────────────────── */
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

    /* ── Brand colour ────────────────────────────────────────────────────── */
    function applyBrandColor(hex) {
        if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const root = document.documentElement;
        root.style.setProperty('--void-accent', hex);
        root.style.setProperty('--void-accent-rgb', `${r}, ${g}, ${b}`);
        const glow = document.querySelector('.saas-bg-glow');
        if (glow) glow.style.background =
            `radial-gradient(circle at 15% 25%, rgba(${r},${g},${b},0.07) 0%, transparent 45%),` +
            `radial-gradient(circle at 85% 75%, rgba(${r},${g},${b},0.04) 0%, transparent 45%),` +
            `var(--void-bg)`;
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */
    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
    function qs(id)   { return document.getElementById(id); }

    function normaliseCard(uc) {
        if (!uc) return null;
        const rowId = uc.id ?? uc.user_card_id;
        if (rowId == null || rowId === '') return null;
        const imgUrl  = uc.card?.image_url || uc.image_url || '';
        const name    = uc.card?.name      || uc.card_name || uc.name || '—';
        const atk     = uc.attack  ?? uc.card?.attack  ?? null;
        const def     = uc.defense ?? uc.card?.defense ?? null;
        const rarity  = (uc.rarity ?? uc.card?.rarity ?? '').toString().toLowerCase() || null;
        const mechanic = uc.mechanic
            ? uc.mechanic
            : (uc.mechanic_icon || uc.mechanic_name)
                ? { icon: uc.mechanic_icon, name: uc.mechanic_name, display_name: uc.mechanic_display_name }
                : null;
        const genesis_mechanic = uc.genesis_mechanic
            ? uc.genesis_mechanic
            : (uc.genesis_mechanic_icon || uc.genesis_mechanic_name)
                ? { icon: uc.genesis_mechanic_icon, name: uc.genesis_mechanic_name, display_name: uc.genesis_mechanic_display_name }
                : null;
        return { ...uc, id: rowId, _imgUrl: imgUrl, _name: name, _atk: atk, _def: def, _rarity: rarity, _mechanic: mechanic, _genesis: genesis_mechanic };
    }

    function traitPipsHTML(mechanic, genesis_mechanic) {
        const icons = [];
        if (mechanic?.icon)         icons.push(mechanic.icon);
        if (genesis_mechanic?.icon) icons.push(genesis_mechanic.icon);
        if (!icons.length) return '';
        return `<div class="bt-card-trait">` +
            icons.map(icon => {
                const isUrl = icon && (icon.startsWith('/') || icon.startsWith('http'));
                return `<div class="bt-trait-pip">${isUrl ? `<img src="${esc(icon)}" alt="">` : esc(icon)}</div>`;
            }).join('') +
        `</div>`;
    }

    /* ── Init ────────────────────────────────────────────────────────────── */
    async function init() {
        try {
            const bsUrl = STREAMER
                ? `${BACKEND}/api/v2/bootstrap?streamer=${STREAMER}`
                : `${BACKEND}/api/v2/bootstrap`;
            const bsRes = await fetch(bsUrl, { credentials: 'include' });
            if (!bsRes.ok) { hide('bt-loading'); show('bt-signin'); return; }
            const bs = await bsRes.json();

            currentUser  = bs?.user     ?? null;
            streamerData = bs?.streamer ?? null;
            if (bs?.csrf_token) csrfToken = bs.csrf_token;

            if (!currentUser?.twitch_id) { hide('bt-loading'); show('bt-signin'); return; }

            // If STREAMER still empty, fall back to the streamer returned from bootstrap
            if (!STREAMER && streamerData?.username) {
                STREAMER = streamerData.username;
            }

            await ensureCsrfToken();

            const brandColor = streamerData?.binder_color || streamerData?.brand_color_primary;
            if (brandColor) applyBrandColor(brandColor);

            setupNavUser(currentUser);

            document.title = `Battle Arena${streamerData ? ` · ${streamerData.brand_name || streamerData.username}` : ''} · Castle TCG`;

            hide('bt-loading');
            show('bt-root');

            await Promise.all([
                loadDecks(),
                loadHistory(),
                loadBattleStats(),
                loadUserCards(),
                loadBattleLeaderboard(),
            ]);

        } catch (err) {
            console.error('[Battle] init:', err);
            hide('bt-loading');
            show('bt-signin');
        }
    }

/* ── Decks (tabs map by deck *name* "Battle Deck N") ─────────────────── */
    function battleDeckNameForTab(tabIdx) {
        return `Battle Deck ${tabIdx + 1}`;
    }

    function tabIndexFromDeckName(name) {
        const m = /^Battle Deck (\d+)$/.exec(String(name || '').trim());
        if (!m) return 0;
        const n = parseInt(m[1], 10) - 1;
        return Math.min(2, Math.max(0, n));
    }

    function getDeckForTab(tabIdx) {
        const want = battleDeckNameForTab(tabIdx);
        return savedDecks.find(d => (d.name || '').trim() === want) || null;
    }

    async function loadDecks(opts) {
        const preserveTab = opts && opts.preserveTab;
        try {
            const q = STREAMER ? `?streamer=${STREAMER}` : '';
            const res = await fetch(`${BACKEND}/api/battle/saved-decks${q}`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            savedDecks = data.decks || [];
            const active = savedDecks.find(d => d.is_active);
            if (active) {
                activeDeckId = active.id;
                if (!preserveTab) {
                    activeDeckIdx = tabIndexFromDeckName(active.name);
                    document.querySelectorAll('.bt-deck-tab').forEach(t => {
                        t.classList.toggle('active', parseInt(t.dataset.deckIdx, 10) === activeDeckIdx);
                    });
                }
            }
            renderActiveDeck();
            renderDeckTabs();
            updateSaveDeckButton();
        } catch (e) { console.error('[Battle] loadDecks:', e); }
    }

    function slotData(ds) {
        if (!ds) return null;
        const n = normaliseCard(ds);
        if (!n) return null;
        return {
            user_card_id:     n.id,
            card:             { image_url: n._imgUrl, name: n._name },
            mechanic:         n._mechanic,
            genesis_mechanic: n._genesis,
        };
    }

    function renderActiveDeck() {
        const deck = getDeckForTab(activeDeckIdx);
        pendingSlots[1] = slotData(deck?.slot_1);
        pendingSlots[2] = slotData(deck?.slot_2);
        pendingSlots[3] = slotData(deck?.slot_3);
        renderSlots();
        updateBattleBtn();
    }

    function renderSlots() {
        [1, 2, 3].forEach(s => {
            const frame = qs(`bt-slot-${s}`);
            if (!frame) return;
            const slot = pendingSlots[s];
            if (slot?.card?.image_url) {
                frame.innerHTML =
                    `<img src="${esc(slot.card.image_url)}" alt="${esc(slot.card.name || '')}"
                          style="width:100%;height:100%;object-fit:cover;display:block;">` +
                    traitPipsHTML(slot.mechanic, slot.genesis_mechanic);
                frame.classList.add('filled');
            } else {
                frame.innerHTML = `<div class="bt-card-empty-icon"><i class="bx bxs-plus"></i></div>`;
                frame.classList.remove('filled');
            }
        });
        updateSaveDeckButton();
    }

    function updateBattleBtn() {
        const filled = Object.values(pendingSlots).filter(s => s?.user_card_id).length;
        const btn = qs('bt-battle-btn');
        if (btn) btn.disabled = filled === 0;
    }

    /* ── Deck tabs ───────────────────────────────────────────────────────── */
    document.querySelectorAll('.bt-deck-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (e.target.closest('.bt-deck-toggle')) return;
            document.querySelectorAll('.bt-deck-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeDeckIdx = parseInt(tab.dataset.deckIdx, 10);
            renderActiveDeck();
        });
    });

    function renderDeckTabs() {
        document.querySelectorAll('.bt-deck-tab').forEach(tab => {
            const idx      = parseInt(tab.dataset.deckIdx, 10);
            const deck     = getDeckForTab(idx);
            const isActive = deck && deck.id === activeDeckId;

            tab.querySelectorAll('.bt-deck-toggle').forEach(n => n.remove());

            if (!deck) return;

            const toggle = document.createElement('button');
            toggle.className = 'bt-deck-toggle' + (isActive ? ' is-active' : '');
            toggle.innerHTML = `<span class="bt-toggle-dot"></span>${isActive ? 'Active' : 'Set Active'}`;

            if (!isActive) {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openActivateConfirm(deck);
                });
            }

            tab.appendChild(toggle);
        });
    }

    /* ── Confirm activate modal ──────────────────────────────────────────── */
    let pendingActivateDeckId = null;

    function openActivateConfirm(deck) {
        if (!deck?.id) return;
        pendingActivateDeckId = deck.id;
        const modal = qs('bt-confirm-active');
        if (!modal) { activateDeck(deck.id); return; }
        const targetEl  = qs('bt-confirm-active-target');
        const currentEl = qs('bt-confirm-active-current');
        const currentWrap = qs('bt-confirm-active-current-wrap');
        if (targetEl) targetEl.textContent = deck.name || 'this deck';
        const current = savedDecks.find(d => d.is_active && d.id !== deck.id);
        if (current && currentEl && currentWrap) {
            currentEl.textContent = current.name || 'another deck';
            currentWrap.classList.remove('hidden');
        } else if (currentWrap) {
            currentWrap.classList.add('hidden');
        }
        const confirmBtn = qs('bt-confirm-active-confirm');
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Make Active'; }
        modal.classList.add('open');
    }

    function closeActivateConfirm() {
        pendingActivateDeckId = null;
        qs('bt-confirm-active')?.classList.remove('open');
    }

    window._btCancelActivate = closeActivateConfirm;
    window._btConfirmActivate = async function () {
        const id = pendingActivateDeckId;
        if (!id) { closeActivateConfirm(); return; }
        const btn = qs('bt-confirm-active-confirm');
        if (btn) { btn.disabled = true; btn.textContent = 'Activating…'; }
        const ok = await activateDeck(id);
        if (ok) {
            closeActivateConfirm();
        } else if (btn) {
            btn.disabled = false; btn.textContent = 'Try again';
        }
    };

    async function activateDeck(deckId) {
        const q = STREAMER ? `?streamer=${STREAMER}` : '';
        try {
            await ensureCsrfToken();
            const res = await fetch(`${BACKEND}/api/battle/saved-decks/activate${q}`, {
                method: 'POST',
                credentials: 'include',
                headers: jsonHeaders(),
                body: JSON.stringify({ id: deckId }),
            });
            if (!res.ok) { console.error('[Battle] activateDeck failed', res.status); return false; }
            activeDeckId = deckId;
            savedDecks.forEach(d => { d.is_active = (d.id === deckId); });
            renderDeckTabs();
            return true;
        } catch (e) {
            console.error('[Battle] activateDeck:', e);
            return false;
        }
    }

    /* ── User cards ──────────────────────────────────────────────────────── */
    async function loadUserCards() {
        try {
            const q = STREAMER ? `?streamer=${STREAMER}` : '';
            const res = await fetch(`${BACKEND}/api/collection${q}`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            const raw = Array.isArray(data) ? data : (data.cards || data.collection || []);
            userCards = raw.map(normaliseCard).filter(Boolean);
        } catch (e) { console.error('[Battle] loadUserCards:', e); }
        finally { cardsLoaded = true; }
    }

    /* ── Card Picker ─────────────────────────────────────────────────────── */
    function traitKeyOf(m) {
        if (!m) return null;
        return (m.name || m.display_name || '').toLowerCase().trim() || null;
    }

    function rebuildTraitChips() {
        const row = qs('bt-trait-row');
        if (!row) return;
        // Collect distinct traits present in the user's cards (mechanic + genesis), keyed by lowercase name.
        const seen = new Map();
        userCards.forEach(uc => {
            [uc._mechanic, uc._genesis].forEach(m => {
                const key = traitKeyOf(m);
                if (!key || seen.has(key)) return;
                seen.set(key, { key, label: m.display_name || m.name, icon: m.icon || '' });
            });
        });
        // Keep the static "Traits" label and remove any previously appended chips.
        Array.from(row.querySelectorAll('.bt-filter-chip')).forEach(el => el.remove());
        Array.from(seen.values())
            .sort((a, b) => a.label.localeCompare(b.label))
            .forEach(t => {
                const isUrl = t.icon && (t.icon.startsWith('/') || t.icon.startsWith('http'));
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'bt-filter-chip';
                btn.dataset.trait = t.key;
                btn.innerHTML = (isUrl
                        ? `<img src="${esc(t.icon)}" alt="">`
                        : (t.icon ? `<span>${esc(t.icon)}</span>` : '')) +
                    `<span>${esc(t.label)}</span>`;
                btn.addEventListener('click', () => {
                    if (pickerFilters.traits.has(t.key)) pickerFilters.traits.delete(t.key);
                    else pickerFilters.traits.add(t.key);
                    btn.classList.toggle('active');
                    renderPickerGrid();
                });
                row.appendChild(btn);
            });
    }

    window._btOpenPicker = function (slot) {
        pickerSlot = slot;
        qs('bt-picker-slot-label').textContent = slot;
        // Reset filters every time the picker opens.
        pickerFilters.rarity = null;
        pickerFilters.traits.clear();
        pickerFilters.query  = '';
        const searchEl = qs('bt-picker-search');
        if (searchEl) { searchEl.value = ''; searchEl.classList.add('collapsed'); }
        qs('bt-picker-search-toggle')?.classList.remove('active');
        document.querySelectorAll('#bt-picker .bt-filter-chip.active').forEach(c => c.classList.remove('active'));

        qs('bt-picker')?.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (cardsLoaded) {
            rebuildTraitChips();
            renderPickerGrid();
        } else {
            const grid = qs('bt-picker-grid');
            if (grid) grid.innerHTML = `
                <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:48px 0;">
                    <div style="width:28px;height:28px;border:2px solid rgba(var(--void-accent-rgb),0.2);border-top-color:var(--void-accent);border-radius:50%;animation:bt-spin 0.8s linear infinite;"></div>
                    <span style="font-size:0.6rem;color:var(--void-muted);">Loading your cards…</span>
                </div>`;
            const check = setInterval(() => {
                if (cardsLoaded) { clearInterval(check); rebuildTraitChips(); renderPickerGrid(); }
            }, 200);
        }
    };

    function renderPickerGrid() {
        const grid = qs('bt-picker-grid');
        if (!grid) return;

        const q          = pickerFilters.query.toLowerCase().trim();
        const rarity     = pickerFilters.rarity;
        const traitSet   = pickerFilters.traits;
        const hasTraits  = traitSet.size > 0;
        const hasQuery   = q.length > 0;
        const hasRarity  = !!rarity;

        const filtered = userCards.filter(uc => {
            if (hasRarity && uc._rarity !== rarity) return false;
            if (hasTraits) {
                const t1 = traitKeyOf(uc._mechanic);
                const t2 = traitKeyOf(uc._genesis);
                let match = false;
                traitSet.forEach(k => { if (k === t1 || k === t2) match = true; });
                if (!match) return false;
            }
            if (hasQuery) {
                if (!(uc._name || '').toLowerCase().includes(q)) return false;
            }
            return true;
        });

        if (!filtered.length) {
            const anyFilter = hasQuery || hasRarity || hasTraits;
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--void-muted);font-size:0.65rem;font-style:italic;">
                ${anyFilter ? 'No cards match these filters.' : 'No cards found in your collection for this streamer.'}
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(uc => {
            const imgUrl   = esc(uc._imgUrl);
            const name     = esc(uc._name);
            const id       = esc(uc.id);
            const mechanic = uc._mechanic, genesis = uc._genesis;

            const traitBadges = [mechanic, genesis].filter(Boolean).map(m => {
                const icon = m.icon || '';
                const label = esc(m.display_name || m.name || '');
                const isUrl = icon && (icon.startsWith('/') || icon.startsWith('http'));
                return `<div class="bt-trait-pip" title="${label}">${isUrl ? `<img src="${esc(icon)}" alt="">` : esc(icon)}</div>`;
            }).join('');

            const statsHTML = (uc._atk != null || uc._def != null) ? `
                <div class="bt-picker-stats">
                    ${uc._atk != null ? `<span class="bt-atk">⚔ ${uc._atk}</span>` : ''}
                    ${uc._def != null ? `<span class="bt-def">🛡 ${uc._def}</span>` : ''}
                </div>` : '';

            return `<div class="bt-picker-card" onclick="window._btPickCard('${id}')">
                <div class="bt-picker-img-wrap">
                    <img src="${imgUrl}" alt="${name}" loading="lazy">
                    ${traitBadges ? `<div class="bt-card-trait">${traitBadges}</div>` : ''}
                </div>
                <div class="bt-picker-name">${name}</div>
                ${statsHTML}
            </div>`;
        }).join('');
    }

    window._btPickCard = function (userCardId) {
        const uc = userCards.find(c => String(c.id ?? c.user_card_id) === String(userCardId));
        if (!uc) return;
        pendingSlots[pickerSlot] = {
            user_card_id:     userCardId,
            card:             { image_url: uc._imgUrl, name: uc._name },
            mechanic:         uc._mechanic,
            genesis_mechanic: uc._genesis,
        };
        renderSlots();
        updateBattleBtn();
        closePicker();
    };

    function closePicker() {
        qs('bt-picker')?.classList.remove('open');
        document.body.style.overflow = '';
    }

    window._btClosePicker = closePicker;

    qs('bt-picker-search')?.addEventListener('input', e => {
        pickerFilters.query = e.target.value;
        renderPickerGrid();
    });

    // Rarity chip toggling (chips live in HTML, so wire on DOM ready)
    document.querySelectorAll('#bt-rarity-row .bt-filter-chip[data-rarity]').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.dataset.rarity;
            if (pickerFilters.rarity === r) {
                pickerFilters.rarity = null;
                btn.classList.remove('active');
            } else {
                pickerFilters.rarity = r;
                document.querySelectorAll('#bt-rarity-row .bt-filter-chip[data-rarity]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            renderPickerGrid();
        });
    });

    // Magnifier toggle — expands/collapses the search input.
    qs('bt-picker-search-toggle')?.addEventListener('click', () => {
        const input  = qs('bt-picker-search');
        const toggle = qs('bt-picker-search-toggle');
        if (!input || !toggle) return;
        const collapsed = input.classList.toggle('collapsed');
        toggle.classList.toggle('active', !collapsed);
        if (collapsed) {
            input.value = '';
            pickerFilters.query = '';
            renderPickerGrid();
        } else {
            setTimeout(() => input.focus(), 60);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (qs('bt-confirm-active')?.classList.contains('open')) { closeActivateConfirm(); return; }
        closePicker();
    });

    /* ── Save deck ───────────────────────────────────────────────────────── */
    function deckSlotCount() {
        return [1, 2, 3].filter(s => pendingSlots[s]?.user_card_id).length;
    }

    function showDeckSaveMsg(text, kind) {
        const el = qs('bt-deck-save-msg');
        if (!el) return;
        el.textContent = text || '';
        el.classList.remove('success', 'error');
        if (kind === 'success' || kind === 'error') el.classList.add(kind);
        if (text) {
            el.classList.remove('hidden');
            el.style.display = 'block';
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    }

    function deckMatchesSaved() {
        const existing = getDeckForTab(activeDeckIdx);
        if (!existing?.id) return false;
        const savedIds = [
            slotData(existing.slot_1)?.user_card_id || null,
            slotData(existing.slot_2)?.user_card_id || null,
            slotData(existing.slot_3)?.user_card_id || null,
        ];
        const pendingIds = [1, 2, 3].map(s => pendingSlots[s]?.user_card_id || null);
        return savedIds.every((id, i) => id === pendingIds[i]);
    }

    function updateSaveDeckButton() {
        const btn      = qs('bt-save-deck-btn');
        const revert   = qs('bt-revert-deck-btn');
        const existing = getDeckForTab(activeDeckIdx);
        const canCreate = deckSlotCount() > 0;
        const matches  = deckMatchesSaved();

        if (btn) {
            if (matches) {
                btn.disabled = true;
                btn.textContent = 'Saved';
                btn.classList.add('is-saved');
            } else {
                btn.disabled = !existing?.id && !canCreate;
                btn.textContent = 'Save Deck';
                btn.classList.remove('is-saved');
            }
        }

        if (revert) {
            const showRevert = !!existing?.id && !matches;
            revert.classList.toggle('hidden', !showRevert);
            revert.disabled = !showRevert;
        }
    }

    function revertDeck() {
        const existing = getDeckForTab(activeDeckIdx);
        if (!existing?.id) return;
        renderActiveDeck();
        showDeckSaveMsg('Reverted to last saved.', '');
        setTimeout(() => { showDeckSaveMsg('', ''); }, 2000);
    }

    async function saveDeck(opts) {
        const feedback = !!(opts && opts.feedback);
        const q    = STREAMER ? `?streamer=${STREAMER}` : '';
        const existing = getDeckForTab(activeDeckIdx);
        const body = {
            name:   existing?.name || `Battle Deck ${activeDeckIdx + 1}`,
            slot_1: pendingSlots[1]?.user_card_id || null,
            slot_2: pendingSlots[2]?.user_card_id || null,
            slot_3: pendingSlots[3]?.user_card_id || null,
        };

        if (!existing?.id && deckSlotCount() === 0) {
            if (feedback) showDeckSaveMsg('Add at least one card before saving.', 'error');
            return false;
        }

        const btn = qs('bt-save-deck-btn');
        if (feedback && btn) { btn.disabled = true; showDeckSaveMsg('Saving…', ''); }

        try {
            await ensureCsrfToken();
            if (!csrfToken) {
                if (feedback) showDeckSaveMsg('Security token missing. Refresh the page and try again.', 'error');
                return false;
            }
            if (existing?.id) {
                const res  = await fetch(`${BACKEND}/api/battle/saved-decks${q}`, {
                    method: 'PATCH', credentials: 'include',
                    headers: jsonHeaders(),
                    body: JSON.stringify({ id: existing.id, ...body }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (feedback) showDeckSaveMsg((data.error === 'CSRF blocked' || res.status === 403) ? 'Session security check failed. Refresh the page.' : (data.error || 'Could not save deck.'), 'error');
                    return false;
                }
                await loadDecks({ preserveTab: true });
            } else {
                const res  = await fetch(`${BACKEND}/api/battle/saved-decks${q}`, {
                    method: 'POST', credentials: 'include',
                    headers: jsonHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const msg = (data.error === 'CSRF blocked' || res.status === 403)
                        ? 'Session security check failed. Refresh the page.'
                        : (data.error || 'Could not save deck.');
                    if (feedback) showDeckSaveMsg(msg, 'error');
                    return false;
                }
                await loadDecks({ preserveTab: true });
            }
            if (feedback) {
                showDeckSaveMsg('Deck saved.', 'success');
                setTimeout(() => { showDeckSaveMsg('', ''); }, 3500);
            }
            updateSaveDeckButton();
            return true;
        } catch (e) {
            console.error('[Battle] saveDeck:', e);
            if (feedback) showDeckSaveMsg('Could not save deck.', 'error');
            return false;
        } finally {
            if (feedback) updateSaveDeckButton();
        }
    }

    qs('bt-save-deck-btn')?.addEventListener('click', () => { saveDeck({ feedback: true }); });
    qs('bt-revert-deck-btn')?.addEventListener('click', revertDeck);

    /* ── Battle ──────────────────────────────────────────────────────────── */
    qs('bt-battle-btn')?.addEventListener('click', async () => {
        const btn = qs('bt-battle-btn');
        const msg = qs('bt-battle-msg');
        btn.disabled = true;
        msg.className = '';
        msg.textContent = 'Finding opponent…';

        try {
            await ensureCsrfToken();
            const q = STREAMER ? `?streamer=${STREAMER}` : '';
            const existing = getDeckForTab(activeDeckIdx);
            if (existing?.id) {
                await fetch(`${BACKEND}/api/battle/saved-decks/activate${q}`, {
                    method: 'POST', credentials: 'include',
                    headers: jsonHeaders(),
                    body: JSON.stringify({ id: existing.id }),
                });
            }

            const res  = await fetch(`${BACKEND}/api/battle/initiate${q}`, {
                method: 'POST', credentials: 'include',
                headers: jsonHeaders(),
                body: JSON.stringify({}),
            });
            const data = await res.json();

            if (!res.ok) {
                msg.className = 'error';
                msg.textContent = data.error || 'Battle failed. Try again.';
                btn.disabled = false;
                return;
            }

            msg.className = 'success';
            msg.textContent = data.result?.summary || data.summary || 'Battle complete!';
            await loadHistory();
            await loadBattleStats();
            setTimeout(() => { msg.textContent = ''; btn.disabled = false; }, 4000);

        } catch (e) {
            console.error('[Battle] battle:', e);
            msg.className = 'error';
            msg.textContent = 'Network error. Try again.';
            btn.disabled = false;
        }
    });

    /* ── History ─────────────────────────────────────────────────────────── */
    async function loadHistory() {
        try {
            const q   = STREAMER ? `?streamer=${STREAMER}` : '';
            const res = await fetch(`${BACKEND}/api/battle/history${q}`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            renderHistory(data.history || []);
        } catch (e) { console.error('[Battle] loadHistory:', e); }
    }

    function renderHistory(history) {
        const list = qs('bt-history-list');
        if (!list) return;
        if (!history.length) {
            list.innerHTML = `<p class="bt-empty-msg">No battles yet.</p>`;
            return;
        }
        list.innerHTML = history.map(h => {
            const cls   = h.won === true ? 'win' : h.won === false ? 'loss' : 'draw';
            const label = h.won === true ? 'WIN'  : h.won === false ? 'LOSS'  : 'DRAW';
            const delta = h.mmr_delta;
            let mmrHtml = '';
            if (delta != null) {
                const dCls  = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero';
                const dText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0';
                mmrHtml = `<span class="bt-history-mmr ${dCls}">${dText}</span>`;
            }
            return `<div class="bt-history-row">
                <div class="bt-history-vs">vs ${esc((h.opponent || '?'))}</div>
                <div class="bt-history-result ${cls}">
                    <span class="bt-history-label">${label}</span>
                    ${mmrHtml}
                </div>
            </div>`;
        }).join('');
    }

    /* ── Stats ───────────────────────────────────────────────────────────── */
    async function loadBattleStats() {
        if (!currentUser?.username) return;
        try {
            const uParam = encodeURIComponent(currentUser.username);
            const sParam = STREAMER ? `&streamer=${STREAMER}` : '';
            const res    = await fetch(`${BACKEND}/api/public/battle/stats?user=${uParam}${sParam}`);
            if (!res.ok) return;
            const text = await res.text();
            const m = text.match(/(\d+)W\s*-\s*(\d+)L\s*-\s*(\d+)D/i);
            if (m) {
                const w = qs('bt-stat-wins'), l = qs('bt-stat-losses'), d = qs('bt-stat-draws');
                if (w) w.textContent = m[1];
                if (l) l.textContent = m[2];
                if (d) d.textContent = m[3];
            }
        } catch (e) { /* silent */ }
    }

    /* ── Battle Leaderboard ──────────────────────────────────────────────── */
    function setLeaderboardMsg(text) {
        const list = qs('bt-lb-list');
        if (list) list.innerHTML = `<p class="bt-empty-msg">${esc(text)}</p>`;
    }

    async function loadBattleLeaderboard() {
        if (!STREAMER) { setLeaderboardMsg('No leaderboard available.'); return; }
        try {
            const res  = await fetch(`${BACKEND}/api/battle/leaderboard?streamer=${STREAMER}`, { credentials: 'include' });
            if (!res.ok) { setLeaderboardMsg("Couldn't load leaderboard."); return; }
            const data = await res.json();
            const rows = data.leaderboard || [];

            // Determine user's rank + rating — check top-5 first, then server-computed values
            const myName = (currentUser?.username || '').toLowerCase();
            const myRow  = rows.find(r => (r.username || '').toLowerCase() === myName);
            let myRating = null;
            if (myRow) {
                userRank = myRow.rank;
                myRating = myRow.rating ?? null;
            } else {
                if (data.my_rank != null)   userRank = data.my_rank;
                if (data.my_rating != null) myRating = data.my_rating;
            }
            const rankEl = qs('bt-stat-rank');
            if (rankEl) {
                const tier = getTier(myRating);
                if (tier) {
                    rankEl.textContent = tier.name;
                    rankEl.style.color = tier.color;
                } else {
                    rankEl.textContent = '—';
                    rankEl.style.color = '';
                }
            }

            renderBattleLeaderboard(rows);
        } catch (e) {
            console.error('[Battle] loadBattleLeaderboard:', e);
            setLeaderboardMsg("Couldn't load leaderboard.");
        }
    }

    function renderBattleLeaderboard(rows) {
        const list = qs('bt-lb-list');
        if (!list) return;

        if (!rows.length) {
            list.innerHTML = `<p class="bt-empty-msg">No battles yet.</p>`;
            return;
        }

        const RANK_COLORS = ['#fbbf24', '#94a3b8', '#d97706', 'var(--void-accent)', 'var(--void-accent)'];

        list.innerHTML = rows.map((r, i) => {
            const rankColor = RANK_COLORS[i] || 'var(--void-muted)';
            const rankLabel = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`;
            const tier = getTier(r.rating);

            const renderThumb = (slot) => slot?.image_url
                ? `<div class="bt-lb-deck-slot"><img src="${esc(slot.image_url)}" alt="${esc(slot.name || '')}" class="bt-lb-deck-card"></div>`
                : `<div class="bt-lb-deck-slot"><div class="bt-lb-deck-empty"></div></div>`;

            const renderTipCard = (slot) => {
                if (!slot?.image_url) {
                    return `<div class="bt-deck-tip-card">
                        <div class="bt-deck-tip-img-wrap">
                            <div class="bt-deck-tip-img-empty">Empty</div>
                        </div>
                    </div>`;
                }
                const traits = [];
                if (slot.mechanic?.display_name) {
                    traits.push({ kind: 'mechanic', name: slot.mechanic.display_name, icon: slot.mechanic.icon });
                }
                if (slot.genesis_mechanic?.display_name) {
                    traits.push({ kind: 'genesis', name: slot.genesis_mechanic.display_name, icon: slot.genesis_mechanic.icon });
                }
                const traitHtml = traits.length
                    ? `<div class="bt-deck-tip-traits">${traits.map(t => {
                          const isUrl = t.icon && (t.icon.startsWith('/') || t.icon.startsWith('http'));
                          const iconHtml = isUrl
                              ? `<img src="${esc(t.icon)}" alt="">`
                              : esc(t.icon || '');
                          return `<div class="bt-deck-tip-trait ${t.kind === 'genesis' ? 'genesis' : ''}">
                              <span class="bt-deck-tip-trait-icon">${iconHtml}</span>
                              <span>${esc(t.name)}</span>
                          </div>`;
                      }).join('')}</div>`
                    : '';
                return `<div class="bt-deck-tip-card">
                    <div class="bt-deck-tip-img-wrap">
                        <img src="${esc(slot.image_url)}" alt="${esc(slot.name || '')}">
                    </div>
                    <div class="bt-deck-tip-name">${esc(slot.name || '—')}</div>
                    <div class="bt-deck-tip-stats">
                        <span class="bt-deck-tip-stat atk">ATK ${slot.attack ?? '—'}</span>
                        <span class="bt-deck-tip-stat def">DEF ${slot.defense ?? '—'}</span>
                    </div>
                    ${traitHtml}
                </div>`;
            };

            let deckHtml;
            if (r.active_deck) {
                const slots = [r.active_deck.slot_1, r.active_deck.slot_2, r.active_deck.slot_3];
                deckHtml = slots.map(renderThumb).join('') +
                    `<div class="bt-deck-tip">${slots.map(renderTipCard).join('')}</div>`;
            } else {
                deckHtml = `<span class="bt-lb-no-deck">—</span>`;
            }

            const tierHtml = tier
                ? `<span class="bt-lb-tier" style="color:${tier.color}">${tier.name}</span><span class="bt-lb-sep">·</span>`
                : '';

            return `<div class="bt-lb-row">
                <span class="bt-lb-rank" style="color:${rankColor}">${rankLabel}</span>
                <div class="bt-lb-info">
                    <div class="bt-lb-name">${esc(r.username || '—')}</div>
                    <div class="bt-lb-record">
                        ${tierHtml}
                        <span class="bt-lb-w">${r.wins}W</span>
                        <span class="bt-lb-sep">·</span>
                        <span class="bt-lb-l">${r.losses}L</span>
                        <span class="bt-lb-sep">·</span>
                        <span class="bt-lb-d">${r.draws}D</span>
                    </div>
                </div>
                <div class="bt-lb-deck">${deckHtml}</div>
            </div>`;
        }).join('');
    }

    /* ── Boot ────────────────────────────────────────────────────────────── */
    init();
})();
