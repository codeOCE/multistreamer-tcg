/**
 * Shared notification bell + dropdown. Self-injects next to #nav-user-menu-root.
 * Backed by GET/POST /api/notifications (see src/index.ts).
 * Types handled: card_drop, achievement_unlock, trade_request, trade_offered,
 * trade_completed, trade_rejected.
 */
(function () {
    'use strict';

    var POLL_MS = 60000;
    var SEEN_KEY = 'castle_nav_notif_seen_v1';
    var pollTimer = null;
    var cached = [];
    var seenIds = loadSeen();

    (function injectBellStyles() {
        if (document.getElementById('nav-notif-bell-style')) return;
        var s = document.createElement('style');
        s.id = 'nav-notif-bell-style';
        s.textContent = [
            '@keyframes bell-ring {',
            '  0%   { transform: rotate(0deg); }',
            '  10%  { transform: rotate(18deg); }',
            '  25%  { transform: rotate(-16deg); }',
            '  40%  { transform: rotate(13deg); }',
            '  55%  { transform: rotate(-9deg); }',
            '  70%  { transform: rotate(5deg); }',
            '  85%  { transform: rotate(-2deg); }',
            '  100% { transform: rotate(0deg); }',
            '}',
            '#nav-notif-trigger .bx-bell-anim {',
            '  display: inline-block;',
            '  transform-origin: 50% 0%;',
            '  animation: bell-ring 0.7s ease-in-out;',
            '}'
        ].join('\n');
        document.head.appendChild(s);
    }());

    function loadSeen() {
        try {
            var raw = localStorage.getItem(SEEN_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (_) { return new Set(); }
    }
    function saveSeen() {
        try {
            // Cap to 500 most recent to avoid unbounded growth.
            var arr = Array.from(seenIds);
            if (arr.length > 500) arr = arr.slice(arr.length - 500);
            localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
        } catch (_) { /* ignore */ }
    }
    function unseenCount(list) {
        var c = 0;
        for (var i = 0; i < list.length; i++) if (!seenIds.has(list[i].id)) c++;
        return c;
    }
    function markAllSeen(list) {
        var changed = false;
        list.forEach(function (n) {
            if (n && n.id && !seenIds.has(n.id)) { seenIds.add(n.id); changed = true; }
        });
        if (changed) saveSeen();
    }

    function backendUrl() {
        if (typeof getCastleBackendOrigin === 'function') return getCastleBackendOrigin();
        if (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL) return window.BACKEND_URL;
        var m = document.querySelector('meta[name="castle-public-url"]');
        if (m && m.content) return m.content.replace(/\/$/, '');
        return '';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function timeAgo(iso) {
        if (!iso) return '';
        var then = new Date(iso).getTime();
        if (!then) return '';
        var diff = Math.max(0, Date.now() - then);
        var s = Math.floor(diff / 1000);
        if (s < 60) return s + 's';
        var m = Math.floor(s / 60);
        if (m < 60) return m + 'm';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h';
        var d = Math.floor(h / 24);
        if (d < 7) return d + 'd';
        var w = Math.floor(d / 7);
        if (w < 5) return w + 'w';
        return new Date(iso).toLocaleDateString();
    }

    var TYPE_HREF = {
        card_drop:          '/my-collection',
        achievement_unlock: '/profile',
        trade_request:      '/trading',
        trade_offered:      '/trading',
        trade_completed:    '/trading',
        trade_rejected:     '/trading',
    };

    function defaultHref(type) {
        return TYPE_HREF[type] || null;
    }

    var EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
    function stripEmojis(s) {
        return String(s == null ? '' : s).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
    }

    // Keep only pack/card-drop notifications; hide sub/resub/gift messages even when
    // they ride on a card_drop row (their `customMessage` overrides the default text).
    var SUB_RE = /(re-?sub|subscrib|subscription|sub\s*reward|gift(ed)?\s*sub|kick\s*sub|welcome|thanks for staying)/i;
    function isSubMessage(n) {
        if (!n) return false;
        var data = n.data || {};
        if (data.is_sub || data.is_resub || data.source === 'sub' || data.source === 'resub' || data.source === 'gift_sub') return true;
        return SUB_RE.test(String(n.message || ''));
    }

    function streamerLabel(n) {
        var s = n && n.streamer;
        if (!s) return '';
        return s.display_name || s.username || '';
    }

    function cardDataFromNotif(n) {
        var d = (n && n.data) || {};
        return {
            user_card_id: d.user_card_id || '',
            card_id: d.card_id || '',
            name: d.name || '',
            rarity: (d.rarity || '').toLowerCase(),
            image_url: d.image_url || '',
            is_genesis: !!d.is_genesis,
            streamer: streamerLabel(n),
        };
    }

    function injectMarkup() {
        var root = document.getElementById('nav-user-menu-root');
        if (!root) return null;
        if (document.getElementById('nav-notif-root')) return document.getElementById('nav-notif-root');

        var wrap = document.createElement('div');
        wrap.id = 'nav-notif-root';
        wrap.className = 'relative mr-1';
        wrap.innerHTML = [
            '<button type="button" id="nav-notif-trigger"',
            '    class="relative flex items-center justify-center w-10 h-10 rounded-full text-void-muted hover:text-white hover:bg-white/[0.06] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-void-accent/50"',
            '    aria-expanded="false" aria-haspopup="true" aria-controls="nav-notif-menu" aria-label="Notifications">',
            '    <i class="bx bxs-bell text-lg" aria-hidden="true"></i>',
            '    <span id="nav-notif-badge"',
            '        class="hidden absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-void-bg leading-none">0</span>',
            '</button>',
            '<div id="nav-notif-menu" role="menu"',
            '    style="width:min(calc(100vw - 2rem), 34rem);"',
            '    class="hidden absolute right-0 top-full mt-2 rounded-2xl border border-white/10 bg-void-bg shadow-2xl shadow-black/50 z-[600] overflow-hidden">',
            '    <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">',
            '        <p class="text-[11px] font-black uppercase tracking-widest text-white">Notifications</p>',
            '        <button type="button" id="nav-notif-clear"',
            '            class="hidden text-[9px] font-black uppercase tracking-widest text-void-accent hover:text-white transition-colors">',
            '            Clear all</button>',
            '    </div>',
            '    <div id="nav-notif-list" style="max-height:min(55vh, 22rem); overflow-y:auto;"></div>',
            '</div>'
        ].join('');

        root.parentNode.insertBefore(wrap, root);
        return wrap;
    }

    function ensureCardModal() {
        if (document.getElementById('nav-notif-card-modal')) return;
        var modal = document.createElement('div');
        modal.id = 'nav-notif-card-modal';
        modal.className = 'fixed inset-0 z-[2000] hidden items-center justify-center p-4';
        modal.style.background = 'rgba(0,0,0,0.78)';
        modal.style.backdropFilter = 'blur(6px)';
        modal.innerHTML = [
            '<div id="nav-notif-card-modal-panel" class="relative w-full max-w-md rounded-3xl border border-white/10 bg-void-bg shadow-2xl shadow-black/60 overflow-hidden">',
            '    <button type="button" id="nav-notif-card-modal-close"',
            '        class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-void-muted hover:text-white transition-colors"',
            '        aria-label="Close">',
            '        <i class="bx bx-x text-xl" aria-hidden="true"></i>',
            '    </button>',
            '    <div class="p-6 flex flex-col items-center gap-4">',
            '        <img id="nav-notif-card-modal-img" src="" alt=""',
            '            class="w-full max-w-[18rem] rounded-2xl border border-white/10 shadow-xl shadow-black/40 object-contain bg-black/40">',
            '        <div class="w-full text-center space-y-1">',
            '            <p id="nav-notif-card-modal-name" class="text-xl font-black text-white tracking-tight">—</p>',
            '            <p id="nav-notif-card-modal-meta" class="text-[10px] font-black uppercase tracking-widest text-void-muted">—</p>',
            '            <p id="nav-notif-card-modal-streamer" class="text-[10px] font-bold uppercase tracking-widest text-void-accent mt-1">—</p>',
            '        </div>',
            '        <a id="nav-notif-card-modal-link" href="/my-collection"',
            '            class="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white transition-colors">',
            '            View in collection</a>',
            '    </div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);

        function close() {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        modal.addEventListener('click', function (e) {
            if (e.target === modal) close();
        });
        document.getElementById('nav-notif-card-modal-close').addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
        });
    }

    function openCardModal(card) {
        ensureCardModal();
        var modal = document.getElementById('nav-notif-card-modal');
        var img = document.getElementById('nav-notif-card-modal-img');
        var nameEl = document.getElementById('nav-notif-card-modal-name');
        var metaEl = document.getElementById('nav-notif-card-modal-meta');
        var streamerEl = document.getElementById('nav-notif-card-modal-streamer');
        if (!modal) return;

        var rarity = (card.rarity || '').toUpperCase() || '—';
        var metaBits = [rarity];
        if (card.is_genesis) metaBits.unshift('GENESIS');

        if (img) {
            img.src = card.image_url || '/Castle_Default_Cardback.png';
            img.onerror = function () { img.src = '/Castle_Default_Cardback.png'; };
        }
        if (nameEl) nameEl.textContent = card.name || 'Card';
        if (metaEl) metaEl.textContent = metaBits.join(' · ');
        if (streamerEl) {
            if (card.streamer) {
                streamerEl.textContent = 'From ' + card.streamer;
                streamerEl.classList.remove('hidden');
            } else {
                streamerEl.classList.add('hidden');
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function renderEmpty(listEl) {
        listEl.innerHTML = [
            '<div class="px-6 py-8 text-center">',
            '    <p class="text-[11px] font-bold uppercase tracking-widest text-void-muted">All caught up</p>',
            '    <p class="text-[9px] text-void-muted/70 mt-1 normal-case tracking-normal">New activity will appear here.</p>',
            '</div>'
        ].join('');
    }

    function notifAction(n) {
        if (!n) return null;
        var data = n.data || {};
        if (n.type === 'card_drop') {
            return { kind: 'card' };
        }
        var href = data.href || data.url || defaultHref(n.type);
        return href ? { kind: 'link', href: href } : null;
    }

    function handleNotifClick(n, event) {
        var action = notifAction(n);
        if (!action) return;
        if (action.kind === 'card') {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
            openCardModal(cardDataFromNotif(n));
            return;
        }
        // link kind — let the anchor navigate naturally. Row stays until X is pressed.
    }

    function renderList(notifications) {
        var listEl = document.getElementById('nav-notif-list');
        var clearBtn = document.getElementById('nav-notif-clear');
        if (!listEl) return;
        if (!notifications.length) {
            renderEmpty(listEl);
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }
        if (clearBtn) clearBtn.classList.remove('hidden');

        listEl.innerHTML = notifications.map(function (n) {
            var action = notifAction(n);
            var msg = escapeHtml(stripEmojis(n.message));
            var when = escapeHtml(timeAgo(n.created_at));
            var streamer = escapeHtml(streamerLabel(n));
            var clickable = !!action;
            var hrefAttr = action && action.kind === 'link' ? ' href="' + escapeHtml(action.href) + '"' : ' href="#"';
            var open = clickable
                ? '<a' + hrefAttr + ' data-notif-click="1" class="flex items-start gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors no-underline group" data-notif-id="' + escapeHtml(n.id) + '">'
                : '<div class="flex items-start gap-3 px-4 py-3 border-b border-white/5 group" data-notif-id="' + escapeHtml(n.id) + '">';
            var close = clickable ? '</a>' : '</div>';
            var streamerLine = streamer
                ? '<p class="text-[9px] font-black uppercase tracking-widest text-void-accent mt-0.5">From ' + streamer + '</p>'
                : '';
            return [
                open,
                '    <div class="min-w-0 flex-1">',
                '        <p class="text-[12px] leading-snug text-white font-medium normal-case tracking-normal">', msg, '</p>',
                         streamerLine,
                '        <p class="text-[9px] font-black uppercase tracking-widest text-void-muted mt-1">', when, '</p>',
                '    </div>',
                '    <button type="button" data-dismiss="', escapeHtml(n.id), '"',
                '        class="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-void-muted hover:text-red-400 p-1 -m-1"',
                '        aria-label="Dismiss">',
                '        <i class="bx bx-x text-base" aria-hidden="true"></i>',
                '    </button>',
                close
            ].join('');
        }).join('');

        var byId = {};
        notifications.forEach(function (n) { byId[n.id] = n; });

        listEl.querySelectorAll('[data-notif-click]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                var id = a.getAttribute('data-notif-id');
                var n = byId[id];
                handleNotifClick(n, e);
            });
        });

        listEl.querySelectorAll('[data-dismiss]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var id = btn.getAttribute('data-dismiss');
                dismiss([id]);
            });
        });
    }

    function updateBadge(count) {
        var badge = document.getElementById('nav-notif-badge');
        if (!badge) return;
        if (!count) {
            badge.classList.add('hidden');
            badge.textContent = '0';
        } else {
            badge.classList.remove('hidden');
            badge.textContent = count > 99 ? '99+' : String(count);
        }
    }

    function isAuthed() {
        try {
            if (typeof currentUser !== 'undefined' && currentUser) return true;
        } catch (_) { /* ignore */ }
        if (window.currentUser) return true;
        try { return !!localStorage.getItem('castle_nav_user_v1'); } catch (_) { return false; }
    }

    async function fetchNotifications() {
        var url = backendUrl() + '/api/notifications';
        try {
            var res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return [];
            var data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (_) {
            return [];
        }
    }

    function ringBell() {
        var icon = document.querySelector('#nav-notif-trigger .bx');
        if (!icon) return;
        icon.classList.remove('bxs-bell', 'bxs-bell-ring', 'bx-bell-anim');
        void icon.offsetWidth; // force reflow so animation restarts
        icon.classList.add('bxs-bell-ring', 'bx-bell-anim');
        icon.addEventListener('animationend', function onEnd() {
            icon.removeEventListener('animationend', onEnd);
            icon.classList.remove('bxs-bell-ring', 'bx-bell-anim');
            icon.classList.add('bxs-bell');
        });
    }

    async function refresh(forceRender) {
        if (!isAuthed()) return;
        var list = await fetchNotifications();
        // Only show pack/card and other relevant types — drop sub/resub messages.
        list = list.filter(function (n) { return !isSubMessage(n); });
        // Ring the bell when genuinely new (unseen) notifications arrive.
        var prevIds = new Set(cached.map(function (n) { return n.id; }));
        var hasNew = list.some(function (n) { return !prevIds.has(n.id) && !seenIds.has(n.id); });
        cached = list;
        var menu = document.getElementById('nav-notif-menu');
        var menuOpen = menu && !menu.classList.contains('hidden');
        // If the menu is open while data arrives, everything visible counts as seen.
        if (menuOpen) markAllSeen(list);
        updateBadge(unseenCount(list));
        if (forceRender || menuOpen) {
            renderList(list);
        }
        if (hasNew && !menuOpen) ringBell();
    }

    async function dismiss(ids) {
        if (!ids || !ids.length) return;
        ids.forEach(function (id) {
            var row = document.querySelector('[data-notif-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
            if (row && row.parentNode) row.parentNode.removeChild(row);
        });
        cached = cached.filter(function (n) { return ids.indexOf(n.id) === -1; });
        // Clean dismissed IDs from seen set so it doesn't grow forever.
        ids.forEach(function (id) { seenIds.delete(id); });
        saveSeen();
        updateBadge(unseenCount(cached));
        var listEl = document.getElementById('nav-notif-list');
        if (listEl && !cached.length) renderEmpty(listEl);
        var clearBtn = document.getElementById('nav-notif-clear');
        if (clearBtn && !cached.length) clearBtn.classList.add('hidden');

        try {
            await fetch(backendUrl() + '/api/notifications', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids })
            });
        } catch (_) { /* ignore */ }
    }

    function closeMenu() {
        var menu = document.getElementById('nav-notif-menu');
        var trigger = document.getElementById('nav-notif-trigger');
        if (menu) menu.classList.add('hidden');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        var menu = document.getElementById('nav-notif-menu');
        var trigger = document.getElementById('nav-notif-trigger');
        if (!menu || !trigger) return;
        menu.classList.remove('hidden');
        trigger.setAttribute('aria-expanded', 'true');
        if (typeof window.closeNavUserMenu === 'function') window.closeNavUserMenu();
        // Opening the bell marks everything currently visible as seen so the badge clears.
        // The notifications themselves stay in the list — only the X button removes them.
        markAllSeen(cached);
        updateBadge(0);
        renderList(cached);
        refresh(true);
    }

    function wireEvents(wrap) {
        var trigger = wrap.querySelector('#nav-notif-trigger');
        var menu = wrap.querySelector('#nav-notif-menu');
        var clearBtn = wrap.querySelector('#nav-notif-clear');

        trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (menu.classList.contains('hidden')) openMenu(); else closeMenu();
        });

        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!cached.length) return;
            dismiss(cached.map(function (n) { return n.id; }));
        });

        document.addEventListener('click', function (e) {
            if (!wrap.contains(e.target)) closeMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (document.visibilityState === 'visible') refresh(false);
        }, POLL_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') refresh(false);
        });
    }

    // ── Realtime (instant) ──────────────────────────────────────────────────
    // Opens a Supabase Realtime subscription so new notifications surface the moment
    // they're inserted, instead of waiting for the poll. Best-effort: if the token
    // endpoint, the CDN, or the socket fails, the 60s poll above still covers us.
    var sbClient = null, sbChannel = null, rtTokenTimer = null, rtStarted = false;

    function loadSupabaseLib() {
        if (window.supabase && window.supabase.createClient) return Promise.resolve();
        if (window.__sbLibPromise) return window.__sbLibPromise;
        window.__sbLibPromise = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            // Same UMD build the OBS overlay already uses in production.
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            s.async = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
        return window.__sbLibPromise;
    }

    async function fetchRealtimeConfig() {
        var res = await fetch(backendUrl() + '/api/realtime/token', { credentials: 'include' });
        if (!res.ok) return null; // 503 = not configured yet; just stay on polling
        return res.json(); // { token, url, anon_key, twitch_id, expires_in }
    }

    function scheduleTokenRefresh(expiresIn) {
        // Re-mint a little before expiry so the socket stays authorized without a drop.
        var ttl = Math.max(60, (expiresIn || 3600) - 120);
        clearTimeout(rtTokenTimer);
        rtTokenTimer = setTimeout(async function () {
            try {
                var next = await fetchRealtimeConfig();
                if (next && next.token && sbClient && sbClient.realtime) {
                    sbClient.realtime.setAuth(next.token);
                    scheduleTokenRefresh(next.expires_in);
                }
            } catch (_) { /* polling covers the gap */ }
        }, ttl * 1000);
    }

    async function startRealtime() {
        if (rtStarted || !isAuthed()) return;
        var cfg = null;
        try { cfg = await fetchRealtimeConfig(); } catch (_) { return; }
        if (!cfg || !cfg.token || !cfg.url || !cfg.anon_key || !cfg.twitch_id) return;
        try { await loadSupabaseLib(); } catch (_) { return; }
        if (!window.supabase || !window.supabase.createClient) return;

        rtStarted = true;
        try {
            sbClient = window.supabase.createClient(cfg.url, cfg.anon_key, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            // Authorize the realtime connection as this user so RLS lets it read its own rows.
            sbClient.realtime.setAuth(cfg.token);
            sbChannel = sbClient.channel('notif-' + cfg.twitch_id)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: 'twitch_id=eq.' + cfg.twitch_id
                }, function () {
                    // Re-pull through the API so the row gets the same pref-filtering and
                    // streamer enrichment as the polled list (the raw payload has neither).
                    refresh(true);
                })
                .subscribe(function (status, err) {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        rtStarted = false;
                        console.warn('[notif-rt] channel status:', status, err);
                    }
                });
            scheduleTokenRefresh(cfg.expires_in);
        } catch (_) {
            rtStarted = false; // fall back to polling
        }
    }

    function tryInit() {
        if (document.getElementById('nav-notif-root')) return true;
        var preview = document.getElementById('nav-user-preview');
        if (!preview) return false;
        var wrap = injectMarkup();
        if (!wrap) return false;
        wireEvents(wrap);
        refresh(false);
        startPolling();
        startRealtime();
        return true;
    }

    function init() {
        if (tryInit()) return;
        // The user menu root may be hidden until login bootstrap fills it.
        var obs = new MutationObserver(function () {
            if (tryInit()) obs.disconnect();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.refreshNavNotifications = function () { return refresh(false); };
})();
