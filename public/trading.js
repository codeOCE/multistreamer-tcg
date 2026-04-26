(function () {
    'use strict';

    /* ── Backend URL ─────────────────────────────────────────────────────────── */
    const BACKEND = (() => {
        const m = document.querySelector('meta[name="castle-public-url"]');
        return m ? m.content.replace(/\/$/, '') : window.location.origin;
    })();

    /* ── State ───────────────────────────────────────────────────────────────── */
    let currentUser    = null;
    let streamer       = null;
    let streamerSlug   = '';
    let csrfToken      = '';   // captured from /api/v2/bootstrap; required for all non-GET /api/* writes
    let listings       = [];
    let page           = 0;
    let hasMore        = false;
    let sort           = 'recent';
    let searchQuery    = '';
    let traitFilter    = null;
    let viewingMine    = false;
    const PAGE_SIZE    = 10;

    let myCards               = [];
    let selectedListCardId    = null;
    let offerTargetListingId  = null;
    let selectedOfferCardId   = null;
    let viewingListingId      = null;

    // Streamer's full trait catalogue (from /api/mechanics) — used to render filter chips
    // and to hydrate user_cards.trait_list (which is stored as a bare array of mechanic UUIDs).
    let streamerTraits        = [];
    let traitsById            = new Map(); // UUID → { id, name, display_name, icon, ... }
    let traitChipsPromise     = null;       // awaitable so the modal can wait for the catalogue
    // List-modal filter state
    let listSearchQuery       = '';
    let listTraitFilter       = new Set();

    // Each entry in user_cards.trait_list may be either a bare UUID string or already a hydrated
    // object (depending on producer). Returns an array of { id, name, display_name, icon_url, color }.
    function hydrateTraits(rawList) {
        if (!Array.isArray(rawList)) return [];
        return rawList.map(entry => {
            if (entry && typeof entry === 'object' && (entry.name || entry.display_name)) return entry;
            const id = typeof entry === 'string' ? entry : entry?.id;
            if (!id) return null;
            const t = traitsById.get(id);
            if (!t) return { id, name: id, display_name: id }; // fallback so search/filter still work
            return {
                id: t.id,
                name: t.name,
                display_name: t.display_name || t.name,
                icon_url: t.icon || t.icon_url || '',
                color: t.color || '',
            };
        }).filter(Boolean);
    }

    /* ── Helpers ─────────────────────────────────────────────────────────────── */
    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function cardImg(card) {
        if (!card) return '';
        if ((card.template_id || card.has_template) && card.user_card_id) {
            return `${BACKEND}/api/cards/${card.user_card_id}/image.png`;
        }
        return card.baked_image_url || card.image_url || '';
    }

    function rarityColor(r) {
        const map = { legendary: '#fbbf24', epic: '#a855f7', rare: '#3b82f6', uncommon: '#34d399', common: '#64748b' };
        return map[(r || '').toLowerCase()] || '#64748b';
    }

    // Mint a fresh CSRF token + matching cookie via /api/csrf.
    // The bootstrap response is edge-cached, so its csrf_token can drift from
    // whatever cookie the browser actually has. /api/csrf is uncached and
    // sets Set-Cookie to the same token it returns, guaranteeing alignment.
    let _csrfPromise = null;
    async function ensureCsrfToken(forceRefresh = false) {
        if (forceRefresh) { csrfToken = ''; _csrfPromise = null; }
        if (csrfToken) return csrfToken;
        if (_csrfPromise) return _csrfPromise;
        _csrfPromise = (async () => {
            try {
                const r = await fetch(`${BACKEND}/api/csrf`, { credentials: 'include' });
                if (r.ok) {
                    const j = await r.json().catch(() => ({}));
                    if (j?.token) csrfToken = j.token;
                }
            } catch (_) { /* ignore — write will fail and surface error */ }
            _csrfPromise = null;
            return csrfToken;
        })();
        return _csrfPromise;
    }

    // Wrapper for write endpoints — automatically sends the CSRF header + cookies.
    // Retries once on 403 with a freshly minted token, in case the cookie was stale.
    async function writeFetch(url, init = {}) {
        const send = async () => {
            const token = await ensureCsrfToken();
            const headers = { ...(init.headers || {}) };
            if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (token) headers['X-CSRF-Token'] = token;
            return fetch(url, { ...init, headers, credentials: 'include' });
        };
        let res = await send();
        if (res.status === 403) {
            await ensureCsrfToken(true);
            res = await send();
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || `HTTP ${res.status}`);
        }
        return res;
    }

    let _toastT = null;
    function toast(msg, type = '') {
        const el = document.getElementById('tr-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = `show ${type}`;
        clearTimeout(_toastT);
        _toastT = setTimeout(() => { el.className = ''; }, 3200);
    }

    // Use inline display instead of the `hidden` class: the page has ID-level `display: flex`
    // rules on #tr-root and #tr-loading, and an ID selector beats a class selector in
    // specificity, so adding `.hidden` has no effect. Inline style always wins.
    function show(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('hidden');
        el.style.display = '';
    }
    function hide(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.style.display = 'none';
    }

    /* ── URL / Routing ───────────────────────────────────────────────────────── */
    function parseSlug() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[parts.length - 1] === 'trading') return parts[parts.length - 2];
        return new URLSearchParams(window.location.search).get('streamer') || '';
    }

    /* ── Init ────────────────────────────────────────────────────────────────── */
    async function init() {
        console.log('[Trading] init() start. BACKEND:', BACKEND);

        streamerSlug = parseSlug();
        console.log('[Trading] parsed slug:', streamerSlug, '| pathname:', window.location.pathname);

        if (!streamerSlug) {
            hide('tr-loading');
            showError('No streamer specified in URL.');
            return;
        }

        // Fetch bootstrap with a 10-second timeout so we never hang forever
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(
                `${BACKEND}/api/v2/bootstrap?streamer=${encodeURIComponent(streamerSlug)}&lite=1`,
                { credentials: 'include', signal: controller.signal }
            );
            clearTimeout(timeout);
            console.log('[Trading] bootstrap status:', res.status);
            if (res.ok) {
                const bs = await res.json();
                currentUser = bs?.user || null;
                streamer    = bs?.streamer || null;
                csrfToken   = bs?.csrf_token || '';
                console.log('[Trading] streamer:', streamer?.username, '| user:', currentUser?.username, '| csrf:', csrfToken ? 'yes' : 'no');
            } else {
                console.warn('[Trading] bootstrap non-ok:', res.status, await res.text().catch(() => ''));
            }
        } catch (e) {
            console.error('[Trading] bootstrap fetch error:', e);
        }

        if (!streamer) {
            hide('tr-loading');
            showError(`Streamer "${streamerSlug}" not found.`);
            return;
        }

        // Reveal the page FIRST so a broken setup step can never leave the user on a blank loader.
        console.log('[Trading] revealing page shell');
        hide('tr-loading');
        show('tr-root');

        // Each setup step is isolated so one failure cannot block the others or the listings fetch.
        try { applyBranding(); }      catch (e) { console.error('[Trading] applyBranding error:', e); }
        try { setupNavUser(); }       catch (e) { console.error('[Trading] setupNavUser error:', e); }
        try { if (window.castleNav) castleNav.autoInit(); } catch (e) { console.error('[Trading] castleNav error:', e); }
        try { renderAuthStatus(); }   catch (e) { console.error('[Trading] renderAuthStatus error:', e); }

        // Trait chips and listings run in parallel; trait chips are optional so never awaited here.
        loadTraitChips().catch(e => console.warn('[Trading] trait chips error:', e));

        console.log('[Trading] calling loadListings()');
        loadListings();
    }

    function showError(msg) {
        const loadingEl = document.getElementById('tr-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <i class="bx bx-error-circle" style="font-size:2rem;opacity:0.3;"></i>
                <span style="font-size:0.75rem;font-weight:700;">${esc(msg)}</span>
                <a href="/" style="font-size:0.7rem;color:var(--void-accent);margin-top:4px;">← Back to Castle</a>
            `;
            loadingEl.classList.remove('hidden');
        }
    }

    /* ── Branding ─────────────────────────────────────────────────────────────── */
    function applyBranding() {
        const accent = streamer.brand_color_primary || '#00f2fe';
        document.documentElement.style.setProperty('--page-accent', accent);
        const r = parseInt(accent.slice(1, 3), 16) || 0;
        const g = parseInt(accent.slice(3, 5), 16) || 242;
        const b = parseInt(accent.slice(5, 7), 16) || 254;
        document.documentElement.style.setProperty('--page-accent-rgb', `${r}, ${g}, ${b}`);

        const name = streamer.brand_name || streamer.username || streamerSlug;
        document.getElementById('tr-back-name').textContent = name;
        document.getElementById('tr-back-link').href = `/${streamerSlug}`;
        document.getElementById('tr-page-label').textContent = `${name} · Trading Centre`;
        document.title = `${name} — Trading Centre · Castle TCG`;
    }

    function setupNavUser() {
        if (!currentUser) return;
        window.currentUser = { ...currentUser, avatar: currentUser.avatar_url || currentUser.avatar };
        const navAvatar  = document.getElementById('nav-avatar');
        const menuAvatar = document.getElementById('nav-user-menu-avatar');
        if (navAvatar)  navAvatar.src  = window.currentUser.avatar || '';
        if (menuAvatar) menuAvatar.src = window.currentUser.avatar || '';
        const preview = document.getElementById('nav-user-preview');
        if (preview) { preview.classList.remove('hidden'); preview.style.display = 'flex'; }
        window.initNavUserMenu?.();
        window.updateNavUserMenuLabels?.();
    }

    function renderAuthStatus() {
        const el = document.getElementById('tr-auth-status');
        if (!el) return;
        if (!currentUser) {
            el.innerHTML = `<a href="${BACKEND}/auth/twitch?role=viewer" style="color:rgba(var(--page-accent-rgb),1);font-weight:700;">Sign in</a> to list cards &amp; make offers.`;
            el.classList.remove('hidden');
        }
    }

    /* ── Trait chips ─────────────────────────────────────────────────────────── */
    function loadTraitChips() {
        if (traitChipsPromise) return traitChipsPromise;
        traitChipsPromise = (async () => {
            if (!streamer?.id) return;
            try {
                const ctrl = new AbortController();
                setTimeout(() => ctrl.abort(), 5000);
                const res = await fetch(`${BACKEND}/api/mechanics?streamer=${encodeURIComponent(streamer.id)}`, { credentials: 'include', signal: ctrl.signal });
                if (!res.ok) return;
                const data = await res.json();
                streamerTraits = Array.isArray(data) ? data : (data.mechanics || []);
                traitsById = new Map(streamerTraits.map(t => [t.id, t]));
                const container = document.getElementById('tr-trait-chips');
                if (container && streamerTraits.length) {
                    container.innerHTML = streamerTraits.map(t => `
                        <button class="tr-trait-chip" data-trait="${esc(t.name)}" onclick="tSetTrait('${esc(t.name)}')">${esc(t.display_name || t.name)}</button>
                    `).join('');
                }
            } catch (e) { console.warn('[Trading] loadTraitChips error:', e); }
        })();
        return traitChipsPromise;
    }

    /* ── Load listings ───────────────────────────────────────────────────────── */
    async function loadListings(resetPage = true) {
        if (resetPage) page = 0;
        const grid = document.getElementById('tr-grid');
        if (grid) grid.innerHTML = `<div class="tr-empty"><i class="bx bx-loader-alt" style="animation:spin 0.8s linear infinite;"></i><span>Loading…</span></div>`;

        const p = new URLSearchParams({
            streamer_id: streamer.id,
            page: String(page),
            limit: String(PAGE_SIZE),
            sort,
        });
        if (searchQuery) p.set('search', searchQuery);
        if (traitFilter) p.set('trait', traitFilter);
        if (viewingMine && currentUser) p.set('mine', '1');

        try {
            // Wait for the trait catalogue so listing trait dots can be hydrated with names/icons.
            const [res] = await Promise.all([
                fetch(`${BACKEND}/api/market/listings?${p}`, { credentials: 'include' }),
                loadTraitChips(),
            ]);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            listings = (data.listings || []).map(l => ({
                ...l,
                card: l.card ? { ...l.card, trait_list: hydrateTraits(l.card.trait_list) } : l.card,
            }));
            hasMore  = data.has_more || false;
            renderGrid();
            renderPagination(data.total || 0);
        } catch (e) {
            if (grid) grid.innerHTML = `<div class="tr-empty"><i class="bx bx-error-circle"></i><span>Failed to load listings.</span></div>`;
        }
    }

    /* ── Render grid ─────────────────────────────────────────────────────────── */
    function renderGrid() {
        const grid = document.getElementById('tr-grid');
        if (!grid) return;
        if (!listings.length) {
            grid.innerHTML = `<div class="tr-empty"><i class="bx bxs-card"></i><span>${viewingMine ? 'You have no active listings.' : 'Nothing listed yet — be the first!'}</span></div>`;
            return;
        }
        grid.innerHTML = listings.map(listing => {
            const card   = listing.card || {};
            const img    = cardImg(card);
            const rColor = rarityColor(card.rarity);
            const isOwn  = currentUser && listing.lister_twitch_id === currentUser.twitch_id;
            const onclick = isOwn ? `tOpenOffersReceived('${listing.id}')` : `tOpenOfferModal('${listing.id}')`;

            const traitDots = (card.trait_list || []).slice(0, 4).map(t => `
                <div class="tr-trait-dot" style="border-color:${esc(t.color||'rgba(255,255,255,0.15)')};" title="${esc(t.display_name||t.name||'')}">
                    ${t.icon_url ? `<img src="${esc(t.icon_url)}" alt="">` : `<span style="font-size:7px;color:${esc(t.color||'#888')}">${esc((t.display_name||t.name||'').slice(0,2).toUpperCase())}</span>`}
                </div>`).join('');

            return `
                <div class="tr-card" onclick="${onclick}" title="${isOwn ? 'View offers' : 'Make an offer'}">
                    <div class="tr-card-img" style="box-shadow:0 8px 28px rgba(0,0,0,0.5);">
                        ${img ? `<img src="${esc(img)}" alt="${esc(card.name||'')}" loading="lazy">` : `<div class="tr-placeholder"><i class="bx bxs-image"></i></div>`}
                        ${isOwn ? `<div class="tr-mine-badge">Yours</div>` : ''}
                    </div>
                    <div class="tr-card-meta">
                        ${traitDots ? `<div class="tr-card-traits">${traitDots}</div>` : ''}
                        <div class="tr-card-name">${esc(card.name || '—')}</div>
                        <div class="tr-card-rarity" style="color:${rColor};">${esc(card.rarity || '')}</div>
                    </div>
                </div>`;
        }).join('');
    }

    function renderPagination(total) {
        const ind  = document.getElementById('tr-page-indicator');
        const prev = document.getElementById('tr-prev-btn');
        const next = document.getElementById('tr-next-btn');
        if (ind) {
            if (total) {
                const s = page * PAGE_SIZE + 1;
                const e = Math.min((page + 1) * PAGE_SIZE, total);
                ind.textContent = `${s}–${e} of ${total}`;
            } else {
                ind.textContent = '';
            }
        }
        if (prev) prev.disabled = page <= 0;
        if (next) next.disabled = !hasMore;
    }

    /* ── Sort / filter (public) ──────────────────────────────────────────────── */
    window.tSetSort = function(s) {
        sort = s;
        document.querySelectorAll('.tr-sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === s));
        loadListings();
    };

    window.tOnSearch = function(v) {
        searchQuery = v.trim();
        clearTimeout(tOnSearch._t);
        tOnSearch._t = setTimeout(() => loadListings(), 320);
    };

    window.tSetTrait = function(name) {
        traitFilter = traitFilter === name ? null : name;
        document.querySelectorAll('.tr-trait-chip').forEach(c => c.classList.toggle('active', c.dataset.trait === traitFilter));
        loadListings();
    };

    window.tToggleSearch = function() {
        const p = document.getElementById('tr-search-panel');
        if (!p) return;
        p.classList.toggle('open');
        const btn = document.getElementById('tr-btn-search');
        if (btn) btn.classList.toggle('active', p.classList.contains('open'));
        if (p.classList.contains('open')) setTimeout(() => document.getElementById('tr-search-input')?.focus(), 280);
    };

    window.tToggleTraits = function() {
        const p = document.getElementById('tr-traits-panel');
        const ch = document.getElementById('tr-traits-chevron');
        if (!p) return;
        p.classList.toggle('open');
        const btn = document.getElementById('tr-btn-traits');
        if (btn) btn.classList.toggle('active', p.classList.contains('open'));
        if (ch) ch.className = p.classList.contains('open') ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
        if (ch) ch.style.cssText = 'margin-left:auto;font-size:0.85rem;';
    };

    /* ── Pagination ──────────────────────────────────────────────────────────── */
    window.tPrevPage = function() { if (page > 0) { page--; loadListings(false); } };
    window.tNextPage = function() { if (hasMore) { page++; loadListings(false); } };

    /* ── My listings toggle ──────────────────────────────────────────────────── */
    window.tViewMyListings = function() {
        if (!currentUser) { toast('Sign in to see your listings.', 'error'); return; }
        viewingMine = !viewingMine;
        const btn = document.getElementById('tr-btn-mine');
        if (btn) btn.classList.toggle('active', viewingMine);
        document.getElementById('tr-page-title').textContent = viewingMine ? 'Your Listings' : 'Market';
        loadListings();
    };

    /* ── Helpers: card picker HTML ───────────────────────────────────────────── */
    function pickerCardHTML(c, onclickFn) {
        const img    = cardImg(c);
        const rColor = rarityColor(c.rarity);
        const traits = Array.isArray(c.trait_list) ? c.trait_list : [];
        const traitChips = traits.slice(0, 6).map(t => {
            const label = t.display_name || t.name || '';
            const color = t.color || '';
            return `<span class="tr-picker-hover-trait" style="${color ? `border-color:${esc(color)};color:${esc(color)};` : ''}">
                ${t.icon_url ? `<img src="${esc(t.icon_url)}" alt="">` : ''}${esc(label)}
            </span>`;
        }).join('');
        return `
            <div class="tr-picker-card" data-id="${c.user_card_id}" onclick="${onclickFn}('${c.user_card_id}')">
                ${img ? `<img src="${esc(img)}" alt="${esc(c.name||'')}" loading="lazy">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="bx bxs-image" style="font-size:2rem;color:rgba(255,255,255,0.1);"></i></div>`}
                <div class="tr-picker-rarity" style="color:${rColor};">${esc(c.rarity||'')}</div>
                <div class="tr-picker-hover">
                    <div class="tr-picker-hover-name">${esc(c.name || 'Unknown')}</div>
                    <div class="tr-picker-hover-rarity" style="color:${rColor};">${esc(c.rarity || '')}</div>
                    ${traitChips ? `<div class="tr-picker-hover-traits">${traitChips}</div>` : ''}
                </div>
            </div>`;
    }

    // Client-side filter. Matches name, rarity, or any trait name/display_name/slug.
    // Trait chip selection is AND across chips (card must have every selected trait).
    function filterListCards() {
        const q = listSearchQuery.trim().toLowerCase();
        const selected = listTraitFilter;
        return myCards.filter(c => {
            if (selected.size) {
                const cardTraitNames = new Set((c.trait_list || []).map(t => (t.name || '').toLowerCase()));
                for (const t of selected) if (!cardTraitNames.has(t.toLowerCase())) return false;
            }
            if (!q) return true;
            if ((c.name || '').toLowerCase().includes(q)) return true;
            if ((c.rarity || '').toLowerCase().includes(q)) return true;
            return (c.trait_list || []).some(t =>
                (t.name || '').toLowerCase().includes(q) ||
                (t.display_name || '').toLowerCase().includes(q)
            );
        });
    }

    function renderListGrid() {
        const grid  = document.getElementById('tr-list-grid');
        const count = document.getElementById('tr-list-count');
        if (!grid) return;
        const filtered = filterListCards();
        if (count) count.textContent = filtered.length === myCards.length
            ? `${myCards.length} card${myCards.length === 1 ? '' : 's'}`
            : `${filtered.length} of ${myCards.length} cards`;
        if (!filtered.length) {
            grid.innerHTML = emptyHTML(myCards.length ? 'No cards match your filters.' : 'No available cards to list in this hub.');
            return;
        }
        grid.innerHTML = filtered.map(c => pickerCardHTML(c, 'tSelectListCard')).join('');
        // Re-apply selection highlight if the selected card is still in the filtered view
        if (selectedListCardId) {
            grid.querySelectorAll('.tr-picker-card').forEach(el => {
                if (el.dataset.id === selectedListCardId) el.classList.add('selected');
            });
        }
    }

    // Render trait filter chips based on traits that ACTUALLY appear on the user's cards
    // (intersected with the streamer's trait catalogue so we keep the display_name/color).
    function renderListTraitChips() {
        const container = document.getElementById('tr-list-trait-chips');
        if (!container) return;
        const presentNames = new Set();
        myCards.forEach(c => (c.trait_list || []).forEach(t => t.name && presentNames.add(t.name)));
        if (!presentNames.size) { container.innerHTML = ''; return; }

        // Prefer streamer catalogue order; fall back to trait_list data if mechanics didn't load
        const byName = new Map();
        streamerTraits.forEach(t => byName.set(t.name, t));
        myCards.forEach(c => (c.trait_list || []).forEach(t => {
            if (t.name && !byName.has(t.name)) byName.set(t.name, t);
        }));

        const chips = [];
        presentNames.forEach(name => {
            const t = byName.get(name) || { name, display_name: name };
            const active = listTraitFilter.has(name);
            chips.push(`<button type="button" class="tr-trait-chip${active ? ' active' : ''}" data-trait="${esc(name)}" onclick="tToggleListTrait('${esc(name)}')">${esc(t.display_name || t.name)}</button>`);
        });
        container.innerHTML = chips.join('');
    }

    window.tOnListSearch = function(v) {
        listSearchQuery = v || '';
        clearTimeout(tOnListSearch._t);
        tOnListSearch._t = setTimeout(renderListGrid, 120);
    };

    window.tToggleListTrait = function(name) {
        if (listTraitFilter.has(name)) listTraitFilter.delete(name);
        else listTraitFilter.add(name);
        renderListTraitChips();
        renderListGrid();
    };

    async function fetchMyCards() {
        const url = `${BACKEND}/api/market/my-cards?streamer_id=${encodeURIComponent(streamer.id)}&exclude_listed=1`;
        console.log('[Trading] fetchMyCards →', url);
        const res = await fetch(url, { credentials: 'include' });
        console.log('[Trading] fetchMyCards status:', res.status);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error('[Trading] fetchMyCards failed:', res.status, body);
            throw new Error(body || `HTTP ${res.status}`);
        }
        return res.json();
    }

    /* ── List a Card Modal ───────────────────────────────────────────────────── */
    window.tOpenListModal = async function() {
        if (!currentUser) { toast('Sign in to list cards.', 'error'); return; }
        selectedListCardId = null;
        listSearchQuery    = '';
        listTraitFilter    = new Set();

        const grid    = document.getElementById('tr-list-grid');
        const btn     = document.getElementById('tr-list-confirm');
        const search  = document.getElementById('tr-list-search');
        const chips   = document.getElementById('tr-list-trait-chips');
        const count   = document.getElementById('tr-list-count');
        if (grid)   grid.innerHTML = loadingHTML();
        if (btn)    btn.disabled = true;
        if (search) search.value = '';
        if (chips)  chips.innerHTML = '';
        if (count)  count.textContent = '';
        openModal('tr-list-modal');

        try {
            // Make sure the trait catalogue is loaded BEFORE we hydrate cards, otherwise
            // trait_list UUIDs get hydrated against an empty map and chips lose their labels.
            const [cards] = await Promise.all([fetchMyCards(), loadTraitChips()]);
            myCards = (cards || []).map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
        } catch (e) {
            console.error('[Trading] tOpenListModal error:', e);
            if (grid) grid.innerHTML = errorHTML(`Failed to load your cards: ${e.message || 'unknown error'}`);
            return;
        }
        renderListTraitChips();
        renderListGrid();
    };

    window.tSelectListCard = function(id) {
        selectedListCardId = id;
        document.querySelectorAll('#tr-list-grid .tr-picker-card').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
        document.getElementById('tr-list-confirm').disabled = false;
    };

    window.tConfirmList = async function() {
        if (!selectedListCardId) return;
        const btn = document.getElementById('tr-list-confirm');
        btn.disabled = true; btn.textContent = 'Listing…';
        try {
            await writeFetch(`${BACKEND}/api/market/listings`, {
                method: 'POST',
                body: JSON.stringify({ user_card_id: selectedListCardId, streamer_id: streamer.id }),
            });
            closeModal('tr-list-modal');
            toast('Card listed!', 'success');
            loadListings();
        } catch (e) {
            toast(e.message || 'Failed to list card.', 'error');
            btn.disabled = false; btn.textContent = 'List Selected Card';
        }
    };

    /* ── Offer Modal ─────────────────────────────────────────────────────────── */
    window.tOpenOfferModal = async function(listingId) {
        if (!currentUser) { toast('Sign in to make offers.', 'error'); return; }
        const listing = listings.find(l => l.id === listingId);
        if (listing?.lister_twitch_id === currentUser.twitch_id) { tOpenOffersReceived(listingId); return; }
        offerTargetListingId = listingId;
        selectedOfferCardId  = null;
        const grid = document.getElementById('tr-offer-grid');
        const btn  = document.getElementById('tr-offer-confirm');
        const sub  = document.getElementById('tr-offer-sub');
        if (btn) btn.disabled = true;
        if (sub && listing?.card?.name) sub.textContent = `Choose a card to offer for "${listing.card.name}".`;
        if (grid) grid.innerHTML = loadingHTML();
        openModal('tr-offer-modal');
        try {
            const [cards] = await Promise.all([fetchMyCards(), loadTraitChips()]);
            myCards = (cards || []).map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
        } catch (e) {
            console.error('[Trading] tOpenOfferModal error:', e);
            if (grid) grid.innerHTML = errorHTML(`Failed to load your cards: ${e.message || 'unknown error'}`);
            return;
        }
        if (!grid) return;
        if (!myCards.length) { grid.innerHTML = emptyHTML('You have no available cards to offer.'); return; }
        grid.innerHTML = myCards.map(c => pickerCardHTML(c, 'tSelectOfferCard')).join('');
    };

    window.tSelectOfferCard = function(id) {
        selectedOfferCardId = id;
        document.querySelectorAll('#tr-offer-grid .tr-picker-card').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
        document.getElementById('tr-offer-confirm').disabled = false;
    };

    window.tConfirmOffer = async function() {
        if (!selectedOfferCardId || !offerTargetListingId) return;
        const btn = document.getElementById('tr-offer-confirm');
        btn.disabled = true; btn.textContent = 'Submitting…';
        try {
            await writeFetch(`${BACKEND}/api/market/offers`, {
                method: 'POST',
                body: JSON.stringify({ listing_id: offerTargetListingId, offered_user_card_id: selectedOfferCardId }),
            });
            closeModal('tr-offer-modal');
            toast('Offer sent!', 'success');
        } catch (e) {
            toast(e.message || 'Failed to submit offer.', 'error');
            btn.disabled = false; btn.textContent = 'Submit Offer';
        }
    };

    /* ── Offers Received Modal ───────────────────────────────────────────────── */
    window.tOpenOffersReceived = async function(listingId) {
        if (!currentUser) return;
        viewingListingId = listingId;
        const list = document.getElementById('tr-offers-list');
        const sub  = document.getElementById('tr-offers-sub');
        if (list) list.innerHTML = loadingHTML();
        const listing = listings.find(l => l.id === listingId);
        if (sub && listing?.card?.name) sub.textContent = `Offers on your listing: "${listing.card.name}"`;
        openModal('tr-offers-modal');
        try {
            const res = await fetch(`${BACKEND}/api/market/listings/${encodeURIComponent(listingId)}/offers`, { credentials: 'include' });
            if (!res.ok) throw new Error(await res.text());
            const offers = await res.json();
            if (!list) return;
            if (!offers.length) { list.innerHTML = emptyHTML('No offers yet.'); return; }
            list.innerHTML = offers.map(o => {
                const card   = o.card || {};
                const img    = cardImg(card);
                const rColor = rarityColor(card.rarity);
                const exp    = o.expires_at ? new Date(o.expires_at).toLocaleDateString() : '—';
                return `
                    <div class="tr-offer-row">
                        ${img ? `<img src="${esc(img)}" alt="${esc(card.name||'')}">` : `<div style="width:44px;height:62px;background:rgba(255,255,255,0.04);border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bx bxs-image" style="color:rgba(255,255,255,0.1);"></i></div>`}
                        <div class="tr-offer-info">
                            <div class="tr-offer-name">${esc(card.name || 'Unknown')}</div>
                            <div class="tr-offer-meta" style="color:${rColor};">${esc(card.rarity || '')}</div>
                            <div class="tr-offer-meta">From <strong>${esc(o.offerer_username || o.offerer_twitch_id || '?')}</strong></div>
                            <div class="tr-offer-meta">Expires ${esc(exp)}</div>
                        </div>
                        <button class="tr-btn-accept" onclick="tAcceptOffer('${o.id}',this)">Accept</button>
                    </div>`;
            }).join('');
        } catch {
            if (list) list.innerHTML = errorHTML('Failed to load offers.');
        }
    };

    window.tAcceptOffer = async function(offerId, btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'Accepting…'; }
        try {
            await writeFetch(`${BACKEND}/api/market/offers/${encodeURIComponent(offerId)}/accept`, { method: 'POST' });
            closeModal('tr-offers-modal');
            toast('Trade complete! Cards swapped.', 'success');
            loadListings();
        } catch (e) {
            toast(e.message || 'Failed to accept offer.', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Accept'; }
        }
    };

    window.tCancelMyListing = async function() {
        if (!viewingListingId || !confirm('Cancel this listing? All pending offers will be rejected.')) return;
        try {
            await writeFetch(`${BACKEND}/api/market/listings/${encodeURIComponent(viewingListingId)}`, { method: 'DELETE' });
            closeModal('tr-offers-modal');
            toast('Listing cancelled.', 'success');
            loadListings();
        } catch (e) {
            toast(e.message || 'Failed to cancel listing.', 'error');
        }
    };

    /* ── Modal helpers ───────────────────────────────────────────────────────── */
    function openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'flex';
        requestAnimationFrame(() => el.classList.add('open'));
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('open');
        setTimeout(() => { el.style.display = 'none'; }, 260);
    }

    window.tCloseModal = closeModal;

    /* ── State HTML snippets ─────────────────────────────────────────────────── */
    function loadingHTML() {
        return `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;padding:40px;color:var(--void-muted);"><i class="bx bx-loader-alt" style="font-size:1.5rem;animation:spin 0.8s linear infinite;"></i></div>`;
    }
    function emptyHTML(msg) {
        return `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--void-muted);font-size:0.75rem;">${esc(msg)}</div>`;
    }
    function errorHTML(msg) {
        return `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#f87171;font-size:0.75rem;">${esc(msg)}</div>`;
    }

    /* ── Wishlist Matches ────────────────────────────────────────────────────── */
    async function openWishlistMatches() {
        const modal = document.getElementById('tr-wishlist-modal');
        const list  = document.getElementById('tr-wishlist-list');
        if (!modal || !list) return;

        list.innerHTML = loadingHTML();
        modal.style.display = 'flex';
        modal.classList.add('open');

        try {
            const res = await fetch(`${BACKEND}/api/trade/wishlist-matches`, { credentials: 'include' });
            if (res.status === 401) { list.innerHTML = emptyHTML('Sign in to find trading partners'); return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const matches = data.matches || [];

            if (!matches.length) {
                list.innerHTML = emptyHTML('No matches yet — add cards to your wishlist and collect more cards to unlock mutual matches');
                return;
            }

            list.innerHTML = matches.map(m => {
                const cardPreviews = (m.they_have || []).slice(0, 3).map(c =>
                    c.image_url
                        ? `<img src="${esc(c.image_url)}" title="${esc(c.name)}" style="width:32px;height:44px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.08)">`
                        : `<div style="width:32px;height:44px;border-radius:4px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:var(--void-muted)">${esc(c.name?.slice(0,3)||'?')}</div>`
                ).join('');
                return `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
                    <img src="${esc(m.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${m.username}`)}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;flex-shrink:0">
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:700;font-size:0.75rem;color:var(--void-text);text-transform:uppercase;letter-spacing:0.04em">${esc(m.username)}</div>
                        <div style="font-size:0.6rem;color:var(--void-muted);margin-top:2px">Has ${m.they_have?.length||0} cards you want · You have ${m.i_have_count} they want</div>
                        <div style="display:flex;gap:4px;margin-top:6px">${cardPreviews}</div>
                    </div>
                    <button onclick="window.location.href='/trading?streamer=${encodeURIComponent(streamerSlug)}';" style="font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:var(--void-text);cursor:pointer;white-space:nowrap" title="Copy trade code: ${esc(m.trade_code)}" onclick="navigator.clipboard?.writeText('${esc(m.trade_code)}')">
                        ${esc(m.trade_code)}
                    </button>
                </div>`;
            }).join('');
        } catch (e) {
            list.innerHTML = errorHTML(e.message || 'Failed to load matches');
        }
    }

    window.tOpenWishlistMatches = openWishlistMatches;

    /* ── Keyboard shortcuts ──────────────────────────────────────────────────── */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') ['tr-list-modal','tr-offer-modal','tr-offers-modal','tr-wishlist-modal'].forEach(closeModal);
        if (e.key === 'ArrowLeft'  && !e.target.closest('input')) tPrevPage();
        if (e.key === 'ArrowRight' && !e.target.closest('input')) tNextPage();
    });

    /* ── Boot ────────────────────────────────────────────────────────────────── */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
