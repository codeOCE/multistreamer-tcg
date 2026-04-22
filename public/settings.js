(function () {
    'use strict';

    const BACKEND =
        typeof getCastleBackendOrigin === 'function'
            ? getCastleBackendOrigin()
            : (typeof window.__CASTLE_BACKEND__ === 'string' ? window.__CASTLE_BACKEND__ : window.location.origin);

    window.BACKEND_URL = BACKEND;

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.showToast = function showToast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast-void toast-${type}`;
        const icons = { success: 'bxs-check-circle', error: 'bxs-x-circle', info: 'bxs-info-circle' };
        toast.innerHTML = `
            <i class="bx ${icons[type] || icons.info} toast-icon"></i>
            <div class="toast-message">${esc(message)}</div>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    window.scrollLock = function scrollLock() {
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = '8px';
    };

    window.scrollUnlock = function scrollUnlock() {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    };

    window.fetchCSRFToken = async function fetchCSRFToken() {
        try {
            const res = await fetch(`${BACKEND}/api/csrf`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                window.csrfToken = data.token;
            }
        } catch (e) {
            console.error('[Settings] CSRF fetch failed:', e);
        }
    };

    function applyNavChrome() {
        const u = window.currentUser;
        if (!u) return;
        const navAvatar = document.getElementById('nav-avatar');
        const menuAvatar = document.getElementById('nav-user-menu-avatar');
        const av = u.avatar || u.avatar_url || '';
        if (navAvatar) navAvatar.src = av;
        if (menuAvatar) menuAvatar.src = av;
        const preview = document.getElementById('nav-user-preview');
        if (preview) {
            preview.classList.remove('hidden');
            preview.style.display = 'flex';
        }
        if (typeof window.initNavUserMenu === 'function') window.initNavUserMenu();
        if (typeof window.updateNavUserMenuLabels === 'function') window.updateNavUserMenuLabels();
    }

    async function init() {
        try {
            const bsRes = await fetch(`${BACKEND}/api/v2/bootstrap?lite=1`, { credentials: 'include' });
            if (!bsRes.ok) {
                document.getElementById('st-loading')?.classList.add('hidden');
                document.getElementById('st-signin')?.classList.remove('hidden');
                return;
            }
            const bs = await bsRes.json();
            const u = bs && bs.user;
            if (!u || (!u.username && !u.twitch_id)) {
                document.getElementById('st-loading')?.classList.add('hidden');
                document.getElementById('st-signin')?.classList.remove('hidden');
                return;
            }

            if (bs.csrf_token) window.csrfToken = bs.csrf_token;

            window.currentUser = {
                twitch_id: u.twitch_id,
                name: u.username,
                display_name: u.display_name || u.username,
                avatar: u.avatar_url,
                is_creator: !!u.is_creator,
                streamer: u.streamer,
                team_memberships: Array.isArray(u.team_memberships) ? u.team_memberships : [],
                kick_linked: !!u.kick_linked
            };

            applyNavChrome();
            if (window.castleNav) castleNav.autoInit();

            if (typeof window.populateProfileView === 'function') {
                await window.populateProfileView();
            }

            document.getElementById('st-loading')?.classList.add('hidden');
            document.getElementById('st-main')?.classList.remove('hidden');
        } catch (err) {
            console.error('[Settings] Init error:', err);
            document.getElementById('st-loading')?.classList.add('hidden');
            document.getElementById('st-signin')?.classList.remove('hidden');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
