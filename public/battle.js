(function () {
    'use strict';

    const BACKEND = (() => {
        const m = document.querySelector('meta[name="castle-public-url"]');
        return m ? m.content.replace(/\/$/, '') : '';
    })();

    const params      = new URLSearchParams(location.search);
    const STREAMER    = params.get('streamer') || '';

    let currentUser   = null;
    let streamerData  = null;
    let savedDecks    = [];
    let userCards     = [];
    let cardsLoaded   = false;  // guard: don't open picker until this is true
    let activeDeckIdx = 0;
    let activeDeckId  = null;   // DB id of the deck with is_active: true
    let pickerSlot    = null;
    let pendingSlots  = { 1: null, 2: null, 3: null };
    let csrfToken     = null;

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

    // Normalise a user_card from either nested (battle deck API) or flat (enriched_user_cards view) shape
    function normaliseCard(uc) {
        if (!uc) return null;
        // Collection API uses user_card_id; deck/slot APIs use id — always expose .id for UI + saves
        const rowId = uc.id ?? uc.user_card_id;
        if (rowId == null || rowId === '') return null;
        // Flat enriched_user_cards shape
        const imgUrl = uc.card?.image_url || uc.image_url || '';
        const name   = uc.card?.name      || uc.card_name || uc.name || '—';
        const atk    = uc.attack  ?? uc.card?.attack  ?? null;
        const def    = uc.defense ?? uc.card?.defense ?? null;
        // Mechanic: nested OR flat fields
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
        return { ...uc, id: rowId, _imgUrl: imgUrl, _name: name, _atk: atk, _def: def, _mechanic: mechanic, _genesis: genesis_mechanic };
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

            await ensureCsrfToken();

            // Apply streamer brand colour to the whole page
            const brandColor = streamerData?.binder_color || streamerData?.brand_color_primary;
            if (brandColor) applyBrandColor(brandColor);

            // Nav profile dropdown
            setupNavUser(currentUser);

            const backLink = qs('bt-back-link');
            if (backLink && STREAMER) {
                backLink.href = `/binder/${STREAMER}`;
                const lbl = qs('bt-back-label');
                if (lbl) lbl.textContent = `${streamerData?.brand_name || STREAMER} Binder`;
            }

            const creatorLabel = qs('bt-creator-label');
            if (creatorLabel) creatorLabel.textContent = (streamerData?.brand_name || streamerData?.username || STREAMER || '').toUpperCase();

            document.title = `Battle Arena${streamerData ? ` · ${streamerData.brand_name || streamerData.username}` : ''} · Castle TCG`;

            hide('bt-loading');
            qs('bt-nav')?.classList.remove('hidden');
            show('bt-root');

            // Load all data in parallel; user can see the page immediately
            await Promise.all([loadDecks(), loadHistory(), loadBattleStats(), loadUserCards()]);

        } catch (err) {
            console.error('[Battle] init:', err);
            hide('bt-loading');
            show('bt-signin');
        }
    }

    /* ── Decks (tabs map by deck *name* "Battle Deck N", not array index) ─ */
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
                frame.innerHTML = `<div class="bt-card-empty-icon"><i class="fa-solid fa-plus"></i></div>`;
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
            // Don't switch tabs when clicking the toggle pill
            if (e.target.closest('.bt-deck-toggle')) return;
            document.querySelectorAll('.bt-deck-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeDeckIdx = parseInt(tab.dataset.deckIdx, 10);
            renderActiveDeck();
        });
    });

    function renderDeckTabs() {
        document.querySelectorAll('.bt-deck-tab').forEach(tab => {
            const idx    = parseInt(tab.dataset.deckIdx, 10);
            const deck   = getDeckForTab(idx);
            const isActive = deck && deck.id === activeDeckId;

            // Remove previously injected toggle
            tab.querySelectorAll('.bt-deck-toggle').forEach(n => n.remove());

            if (!deck) return; // no deck saved at this slot yet

            const toggle = document.createElement('button');
            toggle.className = 'bt-deck-toggle' + (isActive ? ' is-active' : '');
            toggle.innerHTML = `<span class="bt-toggle-dot"></span>${isActive ? 'Active' : 'Set Active'}`;

            if (!isActive) {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    activateDeck(deck.id);
                });
            }

            tab.appendChild(toggle);
        });
    }

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
            if (!res.ok) { console.error('[Battle] activateDeck failed', res.status); return; }
            // Update local state
            activeDeckId = deckId;
            savedDecks.forEach(d => { d.is_active = (d.id === deckId); });
            renderDeckTabs();
        } catch (e) { console.error('[Battle] activateDeck:', e); }
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
    window._btOpenPicker = function (slot) {
        pickerSlot = slot;
        qs('bt-picker-slot-label').textContent = slot;
        qs('bt-picker-search').value = '';
        show('bt-picker');
        if (cardsLoaded) {
            renderPickerGrid('');
        } else {
            // Show spinner while cards are still loading
            const grid = qs('bt-picker-grid');
            if (grid) grid.innerHTML = `
                <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:48px 0;">
                    <div style="width:28px;height:28px;border:2px solid rgba(var(--void-accent-rgb),0.2);border-top-color:var(--void-accent);border-radius:50%;animation:bt-spin 0.8s linear infinite;"></div>
                    <span style="font-size:0.6rem;color:var(--void-muted);">Loading your cards…</span>
                </div>`;
            // Retry once cards finish
            const check = setInterval(() => {
                if (cardsLoaded) { clearInterval(check); renderPickerGrid(qs('bt-picker-search')?.value || ''); }
            }, 200);
        }
    };

    function renderPickerGrid(query) {
        const grid = qs('bt-picker-grid');
        if (!grid) return;

        const q = query.toLowerCase().trim();
        const filtered = q
            ? userCards.filter(uc => {
                const name   = (uc._name || '').toLowerCase();
                const trait1 = (uc._mechanic?.display_name  || uc._mechanic?.name  || '').toLowerCase();
                const trait2 = (uc._genesis?.display_name   || uc._genesis?.name   || '').toLowerCase();
                return name.includes(q) || trait1.includes(q) || trait2.includes(q);
            })
            : userCards;

        if (!filtered.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--void-muted);font-size:0.65rem;font-style:italic;">
                ${q ? 'No cards match your search.' : 'No cards found in your collection for this streamer.'}
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(uc => {
            const imgUrl  = esc(uc._imgUrl);
            const name    = esc(uc._name);
            const id      = esc(uc.id);
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
        hide('bt-picker');
        saveDeck({ feedback: false });
    };

    window._btClosePicker = function () { hide('bt-picker'); };

    qs('bt-picker-search')?.addEventListener('input', e => renderPickerGrid(e.target.value));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide('bt-picker'); });

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

    function updateSaveDeckButton() {
        const btn = qs('bt-save-deck-btn');
        if (!btn) return;
        const existing = getDeckForTab(activeDeckIdx);
        const canCreate = deckSlotCount() > 0;
        btn.disabled = !existing?.id && !canCreate;
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
            list.innerHTML = `<p style="font-size:0.6rem;color:var(--void-muted);opacity:0.5;text-align:center;padding:16px 0;font-style:italic;">No battles yet.</p>`;
            return;
        }
        const me = (currentUser?.username || '').toUpperCase();
        list.innerHTML = history.map(h => {
            const cls   = h.won === true ? 'win' : h.won === false ? 'loss' : 'draw';
            const label = h.won === true ? 'WIN'  : h.won === false ? 'LOSS'  : 'DRAW';
            return `<div class="bt-history-row">
                <div class="bt-history-vs">${esc(me)} VS ${esc((h.opponent || '?').toUpperCase())}</div>
                <div class="bt-history-result ${cls}">${label}</div>
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

    /* ── Boot ────────────────────────────────────────────────────────────── */
    init();
})();
