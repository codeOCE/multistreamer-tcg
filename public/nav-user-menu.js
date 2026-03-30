/**
 * Shared user avatar dropdown (index + dashboard). Requires Font Awesome (fa-solid + fa-brands).
 * StreamElements-style identity row: platform icons + role, chevron expands team channels.
 */
(function () {
    const ACT_AS_KEY = 'castle_act_as_streamer_id';

    function getBackendUrl() {
        if (typeof getCastleBackendOrigin === 'function') return getCastleBackendOrigin();
        if (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL) return window.BACKEND_URL;
        return 'https://multistreamer-tcg.codeoce.workers.dev';
    }

    function getCastleNavUser() {
        try {
            if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
        } catch (_) { /* ignore */ }
        return window.currentUser || null;
    }

    function accountRoleLabel(u) {
        if (!u) return '—';
        if (u.is_creator) return 'CREATOR';
        if (u.team_memberships && u.team_memberships.length) return 'TEAM';
        return 'COLLECTOR';
    }

    function streamerLabel(m) {
        const s = m && m.streamer;
        if (!s) return 'Channel';
        return s.brand_name || s.display_name || s.username || 'Channel';
    }

    function kickIconEl() {
        const img = document.createElement('img');
        img.src = '/kick-mark.svg';
        img.alt = 'Kick';
        img.className = 'h-3 w-3 object-contain shrink-0';
        img.width = 12;
        img.height = 12;
        img.title = 'Kick';
        return img;
    }

    function wantsKickBadge(auth, u) {
        if (auth && auth.authenticated) {
            if (auth.auth_provider === 'kick') return false;
            if (auth.kick_linked) return true;
            if (auth.kick && typeof auth.kick === 'object') return true;
        }
        return !!(u && u.kick_linked);
    }

    function renderPlatformIcons(container, auth, u) {
        if (!container) return;
        container.innerHTML = '';
        if (auth && auth.authenticated) {
            if (auth.auth_provider === 'kick') {
                container.appendChild(kickIconEl());
                return;
            }
            const twitch = document.createElement('i');
            twitch.className = 'fa-brands fa-twitch text-[11px] leading-none';
            twitch.style.color = '#9146FF';
            twitch.title = 'Twitch';
            container.appendChild(twitch);
            if (wantsKickBadge(auth, u)) {
                container.appendChild(kickIconEl());
            }
            return;
        }
        if (u && u.twitch_id) {
            if (String(u.twitch_id).startsWith('kick_')) {
                container.appendChild(kickIconEl());
            } else {
                const twitch = document.createElement('i');
                twitch.className = 'fa-brands fa-twitch text-[11px] leading-none';
                twitch.style.color = '#9146FF';
                twitch.title = 'Twitch';
                container.appendChild(twitch);
                if (u.kick_linked) {
                    container.appendChild(kickIconEl());
                }
            }
        }
    }

    function collapseTeamPanel() {
        const panel = document.getElementById('nav-user-team-panel');
        const chev = document.getElementById('nav-user-team-chevron');
        const toggle = document.getElementById('nav-user-identity-toggle');
        if (panel) panel.classList.add('hidden');
        if (chev) chev.classList.remove('rotate-180');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleTeamPanel() {
        const panel = document.getElementById('nav-user-team-panel');
        const chev = document.getElementById('nav-user-team-chevron');
        const toggle = document.getElementById('nav-user-identity-toggle');
        if (!panel || !toggle || toggle.dataset.hasTeams !== '1') return;
        const open = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !open);
        if (chev) chev.classList.toggle('rotate-180', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeNavUserMenu() {
        const menu = document.getElementById('nav-user-menu');
        const trigger = document.getElementById('nav-user-menu-trigger');
        if (menu) menu.classList.add('hidden');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        collapseTeamPanel();
    }

    function updateNavUserMenuLabels() {
        const u = getCastleNavUser();
        const nameEl = document.getElementById('nav-user-menu-name');
        const roleEl = document.getElementById('nav-user-menu-role');
        const navNick = document.getElementById('nav-username');
        const navRole = document.getElementById('nav-user-role');
        const label = u ? (u.display_name || u.name || 'User') : '—';
        const roleText = accountRoleLabel(u);
        if (nameEl) nameEl.textContent = label;
        if (roleEl) roleEl.textContent = roleText;
        if (navNick) navNick.textContent = label;
        if (navRole) navRole.textContent = roleText;
    }

    function syncMenuAvatar(u) {
        const menuAv = document.getElementById('nav-user-menu-avatar');
        const barAv = document.getElementById('nav-avatar');
        const src = (u && u.avatar) || (barAv && barAv.src) || '/assets/default-avatar.png';
        if (menuAv) {
            menuAv.src = src;
            menuAv.onerror = () => {
                menuAv.src = '/default-avatar.png';
            };
        }
    }

    async function fetchAuthStatus() {
        try {
            const res = await fetch(`${getBackendUrl()}/api/auth/twitch-status`, {
                credentials: 'include'
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    function buildTeamChannelRow(m) {
        const sid = m.streamer_id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
            'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors';
        const img = document.createElement('img');
        img.src = (m.streamer && m.streamer.avatar_url) || '/assets/default-avatar.png';
        img.className = 'w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0';
        img.alt = '';
        img.onerror = () => {
            img.src = '/default-avatar.png';
        };
        const text = document.createElement('div');
        text.className = 'min-w-0 flex-1';
        const title = document.createElement('div');
        title.className = 'text-[11px] font-bold text-white truncate';
        title.textContent = streamerLabel(m);
        text.appendChild(title);
        const sub = document.createElement('div');
        sub.className = 'text-[9px] text-void-muted/90 truncate';
        sub.textContent = m.streamer && m.streamer.username ? '@' + m.streamer.username : '';
        text.appendChild(sub);
        const badge = document.createElement('span');
        const ed = m.role === 'editor';
        badge.className = ed
            ? 'shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
            : 'shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-void-accent/10 text-void-accent border border-void-accent/25';
        badge.textContent = ed ? 'Editor' : 'Mod';
        btn.appendChild(img);
        btn.appendChild(text);
        btn.appendChild(badge);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                if (sid) localStorage.setItem(ACT_AS_KEY, String(sid));
            } catch (_) { /* ignore */ }
            const path = (window.location.pathname || '').replace(/\/+$/, '') || '/';
            if (path === '/dashboard') {
                window.location.reload();
            } else {
                window.location.href = '/dashboard';
            }
        });
        return btn;
    }

    async function refreshNavUserMenuContent() {
        collapseTeamPanel();
        updateNavUserMenuLabels();
        const u = getCastleNavUser();
        syncMenuAvatar(u);

        const codeEl = document.getElementById('nav-user-menu-castle-code');
        const teamList = document.getElementById('nav-user-team-list');
        const chev = document.getElementById('nav-user-team-chevron');
        const chevWrap = document.getElementById('nav-user-team-chevron-wrap');
        const identityToggle = document.getElementById('nav-user-identity-toggle');
        const iconWrap = document.getElementById('nav-user-platform-icons');

        if (codeEl) codeEl.textContent = (u && u.trade_code) ? u.trade_code : '…';
        
        // Use auth_status from bootstrap if available, otherwise fetch
        let auth = (u && u.auth_status) ? u.auth_status : null;
        if (!auth) {
            auth = await fetchAuthStatus();
        }
        renderPlatformIcons(iconWrap, auth, u);

        // If we don't have the trade_code, fetch it
        if (!u || !u.trade_code) {
            try {
                const res = await fetch(`${getBackendUrl()}/api/trade/code`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (codeEl) codeEl.textContent = data.trade_code || '—';
                } else if (codeEl) codeEl.textContent = '—';
            } catch (_) {
                if (codeEl) codeEl.textContent = '—';
            }
        }

        const memberships = u && Array.isArray(u.team_memberships) ? u.team_memberships : [];
        const sorted = [...memberships].sort((a, b) =>
            streamerLabel(a).localeCompare(streamerLabel(b), undefined, { sensitivity: 'base' })
        );
        const hasTeams = sorted.length > 0;

        if (chevWrap) chevWrap.classList.toggle('hidden', !hasTeams);
        if (identityToggle) {
            identityToggle.dataset.hasTeams = hasTeams ? '1' : '0';
            identityToggle.classList.toggle('cursor-pointer', hasTeams);
            identityToggle.classList.toggle('cursor-default', !hasTeams);
            if (hasTeams) {
                identityToggle.setAttribute(
                    'title',
                    'Press the row or arrow to open your team channels (mod / editor)'
                );
            } else {
                identityToggle.removeAttribute('title');
            }
        }

        if (teamList) {
            teamList.innerHTML = '';
            sorted.forEach((m) => {
                teamList.appendChild(buildTeamChannelRow(m));
            });
        }
    }

    function copyCastleCode() {
        const codeEl = document.getElementById('nav-user-menu-castle-code');
        const code = codeEl ? codeEl.textContent.trim() : '';
        if (!code || code === '—' || code === '…') return;
        navigator.clipboard.writeText(code).then(
            () => {
                if (typeof showToast === 'function') showToast('Castle code copied!', 'success');
            },
            () => { /* ignore */ }
        );
    }

    function openNavUserSettings() {
        closeNavUserMenu();
        // Viewer account: Castle code, team channels, blocks, delete account (main SPA #profile-view).
        // Do not route to dashboard.html's "Settings" tab — that is channel/branding only.
        if (typeof switchView === 'function' && document.getElementById('profile-view')) {
            switchView('profile');
            if (history && history.replaceState) {
                try {
                    history.replaceState({ appView: 'profile' }, '', '/profile');
                } catch (e) { /* ignore */ }
            }
            return;
        }
        // Standalone creator page (dashboard.html) has no profile view — same-origin /profile loads the SPA.
        if (document.getElementById('tab-settings')) {
            window.location.href = '/profile';
            return;
        }
        if (typeof switchView === 'function') {
            switchView('profile');
            return;
        }
        window.location.href = '/profile';
    }

    async function navUserLogout() {
        closeNavUserMenu();
        try {
            await fetch(`${getBackendUrl()}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.error('[nav-user-menu] logout', e);
        }
        try {
            sessionStorage.clear();
        } catch (_) { /* ignore */ }
        window.location.href = '/login';
    }

    function initNavUserMenu() {
        const root = document.getElementById('nav-user-menu-root');
        const trigger = document.getElementById('nav-user-menu-trigger');
        const menu = document.getElementById('nav-user-menu');
        if (!root || !trigger || !menu || root.dataset.navMenuInit === '1') return;
        root.dataset.navMenuInit = '1';

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open = menu.classList.contains('hidden');
            if (open) {
                menu.classList.remove('hidden');
                trigger.setAttribute('aria-expanded', 'true');
                refreshNavUserMenuContent();
            } else {
                closeNavUserMenu();
            }
        });

        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) closeNavUserMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeNavUserMenu();
        });

        const identityToggle = document.getElementById('nav-user-identity-toggle');
        identityToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (identityToggle.dataset.hasTeams !== '1') return;
            toggleTeamPanel();
        });

        document.getElementById('nav-user-menu-copy-code')?.addEventListener('click', (e) => {
            e.stopPropagation();
            copyCastleCode();
        });
        document.getElementById('nav-user-menu-settings')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openNavUserSettings();
        });
        document.getElementById('nav-user-menu-logout')?.addEventListener('click', (e) => {
            e.stopPropagation();
            navUserLogout();
        });
    }

    window.initNavUserMenu = initNavUserMenu;
    window.refreshNavUserMenuContent = refreshNavUserMenuContent;
    window.updateNavUserMenuLabels = updateNavUserMenuLabels;
    window.closeNavUserMenu = closeNavUserMenu;
})();
