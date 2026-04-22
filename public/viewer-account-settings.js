/**
 * Shared viewer account settings (Account / profile panels). Used by index SPA and settings.html.
 * Expects window.BACKEND_URL or getCastleBackendOrigin(); uses window.csrfToken with app.js sync.
 */
(function () {
    'use strict';

    function backendBase() {
        if (typeof getCastleBackendOrigin === 'function') {
            try {
                const o = getCastleBackendOrigin();
                if (o) return String(o).replace(/\/$/, '');
            } catch (e) { /* ignore */ }
        }
        if (typeof window.BACKEND_URL === 'string' && window.BACKEND_URL) {
            return window.BACKEND_URL.replace(/\/$/, '');
        }
        return (window.location && window.location.origin) ? window.location.origin.replace(/\/$/, '') : '';
    }

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function ensureCsrfToken() {
        if (typeof window.fetchCSRFToken === 'function') {
            await window.fetchCSRFToken();
            return;
        }
        const b = backendBase();
        if (!b) return;
        try {
            const res = await fetch(`${b}/api/csrf`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                window.csrfToken = data.token;
            }
        } catch (e) {
            console.error('[viewer-account-settings] CSRF fetch failed:', e);
        }
    }

    function csrfVal() {
        return (typeof window.csrfToken !== 'undefined' && window.csrfToken) ? window.csrfToken : '';
    }

    let viewerProfileSettingsInitialized = false;

    function setViewerProfileTab(tab) {
        const base =
            'profile-settings-tab px-5 sm:px-7 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all border';
        const active = 'border-void-accent text-void-text bg-void-accent/10';
        const inactive =
            'border-transparent text-void-muted hover:text-void-text hover:bg-white/[0.04]';
        document.querySelectorAll('.profile-settings-tab').forEach((btn) => {
            const t = btn.getAttribute('data-profile-tab');
            const on = t === tab;
            btn.className = `${base} ${on ? active : inactive}`;
        });
        const panels = {
            channels: document.getElementById('profile-panel-channels'),
            connections: document.getElementById('profile-panel-connections'),
            transactions: document.getElementById('profile-panel-transactions'),
            security: document.getElementById('profile-panel-security'),
            personalise: document.getElementById('profile-panel-personalise')
        };
        Object.entries(panels).forEach(([k, el]) => {
            if (!el) return;
            el.classList.toggle('hidden', k !== tab);
        });
    }

    function initViewerProfileSettingsOnce() {
        if (viewerProfileSettingsInitialized) return;
        viewerProfileSettingsInitialized = true;

        document.querySelectorAll('.profile-settings-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-profile-tab');
                if (tab) setViewerProfileTab(tab);
            });
        });

        document.getElementById('viewer-settings-copy-code')?.addEventListener('click', () => {
            const el = document.getElementById('viewer-settings-castle-code');
            const code = el ? el.textContent.trim() : '';
            if (!code || code === '…' || code === '—') return;
            navigator.clipboard.writeText(code).then(
                () => {
                    if (typeof showToast === 'function') showToast('Castle code copied!', 'success');
                },
                () => { /* ignore */ }
            );
        });

        document.getElementById('viewer-block-streamer-btn')?.addEventListener('click', () => {
            void addViewerStreamerBlock();
        });

        document.getElementById('viewer-open-delete-account-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('viewer-delete-account-modal');
            const input = document.getElementById('viewer-delete-confirm-input');
            if (input) input.value = '';
            modal?.classList.remove('hidden');
            if (typeof scrollLock === 'function') scrollLock();
        });

        document.getElementById('viewer-delete-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('viewer-delete-account-modal')?.classList.add('hidden');
            if (typeof scrollUnlock === 'function') scrollUnlock();
        });

        document.getElementById('viewer-delete-submit-btn')?.addEventListener('click', () => {
            void submitViewerDeleteAccount();
        });

        document.getElementById('viewer-delete-account-modal')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'viewer-delete-account-modal') {
                e.currentTarget.classList.add('hidden');
                if (typeof scrollUnlock === 'function') scrollUnlock();
            }
        });

        document.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('[data-castle-disconnect]') : null;
            if (!btn) return;
            const platform = btn.getAttribute('data-castle-disconnect');
            if (platform !== 'twitch' && platform !== 'kick') return;
            e.preventDefault();
            void disconnectCastlePlatform(platform);
        });

        initPersonalisationPrefs();
    }

    async function disconnectCastlePlatform(platform) {
        if (!csrfVal()) await ensureCsrfToken();
        const path = platform === 'twitch' ? '/api/auth/disconnect/twitch' : '/api/auth/disconnect/kick';
        try {
            const res = await fetch(`${backendBase()}${path}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data && data.error ? data.error : `Could not disconnect (${res.status})`;
                if (typeof showToast === 'function') showToast(String(msg), 'error');
                return;
            }
            if (data.logged_out) {
                window.location.href = '/login';
                return;
            }
            if (typeof showToast === 'function') showToast('Disconnected', 'success');
            window.location.reload();
        } catch (err) {
            if (typeof showToast === 'function') showToast('Network error', 'error');
        }
    }

    /**
     * Twitch-style rows: icon, title, status (+ optional check), fine print, Connect (purple) / Disconnect (grey).
     */
    async function renderViewerSettingsConnections() {
        const wrap = document.getElementById('viewer-settings-connections');
        if (!wrap) return;

        const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
        let auth = {
            authenticated: false,
            auth_provider: 'twitch',
            username: u && (u.name || u.display_name),
            kick_linked: !!(u && u.kick_linked),
            twitch: null,
            kick: null
        };
        try {
            const res = await fetch(`${backendBase()}/api/auth/twitch-status`, { credentials: 'include' });
            if (res.ok) auth = { ...auth, ...(await res.json()) };
        } catch (e) { /* ignore */ }

        const role = u && u.is_creator ? 'creator' : 'viewer';
        const kickHref = `${backendBase()}/auth/kick?mode=link&role=${role}`;
        const twitchHref = `${backendBase()}/auth/twitch?role=${role}&reauth=1`;

        const isKickPrimary = auth.auth_provider === 'kick';
        const tw = auth.twitch;
        const twOk =
            !isKickPrimary && tw && tw.token_valid && !tw.needs_reauth;
        const kickLinked = !!auth.kick_linked;
        const k = auth.kick;
        const kickOk = kickLinked && k && k.token_valid && !k.needs_reauth;

        const btnConnectTwitch = `inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-[#9146FF] text-white shadow-lg shadow-[#9146FF]/20 hover:brightness-110 transition-all`;
        const btnConnectKick = `inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-[#53FC18] text-black shadow-lg shadow-[#53FC18]/15 hover:brightness-95 transition-all`;
        const btnDisconnect = `inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-white/[0.08] border border-white/15 text-white hover:bg-white/[0.12] transition-colors`;

        const card = (inner) =>
            `<div class="rounded-xl border border-white/10 bg-black/25 p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">${inner}</div>`;

        const leftCol = (iconInner, title, statusHtml, statusOk, finePrint) => `
            <div class="flex gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 shrink-0 rounded-lg bg-white/[0.06] flex items-center justify-center border border-white/10">${iconInner}</div>
                <div class="min-w-0 space-y-2">
                    <h3 class="text-base font-bold text-white tracking-tight">${escapeHTML(title)}</h3>
                    <div class="text-sm ${statusOk ? 'text-emerald-400/95' : 'text-void-muted'} flex items-start gap-2 leading-snug">
                        ${statusOk ? '<i class="bx bxs-check mt-0.5 text-emerald-400 shrink-0" aria-hidden="true"></i>' : ''}
                        <span>${statusHtml}</span>
                    </div>
                    <p class="text-xs text-void-muted/90 leading-relaxed max-w-xl">${finePrint}</p>
                </div>
            </div>`;

        const actionsCol = (html) =>
            `<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0 w-full sm:w-auto sm:min-w-[9.5rem]">${html}</div>`;

        const twitchFine =
            'Castle uses Twitch for sign-in, drops, and (for creators) Channel Points. Disconnect removes Castle’s access to your Twitch tokens; you can reconnect anytime.';

        let twitchStatus;
        let twitchOkFlag = false;
        let twitchActions;
        if (isKickPrimary) {
            twitchStatus = `You’re signed in with <strong class="text-void-text">Kick</strong>. Link Twitch to use Twitch features in Castle.`;
            twitchActions = actionsCol(
                `<a href="${escapeHTML(twitchHref)}" class="${btnConnectTwitch} w-full sm:w-auto">Connect</a>`
            );
        } else if (twOk) {
            twitchOkFlag = true;
            const un = escapeHTML(auth.username || u?.display_name || u?.name || 'Twitch');
            twitchStatus = `Your Twitch account is connected as <span class="text-white font-semibold">${un}</span>.`;
            twitchActions = actionsCol(
                `<button type="button" data-castle-disconnect="twitch" class="${btnDisconnect} w-full sm:w-auto">Disconnect</button>`
            );
        } else {
            const need = tw && tw.needs_reauth;
            twitchStatus = need
                ? 'Your Twitch connection needs to be refreshed so drops and features keep working.'
                : 'Connect your Twitch account for identity, drops, and channel features.';
            twitchActions = actionsCol(
                `<a href="${escapeHTML(twitchHref)}" class="${btnConnectTwitch} w-full sm:w-auto">${need ? 'Reconnect' : 'Connect'}</a>`
            );
        }

        const twitchBlock = card(
            `${leftCol(
                '<i class="bx bxl-twitch text-2xl text-[#9146FF]" aria-hidden="true"></i>',
                'Twitch',
                twitchStatus,
                twitchOkFlag,
                twitchFine
            )}${twitchActions}`
        );

        const kickFine =
            'Link Kick so Castle can match your Kick channel to drops and chat. Disconnect removes the Kick link from this Castle account.';

        let kickStatus;
        let kickOkFlag = false;
        let kickActions;
        if (!kickLinked) {
            kickStatus = 'Kick is not linked yet.';
            kickActions = actionsCol(
                `<a href="${escapeHTML(kickHref)}" class="${btnConnectKick} w-full sm:w-auto">Connect</a>`
            );
        } else if (kickOk) {
            kickOkFlag = true;
            kickStatus = 'Your Kick account is connected and tokens are valid.';
            kickActions = actionsCol(
                `<button type="button" data-castle-disconnect="kick" class="${btnDisconnect} w-full sm:w-auto">Disconnect</button>`
            );
        } else {
            kickStatus =
                'Your Kick link needs attention — refresh the connection or disconnect and link again.';
            kickActions = actionsCol(`
                <a href="${escapeHTML(kickHref)}" class="${btnConnectKick} w-full sm:w-auto">Reconnect</a>
                <button type="button" data-castle-disconnect="kick" class="${btnDisconnect} w-full sm:w-auto">Disconnect</button>`);
        }

        const kickBlock = card(
            `${leftCol(
                '<img src="/kick-mark.svg" alt="" class="h-7 w-7 object-contain" />',
                'Kick',
                kickStatus,
                kickOkFlag,
                kickFine
            )}${kickActions}`
        );

        const ytFine =
            'When YouTube is supported, you’ll connect it here for drops and identity — similar to Twitch and Kick.';

        const youtubeBlock = card(
            `${leftCol(
                '<i class="bx bxl-youtube text-2xl text-red-500" aria-hidden="true"></i>',
                'YouTube',
                'YouTube linking is not available yet.',
                false,
                ytFine
            )}${actionsCol(
                `<span class="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest border border-white/10 text-void-muted cursor-not-allowed w-full sm:w-auto">Soon</span>`
            )}`
        );

        wrap.className = 'space-y-3';
        wrap.innerHTML = `${twitchBlock}${kickBlock}${youtubeBlock}`;
    }

    function renderViewerTeamList() {
        const teamList = document.getElementById('viewer-settings-team-list');
        const empty = document.getElementById('viewer-settings-team-empty');
        const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
        const teams = (u && Array.isArray(u.team_memberships)) ? u.team_memberships : [];
        if (!teamList) return;
        if (teams.length === 0) {
            teamList.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        teamList.innerHTML = teams
            .map((m) => {
                const s = m.streamer || m;
                const name = s.brand_name || s.display_name || s.username || 'Channel';
                const role = (m.role || m.team_role || 'team').toString();
                const uname = s.username || '';
                const avatar = s.avatar_url || s.brand_logo_url || '/assets/default-avatar.png';
                return `
                <div class="flex items-center justify-between gap-4 py-3 px-4 rounded-xl border border-white/5 bg-black/30 hover:border-white/10 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${escapeHTML(avatar)}" alt="" class="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 shadow-md shadow-black/30" />
                        <div class="min-w-0">
                            <div class="text-sm font-display font-black text-white uppercase italic tracking-tight truncate">${escapeHTML(name)}</div>
                            <div class="text-[9px] font-black uppercase tracking-[0.2em] text-void-muted">${escapeHTML(role)}</div>
                        </div>
                    </div>
                    ${uname ? `<a href="/binder/${encodeURIComponent(uname)}" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-void-accent border border-void-accent/25 bg-void-accent/5 hover:bg-void-accent/15 shrink-0 transition-colors">Open</a>` : ''}
                </div>`;
            })
            .join('');
    }

    async function loadViewerBlockedStreamers() {
        const listEl = document.getElementById('viewer-blocked-list');
        if (!listEl) return;
        listEl.innerHTML = '<p class="text-[10px] font-black uppercase tracking-widest text-void-muted py-2">Loading…</p>';
        try {
            const res = await fetch(`${backendBase()}/api/user/blocked-streamers`, { credentials: 'include' });
            if (!res.ok) {
                listEl.innerHTML = `<p class="text-xs text-red-400/90">Could not load blocks (${res.status})</p>`;
                return;
            }
            const rows = await res.json();
            if (!Array.isArray(rows) || rows.length === 0) {
                listEl.innerHTML = '<p class="text-xs text-void-muted/80 italic py-2 border border-dashed border-white/10 rounded-xl px-4">No channels blocked.</p>';
                return;
            }
            listEl.innerHTML = rows
                .map((row) => {
                    const s = row.streamer || {};
                    const label = s.brand_name || s.display_name || s.username || row.streamer_id;
                    const sid = row.streamer_id;
                    return `
                    <div class="flex items-center justify-between gap-3 py-3 px-4 rounded-xl border border-white/5 bg-black/30 hover:border-white/10 transition-colors">
                        <span class="text-sm font-display font-black text-white uppercase italic tracking-tight truncate">${escapeHTML(String(label))}</span>
                        <button type="button" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-red-400 border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 viewer-unblock-btn transition-colors" data-streamer-id="${escapeHTML(String(sid))}">Remove</button>
                    </div>`;
                })
                .join('');
            listEl.querySelectorAll('.viewer-unblock-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-streamer-id');
                    if (id) void removeViewerStreamerBlock(id);
                });
            });
        } catch (e) {
            listEl.innerHTML = '<p class="text-xs text-red-400/90">Could not load blocks.</p>';
        }
    }

    async function addViewerStreamerBlock() {
        const input = document.getElementById('viewer-block-streamer-input');
        const raw = (input && input.value) ? input.value.trim() : '';
        if (!raw) {
            if (typeof showToast === 'function') showToast('Enter a creator username.', 'error');
            return;
        }
        if (!csrfVal()) await ensureCsrfToken();
        try {
            const res = await fetch(`${backendBase()}/api/user/blocked-streamers`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ username: raw })
            });
            const errData = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = errData && errData.error ? errData.error : 'Could not block channel';
                if (typeof showToast === 'function') showToast(String(msg), 'error');
                return;
            }
            if (input) input.value = '';
            if (typeof showToast === 'function') showToast('Channel blocked', 'success');
            await loadViewerBlockedStreamers();
        } catch (e) {
            if (typeof showToast === 'function') showToast('Network error', 'error');
        }
    }

    async function removeViewerStreamerBlock(streamerId) {
        if (!csrfVal()) await ensureCsrfToken();
        try {
            const res = await fetch(
                `${backendBase()}/api/user/blocked-streamers?streamer_id=${encodeURIComponent(streamerId)}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'X-CSRF-Token': csrfVal() }
                }
            );
            const errData = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = errData && errData.error ? errData.error : 'Could not remove block';
                if (typeof showToast === 'function') showToast(String(msg), 'error');
                return;
            }
            if (typeof showToast === 'function') showToast('Block removed', 'success');
            await loadViewerBlockedStreamers();
        } catch (e) {
            if (typeof showToast === 'function') showToast('Network error', 'error');
        }
    }

    async function submitViewerDeleteAccount() {
        const input = document.getElementById('viewer-delete-confirm-input');
        const phrase = (input && input.value) ? input.value.trim() : '';
        if (phrase !== 'DELETE MY CASTLE ACCOUNT') {
            if (typeof showToast === 'function') showToast('Type the confirmation phrase exactly.', 'error');
            return;
        }
        if (!csrfVal()) await ensureCsrfToken();
        try {
            const res = await fetch(`${backendBase()}/api/user/delete-account`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ confirmation: phrase })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data && data.error ? data.error : 'Could not delete account';
                if (typeof showToast === 'function') showToast(String(msg), 'error');
                return;
            }
            try {
                sessionStorage.clear();
            } catch (_) { /* ignore */ }
            window.location.href = '/login';
        } catch (e) {
            if (typeof showToast === 'function') showToast('Network error', 'error');
        }
    }

    async function populateProfileView() {
        const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
        if (!u) return;
        initViewerProfileSettingsOnce();
        setViewerProfileTab('channels');

        const av = document.getElementById('viewer-settings-avatar');
        if (av) av.src = u.avatar || u.avatar_url || '/assets/default-avatar.png';

        const nameEl = document.getElementById('viewer-settings-display-name');
        if (nameEl) nameEl.textContent = u.display_name || u.name || '—';

        const roleBadge = document.getElementById('viewer-settings-role-badge');
        if (roleBadge) {
            const base =
                'text-[10px] font-black uppercase tracking-[0.18em] px-3.5 py-1.5 rounded-full border';
            if (u.is_creator) {
                roleBadge.textContent = 'CREATOR';
                roleBadge.className = `${base} bg-void-accent text-black border-void-accent shadow-sm shadow-void-accent/20`;
            } else if (u.team_memberships && u.team_memberships.length) {
                roleBadge.textContent = 'TEAM';
                roleBadge.className = `${base} bg-indigo-500/15 text-indigo-300 border-indigo-500/25`;
            } else {
                roleBadge.textContent = 'COLLECTOR';
                roleBadge.className = `${base} bg-white/[0.06] text-void-muted border-white/10`;
            }
        }

        try {
            const res = await fetch(`${backendBase()}/api/trade/code`, { credentials: 'include' });
            if (res.ok) {
                const d = await res.json();
                const c = document.getElementById('viewer-settings-castle-code');
                if (c) c.textContent = d.trade_code || '—';
            }
        } catch (e) { /* ignore */ }

        const upgradeCard = document.getElementById('viewer-settings-upgrade-card');
        if (upgradeCard) {
            upgradeCard.classList.toggle('hidden', !!u.is_creator);
        }

        await renderViewerSettingsConnections();
        renderViewerTeamList();
        await loadViewerBlockedStreamers();
    }

    /** Creator Channel Points: configure on the creator dashboard (modal lives there). */
    function openTwitchSettingsFromAccountPage() {
        window.location.href = '/dashboard';
    }

    /**
     * Personalisation preferences — stored in localStorage.
     * Keys: castle_pref_foil, castle_pref_tilt, castle_pref_dupes (bool, default true)
     *       castle_pref_reduce_motion (bool, default false)
     *       castle_pref_card_size ('small'|'medium'|'large', default 'medium')
     *       castle_pref_sort ('newest'|'oldest'|'rarity'|'name', default 'newest')
     */
    function getPref(key, defaultVal) {
        try {
            const v = localStorage.getItem(key);
            if (v === null) return defaultVal;
            if (v === 'true') return true;
            if (v === 'false') return false;
            return v;
        } catch (_) { return defaultVal; }
    }

    function setPref(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (_) { /* ignore */ }
    }

    function applyReduceMotion(enabled) {
        document.documentElement.classList.toggle('castle-reduce-motion', !!enabled);
    }

    function flashSavedNotice() {
        const el = document.getElementById('pref-saved-notice');
        if (!el) return;
        el.classList.remove('hidden');
        clearTimeout(el._saveTimer);
        el._saveTimer = setTimeout(() => el.classList.add('hidden'), 2000);
    }

    function syncToggleUI(btn, on) {
        if (!btn) return;
        const knob = btn.querySelector('span');
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        if (on) {
            btn.classList.remove('bg-white/[0.08]');
            btn.classList.add('bg-void-accent');
            if (knob) { knob.classList.add('translate-x-5'); knob.classList.remove('translate-x-0'); }
        } else {
            btn.classList.remove('bg-void-accent');
            btn.classList.add('bg-white/[0.08]');
            if (knob) { knob.classList.remove('translate-x-5'); knob.classList.add('translate-x-0'); }
        }
    }

    function syncCardSizeUI(size) {
        document.querySelectorAll('.pref-card-size-btn').forEach((btn) => {
            const active = btn.getAttribute('data-pref-card-size') === size;
            btn.classList.toggle('bg-void-accent/15', active);
            btn.classList.toggle('text-void-accent', active);
            btn.classList.toggle('border', active);
            btn.classList.toggle('border-void-accent/30', active);
            btn.classList.toggle('text-void-muted', !active);
        });
    }

    function initPersonalisationPrefs() {
        // Load stored values (with sensible defaults)
        const foilOn      = getPref('castle_pref_foil', true);
        const tiltOn      = getPref('castle_pref_tilt', true);
        const dupesOn     = getPref('castle_pref_dupes', true);
        const reduceOn    = getPref('castle_pref_reduce_motion', false);
        const cardSize    = getPref('castle_pref_card_size', 'medium');
        const sortDefault = getPref('castle_pref_sort', 'newest');

        // Apply reduce-motion immediately
        applyReduceMotion(reduceOn);

        // Sync toggle UIs
        syncToggleUI(document.getElementById('pref-toggle-foil'), foilOn);
        syncToggleUI(document.getElementById('pref-toggle-tilt'), tiltOn);
        syncToggleUI(document.getElementById('pref-toggle-dupes'), dupesOn);
        syncToggleUI(document.getElementById('pref-toggle-reduce-motion'), reduceOn);

        // Sync card-size buttons
        syncCardSizeUI(cardSize);

        // Sync sort select
        const sortSel = document.getElementById('pref-default-sort');
        if (sortSel) sortSel.value = sortDefault;

        // Wire toggles
        document.querySelectorAll('.pref-toggle').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-pref-key');
                const currentOn = btn.getAttribute('aria-checked') === 'true';
                const newOn = !currentOn;
                syncToggleUI(btn, newOn);
                setPref(key, newOn);
                if (key === 'castle_pref_reduce_motion') applyReduceMotion(newOn);
                flashSavedNotice();
                // Dispatch event so rest of app can react
                window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key, value: newOn } }));
            });
        });

        // Wire card-size buttons
        document.querySelectorAll('.pref-card-size-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const size = btn.getAttribute('data-pref-card-size');
                syncCardSizeUI(size);
                setPref('castle_pref_card_size', size);
                flashSavedNotice();
                window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key: 'castle_pref_card_size', value: size } }));
            });
        });

        // Wire sort select
        if (sortSel) {
            sortSel.addEventListener('change', () => {
                setPref('castle_pref_sort', sortSel.value);
                flashSavedNotice();
                window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key: 'castle_pref_sort', value: sortSel.value } }));
            });
        }
    }

    // Apply reduce-motion on every page load from localStorage (before DOMContentLoaded)
    (function applyReduceMotionEarly() {
        try {
            if (localStorage.getItem('castle_pref_reduce_motion') === 'true') {
                document.documentElement.classList.add('castle-reduce-motion');
            }
        } catch (_) { /* ignore */ }
    })();

    window.setViewerProfileTab = setViewerProfileTab;
    window.initViewerProfileSettingsOnce = initViewerProfileSettingsOnce;
    window.populateProfileView = populateProfileView;
    window.renderViewerSettingsConnections = renderViewerSettingsConnections;
    window.renderViewerTeamList = renderViewerTeamList;
    window.loadViewerBlockedStreamers = loadViewerBlockedStreamers;
    window.addViewerStreamerBlock = addViewerStreamerBlock;
    window.removeViewerStreamerBlock = removeViewerStreamerBlock;
    window.submitViewerDeleteAccount = submitViewerDeleteAccount;
    window.openTwitchSettingsFromAccountPage = openTwitchSettingsFromAccountPage;
    window.initPersonalisationPrefs = initPersonalisationPrefs;
    window.getPref = getPref;
})();
