(function () {
    'use strict';

    const BACKEND = (() => {
        const m = document.querySelector('meta[name="castle-public-url"]');
        return m ? m.content.replace(/\/$/, '') : '';
    })();

    let collections = [];   // array of { streamer_id, streamer_username, brand_name, brand_color_primary, avatar_url, pack_image_url, card_count, preview_images }
    let currentUser = null;
    let searchQuery = '';

    /* ── Nav user ─────────────────────────────────────────────────────────── */
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

    /* ── Helpers ──────────────────────────────────────────────────────────── */
    function escapeHTML(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function hexToRgb(hex) {
        if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return { rgb: '55, 48, 163', light: false };
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // Perceived luminance (sRGB formula)
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return { rgb: `${r}, ${g}, ${b}`, light: lum > 0.45 };
    }

    /* ── DOM helpers ──────────────────────────────────────────────────────── */
    function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

    /* ── Bootstrap / auth ────────────────────────────────────────────────── */
    async function init() {
        try {
            // Light bootstrap call to get user identity
            const bsRes = await fetch(`${BACKEND}/api/v2/bootstrap?streamer=all&lite=1`, { credentials: 'include' });
            if (!bsRes.ok) {
                hide('mc-loading');
                show('mc-signin');
                return;
            }
            const bs = await bsRes.json();
            currentUser = bs?.user ?? null;

            if (!currentUser?.username && !currentUser?.twitch_id) {
                hide('mc-loading');
                show('mc-signin');
                return;
            }

            // Set up nav profile dropdown
            setupNavUser(currentUser);

            // Fetch collections
            const colRes = await fetch(`${BACKEND}/api/my-collections`, { credentials: 'include' });
            if (colRes.ok) {
                collections = await colRes.json();
                if (!Array.isArray(collections)) collections = [];
            }

            hide('mc-loading');
            show('mc-root');

            renderHeader();
            renderBinders();
            renderPurchaseList();

        } catch (err) {
            console.error('[MyCollection] Init error:', err);
            hide('mc-loading');
            show('mc-signin');
        }
    }

    /* ── Header ──────────────────────────────────────────────────────────── */
    function renderHeader() {
        const usernameEl = document.getElementById('mc-username');
        if (usernameEl) {
            const name = currentUser?.username || currentUser?.twitch_id || 'Collector';
            usernameEl.textContent = name.toUpperCase();
            document.title = `${name}'s Collection · Castle TCG`;
        }
    }

    /* ── Binders grid ────────────────────────────────────────────────────── */
    function renderBinders() {
        const grid = document.getElementById('mc-binders');
        const empty = document.getElementById('mc-empty');
        if (!grid) return;

        const query = searchQuery.toLowerCase().trim();
        const filtered = query
            ? collections.filter(c =>
                (c.brand_name || '').toLowerCase().includes(query) ||
                (c.streamer_username || '').toLowerCase().includes(query))
            : collections;

        if (filtered.length === 0) {
            grid.innerHTML = '';
            show('mc-empty');
            return;
        }
        hide('mc-empty');

        // Always fill to a multiple of 4 (minimum 8 slots so the grid looks populated)
        const COLS = 4;
        const minSlots = Math.max(COLS * 2, Math.ceil(filtered.length / COLS) * COLS);
        const emptyCount = minSlots - filtered.length;
        const emptySlots = Array(emptyCount).fill(null).map(() => `
            <div class="binder-tile binder-empty">
                <div class="binder-book binder-book--empty">
                    <div class="binder-empty-icon"><i class="fa-solid fa-plus"></i></div>
                </div>
                <div class="binder-label">
                    <span class="binder-name" style="color:var(--void-muted)">Empty Slot</span>
                </div>
            </div>`).join('');

        grid.innerHTML = filtered.map(c => binderTileHTML(c)).join('') + emptySlots;
    }

    function binderTileHTML(c) {
        // Use brand color, fall back to a rich dark indigo if not set
        const rawColor = c.brand_color_primary || '#3730a3';
        const { rgb: accentRgb, light: isLight } = hexToRgb(rawColor);
        const brandName = escapeHTML(c.brand_name || c.streamer_username);
        const handle = escapeHTML(c.streamer_username);
        const count = c.card_count ?? 0;

        // Light covers: dark debossed text (pressed-in look)
        // Dark covers: light embossed text (raised look)
        const etchColor    = isLight ? 'rgba(0,0,0,0.32)'         : 'rgba(255,255,255,0.35)';
        const etchShadow   = isLight ? '0 1px 1px rgba(255,255,255,0.22)' : '0 1px 2px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.08)';
        const etchColorSub = isLight ? 'rgba(0,0,0,0.22)'         : 'rgba(255,255,255,0.22)';
        const etchShadowSub= isLight ? '0 1px 0 rgba(255,255,255,0.14)'  : '0 1px 2px rgba(0,0,0,0.5)';
        const countColor   = isLight ? 'rgba(0,0,0,0.28)'         : 'rgba(255,255,255,0.28)';
        const countShadow  = isLight ? '0 1px 0 rgba(255,255,255,0.14)'  : '0 1px 1px rgba(0,0,0,0.5)';

        return `
        <a class="binder-tile" href="/binder/${handle}" style="--binder-accent-rgb: ${accentRgb}" data-light="${isLight}">
            <div class="binder-book">
                <!-- Spine dark strip -->
                <div class="binder-spine-strip"></div>
                <!-- Main cover face -->
                <div class="binder-face">
                    <div class="binder-weave"></div>
                    <div class="binder-sheen"></div>
                    <div class="binder-stitch"></div>
                    <div class="binder-zipper"></div>
                    <!-- Etched brand + handle -->
                    <div class="binder-etched">
                        <div class="binder-etch-name" style="color:${etchColor};text-shadow:${etchShadow}">${brandName}</div>
                        <div class="binder-etch-handle" style="color:${etchColorSub};text-shadow:${etchShadowSub}">by ${handle}</div>
                    </div>
                    <!-- Card count etched bottom-right -->
                    <div class="binder-card-count" style="color:${countColor};text-shadow:${countShadow}">${count} card${count !== 1 ? 's' : ''}</div>
                </div>
            </div>
            <div class="binder-label">
                <span class="binder-name">${brandName}</span>
                <div class="binder-meta">
                    <span class="accent-dot"></span>
                    <span>${count} card${count !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </a>`;
    }

    /* ── Purchase modal ──────────────────────────────────────────────────── */
    function renderPurchaseList() {
        const list = document.getElementById('mc-purchase-list');
        if (!list) return;

        if (collections.length === 0) {
            list.innerHTML = `<p style="font-size:0.6rem;color:var(--void-muted);text-align:center;padding:20px 0">Start collecting from a stream to unlock pack purchases.</p>`;
            return;
        }

        list.innerHTML = collections.map(c => {
            const { rgb: accentRgb } = hexToRgb(c.brand_color_primary);
            const name = escapeHTML(c.brand_name || c.streamer_username);
            const slug = escapeHTML(c.streamer_username);
            const avatarHTML = c.avatar_url
                ? `<img src="${escapeHTML(c.avatar_url)}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:rgba(${accentRgb},0.9);background:rgba(${accentRgb},0.12);border-radius:50%">${name.charAt(0).toUpperCase()}</div>`;

            return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <div style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(${accentRgb},0.3);overflow:hidden;flex-shrink:0">${avatarHTML}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:0.7rem;font-weight:700;color:var(--void-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
                    <div style="font-size:0.55rem;color:var(--void-muted)">${c.card_count} cards collected</div>
                </div>
                <a href="/binder/${slug}?tab=packs" style="padding:7px 14px;background:rgba(${accentRgb},0.1);border:1px solid rgba(${accentRgb},0.25);border-radius:8px;font-size:0.55rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:rgba(${accentRgb},0.9);text-decoration:none;white-space:nowrap;transition:all 0.2s"
                   onmouseover="this.style.background='rgba(${accentRgb},0.2)'" onmouseout="this.style.background='rgba(${accentRgb},0.1)'">
                    Buy Packs
                </a>
            </div>`;
        }).join('');
    }

    function openPurchase() {
        show('mc-purchase-modal');
        document.body.style.overflow = 'hidden';
    }

    function closePurchase() {
        hide('mc-purchase-modal');
        document.body.style.overflow = '';
    }

    /* ── Search ──────────────────────────────────────────────────────────── */
    function search(q) {
        searchQuery = q;
        renderBinders();
    }

    /* ── Keyboard ────────────────────────────────────────────────────────── */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePurchase();
    });

    /* ── Globals ─────────────────────────────────────────────────────────── */
    window._mcSearch        = search;
    window._mcOpenPurchase  = openPurchase;
    window._mcClosePurchase = closePurchase;

    /* ── Boot ────────────────────────────────────────────────────────────── */
    init();

})();
