/**
 * Shared user avatar dropdown (index + dashboard). Requires Boxicons (bx bxs-* + bxl-*).
 * StreamElements-style identity row: platform icons + role, chevron expands team channels.
 */
(function () {
    const ACT_AS_KEY = 'castle_act_as_streamer_id';
    const NAME_ICON_SRC = '/Affiliate%20BLUE.png';

    function getBackendUrl() {
        if (typeof getCastleBackendOrigin === 'function') return getCastleBackendOrigin();
        if (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL) return window.BACKEND_URL;
        return 'https://tcg.creatorcastle.gg';
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
            twitch.className = 'bx bxl-twitch text-[11px] leading-none';
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
                twitch.className = 'bx bxl-twitch text-[11px] leading-none';
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

    function ensureNameIconLabel(nameEl) {
        if (!nameEl) return null;
        let textEl = document.getElementById('nav-user-menu-name-text');
        if (textEl) return textEl;

        nameEl.textContent = '';
        nameEl.classList.add('flex', 'items-center', 'gap-1.5', 'text-2xl');

        const icon = document.createElement('img');
        icon.id = 'nav-user-menu-name-icon';
        icon.src = NAME_ICON_SRC;
        icon.alt = '';
        icon.className = 'h-5 w-5 object-contain shrink-0';
        icon.width = 20;
        icon.height = 20;
        icon.style.display = 'none';
        icon.setAttribute('aria-hidden', 'true');

        textEl = document.createElement('span');
        textEl.id = 'nav-user-menu-name-text';
        textEl.className = 'truncate';

        nameEl.appendChild(textEl);
        nameEl.appendChild(icon);
        return textEl;
    }

    function updateNavUserMenuLabels() {
        const u = getCastleNavUser();
        const nameEl = document.getElementById('nav-user-menu-name');
        const roleEl = document.getElementById('nav-user-menu-role');
        const navNick = document.getElementById('nav-username');
        const navRole = document.getElementById('nav-user-role');
        const iconWrap = document.getElementById('nav-user-platform-icons');
        const label = u ? (u.display_name || u.username || u.name || '—') : '—';
        const roleText = accountRoleLabel(u);
        const nameTextEl = ensureNameIconLabel(nameEl);
        if (iconWrap) iconWrap.classList.add('hidden');
        if (roleEl) roleEl.classList.add('hidden');
        if (nameTextEl) nameTextEl.textContent = label;
        if (roleEl) roleEl.textContent = roleText;
        if (navNick) navNick.textContent = label;
        if (navRole) navRole.textContent = roleText;
        const iconEl = document.getElementById('nav-user-menu-name-icon');
        if (iconEl) {
            const isAffiliate = !!(u && (u.role === 'affiliate' || u.role === 'partner'));
            iconEl.style.display = isAffiliate ? '' : 'none';
        }
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
        const chevWrap = document.getElementById('nav-user-team-chevron-wrap');
        const identityToggle = document.getElementById('nav-user-identity-toggle');
        const iconWrap = document.getElementById('nav-user-platform-icons');

        if (codeEl) codeEl.textContent = (u && u.trade_code) ? u.trade_code.toUpperCase() : '…';

        // Use auth_status from bootstrap if available, otherwise fetch
        let auth = (u && u.auth_status) ? u.auth_status : null;
        if (!auth) {
            auth = await fetchAuthStatus();
        }
        renderPlatformIcons(iconWrap, auth, u);
        if (iconWrap) iconWrap.classList.add('hidden');

        // If we don't have the trade_code, fetch it
        if (!u || !u.trade_code) {
            try {
                const res = await fetch(`${getBackendUrl()}/api/trade/code`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (codeEl) codeEl.textContent = data.trade_code ? data.trade_code.toUpperCase() : '—';
                } else if (codeEl) codeEl.textContent = '—';
            } catch (_) {
                if (codeEl) codeEl.textContent = '—';
            }
        }

        const memberships = u && Array.isArray(u.team_memberships) ? u.team_memberships : [];
        const sorted = [...memberships].sort((a, b) =>
            streamerLabel(a).localeCompare(streamerLabel(b), undefined, { sensitivity: 'base' })
        );
        const isPlatformAdmin = !!(u && (u.is_platform_admin || u.is_admin));
        const hasTeams = sorted.length > 0 || isPlatformAdmin;

        if (chevWrap) chevWrap.classList.toggle('hidden', !hasTeams);
        if (identityToggle) {
            identityToggle.dataset.hasTeams = hasTeams ? '1' : '0';
            identityToggle.classList.toggle('cursor-pointer', hasTeams);
            identityToggle.classList.toggle('cursor-default', !hasTeams);
            if (hasTeams) {
                identityToggle.setAttribute(
                    'title',
                    isPlatformAdmin
                        ? 'Switch to any channel (platform admin)'
                        : 'Press the row or arrow to open your team channels (mod / editor)'
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

        if (isPlatformAdmin) {
            const panel = document.getElementById('nav-user-team-panel');
            if (panel && !document.getElementById('nav-admin-channel-switcher')) {
                const wrap = document.createElement('div');
                wrap.id = 'nav-admin-channel-switcher';
                wrap.className = 'border-t border-white/5 mt-1 pt-2 px-1';
                wrap.innerHTML = `
                    <p class="text-[9px] font-black uppercase tracking-widest text-amber-400/80 px-1 pb-1.5">Admin: switch channel</p>
                    <div class="flex gap-1.5">
                        <input id="nav-admin-channel-input" type="text" placeholder="username"
                            class="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder-void-muted/50 focus:outline-none focus:border-void-accent/50" />
                        <button id="nav-admin-channel-go" type="button"
                            class="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-[9px] font-black uppercase tracking-widest text-amber-300 transition-colors">
                            Go
                        </button>
                    </div>
                    <p id="nav-admin-channel-error" class="text-[9px] text-red-400 mt-1 hidden"></p>
                    <button id="nav-admin-channel-clear" type="button"
                        class="mt-1.5 w-full text-left px-1 py-1 text-[9px] font-black uppercase tracking-widest text-void-muted hover:text-amber-300 transition-colors hidden">
                        &larr; Back to my channel
                    </button>`;
                panel.appendChild(wrap);

                const input = wrap.querySelector('#nav-admin-channel-input');
                const btn = wrap.querySelector('#nav-admin-channel-go');
                const errEl = wrap.querySelector('#nav-admin-channel-error');
                const clearBtn = wrap.querySelector('#nav-admin-channel-clear');

                async function doAdminSwitch() {
                    const q = (input.value || '').trim();
                    if (!q) return;
                    errEl.classList.add('hidden');
                    btn.disabled = true;
                    btn.textContent = '...';
                    try {
                        const res = await fetch(`${getBackendUrl()}/api/admin/streamer-lookup?q=${encodeURIComponent(q)}`, { credentials: 'include' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Lookup failed');
                        const rows = Array.isArray(data) ? data : [];
                        const match = rows.find(r => r.username.toLowerCase() === q.toLowerCase()) || rows[0];
                        if (!match) throw new Error('No streamer found for "' + q + '"');
                        try { localStorage.setItem(ACT_AS_KEY, String(match.id)); } catch (_) {}
                        window.location.href = '/dashboard';
                    } catch (e) {
                        errEl.textContent = e.message || 'Error';
                        errEl.classList.remove('hidden');
                        btn.disabled = false;
                        btn.textContent = 'Go';
                    }
                }

                btn.addEventListener('click', doAdminSwitch);
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdminSwitch(); });
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        try { localStorage.removeItem(ACT_AS_KEY); } catch (_) { /* ignore */ }
                        window.location.reload();
                    });
                }
            }
            // Update clear button visibility each time the menu opens
            const existingClearBtn = document.getElementById('nav-admin-channel-clear');
            if (existingClearBtn) {
                try {
                    existingClearBtn.classList.toggle('hidden', !localStorage.getItem(ACT_AS_KEY));
                } catch (_) { /* ignore */ }
            }
        }

        updateSwitchViewButton();
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
        window.location.href = '/settings';
    }

    function openEditProfile() {
        closeNavUserMenu();
        window.location.href = '/profile';
    }

    function switchView() {
        closeNavUserMenu();
        const onDashboard = window.location.pathname === '/dashboard';
        if (onDashboard) {
            // Go back to viewer (main SPA)
            window.location.href = '/';
        } else {
            // Go to creator dashboard
            window.location.href = '/dashboard';
        }
    }

    function updateSwitchViewButton() {
        const btn = document.getElementById('nav-user-menu-switch-view');
        if (!btn) return;
        const u = getCastleNavUser();
        const isCreator = !!(u && u.is_creator);
        if (!isCreator) {
            btn.style.display = 'none';
            return;
        }
        const onDashboard = window.location.pathname === '/dashboard';
        btn.style.display = '';
        if (onDashboard) {
            btn.innerHTML = `
                <i class="bx bxs-show text-void-muted w-4 text-center shrink-0"></i>
                <span class="flex flex-col leading-tight normal-case">
                    <span class="uppercase tracking-widest">Switch to Collector Mode</span>
                    <span class="text-[9px] font-semibold text-void-muted tracking-normal mt-0.5">Back to your collection</span>
                </span>`;
        } else {
            btn.innerHTML = `
                <i class="bx bxs-film text-void-muted w-4 text-center shrink-0"></i>
                <span class="flex flex-col leading-tight normal-case">
                    <span class="uppercase tracking-widest">Switch to Creator Mode</span>
                    <span class="text-[9px] font-semibold text-void-muted tracking-normal mt-0.5">Manage your channel</span>
                </span>`;
        }
    }

    function injectExtraMenuItems(menu) {
        // Guard: only inject once
        if (menu.dataset.extraItemsInjected === '1') return;
        menu.dataset.extraItemsInjected = '1';

        const settingsBtn = document.getElementById('nav-user-menu-settings');
        if (!settingsBtn) return;
        const container = settingsBtn.parentElement;

        const makeBtn = (id, innerHTML) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.setAttribute('role', 'menuitem');
            btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold uppercase tracking-widest text-void-text hover:bg-white/5 transition-colors';
            btn.innerHTML = innerHTML;
            return btn;
        };

        const myCollectionBtn = makeBtn('nav-user-menu-my-collection', `
            <i class="bx bxs-collection text-void-muted w-4 text-center shrink-0"></i>
            <span class="flex flex-col leading-tight normal-case">
                <span class="uppercase tracking-widest">My Collection</span>
                <span class="text-[9px] font-semibold text-void-muted tracking-normal mt-0.5">View your cards</span>
            </span>`);

        const editProfileBtn = makeBtn('nav-user-menu-edit-profile', `
            <i class="bx bxs-user-detail text-void-muted w-4 text-center shrink-0"></i>
            <span class="flex flex-col leading-tight normal-case">
                <span class="uppercase tracking-widest">View Profile</span>
                <span class="text-[9px] font-semibold text-void-muted tracking-normal mt-0.5">Public page &amp; display name</span>
            </span>`);

        const switchViewBtn = makeBtn('nav-user-menu-switch-view', '');

        // Insert order: My Collection → View Profile → Settings → separator → Creator/Viewer toggle → Logout
        container.insertBefore(myCollectionBtn, settingsBtn);
        container.insertBefore(editProfileBtn, settingsBtn);

        // Switch view goes between settings and logout, with a divider above it
        const logoutBtn = document.getElementById('nav-user-menu-logout');
        const divider = document.createElement('div');
        divider.className = 'my-1 border-t border-white/5';
        if (logoutBtn) {
            container.insertBefore(divider, logoutBtn);
            container.insertBefore(switchViewBtn, logoutBtn);
        } else {
            container.appendChild(divider);
            container.appendChild(switchViewBtn);
        }

        // Wire up new buttons
        myCollectionBtn.addEventListener('click', (e) => { e.stopPropagation(); closeNavUserMenu(); window.location.href = '/my-collection'; });
        editProfileBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditProfile(); });
        switchViewBtn.addEventListener('click',  (e) => { e.stopPropagation(); switchView(); });

        updateSwitchViewButton();
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

        // Inject extra items (edit profile, switch view, redeem) before first open
        injectExtraMenuItems(menu);

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
