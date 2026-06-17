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
    const traitFilters = new Set();  // selected mechanic UUIDs + optional 'genesis' token (multi-select, OR)
    const rarityFilters = new Set();  // selected rarities (multi-select, OR)
    let setFilter      = null;  // lowercased set_name
    let viewingMine    = false;
    const PAGE_SIZE    = 10;

    let myCards               = [];
    const selectedListCardIds = new Set();   // multi-select for bulk listing
    const LIST_BULK_MAX       = 50;          // matches the server cap on /api/market/listings/bulk
    let offerTargetListingId  = null;
    let selectedOfferCardId   = null;
    let viewingListingId      = null;
    let detailListingId       = null;

    // Streamer's full trait catalogue (from /api/mechanics) — used to render filter chips
    // and to hydrate user_cards.trait_list (which is stored as a bare array of mechanic UUIDs).
    let streamerTraits        = [];
    let traitsById            = new Map(); // UUID → { id, name, display_name, icon, ... }
    let traitChipsPromise     = null;       // awaitable so the modal can wait for the catalogue
    // Picker filter state (battle-style rarity chips + trait chips + search) for both popups.
    const listFilters         = { rarity: new Set(), traits: new Set(), query: '' };
    const offerFilters        = { rarity: new Set(), traits: new Set(), query: '' };
    let catalogPage           = 0;
    const CATALOG_PAGE_SIZE   = 15;

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
        const map = { legendary: '#fbbf24', epic: '#a855f7', rare: '#3faaff', uncommon: '#34d399', common: '#64748b' };
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
        if (res.status === 401) throw new Error('Session expired — please sign in again.');
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
        try { renderAuthStatus(); }   catch (e) { console.error('[Trading] renderAuthStatus error:', e); }
        try { restorePanelStates(); } catch (e) { console.error('[Trading] restorePanelStates error:', e); }
        try { restoreFilters(); }     catch (e) { console.error('[Trading] restoreFilters error:', e); }

        // Trait chips, conveyor belt, and listings run in parallel.
        loadTraitChips().catch(e => console.warn('[Trading] trait chips error:', e));
        loadConveyor().catch(e => console.warn('[Trading] loadConveyor error:', e));

        console.log('[Trading] calling loadListings()');
        loadListings();

        // Notification deep links: ?view_offers=<id> opens the offers you received on a
        // listing; ?listing=<id> opens that card's detail (e.g. from a wishlist-match alert).
        handleNotifDeepLink().catch(e => console.warn('[Trading] deep link error:', e));
    }

    async function handleNotifDeepLink() {
        const q = new URLSearchParams(window.location.search);
        const viewOffers = q.get('view_offers');
        const listingId  = q.get('listing');
        if (!viewOffers && !listingId) return;

        // Strip the params so a manual refresh doesn't reopen the modal.
        try {
            q.delete('view_offers'); q.delete('listing');
            const qs = q.toString();
            history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
        } catch {}

        if (viewOffers) {
            window.tOpenOffersReceived?.(viewOffers);
            return;
        }
        if (listingId) {
            // Make sure the listing is available even if it isn't on the current page/filters.
            let found = listings.find(l => l.id === listingId);
            if (!found) {
                try {
                    const res = await fetch(`${BACKEND}/api/market/listings/${encodeURIComponent(listingId)}`, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data?.listing) { listings.unshift(data.listing); found = data.listing; }
                    }
                } catch {}
            }
            if (found) window.tOpenCardDetail?.(listingId);
        }
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
        const accent = streamer.brand_color_primary || '#3faaff';
        document.documentElement.style.setProperty('--page-accent', accent);
        const r = parseInt(accent.slice(1, 3), 16) || 0;
        const g = parseInt(accent.slice(3, 5), 16) || 242;
        const b = parseInt(accent.slice(5, 7), 16) || 254;
        document.documentElement.style.setProperty('--page-accent-rgb', `${r}, ${g}, ${b}`);

        const name = streamer.brand_name || streamer.username || streamerSlug;
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
                const to = setTimeout(() => ctrl.abort(), 8000);
                const res = await fetch(`${BACKEND}/api/mechanics?streamer=${encodeURIComponent(streamer.id)}`, { credentials: 'include', signal: ctrl.signal });
                clearTimeout(to);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                streamerTraits = Array.isArray(data) ? data : (data.mechanics || []);
                traitsById = new Map(streamerTraits.map(t => [t.id, t]));
                const container = document.getElementById('tr-trait-chips');
                if (container) {
                    const genesisChip = `<button class="tr-trait-chip" data-trait="genesis" onclick="tSetTrait('genesis')">Genesis</button>`;
                    container.innerHTML = genesisChip + streamerTraits.map(t => `
                        <button class="tr-trait-chip" data-trait="${esc(t.id)}" onclick="tSetTrait('${esc(t.id)}')">${esc(t.display_name || t.name)}</button>
                    `).join('');
                    container.querySelectorAll('.tr-trait-chip[data-trait]').forEach(c =>
                        c.classList.toggle('active', traitFilters.has(c.dataset.trait)));
                }
                // Catalogue is now available — re-render listings so any trait dots that
                // rendered as raw IDs (before the catalogue loaded) resolve to names/icons.
                if (listings.length) renderGrid();
            } catch (e) {
                console.warn('[Trading] loadTraitChips error:', e);
                traitChipsPromise = null; // don't poison the session — allow a retry on the next call
            }
        })();
        return traitChipsPromise;
    }

    /* ── Conveyor belt ───────────────────────────────────────────────────────── */
    let beltCatalog  = [];
    let beltSets     = [];
    let catalogSorted = [];

    async function loadConveyor() {
        if (!streamerSlug) return;
        const track = document.getElementById('tr-belt-track');
        if (!track) return;

        const res = await fetch(`${BACKEND}/api/public/collection-page?streamer=${encodeURIComponent(streamerSlug)}`);
        if (!res.ok) return;
        const data = await res.json();
        beltCatalog = (data.catalog || []).filter(c => c.image_url);
        beltSets    = (data.sets   || []).filter(s => s.name);

        renderSetChips();

        if (beltCatalog.length < 2) return;

        const cardItems = beltCatalog.map((c, i) =>
            `<div class="tr-belt-card" data-belt-idx="${i}" onclick="tBeltCardPeek(${i},this)" title="${esc(c.name || 'View card')}"><img src="${esc(c.image_url)}" alt="${esc(c.name || '')}" loading="lazy"></div>`
        );

        // Tile enough cards so one set is wider than the viewport, then duplicate for seamless loop.
        const CARD_STEP = 81;
        const minCount = Math.ceil((window.innerWidth || 1440) / CARD_STEP) + 4;
        const repeats = Math.max(1, Math.ceil(minCount / cardItems.length));
        const oneSet = Array.from({ length: repeats }, () => cardItems).flat().join('');
        track.innerHTML = oneSet + oneSet;
    }

    /* ── Belt card peek popup ────────────────────────────────────────────────── */
    let _beltWishlist = null; // null = not loaded yet

    async function fetchBeltWishlist() {
        if (_beltWishlist !== null) return _beltWishlist;
        try {
            const res = await fetch(`${BACKEND}/api/viewer/profile/wishlist`, { credentials: 'include' });
            if (res.ok) { const d = await res.json(); _beltWishlist = Array.isArray(d.items) ? d.items : []; }
            else _beltWishlist = [];
        } catch (_) { _beltWishlist = []; }
        return _beltWishlist;
    }

    function closeBeltPeek() {
        const pop = document.getElementById('tr-belt-peek');
        if (pop) pop.remove();
        const track = document.getElementById('tr-belt-track');
        if (track) track.style.animationPlayState = '';
        document.querySelectorAll('.tr-belt-card.peek-active').forEach(el => el.classList.remove('peek-active'));
    }

    window.tBeltCardPeek = function(idx, el) {
        const card = beltCatalog[idx % beltCatalog.length];
        if (!card) return;

        // If already open for same card, close and bail.
        const existing = document.getElementById('tr-belt-peek');
        if (existing && existing.dataset.idx === String(idx % beltCatalog.length)) { closeBeltPeek(); return; }
        closeBeltPeek();

        el.classList.add('peek-active');
        const track = document.getElementById('tr-belt-track');
        if (track) track.style.animationPlayState = 'paused';

        const rarityColors = { legendary: '#f59e0b', epic: '#a855f7', rare: '#3b82f6', uncommon: '#22c55e', common: '#6b7280' };
        const rarityKey = (card.rarity || '').toLowerCase();
        const rarityColor = rarityColors[rarityKey] || '#6b7280';

        const pop = document.createElement('div');
        pop.id = 'tr-belt-peek';
        pop.dataset.idx = String(idx % beltCatalog.length);
        pop.style.cssText = [
            'position:fixed;z-index:1500;',
            'background:rgba(10,10,18,0.97);',
            'border:1px solid rgba(255,255,255,0.12);',
            'border-radius:16px;',
            'box-shadow:0 16px 48px rgba(0,0,0,0.7);',
            'padding:14px;width:180px;',
            'display:flex;flex-direction:column;gap:8px;',
            'backdrop-filter:blur(12px);',
        ].join('');

        const rect = el.getBoundingClientRect();
        pop.innerHTML = `
            <div style="display:flex;gap:10px;align-items:center;">
                <img src="${esc(card.image_url)}" alt="" style="width:44px;height:62px;object-fit:cover;border-radius:6px;border:2px solid ${rarityColor};flex-shrink:0;">
                <div style="min-width:0;">
                    <p style="font-size:11px;font-weight:800;color:#fff;line-height:1.2;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(card.name)}">${esc(card.name)}</p>
                    <p style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${rarityColor};margin:3px 0 0;">${esc(card.rarity || '')}</p>
                </div>
            </div>
            <button id="tr-belt-peek-search" style="width:100%;padding:7px 0;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">
                Search Market
            </button>
            <button id="tr-belt-peek-wish" style="width:100%;padding:7px 0;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">
                Add to Wishlist
            </button>
            <button id="tr-belt-peek-catalog" style="width:100%;padding:7px 0;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">
                View All Cards
            </button>`;

        document.body.appendChild(pop);

        // Position below the card, clamped to viewport.
        const popW = 180, popH = 170;
        let left = rect.left + rect.width / 2 - popW / 2;
        let top  = rect.bottom + 8;
        left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
        if (top + popH > window.innerHeight - 8) top = rect.top - popH - 8;
        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';

        pop.querySelector('#tr-belt-peek-search').addEventListener('click', function() {
            closeBeltPeek();
            window.tOnSearch(card.name);
            const searchEl = document.getElementById('tr-search-input');
            if (searchEl) { searchEl.value = card.name; searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        });

        pop.querySelector('#tr-belt-peek-wish').addEventListener('click', async function() {
            const btn = this;
            if (!currentUser) { toast('Sign in to wishlist cards', 'error'); closeBeltPeek(); return; }
            btn.disabled = true;
            btn.textContent = 'Saving…';
            const items = await fetchBeltWishlist();
            const already = items.some(i => i.card_id === card.card_id || i.card_id === card.id);
            if (already) {
                btn.textContent = 'Already wishlisted';
                setTimeout(closeBeltPeek, 1200);
                return;
            }
            const newItem = {
                card_id:           String(card.card_id || card.id || ''),
                name:              String(card.name || ''),
                image_url:         String(card.image_url || ''),
                rarity:            String(card.rarity || 'Common'),
                brand_name:        String(card.brand_name || streamer?.brand_name || streamer?.username || ''),
                set_name:          String(card.set_name || ''),
                streamer_username: String(streamer?.username || ''),
            };
            _beltWishlist = [...items, newItem].slice(0, 20);
            try {
                const res = await writeFetch(`${BACKEND}/api/viewer/profile/wishlist`, {
                    method: 'POST',
                    body: JSON.stringify({ items: _beltWishlist }),
                });
                if (res && res.ok) { toast(`${card.name} added to wishlist`, 'success'); }
                else { toast('Failed to save wishlist', 'error'); _beltWishlist = null; }
            } catch (_) { toast('Failed to save wishlist', 'error'); _beltWishlist = null; }
            closeBeltPeek();
        });

        pop.querySelector('#tr-belt-peek-catalog').addEventListener('click', function() {
            closeBeltPeek();
            tOpenCatalog();
        });

        setTimeout(() => document.addEventListener('click', function outsideClick(e) {
            if (!pop.contains(e.target) && !el.contains(e.target)) { closeBeltPeek(); document.removeEventListener('click', outsideClick); }
        }), 50);
    };

    function renderSetChips() {
        const container = document.getElementById('tr-set-chips');
        if (!container) return;
        if (!beltSets.length) {
            container.closest('.tr-sidebar-filter')?.remove();
            return;
        }
        container.innerHTML = beltSets.map(s => {
            const key = s.name.toLowerCase();
            return `<button class="tr-trait-chip" data-set="${esc(key)}" onclick="tSetSet('${esc(key)}')">${esc(s.name)}</button>`;
        }).join('');
        container.querySelectorAll('[data-set]').forEach(c =>
            c.classList.toggle('active', c.dataset.set === setFilter));
    }

    /* ── Catalog modal ───────────────────────────────────────────────────────── */
    window.tOpenCatalog = function() {
        catalogPage = 0;
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
        catalogSorted = [...beltCatalog].sort((a, b) =>
            (rarityOrder[(a.rarity || '').toLowerCase()] ?? 9) - (rarityOrder[(b.rarity || '').toLowerCase()] ?? 9)
        );
        const countEl = document.getElementById('tr-catalog-count');
        if (countEl) countEl.textContent = `${catalogSorted.length} card${catalogSorted.length !== 1 ? 's' : ''}`;
        renderCatalogGrid();
        openModal('tr-catalog-modal');
    };

    function renderCatalogGrid() {
        const grid = document.getElementById('tr-catalog-grid');
        if (!grid) return;
        const start = catalogPage * CATALOG_PAGE_SIZE;
        const slice = catalogSorted.slice(start, start + CATALOG_PAGE_SIZE);
        grid.innerHTML = slice.map(c => `
            <div class="tr-picker-card">
                <img src="${esc(c.image_url)}" alt="${esc(c.name || '')}" loading="lazy">
                <div class="tr-picker-rarity" style="color:${rarityColor(c.rarity)};">${esc(c.rarity || '')}</div>
                <div class="tr-picker-hover">
                    <div style="font-size:0.62rem;font-weight:700;color:#fff;text-align:center;">${esc(c.name || '')}</div>
                </div>
            </div>`).join('');
        renderPager('tr-catalog-pager', catalogPage, catalogSorted.length, CATALOG_PAGE_SIZE);
    }

    window.tCatalogPagePrev = function() {
        if (catalogPage > 0) { catalogPage--; renderCatalogGrid(); }
    };
    window.tCatalogPageNext = function() {
        if ((catalogPage + 1) * CATALOG_PAGE_SIZE < catalogSorted.length) { catalogPage++; renderCatalogGrid(); }
    };

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
        if (traitFilters.size) p.set('trait', [...traitFilters].join(','));
        if (rarityFilters.size) p.set('rarity', [...rarityFilters].join(','));
        if (setFilter)    p.set('set_name', setFilter);
        if (viewingMine && currentUser) p.set('mine', '1');

        try {
            // Wait for the trait catalogue so listing trait dots can be hydrated with names/icons.
            const [res] = await Promise.all([
                fetch(`${BACKEND}/api/market/listings?${p}`, { credentials: 'include' }),
                loadTraitChips(),
            ]);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            // Keep trait_list as raw mechanic IDs and hydrate at render time, so dots
            // resolve correctly even if the trait catalogue arrives after the listings
            // (and so a cold/empty catalogue can't bake a permanent fallback).
            listings = data.listings || [];
            hasMore  = data.has_more || false;
            renderGrid();
            renderPagination(data.total || 0);
            // Cold-start safety net: if the catalogue wasn't ready, retry so the trait
            // dots (currently showing raw IDs) self-heal via renderGrid() on success.
            if (!traitsById.size) loadTraitChips().catch(() => {});
        } catch (e) {
            if (grid) grid.innerHTML = `<div class="tr-empty"><i class="bx bx-error-circle"></i><span>Failed to load listings.</span></div>`;
        }
    }

    // After listing a card from anywhere, jump to the real-time "Your Listings" view so it
    // shows immediately (the public market path is KV-cached for ~15s).
    function afterListed() {
        if (!viewingMine) {
            viewingMine = true;
            const mineBtn = document.getElementById('tr-btn-mine');
            if (mineBtn) mineBtn.classList.remove('active');
            const label = document.getElementById('tr-mine-label');
            if (label) label.textContent = 'Back to market';
            const titleEl = document.getElementById('tr-page-title');
            if (titleEl) titleEl.textContent = 'Your Listings';
        }
        loadListings();
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

            const traitDots = hydrateTraits(card.trait_list).slice(0, 4).map(t => `
                <div class="tr-trait-dot" style="border-color:${esc(t.color||'rgba(255,255,255,0.15)')};" title="${esc(t.display_name||t.name||'')}">
                    ${t.icon_url ? `<img src="${esc(t.icon_url)}" alt="">` : `<span style="font-size:7px;color:${esc(t.color||'#888')}">${esc((t.display_name||t.name||'').slice(0,2).toUpperCase())}</span>`}
                </div>`).join('');

            return `
                <div class="tr-card" onclick="tOpenCardDetail('${listing.id}')" title="View card">
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
        saveFilters();
        loadListings();
    };

    window.tOnSearch = function(v) {
        searchQuery = v.trim();
        saveFilters();
        clearTimeout(tOnSearch._t);
        tOnSearch._t = setTimeout(() => loadListings(), 320);
    };

    window.tSetTrait = function(id) {
        if (traitFilters.has(id)) traitFilters.delete(id); else traitFilters.add(id);
        document.querySelectorAll('.tr-trait-chip[data-trait]').forEach(c =>
            c.classList.toggle('active', traitFilters.has(c.dataset.trait)));
        saveFilters();
        loadListings();
    };

    // Sidebar filter panels remember their open/closed state across refreshes (localStorage).
    const PANELS = [
        ['tr-traits-panel', 'tr-btn-traits', 'tr-traits-chevron'],
        ['tr-rarity-panel', 'tr-btn-rarity', 'tr-rarity-chevron'],
        ['tr-set-panel',    'tr-btn-set',    'tr-set-chevron'],
    ];

    function setPanelOpen(panelId, btnId, chevronId, open) {
        const p = document.getElementById(panelId);
        if (!p) return;
        p.classList.toggle('open', open);
        const btn = btnId ? document.getElementById(btnId) : null;
        if (btn) btn.classList.toggle('active', open);
        const ch = chevronId ? document.getElementById(chevronId) : null;
        if (ch) {
            ch.className = open ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
            ch.style.cssText = 'margin-left:auto;font-size:0.85rem;';
        }
    }

    function togglePanel(panelId, btnId, chevronId) {
        const p = document.getElementById(panelId);
        if (!p) return;
        const open = !p.classList.contains('open');
        setPanelOpen(panelId, btnId, chevronId, open);
        try { localStorage.setItem(`tr-panel:${panelId}`, open ? '1' : '0'); } catch {}
    }

    function restorePanelStates() {
        PANELS.forEach(([panelId, btnId, chevronId]) => {
            let saved = null;
            try { saved = localStorage.getItem(`tr-panel:${panelId}`); } catch {}
            if (saved === '1') setPanelOpen(panelId, btnId, chevronId, true);
        });
    }

    window.tToggleTraits  = () => togglePanel('tr-traits-panel',  'tr-btn-traits',  'tr-traits-chevron');
    window.tToggleRarity  = () => togglePanel('tr-rarity-panel',  'tr-btn-rarity',  'tr-rarity-chevron');
    window.tToggleSet     = () => togglePanel('tr-set-panel',     'tr-btn-set',     'tr-set-chevron');

    // Per-rarity colours. c = base/text colour, b = idle border, t = contrasting text when filled.
    const RARITY_STYLE = {
        legendary: { c: '#fbbf24', b: 'rgba(251,191,36,0.3)',  t: '#1a1205' },
        epic:      { c: '#a855f7', b: 'rgba(168,85,247,0.3)',  t: '#ffffff' },
        rare:      { c: '#3faaff', b: 'rgba(63,170,255,0.3)',  t: '#06243a' },
        uncommon:  { c: '#34d399', b: 'rgba(52,211,153,0.3)',  t: '#05231a' },
        common:    { c: '#64748b', b: 'rgba(100,116,139,0.3)', t: '#ffffff' },
    };

    function applyRarityChipStyle(c) {
        const s = RARITY_STYLE[c.dataset.rarity];
        if (!s) return;
        if (rarityFilters.has(c.dataset.rarity)) {
            c.style.background  = s.c;
            c.style.color       = s.t;
            c.style.borderColor = s.c;
        } else {
            c.style.background  = 'transparent';
            c.style.color       = s.c;
            c.style.borderColor = s.b;
        }
    }

    window.tSetRarity = function(r) {
        if (rarityFilters.has(r)) rarityFilters.delete(r); else rarityFilters.add(r);
        document.querySelectorAll('.tr-rarity-chip').forEach(applyRarityChipStyle);
        saveFilters();
        loadListings();
    };

    window.tSetSet = function(s) {
        setFilter = setFilter === s ? null : s;
        document.querySelectorAll('[data-set]').forEach(c =>
            c.classList.toggle('active', c.dataset.set === setFilter));
        saveFilters();
        loadListings();
    };

    // Browse filters (search, sort, traits, rarity, set) persist per-streamer across refreshes.
    const filtersKey = () => `tr-filters:${streamerSlug}`;

    function saveFilters() {
        try {
            localStorage.setItem(filtersKey(), JSON.stringify({
                sort,
                search: searchQuery,
                traits: [...traitFilters],
                rarity: [...rarityFilters],
                set:    setFilter,
            }));
        } catch {}
    }

    function restoreFilters() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(filtersKey()) || 'null'); } catch {}
        if (!saved) return;
        if (saved.sort) sort = saved.sort;
        if (typeof saved.search === 'string') searchQuery = saved.search;
        if (Array.isArray(saved.traits)) saved.traits.forEach(t => traitFilters.add(t));
        if (Array.isArray(saved.rarity)) saved.rarity.forEach(r => rarityFilters.add(r));
        if (saved.set) setFilter = saved.set;
        syncFilterUI();
    }

    // Reflect the current filter state onto every control. Trait/set chips render
    // asynchronously, so their render functions also apply active state directly.
    function syncFilterUI() {
        const searchInput = document.getElementById('tr-search-input');
        if (searchInput) searchInput.value = searchQuery;
        document.querySelectorAll('.tr-sort-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.sort === sort));
        document.querySelectorAll('.tr-rarity-chip').forEach(applyRarityChipStyle);
        document.querySelectorAll('.tr-trait-chip[data-trait]').forEach(c =>
            c.classList.toggle('active', traitFilters.has(c.dataset.trait)));
        document.querySelectorAll('[data-set]').forEach(c =>
            c.classList.toggle('active', c.dataset.set === setFilter));
    }

    window.tClearFilters = function() {
        traitFilters.clear();
        rarityFilters.clear();
        setFilter   = null;
        searchQuery = '';
        sort        = 'recent';
        try { localStorage.removeItem(filtersKey()); } catch {}
        syncFilterUI();
        loadListings();
    };

    /* ── Pagination ──────────────────────────────────────────────────────────── */
    window.tPrevPage = function() { if (page > 0) { page--; loadListings(false); } };
    window.tNextPage = function() { if (hasMore) { page++; loadListings(false); } };

    /* ── My listings toggle ──────────────────────────────────────────────────── */
    window.tViewMyListings = function() {
        if (!currentUser) { toast('Sign in to see your listings.', 'error'); return; }
        viewingMine = !viewingMine;
        const btn = document.getElementById('tr-btn-mine');
        if (btn) btn.classList.remove('active');
        const label = document.getElementById('tr-mine-label');
        if (label) label.textContent = viewingMine ? 'Back to market' : 'Your listings';
        document.getElementById('tr-page-title').textContent = viewingMine ? 'Your Listings' : 'Market';
        loadListings();
    };

    /* ── Your Trade Pile modal — cards flagged via "Send to Trade" in binder/packs ─ */
    let pileCards = [];

    async function fetchTradePile() {
        const res = await fetch(`${BACKEND}/api/market/trade-pile?streamer_id=${encodeURIComponent(streamer.id)}`, { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text().catch(() => '') || `HTTP ${res.status}`);
        return res.json();
    }

    function pileTileHTML(c) {
        const img    = cardImg(c);
        const rColor = rarityColor(c.rarity);
        const traits = Array.isArray(c.trait_list) ? c.trait_list : [];
        const imgEl  = img
            ? `<img src="${esc(img)}" alt="${esc(c.name || '')}" loading="lazy">`
            : `<div class="tr-deck-img-fallback"><i class="bx bxs-image"></i></div>`;
        const id = esc(c.user_card_id);
        const listBtn = c.is_listed
            ? `<button class="tr-pile-btn tr-pile-btn--listed" disabled>Listed</button>`
            : `<button class="tr-pile-btn tr-pile-btn--list" onclick="tPileList('${id}')">List</button>`;
        return `
            <div class="tr-deck-card tr-deck-card--static" data-id="${id}">
                <div class="tr-deck-img-wrap">
                    ${imgEl}
                    ${traits.length ? `<div class="tr-deck-traits">${deckTraitPips(traits)}</div>` : ''}
                </div>
                <div class="tr-deck-name">${esc(c.name || 'Unknown')}</div>
                <div class="tr-deck-rarity" style="color:${rColor};">${esc(c.rarity || '')}</div>
                <div class="tr-pile-actions">
                    ${listBtn}
                    <button class="tr-pile-btn tr-pile-btn--remove" onclick="tPileRemove('${id}')">Remove</button>
                </div>
            </div>`;
    }

    function renderTradePile() {
        const grid  = document.getElementById('tr-pile-grid');
        const count = document.getElementById('tr-pile-count');
        if (!grid) return;
        const types = new Set(pileCards.map(cardBaseKey)).size;
        if (count) count.textContent = pileCards.length
            ? `${pileCards.length} card${pileCards.length === 1 ? '' : 's'} · ${types} type${types === 1 ? '' : 's'}`
            : '';
        if (!pileCards.length) {
            grid.innerHTML = emptyHTML('Nothing in your trade pile yet. Open a pack or right-click a card in your binder and choose "Send to Trade".');
            return;
        }
        const groups = new Map();
        pileCards.forEach(c => {
            const k = cardBaseKey(c);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(c);
        });
        grid.innerHTML = [...groups.entries()]
            .sort((a, b) => (a[1][0].name || '').localeCompare(b[1][0].name || ''))
            .map(([, inst]) => {
                const header = `<div class="tr-deck-group-header">${esc(inst[0].name || 'Unknown')}<span>${inst.length}</span></div>`;
                return header + inst.map(pileTileHTML).join('');
            }).join('');
    }

    window.tOpenTradePile = async function() {
        if (!currentUser) { toast('Sign in to view your trade pile.', 'error'); return; }
        const grid  = document.getElementById('tr-pile-grid');
        const count = document.getElementById('tr-pile-count');
        if (grid)  grid.innerHTML = loadingHTML();
        if (count) count.textContent = '';
        openModal('tr-pile-modal');
        try {
            const [cards] = await Promise.all([fetchTradePile(), loadTraitChips()]);
            pileCards = (cards || []).map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
            renderTradePile();
        } catch (e) {
            console.error('[Trading] tOpenTradePile error:', e);
            if (grid) grid.innerHTML = errorHTML(`Failed to load your trade pile: ${e.message || 'unknown error'}`);
        }
    };

    window.tPileList = async function(id) {
        try {
            await writeFetch(`${BACKEND}/api/market/listings`, {
                method: 'POST',
                body: JSON.stringify({ user_card_id: id, streamer_id: streamer.id }),
            });
            // Listed — drop from the pile so it doesn't linger as "to list".
            await writeFetch(`${BACKEND}/api/market/trade-pile`, {
                method: 'POST',
                body: JSON.stringify({ user_card_id: id, in_pile: false }),
            }).catch(() => {});
            pileCards = pileCards.filter(c => c.user_card_id !== id);
            renderTradePile();
            toast('Card listed!', 'success');
            afterListed();
        } catch (e) {
            toast(e.message || 'Failed to list card.', 'error');
        }
    };

    window.tPileRemove = async function(id) {
        try {
            await writeFetch(`${BACKEND}/api/market/trade-pile`, {
                method: 'POST',
                body: JSON.stringify({ user_card_id: id, in_pile: false }),
            });
            pileCards = pileCards.filter(c => c.user_card_id !== id);
            renderTradePile();
            toast('Removed from trade pile.', 'success');
        } catch (e) {
            toast(e.message || 'Failed to remove from pile.', 'error');
        }
    };

    /* ── Helpers: card picker HTML ───────────────────────────────────────────── */
    function cardBaseKey(c) { return c.template_id || c.name || c.user_card_id; }

    /* ── Battle-style picker filters (rarity chips + trait chips + search) ──────── */
    function pickerTraitKey(t) {
        if (!t) return null;
        return (t.display_name || t.name || '').toLowerCase().trim() || null;
    }

    function cardMatchesPickerFilters(c, f) {
        if (f.rarity.size && !f.rarity.has((c.rarity || '').toLowerCase())) return false;
        if (f.traits.size) {
            const keys = (Array.isArray(c.trait_list) ? c.trait_list : []).map(pickerTraitKey).filter(Boolean);
            let ok = false;
            f.traits.forEach(k => { if (keys.includes(k)) ok = true; });
            if (!ok) return false;
        }
        const q = (f.query || '').toLowerCase().trim();
        if (q && !(c.name || '').toLowerCase().includes(q)) return false;
        return true;
    }

    // Build trait chips from the distinct traits present across the user's cards.
    function buildPickerTraitRow(rowId, filters, onChange) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const seen = new Map();
        myCards.forEach(c => (Array.isArray(c.trait_list) ? c.trait_list : []).forEach(t => {
            const key = pickerTraitKey(t);
            if (!key || seen.has(key)) return;
            seen.set(key, { key, label: t.display_name || t.name || key, icon: t.icon_url || '' });
        }));
        row.querySelectorAll('.bt-filter-chip').forEach(el => el.remove());
        [...seen.values()].sort((a, b) => a.label.localeCompare(b.label)).forEach(t => {
            const isUrl = t.icon && (t.icon.startsWith('/') || t.icon.startsWith('http'));
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bt-filter-chip';
            btn.dataset.trait = t.key;
            btn.innerHTML = (isUrl ? `<img src="${esc(t.icon)}" alt="">` : (t.icon ? `<span>${esc(t.icon)}</span>` : '')) + `<span>${esc(t.label)}</span>`;
            if (filters.traits.has(t.key)) btn.classList.add('active');
            btn.addEventListener('click', () => {
                if (filters.traits.has(t.key)) filters.traits.delete(t.key); else filters.traits.add(t.key);
                btn.classList.toggle('active');
                onChange();
            });
            row.appendChild(btn);
        });
    }

    function wirePickerRarityRow(rowId, filters, onChange) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.querySelectorAll('.bt-filter-chip[data-rarity]').forEach(btn => {
            btn.onclick = () => {
                const r = btn.dataset.rarity;
                if (filters.rarity.has(r)) filters.rarity.delete(r); else filters.rarity.add(r);
                btn.classList.toggle('active');
                onChange();
            };
        });
    }

    function wirePickerSearch(inputId, toggleId, filters, onChange) {
        const input  = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        if (input) {
            input.oninput = () => {
                filters.query = input.value;
                clearTimeout(input._t);
                input._t = setTimeout(onChange, 120);
            };
        }
        if (toggle && input) {
            toggle.onclick = () => {
                const collapsed = input.classList.toggle('collapsed');
                toggle.classList.toggle('active', !collapsed);
                if (!collapsed) { setTimeout(() => input.focus(), 60); }
                else { input.value = ''; filters.query = ''; onChange(); }
            };
        }
    }

    function resetPickerFilterUI(prefix, filters) {
        filters.rarity.clear(); filters.traits.clear(); filters.query = '';
        document.querySelectorAll(`#tr-${prefix}-filters .bt-filter-chip.active`).forEach(c => c.classList.remove('active'));
        const input = document.getElementById(`tr-${prefix}-search`);
        if (input) { input.value = ''; input.classList.add('collapsed'); }
        document.getElementById(`tr-${prefix}-search-toggle`)?.classList.remove('active');
    }

    // Filter individual cards by the active picker filters (rarity chips + traits + search)
    function filterListCards() {
        return myCards.filter(c => cardMatchesPickerFilters(c, listFilters));
    }

    // Battle-deck-style tile: card image with trait pips overlaid, name + rarity below.
    // Used by the List a Card picker for both stacked base cards (data-key) and instances (data-id).
    function deckTraitPips(traits) {
        return (traits || []).slice(0, 3).map(t => {
            const label = esc(t.display_name || t.name || '');
            const icon  = t.icon_url || '';
            const inner = icon ? `<img src="${esc(icon)}" alt="">` : esc((label[0] || '?'));
            return `<div class="tr-deck-pip" title="${label}">${inner}</div>`;
        }).join('');
    }

    function deckCardTileHTML({ card, dataKey, dataId, onclick, count }) {
        const img    = cardImg(card);
        const rColor = rarityColor(card.rarity);
        const traits = Array.isArray(card.trait_list) ? card.trait_list : [];
        const imgEl  = img
            ? `<img src="${esc(img)}" alt="${esc(card.name||'')}" loading="lazy">`
            : `<div class="tr-deck-img-fallback"><i class="bx bxs-image"></i></div>`;
        const attr   = dataId ? `data-id="${esc(dataId)}"` : `data-key="${esc(dataKey)}"`;
        const badge  = count > 1 ? `<div class="tr-deck-copies">×${count}</div>` : '';
        const rarityLine = `${esc(card.rarity || '')}${count > 1 ? ` · ${count} owned` : ''}`;
        const clickAttr  = onclick ? ` onclick="${onclick}"` : '';
        return `
            <div class="tr-deck-card${onclick ? '' : ' tr-deck-card--static'}" ${attr}${clickAttr}>
                <div class="tr-deck-img-wrap">
                    ${imgEl}
                    ${badge}
                    ${traits.length ? `<div class="tr-deck-traits">${deckTraitPips(traits)}</div>` : ''}
                </div>
                <div class="tr-deck-name">${esc(card.name || 'Unknown')}</div>
                <div class="tr-deck-rarity" style="color:${rColor};">${rarityLine}</div>
            </div>`;
    }

    // Render every instance as its own tile, clustered by card — all copies of one card
    // sit together under a small group header (e.g. all Bogmires, then all Bogs).
    function groupedInstancesHTML(cards, onclickFn) {
        const groups = new Map();
        cards.forEach(c => {
            const k = cardBaseKey(c);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(c);
        });
        return [...groups.entries()]
            .sort((a, b) => (a[1][0].name || '').localeCompare(b[1][0].name || ''))
            .map(([, inst]) => {
                const header = `<div class="tr-deck-group-header">${esc(inst[0].name || 'Unknown')}<span>${inst.length}</span></div>`;
                const tiles = inst.map(c => deckCardTileHTML({
                    card: c,
                    dataId: c.user_card_id,
                    onclick: onclickFn ? `${onclickFn}('${c.user_card_id}')` : '',
                })).join('');
                return header + tiles;
            }).join('');
    }

    function markSelectedTile(gridId, selectedId) {
        if (!selectedId) return;
        document.querySelectorAll(`#${gridId} .tr-deck-card`).forEach(el => {
            el.classList.toggle('selected', el.dataset.id === selectedId);
        });
    }

    function renderListGrid() {
        const grid  = document.getElementById('tr-list-grid');
        const count = document.getElementById('tr-list-count');
        if (!grid) return;
        const cards = filterListCards();
        const types = new Set(cards.map(cardBaseKey)).size;
        if (count) count.textContent = cards.length
            ? `${cards.length} card${cards.length === 1 ? '' : 's'} · ${types} type${types === 1 ? '' : 's'}`
            : '';
        if (!cards.length) {
            grid.innerHTML = emptyHTML(myCards.length ? 'No cards match these filters.' : 'No available cards to list in this hub.');
            return;
        }
        grid.innerHTML = groupedInstancesHTML(cards, 'tSelectListCard');
        updateListSelectionUI();
    }

    // Reflect the multi-select state onto the grid tiles + the confirm button label.
    function updateListSelectionUI() {
        document.querySelectorAll('#tr-list-grid .tr-deck-card').forEach(el =>
            el.classList.toggle('selected', selectedListCardIds.has(el.dataset.id)));
        const btn = document.getElementById('tr-list-confirm');
        if (!btn) return;
        const n = selectedListCardIds.size;
        btn.disabled = n === 0;
        btn.textContent = n === 0 ? 'List Selected'
            : n === 1 ? 'List 1 Card'
            : `List ${n} Cards`;
    }

    async function fetchMyCards(excludeListed = true) {
        const url = `${BACKEND}/api/market/my-cards?streamer_id=${encodeURIComponent(streamer.id)}${excludeListed ? '&exclude_listed=1' : ''}`;
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
        selectedListCardIds.clear();

        const grid       = document.getElementById('tr-list-grid');
        const btn        = document.getElementById('tr-list-confirm');
        const count      = document.getElementById('tr-list-count');
        if (grid)       grid.innerHTML = loadingHTML();
        if (btn)        { btn.disabled = true; btn.textContent = 'List Selected'; }
        if (count)      count.textContent = '';
        resetPickerFilterUI('list', listFilters);
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
        const onListFilterChange = () => renderListGrid();
        wirePickerRarityRow('tr-list-rarity-row', listFilters, onListFilterChange);
        wirePickerSearch('tr-list-search', 'tr-list-search-toggle', listFilters, onListFilterChange);
        buildPickerTraitRow('tr-list-trait-row', listFilters, onListFilterChange);
        renderListGrid();
    };

    window.tSelectListCard = function(id) {
        if (selectedListCardIds.has(id)) {
            selectedListCardIds.delete(id);
        } else {
            if (selectedListCardIds.size >= LIST_BULK_MAX) {
                toast(`You can list up to ${LIST_BULK_MAX} cards at once.`, 'error');
                return;
            }
            selectedListCardIds.add(id);
        }
        updateListSelectionUI();
    };

    window.tConfirmList = async function() {
        const ids = [...selectedListCardIds];
        if (!ids.length) return;
        const btn = document.getElementById('tr-list-confirm');
        btn.disabled = true; btn.textContent = ids.length > 1 ? `Listing ${ids.length}…` : 'Listing…';
        try {
            // One batched request — the server validates ownership, skips already-listed
            // cards, inserts in a single query, and busts the cache once.
            const res = await writeFetch(`${BACKEND}/api/market/listings/bulk`, {
                method: 'POST',
                body: JSON.stringify({ user_card_ids: ids, streamer_id: streamer.id }),
            });
            const data    = await res.json().catch(() => ({}));
            const listed  = data.listed  ?? ids.length;
            const skipped = data.skipped ?? 0;
            closeModal('tr-list-modal');
            selectedListCardIds.clear();
            toast(
                skipped ? `${listed} listed · ${skipped} skipped (already listed)`
                        : `${listed} card${listed === 1 ? '' : 's'} listed!`,
                'success'
            );
            afterListed();
        } catch (e) {
            toast(e.message || 'Failed to list cards.', 'error');
            updateListSelectionUI();
        }
    };

    /* ── Card Detail Modal ───────────────────────────────────────────────────── */
    /* ── Card Inspect: 3D flip + holographic + tilt (ported from binder) ──────── */
    const CARD_DETAIL_DRAG_FOIL = {
        rare:      { maxH: 0.28, maxS: 0.34, idleH: 0.12, idleS: 0.18, tilt: 15 },
        epic:      { maxH: 0.36, maxS: 0.42, idleH: 0.16, idleS: 0.24, tilt: 16 },
        legendary: { maxH: 0.46, maxS: 0.50, idleH: 0.22, idleS: 0.30, tilt: 18 },
    };

    function inspectNormalizeRarity(card) {
        const raw = String(card?.rarity || '').trim().toLowerCase();
        if (!raw) return 'common';
        if (raw.includes('legend') || raw === 'test') return 'legendary';
        if (raw.startsWith('epic')) return 'epic';
        if (raw.startsWith('rare')) return 'rare';
        return 'common';
    }

    function inspectSizeArt(imgW, imgH) {
        const scene = document.getElementById('card-detail-flip-scene');
        if (!scene) return;
        const aspect = (imgW && imgH && imgH > 0) ? imgW / imgH : 5 / 7;
        const maxH = Math.min(window.innerHeight * 0.7, 548);
        const maxW = Math.min(window.innerWidth * 0.92, 380);
        let h = maxH, w = h * aspect;
        if (w > maxW) { w = maxW; h = w / aspect; }
        scene.style.width  = `${Math.round(w)}px`;
        scene.style.height = `${Math.round(h)}px`;
        scene.style.aspectRatio = '';
    }

    function inspectResetTiltVisuals() {
        const scene = document.getElementById('card-detail-flip-scene');
        const tilt  = scene?.querySelector('.card-detail-tilt-wrap');
        if (tilt) { tilt.style.transition = ''; tilt.style.transform = ''; tilt.style.filter = ''; }
        if (scene) {
            ['--holo-o','--shine-o','--foil-x','--foil-y','--foil-angle'].forEach(p => scene.style.removeProperty(p));
            scene.classList.remove('is-card-tilting');
        }
    }

    function inspectToggleFlip(event) {
        if (event?.stopPropagation) event.stopPropagation();
        const scene = document.getElementById('card-detail-flip-scene');
        if (!scene) return;
        scene.classList.toggle('is-flipped');
        scene.setAttribute('aria-pressed', scene.classList.contains('is-flipped') ? 'true' : 'false');
    }

    function inspectInitInteraction() {
        const scene = document.getElementById('card-detail-flip-scene');
        if (!scene || scene.__pointerBound) return;
        const tiltWrap = scene.querySelector('.card-detail-tilt-wrap');
        if (!tiltWrap) return;
        scene.__pointerBound = true;

        const TAP_MOVE_LIMIT_PX = 5;
        let dragging = false, engagedDrag = false, startX = 0, startY = 0, maxDist = 0;

        function readTiltVars() {
            if (scene.classList.contains('holo-legendary')) return CARD_DETAIL_DRAG_FOIL.legendary;
            if (scene.classList.contains('holo-epic'))      return CARD_DETAIL_DRAG_FOIL.epic;
            if (scene.classList.contains('holo-rare'))      return CARD_DETAIL_DRAG_FOIL.rare;
            return { maxH: 0.22, maxS: 0.50, idleH: 0, idleS: 0, tilt: 12 };
        }
        function applyTilt(clientX, clientY, light = false) {
            const r = scene.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
            const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
            const p = readTiltVars();
            const rx = (0.5 - y) * p.tilt * (light ? 0.55 : 1);
            const ry = (x - 0.5) * p.tilt * (light ? 0.55 : 1);
            tiltWrap.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
            scene.classList.add('is-card-tilting');
            scene.style.setProperty('--foil-x', String(x));
            scene.style.setProperty('--foil-y', String(y));
            scene.style.setProperty('--foil-angle', String((x - 0.5) * 32));
            const dist = Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 1.9);
            scene.style.setProperty('--holo-o',  String(p.idleH + (p.maxH - p.idleH) * dist));
            scene.style.setProperty('--shine-o', String(p.idleS + (p.maxS - p.idleS) * dist));
        }
        function resetTilt() {
            const p = readTiltVars();
            tiltWrap.style.transition = 'transform 300ms cubic-bezier(0.22,1,0.36,1)';
            tiltWrap.style.transform = '';
            setTimeout(() => { tiltWrap.style.transition = ''; }, 320);
            scene.classList.remove('is-card-tilting');
            scene.style.setProperty('--foil-x', '0.5');
            scene.style.setProperty('--foil-y', '0.5');
            scene.style.setProperty('--foil-angle', '0');
            scene.style.setProperty('--holo-o',  String(p.idleH || 0));
            scene.style.setProperty('--shine-o', String(p.idleS || 0));
        }

        scene.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            dragging = true; engagedDrag = false; maxDist = 0;
            startX = e.clientX; startY = e.clientY;
            scene.setPointerCapture?.(e.pointerId);
        });
        scene.addEventListener('pointermove', e => {
            if (!dragging) return;
            maxDist = Math.max(maxDist, Math.hypot(e.clientX - startX, e.clientY - startY));
            if (maxDist > TAP_MOVE_LIMIT_PX) { engagedDrag = true; applyTilt(e.clientX, e.clientY); }
        });
        function endPointer(e) {
            if (!dragging) return;
            dragging = false;
            try { scene.releasePointerCapture?.(e.pointerId); } catch {}
            resetTilt();
            if (!engagedDrag) inspectToggleFlip(e);
        }
        scene.addEventListener('pointerup', endPointer);
        scene.addEventListener('pointercancel', endPointer);
        scene.addEventListener('mousemove', e => { if (!dragging) applyTilt(e.clientX, e.clientY, true); });
        scene.addEventListener('mouseleave', () => { if (!dragging) resetTilt(); });
        scene.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspectToggleFlip(e); }
        });
    }

    function inspectHoloMaskStyle(url) {
        const ref = `url(${JSON.stringify(url && String(url).trim() ? String(url) : '')})`;
        return [
            `mask-image: ${ref}`, `-webkit-mask-image: ${ref}`,
            'mask-size: contain', '-webkit-mask-size: contain',
            'mask-position: center', '-webkit-mask-position: center',
            'mask-repeat: no-repeat', '-webkit-mask-repeat: no-repeat',
            'mask-mode: alpha', '-webkit-mask-mode: alpha',
        ].join('; ');
    }
    function inspectApplyHoloMask(url, alsoShine) {
        const hl = document.getElementById('card-detail-holo-layer');
        const hs = document.getElementById('card-detail-holo-shine');
        if (!hl) return;
        const style = inspectHoloMaskStyle(url);
        hl.setAttribute('style', style);
        if (alsoShine && hs) hs.setAttribute('style', style);
        else if (hs) hs.removeAttribute('style');
    }

    window.tCloseInspect = function() {
        const scene = document.getElementById('card-detail-flip-scene');
        if (scene) { scene.classList.remove('is-flipped'); scene.setAttribute('aria-pressed', 'false'); }
        inspectResetTiltVisuals();
        const modal = document.getElementById('card-detail-modal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            unlockScroll();
        }
    };

    window.tOpenCardDetail = function(listingId) {
        const listing = listings.find(l => l.id === listingId);
        if (!listing) return;
        detailListingId = listingId;

        const modal  = document.getElementById('card-detail-modal');
        if (!modal) return;
        const card   = listing.card || {};
        const imgUrl = cardImg(card);
        const rarity = inspectNormalizeRarity(card);
        const isHolo = ['rare', 'epic', 'legendary'].includes(rarity);
        const isOwn  = currentUser && listing.lister_twitch_id === currentUser.twitch_id;

        // Flip scene: reset + holo class + idle foil vars
        const scene = document.getElementById('card-detail-flip-scene');
        const tilt  = scene?.querySelector('.card-detail-tilt-wrap');
        if (tilt) { tilt.style.transition = ''; tilt.style.transform = ''; tilt.style.filter = ''; }
        if (scene) {
            scene.classList.remove('is-card-tilting', 'is-flipped', 'holo-rare', 'holo-epic', 'holo-legendary');
            scene.setAttribute('aria-pressed', 'false');
            if (isHolo) scene.classList.add(`holo-${rarity}`);
            const foil = CARD_DETAIL_DRAG_FOIL[rarity];
            scene.style.setProperty('--foil-x', '0.5');
            scene.style.setProperty('--foil-y', '0.5');
            scene.style.setProperty('--foil-angle', '0');
            scene.style.setProperty('--holo-o',  foil && isHolo ? String(foil.idleH) : '0');
            scene.style.setProperty('--shine-o', foil && isHolo ? String(foil.idleS) : '0');
        }

        // Holo layers (mask follows card art)
        const hl = document.getElementById('card-detail-holo-layer');
        const hs = document.getElementById('card-detail-holo-shine');
        if (hl) { hl.classList.add('hidden'); hl.removeAttribute('style'); }
        if (hs) { hs.classList.add('hidden'); hs.removeAttribute('style'); }
        if (isHolo && imgUrl) {
            inspectApplyHoloMask(imgUrl, true);
            if (hl) hl.classList.remove('hidden');
            if (hs) hs.classList.remove('hidden');
        }

        // Card image
        const img = document.getElementById('card-detail-image');
        if (img) {
            img.onload = function () { inspectSizeArt(this.naturalWidth, this.naturalHeight); };
            img.src = imgUrl || '';
        }
        inspectSizeArt();
        const backImg = document.getElementById('card-detail-back-image');
        if (backImg) backImg.onerror = function () { this.onerror = null; this.src = '/Castle_Default_Cardback.png'; };

        // Text fields
        const el = id => document.getElementById(id);
        if (el('card-detail-name'))        el('card-detail-name').textContent = card.name || '—';
        if (el('card-detail-rarity'))      { el('card-detail-rarity').textContent = card.rarity || '—'; el('card-detail-rarity').setAttribute('data-rarity', rarity); }
        if (el('card-detail-set'))         el('card-detail-set').textContent = card.set_name || '—';
        if (el('card-detail-description')) el('card-detail-description').textContent = card.description || 'No description available.';
        if (el('card-detail-attack'))      el('card-detail-attack').textContent  = card.attack  ?? 0;
        if (el('card-detail-defense'))     el('card-detail-defense').textContent = card.defense ?? 0;
        const cn = card.card_number;
        if (el('card-detail-number'))      el('card-detail-number').textContent = (cn != null && String(cn).trim() && String(cn).toLowerCase() !== 'null') ? String(cn) : '—';

        // Traits
        const traitsEl = el('tr-detail-traits');
        if (traitsEl) {
            const traits = hydrateTraits(card.trait_list);
            traitsEl.innerHTML = traits.map(t => {
                const label = esc(t.display_name || t.name || '');
                const style = t.color ? `border-color:${esc(t.color)};color:${esc(t.color)};` : '';
                const icon  = t.icon_url ? `<img src="${esc(t.icon_url)}" alt="">` : '';
                return `<span class="tr-detail-trait" style="${style}">${icon}${label}</span>`;
            }).join('') || '<span style="font-size:0.6rem;color:var(--void-muted)">No traits</span>';
        }

        // Lister row
        const listerEl = el('tr-detail-lister');
        if (listerEl) {
            const listedDate = listing.created_at ? new Date(listing.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
            if (isOwn) {
                listerEl.innerHTML = `<div class="tr-detail-lister-text">This is <strong>your listing</strong></div>`;
            } else {
                const lname   = listing.lister?.username || null;
                const lavatar = listing.lister?.avatar_url || '';
                if (lname) {
                    listerEl.innerHTML = `${lavatar ? `<img src="${esc(lavatar)}" alt="">` : ''}<div class="tr-detail-lister-text">Listed by <strong>${esc(lname)}</strong>${listedDate ? ` · ${listedDate}` : ''}</div>`;
                } else {
                    listerEl.innerHTML = `<div class="tr-detail-lister-text" style="color:var(--void-muted);font-size:0.58rem">Listed ${listedDate}</div>`;
                }
            }
        }

        // Buttons
        const offerBtn  = el('tr-detail-offer-btn');
        const cancelBtn = el('tr-detail-cancel-btn');
        if (offerBtn)  { offerBtn.textContent = isOwn ? 'View Offers' : 'Send Offer'; offerBtn.style.display = ''; }
        if (cancelBtn) cancelBtn.style.display = isOwn ? '' : 'none';

        inspectInitInteraction();
        const wasHidden = modal.classList.contains('hidden');
        modal.classList.remove('hidden');
        if (wasHidden) lockScroll();
    };

    window.tDetailOffer = function() {
        const id = detailListingId;
        if (!id) return;
        tCloseInspect();
        const listing = listings.find(l => l.id === id);
        const isOwn   = currentUser && listing?.lister_twitch_id === currentUser.twitch_id;
        if (isOwn) tOpenOffersReceived(id);
        else       tOpenOfferModal(id);
    };

    window.tDetailCancel = async function() {
        const id = detailListingId;
        if (!id) return;
        const btn = document.getElementById('tr-detail-cancel-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Cancelling…'; }
        try {
            await writeFetch(`${BACKEND}/api/market/listings/${id}`, { method: 'DELETE' });
            tCloseInspect();
            toast('Listing cancelled.', 'success');
            // Optimistic: drop it from the grid right away, then reconcile with the server.
            listings = listings.filter(l => l.id !== id);
            renderGrid();
            loadListings();
        } catch (e) {
            toast(e.message || 'Failed to cancel listing.', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Cancel Listing'; }
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
        resetPickerFilterUI('offer', offerFilters);
        openModal('tr-offer-modal');
        try {
            const [cards] = await Promise.all([fetchMyCards(), loadTraitChips()]);
            myCards = (cards || []).map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
        } catch (e) {
            console.error('[Trading] tOpenOfferModal error:', e);
            if (grid) grid.innerHTML = errorHTML(`Failed to load your cards: ${e.message || 'unknown error'}`);
            return;
        }
        const onOfferFilterChange = () => renderOfferGrid();
        wirePickerRarityRow('tr-offer-rarity-row', offerFilters, onOfferFilterChange);
        wirePickerSearch('tr-offer-search', 'tr-offer-search-toggle', offerFilters, onOfferFilterChange);
        buildPickerTraitRow('tr-offer-trait-row', offerFilters, onOfferFilterChange);
        renderOfferGrid();
    };

    function filteredOfferCards() {
        return myCards.filter(c => cardMatchesPickerFilters(c, offerFilters));
    }

    function renderOfferGrid() {
        const grid  = document.getElementById('tr-offer-grid');
        const count = document.getElementById('tr-offer-count');
        if (!grid) return;
        const cards = filteredOfferCards();
        const types = new Set(cards.map(cardBaseKey)).size;
        if (count) count.textContent = cards.length
            ? `${cards.length} card${cards.length === 1 ? '' : 's'} · ${types} type${types === 1 ? '' : 's'}`
            : '';
        if (!cards.length) {
            grid.innerHTML = emptyHTML(myCards.length ? 'No cards match these filters.' : 'You have no available cards to offer.');
            return;
        }
        grid.innerHTML = groupedInstancesHTML(cards, 'tSelectOfferCard');
        markSelectedTile('tr-offer-grid', selectedOfferCardId);
    }

    window.tSelectOfferCard = function(id) {
        selectedOfferCardId = id;
        document.querySelectorAll('#tr-offer-grid .tr-deck-card').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
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
            listings = listings.filter(l => l.id !== viewingListingId);
            renderGrid();
            loadListings();
        } catch (e) {
            toast(e.message || 'Failed to cancel listing.', 'error');
        }
    };

    /* ── Modal helpers ───────────────────────────────────────────────────────── */
    // Body scroll lock — reference-counted so stacked popups (e.g. an offer modal opened
    // from the card inspector) keep the page behind frozen until the LAST one closes.
    let _scrollLocks = 0;
    function lockScroll() {
        _scrollLocks++;
        document.body.style.overflow = 'hidden';
    }
    function unlockScroll() {
        _scrollLocks = Math.max(0, _scrollLocks - 1);
        if (_scrollLocks === 0) document.body.style.overflow = '';
    }

    function openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.classList.contains('open')) return; // already open — don't double-lock
        el.style.display = 'flex';
        requestAnimationFrame(() => el.classList.add('open'));
        lockScroll();
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!el.classList.contains('open')) return; // already closed — don't over-unlock
        el.classList.remove('open');
        setTimeout(() => { el.style.display = 'none'; }, 260);
        unlockScroll();
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

    function renderPager(pagerId, currentPage, total, pageSize) {
        const pager = document.getElementById(pagerId);
        if (!pager) return;
        const totalPages = Math.ceil(total / pageSize);
        pager.style.display = totalPages > 1 ? 'flex' : 'none';
        if (totalPages <= 1) return;
        const btns = pager.querySelectorAll('.tr-pager-btn');
        if (btns[0]) btns[0].disabled = currentPage <= 0;
        if (btns[1]) btns[1].disabled = currentPage >= totalPages - 1;
        const info = pager.querySelector('.tr-pager-info');
        if (info) info.textContent = `${currentPage + 1} / ${totalPages}`;
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
                const mutualBadge = m.mutual
                    ? `<span style="font-size:0.45rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:rgba(var(--void-accent-rgb),0.15);color:var(--void-accent);border:1px solid rgba(var(--void-accent-rgb),0.3)">Mutual</span>`
                    : '';
                const subline = m.mutual
                    ? `Has ${m.they_have?.length||0} cards you want · You have ${m.i_have_count} they want`
                    : `Has ${m.they_have?.length||0} cards you want`;
                return `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
                    <img src="${esc(m.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${m.username}`)}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;flex-shrink:0">
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:0.75rem;color:var(--void-text);text-transform:uppercase;letter-spacing:0.04em">${esc(m.username)}${mutualBadge}</div>
                        <div style="font-size:0.6rem;color:var(--void-muted);margin-top:2px">${subline}</div>
                        <div style="display:flex;gap:4px;margin-top:6px">${cardPreviews}</div>
                    </div>
                    <button onclick="tCloseModal('tr-wishlist-modal');tStartTradeWithCode('${esc(m.trade_code)}')" style="font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:6px 12px;border-radius:8px;border:1px solid rgba(var(--void-accent-rgb),0.3);background:rgba(var(--void-accent-rgb),0.12);color:var(--void-accent);cursor:pointer;white-space:nowrap" title="Start a direct trade (code: ${esc(m.trade_code)})">
                        <i class="bx bx-transfer-alt"></i> Trade
                    </button>
                </div>`;
            }).join('');
        } catch (e) {
            list.innerHTML = errorHTML(e.message || 'Failed to load matches');
        }
    }

    window.tOpenWishlistMatches = openWishlistMatches;

    /* ── Direct (peer-to-peer) Trades ────────────────────────────────────────── */
    // A separate system from the marketplace: two collectors swap cards one-to-one
    // using Castle Codes, via the /api/trade/* endpoints. Three-step flow:
    //   1. initiator offers cards (status 'pending')
    //   2. recipient counters with their own cards (offer-reply → 'offered')
    //   3. initiator confirms (respond accept → atomic swap) or either side rejects/cancels.
    let myTradeCode        = '';
    let directTrades       = [];
    let builderMode        = 'init';   // 'init' (new offer) | 'reply' (counter)
    let builderTargetCode  = '';
    let builderTradeId     = null;
    const builderMine      = new Set(); // user_card_ids I'm putting up

    // These endpoints resolve their streamer via query param, mirroring the marketplace calls.
    function tradeStreamerParam() {
        return streamer?.id ? `?streamer_id=${encodeURIComponent(streamer.id)}` : '';
    }

    window.tOpenDirectTrades = function() {
        if (!currentUser) { toast('Sign in to trade directly.', 'error'); return; }
        openModal('tr-direct-modal');
        fetchMyTradeCode();
        fetchDirectTrades();
    };

    async function fetchMyTradeCode() {
        const el = document.getElementById('tr-direct-mycode');
        try {
            const res = await fetch(`${BACKEND}/api/trade/code`, { credentials: 'include' });
            if (res.ok) myTradeCode = (await res.json())?.trade_code || '';
        } catch { /* leave blank — start-trade still works */ }
        if (el) el.textContent = myTradeCode || '—';
    }

    window.tCopyMyCode = function() {
        if (!myTradeCode) return;
        navigator.clipboard?.writeText(myTradeCode);
        toast('Castle Code copied!', 'success');
    };

    async function fetchDirectTrades() {
        const list = document.getElementById('tr-direct-list');
        if (list) list.innerHTML = loadingHTML();
        try {
            const res = await fetch(`${BACKEND}/api/trades${tradeStreamerParam()}`, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            directTrades = (await res.json()) || [];
            renderDirectTrades();
        } catch (e) {
            if (list) list.innerHTML = errorHTML(e.message || 'Failed to load trades.');
        }
    }

    function tradeCardThumbs(items) {
        if (!items.length) return `<span class="tr-direct-empty-cards">—</span>`;
        return items.map(it => {
            const c   = it.card || {};
            const img = cardImg({ ...c, user_card_id: c.user_card_id || it.user_card_id });
            return img
                ? `<img src="${esc(img)}" title="${esc(c.name || '')}" class="tr-direct-thumb" loading="lazy">`
                : `<div class="tr-direct-thumb tr-direct-thumb--empty">${esc((c.name || '?').slice(0, 2))}</div>`;
        }).join('');
    }

    function renderDirectTrades() {
        const list = document.getElementById('tr-direct-list');
        if (!list) return;
        // Only surface live negotiations; terminal trades just add noise.
        const active = directTrades.filter(t => t.status === 'pending' || t.status === 'offered');
        if (!active.length) {
            list.innerHTML = emptyHTML('No active trades. Enter a Castle Code above to start one.');
            return;
        }
        const me = String(currentUser.twitch_id);
        list.innerHTML = active.map(t => {
            const iAmSender   = String(t.sender_id) === me;
            const iAmReceiver = String(t.receiver_id) === me;
            const other       = iAmSender ? t.receiver : t.sender;
            const mine        = (t.items || []).filter(i => String(i.owner_id) === me);
            const theirs      = (t.items || []).filter(i => String(i.owner_id) !== me);
            const meta = ({
                pending: { c: '#fbbf24', label: 'Initial Offer' },
                offered: { c: '#a855f7', label: 'Offer Received' },
            })[t.status] || { c: '#94a3b8', label: t.status };

            let actions = '';
            if (t.status === 'pending') {
                actions = iAmReceiver
                    ? `<button class="tr-btn-primary" onclick="tPrepareReply('${esc(t.id)}')">Counter Offer</button>
                       <button class="tr-btn-danger" onclick="tRespondTrade('${esc(t.id)}','reject',this)">Reject</button>`
                    : `<button class="tr-btn-danger" onclick="tRespondTrade('${esc(t.id)}','cancel',this)">Cancel</button>`;
            } else if (t.status === 'offered') {
                actions = iAmSender
                    ? `<button class="tr-btn-primary" onclick="tRespondTrade('${esc(t.id)}','accept',this)">Confirm Trade</button>
                       <button class="tr-btn-danger" onclick="tRespondTrade('${esc(t.id)}','cancel',this)">Cancel</button>`
                    : `<button class="tr-btn-danger" onclick="tRespondTrade('${esc(t.id)}','reject',this)">Reject</button>`;
            }

            const avatar = other?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(other?.username || '?')}`;
            return `
            <div class="tr-direct-row">
                <div class="tr-direct-row-head">
                    <div class="tr-direct-party">
                        <img src="${esc(avatar)}" class="tr-direct-avatar" alt="">
                        <div>
                            <div class="tr-direct-dir">${iAmSender ? 'To' : 'From'}</div>
                            <div class="tr-direct-name">${esc(other?.username || 'Unknown')}</div>
                        </div>
                    </div>
                    <span class="tr-direct-status" style="color:${meta.c}">${esc(meta.label)}</span>
                </div>
                <div class="tr-direct-swap">
                    <div class="tr-direct-side">
                        <div class="tr-direct-side-label">You give</div>
                        <div class="tr-direct-thumbs">${tradeCardThumbs(mine)}</div>
                    </div>
                    <i class="bx bx-transfer tr-direct-swap-icon"></i>
                    <div class="tr-direct-side">
                        <div class="tr-direct-side-label">You get</div>
                        <div class="tr-direct-thumbs">${tradeCardThumbs(theirs)}</div>
                    </div>
                </div>
                ${actions ? `<div class="tr-direct-actions">${actions}</div>` : ''}
            </div>`;
        }).join('');
    }

    window.tRespondTrade = async function(tradeId, action, btn) {
        if ((action === 'reject' || action === 'cancel')
            && !confirm(`${action === 'reject' ? 'Reject' : 'Cancel'} this trade?`)) return;
        if (btn) btn.disabled = true;
        try {
            await writeFetch(`${BACKEND}/api/trade/respond${tradeStreamerParam()}`, {
                method: 'POST',
                body: JSON.stringify({ trade_id: tradeId, action }),
            });
            toast(action === 'accept' ? 'Trade complete! Cards swapped.' : `Trade ${action}ed.`, 'success');
            fetchDirectTrades();
        } catch (e) {
            toast(e.message || 'Action failed.', 'error');
            if (btn) btn.disabled = false;
        }
    };

    /* ── Trade builder (pick cards to offer / counter) ───────────────────────── */
    function updateBuilderSend() {
        const btn   = document.getElementById('tr-builder-send');
        const count = document.getElementById('tr-builder-mine-count');
        if (count) count.textContent = builderMine.size ? `${builderMine.size} selected` : '';
        if (!btn) return;
        btn.disabled    = builderMine.size === 0;
        btn.textContent = builderMode === 'reply' ? 'Send Counter Offer' : 'Send Trade Offer';
    }

    function renderBuilderMine() {
        const grid = document.getElementById('tr-builder-mine-grid');
        if (!grid) return;
        if (!myCards.length) {
            grid.innerHTML = emptyHTML('You have no available cards to trade in this hub.');
            return;
        }
        grid.innerHTML = groupedInstancesHTML(myCards, 'tToggleBuilderMine');
        grid.querySelectorAll('.tr-deck-card').forEach(el =>
            el.classList.toggle('selected', builderMine.has(el.dataset.id)));
        updateBuilderSend();
    }

    window.tToggleBuilderMine = function(id) {
        if (builderMine.has(id)) builderMine.delete(id); else builderMine.add(id);
        document.querySelectorAll('#tr-builder-mine-grid .tr-deck-card').forEach(el =>
            el.classList.toggle('selected', builderMine.has(el.dataset.id)));
        updateBuilderSend();
    };

    // Read-only display of the other party's cards (their collection, or their incoming offer).
    function renderBuilderTheirs(cards) {
        const grid = document.getElementById('tr-builder-theirs-grid');
        if (!grid) return;
        if (!cards.length) { grid.innerHTML = emptyHTML('No cards to show.'); return; }
        const hydrated = cards.map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
        grid.innerHTML = groupedInstancesHTML(hydrated, null);
    }

    async function loadMyCardsForBuilder() {
        const cards = await fetchMyCards();
        myCards = (cards || []).map(c => ({ ...c, trait_list: hydrateTraits(c.trait_list) }));
    }

    window.tStartTrade = function() {
        const input = document.getElementById('tr-direct-code-input');
        tStartTradeWithCode(input?.value || '');
    };

    window.tStartTradeWithCode = async function(rawCode) {
        const code = (rawCode || '').trim().toUpperCase();
        if (!code) { toast('Enter a Castle Code.', 'error'); return; }
        if (myTradeCode && code === myTradeCode) { toast('You cannot trade with yourself.', 'error'); return; }

        builderMode       = 'init';
        builderTargetCode = code;
        builderTradeId    = null;
        builderMine.clear();

        document.getElementById('tr-builder-title').textContent = `Propose Trade · ${code}`;
        document.getElementById('tr-builder-sub').textContent   = 'Pick the card(s) to offer. They can counter with cards of their own before either side confirms.';
        document.getElementById('tr-builder-mine-label').textContent = 'Your Offer';
        const theirsSection = document.getElementById('tr-builder-theirs-section');
        const mineGrid      = document.getElementById('tr-builder-mine-grid');
        const theirsGrid    = document.getElementById('tr-builder-theirs-grid');
        if (mineGrid)   mineGrid.innerHTML = loadingHTML();
        if (theirsGrid) theirsGrid.innerHTML = loadingHTML();
        if (theirsSection) theirsSection.style.display = '';
        updateBuilderSend();
        openModal('tr-builder-modal');

        try {
            const [, theirRes] = await Promise.all([
                loadMyCardsForBuilder(),
                fetch(`${BACKEND}/api/public/collection/${encodeURIComponent(code)}`, { credentials: 'include' }),
            ]);
            renderBuilderMine();
            if (!theirRes.ok) {
                if (theirRes.status === 404) { toast('Invalid Castle Code.', 'error'); closeModal('tr-builder-modal'); return; }
                if (theirsSection) theirsSection.style.display = 'none';
                return;
            }
            let theirCards = (await theirRes.json()) || [];
            // Public collection spans every hub; keep only cards in this streamer's hub.
            theirCards = theirCards.filter(c => !c.streamer_id || String(c.streamer_id) === String(streamer.id));
            document.getElementById('tr-builder-theirs-label').textContent = 'Their Collection';
            if (theirsSection) theirsSection.style.display = theirCards.length ? '' : 'none';
            renderBuilderTheirs(theirCards);
        } catch (e) {
            if (mineGrid) mineGrid.innerHTML = errorHTML(e.message || 'Failed to load cards.');
        }
    };

    window.tPrepareReply = async function(tradeId) {
        const t = directTrades.find(x => String(x.id) === String(tradeId));
        if (!t) return;

        builderMode       = 'reply';
        builderTradeId    = tradeId;
        builderTargetCode = '';
        builderMine.clear();

        const senderName = t.sender?.username || 'them';
        document.getElementById('tr-builder-title').textContent = `Counter Offer · ${senderName}`;
        document.getElementById('tr-builder-sub').textContent   = 'Pick the card(s) you will give back. They confirm the final trade.';
        document.getElementById('tr-builder-mine-label').textContent   = 'Your Counter-Offer';
        document.getElementById('tr-builder-theirs-label').textContent = 'Their Incoming Offer';
        const theirsSection = document.getElementById('tr-builder-theirs-section');
        const mineGrid      = document.getElementById('tr-builder-mine-grid');
        if (mineGrid) mineGrid.innerHTML = loadingHTML();
        if (theirsSection) theirsSection.style.display = '';

        // The incoming offer = items not owned by me (the initiator's cards).
        const incoming = (t.items || [])
            .filter(i => String(i.owner_id) !== String(currentUser.twitch_id))
            .map(i => ({ ...(i.card || {}), user_card_id: (i.card && i.card.user_card_id) || i.user_card_id }));
        renderBuilderTheirs(incoming);
        updateBuilderSend();
        openModal('tr-builder-modal');

        try {
            await loadMyCardsForBuilder();
            renderBuilderMine();
        } catch (e) {
            if (mineGrid) mineGrid.innerHTML = errorHTML(e.message || 'Failed to load your cards.');
        }
    };

    window.tSendTrade = async function() {
        if (builderMine.size === 0) { toast('Select at least one card to offer.', 'error'); return; }
        const btn = document.getElementById('tr-builder-send');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        const isReply = builderMode === 'reply';
        const url  = `${BACKEND}${isReply ? '/api/trade/offer-reply' : '/api/trade/offer'}${tradeStreamerParam()}`;
        const body = isReply
            ? { trade_id: builderTradeId, receiver_items: [...builderMine] }
            : { target_code: builderTargetCode, sender_items: [...builderMine] };
        try {
            await writeFetch(url, { method: 'POST', body: JSON.stringify(body) });
            closeModal('tr-builder-modal');
            toast(isReply ? 'Counter offer sent!' : 'Trade offer sent!', 'success');
            // Refresh the trades list if the Direct Trades panel is open.
            fetchDirectTrades();
        } catch (e) {
            toast(e.message || 'Failed to send trade.', 'error');
            updateBuilderSend();
        }
    };

    /* ── Keyboard shortcuts ──────────────────────────────────────────────────── */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['tr-list-modal','tr-offer-modal','tr-offers-modal','tr-wishlist-modal','tr-pile-modal','tr-direct-modal','tr-builder-modal'].forEach(closeModal);
            tCloseInspect();
            closeBeltPeek();
        }
        if (e.key === 'ArrowLeft'  && !e.target.closest('input')) tPrevPage();
        if (e.key === 'ArrowRight' && !e.target.closest('input')) tNextPage();
    });

    /* ── Boot ────────────────────────────────────────────────────────────────── */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
