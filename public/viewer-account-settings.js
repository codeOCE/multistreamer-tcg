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
            'profile-settings-tab flex-1 whitespace-nowrap px-4 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all border';
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
            transactions: document.getElementById('profile-panel-transactions'),
            security: document.getElementById('profile-panel-security'),
            accessibility: document.getElementById('profile-panel-accessibility'),
            notifications: document.getElementById('profile-panel-notifications'),
            upgrade: document.getElementById('profile-panel-upgrade'),
            redeem: document.getElementById('profile-panel-redeem'),
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
        document.getElementById('viewer-block-streamer-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') void addViewerStreamerBlock();
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

        document.getElementById('redeem-code-btn')?.addEventListener('click', () => {
            void submitRedeemCode();
        });
        document.getElementById('redeem-code-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') void submitRedeemCode();
        });

        initPersonalisationPrefs();
        initRegionalPrefs();
        initPrivacyPrefs();
        initNotificationPrefs();
        initAllVoidDropdowns();
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

    async function submitRedeemCode() {
        const input = document.getElementById('redeem-code-input');
        const resultEl = document.getElementById('redeem-result');
        const raw = (input && input.value) ? input.value.trim().toUpperCase() : '';
        if (!raw) {
            if (typeof showToast === 'function') showToast('Enter a redeem code.', 'error');
            return;
        }
        if (!csrfVal()) await ensureCsrfToken();
        try {
            const res = await fetch(`${backendBase()}/api/redeem/code`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ code: raw })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data && data.error ? data.error : 'Invalid or expired code.';
                if (typeof showToast === 'function') showToast(String(msg), 'error');
                if (resultEl) {
                    resultEl.className = 'text-xs text-red-400/90 py-2';
                    resultEl.textContent = String(msg);
                }
                return;
            }
            if (input) input.value = '';
            const reward = data.reward || data.message || 'Code redeemed successfully!';
            if (typeof showToast === 'function') showToast(String(reward), 'success');
            if (resultEl) {
                resultEl.className = 'text-xs text-emerald-400/90 py-2';
                resultEl.textContent = String(reward);
            }
        } catch (e) {
            if (typeof showToast === 'function') showToast('Network error', 'error');
        }
    }

    async function populateProfileView() {
        const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
        if (!u) return;

        // Hydrate prefs from server bootstrap (cross-device sync).
        // window.castleUiPrefs is set by settings.js / app.js after bootstrap resolves.
        const serverPrefs = window.castleUiPrefs || null;
        if (serverPrefs && typeof serverPrefs === 'object' && Object.keys(serverPrefs).length > 0) {
            hydrateLocalStorageFromUiPrefs(serverPrefs);
            setCastlePrefsCookie(serverPrefs);
            // Re-apply classes in case early-apply IIFE used stale/empty localStorage
            applyLightMode(getPref('castle_pref_light_mode', false));
            applyReduceMotion(getPref('castle_pref_reduce_motion', false));
            applyNoAnimations(getPref('castle_pref_no_animations', false));
            applyPhotosensitivity(getPref('castle_pref_photosensitivity', false));
            applyFoil(getPref('castle_pref_foil', true));
            applyTilt(getPref('castle_pref_tilt', true));
            applyDupes(getPref('castle_pref_dupes', true));
        }

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

        const upgradeCard = document.getElementById('viewer-settings-upgrade-card');
        const alreadyCreator = document.getElementById('viewer-settings-already-creator');
        if (upgradeCard) upgradeCard.classList.toggle('hidden', !!u.is_creator);
        if (alreadyCreator) alreadyCreator.classList.toggle('hidden', !u.is_creator);

        renderViewerTeamList();

        const [tradeData] = await Promise.all([
            fetch(`${backendBase()}/api/trade/code`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null).catch(() => null),
            renderViewerSettingsConnections(),
            loadViewerBlockedStreamers()
        ]);
        if (tradeData) {
            const c = document.getElementById('viewer-settings-castle-code');
            if (c) c.textContent = tradeData.trade_code || '—';
        }
    }

    /** Creator Channel Points: configure on the creator dashboard (modal lives there). */
    function openTwitchSettingsFromAccountPage() {
        window.location.href = '/dashboard';
    }

    // ── Preference server-sync helpers ───────────────────────────────────────

    // Maps localStorage keys → server-side ui_prefs keys
    const PREF_SERVER_KEY = {
        castle_pref_light_mode:       'light_mode',
        castle_pref_reduce_motion:    'reduce_motion',
        castle_pref_no_animations:    'no_animations',
        castle_pref_photosensitivity: 'photosensitivity',
        castle_pref_foil:             'foil',
        castle_pref_tilt:             'tilt',
        castle_pref_dupes:            'dupes',
        castle_pref_sort:             'sort',
    };

    function buildClientPrefCookie(p) {
        const q = new URLSearchParams();
        q.set('lm', p.light_mode        ? '1' : '0');
        q.set('rm', p.reduce_motion     ? '1' : '0');
        q.set('na', p.no_animations     ? '1' : '0');
        q.set('ps', p.photosensitivity  ? '1' : '0');
        q.set('fo', p.foil  === false   ? '0' : '1');
        q.set('ti', p.tilt  === false   ? '0' : '1');
        q.set('du', p.dupes === false   ? '0' : '1');
        q.set('so', p.sort      || 'newest');
        return q.toString();
    }

    function setCastlePrefsCookie(uiPrefs) {
        try {
            const val = buildClientPrefCookie(uiPrefs);
            document.cookie = `castle_prefs=${encodeURIComponent(val)}; path=/; max-age=${365 * 86400}; SameSite=Lax`;
        } catch (_) {}
    }

    function hydrateLocalStorageFromUiPrefs(uiPrefs) {
        if (!uiPrefs || typeof uiPrefs !== 'object') return;
        try {
            if ('light_mode'       in uiPrefs) setPref('castle_pref_light_mode',       uiPrefs.light_mode);
            if ('reduce_motion'    in uiPrefs) setPref('castle_pref_reduce_motion',     uiPrefs.reduce_motion);
            if ('no_animations'    in uiPrefs) setPref('castle_pref_no_animations',     uiPrefs.no_animations);
            if ('photosensitivity' in uiPrefs) setPref('castle_pref_photosensitivity',  uiPrefs.photosensitivity);
            if ('foil'             in uiPrefs) setPref('castle_pref_foil',              uiPrefs.foil !== false);
            if ('tilt'             in uiPrefs) setPref('castle_pref_tilt',              uiPrefs.tilt !== false);
            if ('dupes'            in uiPrefs) setPref('castle_pref_dupes',             uiPrefs.dupes !== false);
            if ('sort'             in uiPrefs) setPref('castle_pref_sort',              uiPrefs.sort);
        } catch (_) {}
    }

    let _prefSaveTimer = null;
    let _pendingPrefUpdates = {};

    function scheduleServerPrefSave(serverKey, value) {
        if (!serverKey) return;
        _pendingPrefUpdates[serverKey] = value;
        clearTimeout(_prefSaveTimer);
        _prefSaveTimer = setTimeout(async () => {
            const updates = Object.assign({}, _pendingPrefUpdates);
            _pendingPrefUpdates = {};
            try {
                const b = backendBase();
                if (!b) return;
                if (!window.csrfToken) await ensureCsrfToken();
                const res = await fetch(`${b}/api/user/ui-prefs`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                    body: JSON.stringify(updates)
                });
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (data.ui_prefs) setCastlePrefsCookie(data.ui_prefs);
                }
            } catch (e) {
                console.warn('[prefs] Server save failed (prefs still in localStorage):', e);
            }
        }, 800);
    }

    /**
     * Personalisation preferences — stored in localStorage + synced to DB.
     * Keys: castle_pref_foil, castle_pref_tilt, castle_pref_dupes (bool, default true)
     *       castle_pref_reduce_motion (bool, default false)
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

    function applyLightMode(enabled) {
        document.documentElement.classList.toggle('castle-light-mode', !!enabled);
    }

    function applyNoAnimations(enabled) {
        document.documentElement.classList.toggle('castle-no-animations', !!enabled);
    }

    function applyPhotosensitivity(enabled) {
        document.documentElement.classList.toggle('castle-photosensitivity', !!enabled);
        if (enabled) {
            setPref('castle_pref_foil', false);
            setPref('castle_pref_tilt', false);
            syncToggleUI(document.getElementById('pref-toggle-foil'), false);
            syncToggleUI(document.getElementById('pref-toggle-tilt'), false);
            applyFoil(false);
            applyTilt(false);
            window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key: 'castle_pref_foil', value: false } }));
            window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key: 'castle_pref_tilt', value: false } }));
        }
    }

    function applyFoil(enabled) {
        document.documentElement.classList.toggle('castle-no-foil', !enabled);
    }

    function applyTilt(enabled) {
        document.documentElement.classList.toggle('castle-no-tilt', !enabled);
    }

    function applyDupes(enabled) {
        document.documentElement.classList.toggle('castle-hide-dupes', !enabled);
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

    function syncVoidDropdownMenu(container) {
        const native = container.querySelector('.void-dropdown-native');
        const label = container.querySelector('.void-dropdown-label');
        const optionsEl = container.querySelector('.void-dropdown-options');
        const target = optionsEl || container.querySelector('.void-dropdown-menu');
        if (!native || !target) return;
        target.innerHTML = Array.from(native.options).map(opt =>
            `<div class="void-dropdown-option${native.value === opt.value ? ' selected' : ''}" role="option" tabindex="-1" data-value="${opt.value.replace(/"/g, '&quot;')}">${opt.text}</div>`
        ).join('');
        target.querySelectorAll('.void-dropdown-option').forEach(opt => {
            opt.onclick = e => {
                e.stopPropagation();
                native.value = opt.dataset.value;
                if (label) label.textContent = opt.textContent;
                const menu = container.querySelector('.void-dropdown-menu');
                if (menu) { menu.hidden = true; menu.setAttribute('aria-hidden', 'true'); }
                container.querySelector('.void-dropdown-trigger').setAttribute('aria-expanded', 'false');
                container.classList.remove('void-dropdown-open');
                native.dispatchEvent(new Event('change', { bubbles: true }));
            };
        });
        const sel = native.options[native.selectedIndex];
        if (sel && label) label.textContent = sel.text;
    }

    function initVoidDropdown(container) {
        if (container.dataset.voidDropdownInit === 'true') return;
        container.dataset.voidDropdownInit = 'true';
        const native = container.querySelector('.void-dropdown-native');
        const trigger = container.querySelector('.void-dropdown-trigger');
        const menu = container.querySelector('.void-dropdown-menu');
        if (!native || !trigger || !menu) return;

        // Build search + options structure inside the menu
        const searchWrap = document.createElement('div');
        searchWrap.className = 'void-dropdown-search-wrap';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'void-dropdown-search';
        searchInput.placeholder = 'Search…';
        searchInput.setAttribute('autocomplete', 'off');
        searchWrap.appendChild(searchInput);

        const optionsEl = document.createElement('div');
        optionsEl.className = 'void-dropdown-options';

        const noResults = document.createElement('div');
        noResults.className = 'void-dropdown-no-results';
        noResults.textContent = 'No results';
        noResults.hidden = true;

        menu.appendChild(searchWrap);
        menu.appendChild(optionsEl);
        menu.appendChild(noResults);
        syncVoidDropdownMenu(container);

        function filterOptions(q) {
            const query = q.toLowerCase().trim();
            let visible = 0;
            optionsEl.querySelectorAll('.void-dropdown-option').forEach(opt => {
                const show = !query || opt.textContent.toLowerCase().includes(query);
                opt.hidden = !show;
                if (show) visible++;
            });
            noResults.hidden = visible > 0;
        }

        searchInput.addEventListener('input', () => filterOptions(searchInput.value));
        searchInput.addEventListener('click', e => e.stopPropagation());
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                optionsEl.querySelector('.void-dropdown-option:not([hidden])')?.focus();
            }
        });
        optionsEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const opts = Array.from(optionsEl.querySelectorAll('.void-dropdown-option:not([hidden])'));
                const idx = opts.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') (opts[idx + 1] || opts[0])?.focus();
                else if (idx > 0) opts[idx - 1].focus();
                else searchInput.focus();
            }
        });

        const open = () => {
            syncVoidDropdownMenu(container);
            searchInput.value = '';
            filterOptions('');
            menu.hidden = false;
            menu.setAttribute('aria-hidden', 'false');
            trigger.setAttribute('aria-expanded', 'true');
            container.classList.add('void-dropdown-open');
            requestAnimationFrame(() => searchInput.focus());
        };
        const close = () => {
            menu.hidden = true;
            menu.setAttribute('aria-hidden', 'true');
            trigger.setAttribute('aria-expanded', 'false');
            container.classList.remove('void-dropdown-open');
        };
        trigger.onclick = e => {
            e.stopPropagation();
            if (menu.hidden) {
                open();
                const handler = ev => {
                    if (!container.contains(ev.target)) {
                        close();
                        document.removeEventListener('click', handler);
                    }
                };
                setTimeout(() => document.addEventListener('click', handler), 0);
            } else {
                close();
            }
        };
        native.addEventListener('change', () => {
            const sel = native.options[native.selectedIndex];
            const label = container.querySelector('.void-dropdown-label');
            if (sel && label) label.textContent = sel.text;
        });
    }

    function initAllVoidDropdowns() {
        document.querySelectorAll('.void-dropdown').forEach(el => {
            if (!el.dataset.voidDropdownInit) initVoidDropdown(el);
        });
    }

    function autoDetectTimezone() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; }
    }

    function getUtcOffset(tz) {
        try {
            const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
            const raw = parts.find(p => p.type === 'timeZoneName')?.value || '';
            const converted = raw.replace(/^GMT/, 'UTC');
            return converted === 'UTC' ? 'UTC+0' : converted;
        } catch (_) { return ''; }
    }

    function enrichTimezoneOptions(sel) {
        Array.from(sel.options).forEach(opt => {
            const offset = getUtcOffset(opt.value);
            if (offset) opt.text = opt.text + ' — ' + offset;
        });
    }

    async function saveNotificationPref(key, value) {
        try {
            const b = backendBase();
            if (!b) return;
            if (!window.csrfToken) await ensureCsrfToken();
            const res = await fetch(`${b}/api/user/notification-prefs`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ [key]: value })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.warn('[notifications] Server save failed:', e);
            showToast('Failed to save notification setting', 'error');
        }
    }

    function initNotificationPrefs() {
        const saved = window.castleNotificationPrefs || {};
        const KEYS = ['card_drops', 'trades', 'achievements'];
        const ID_MAP = {
            card_drops:   'notif-toggle-card-drops',
            trades:       'notif-toggle-trades',
            achievements: 'notif-toggle-achievements',
        };

        for (const key of KEYS) {
            const on = key in saved ? !!saved[key] : true;
            const btn = document.getElementById(ID_MAP[key]);
            syncToggleUI(btn, on);
        }

        document.querySelectorAll('.notification-toggle').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-notif-key');
                if (!key) return;
                const currentOn = btn.getAttribute('aria-checked') === 'true';
                const newOn = !currentOn;
                syncToggleUI(btn, newOn);
                flashSavedNotice();
                saveNotificationPref(key, newOn);
            });
        });
    }

    async function savePrivacyPref(key, value) {
        try {
            const b = backendBase();
            if (!b) return;
            if (!window.csrfToken) await ensureCsrfToken();
            const res = await fetch(`${b}/api/user/privacy`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ [key]: value })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.warn('[privacy] Server save failed:', e);
            showToast('Failed to save privacy setting', 'error');
        }
    }

    function initPrivacyPrefs() {
        const saved = window.castlePrivacyPrefs || {};

        // All keys default to true (open by default)
        const KEYS = ['profile_public', 'collection_public', 'show_on_leaderboard', 'wishlist_public', 'trade_code_public'];
        const ID_MAP = {
            profile_public:       'privacy-toggle-profile-public',
            collection_public:    'privacy-toggle-collection-public',
            show_on_leaderboard:  'privacy-toggle-show-on-leaderboard',
            wishlist_public:      'privacy-toggle-wishlist-public',
            trade_code_public:    'privacy-toggle-trade-code-public',
        };

        for (const key of KEYS) {
            const on = key in saved ? !!saved[key] : true;
            const btn = document.getElementById(ID_MAP[key]);
            syncToggleUI(btn, on);
        }

        document.querySelectorAll('.privacy-toggle').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-privacy-key');
                if (!key) return;
                const currentOn = btn.getAttribute('aria-checked') === 'true';
                const newOn = !currentOn;
                syncToggleUI(btn, newOn);
                flashSavedNotice();
                savePrivacyPref(key, newOn);
            });
        });
    }

    async function saveRegionalPref(key, value) {
        try {
            const b = backendBase();
            if (!b) return;
            if (!window.csrfToken) await ensureCsrfToken();
            await fetch(`${b}/api/user/regional-prefs`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfVal() },
                body: JSON.stringify({ [key]: value })
            });
        } catch (e) {
            console.warn('[regional] Server save failed:', e);
        }
    }

    function initRegionalPrefs() {
        const saved = window.castleRegionalPrefs || {};

        const tzSel = document.getElementById('regional-timezone');
        const langSel = document.getElementById('regional-language');
        const currSel = document.getElementById('regional-currency');

        if (tzSel) {
            enrichTimezoneOptions(tzSel);
            const tz = saved.timezone || autoDetectTimezone();
            const opt = tzSel.querySelector(`option[value="${CSS.escape ? CSS.escape(tz) : tz}"]`);
            if (opt) tzSel.value = tz;
            else {
                const o = document.createElement('option');
                o.value = tz;
                const offset = getUtcOffset(tz);
                o.textContent = tz + (offset ? ' — ' + offset : '');
                tzSel.appendChild(o);
                tzSel.value = tz;
            }
            tzSel.addEventListener('change', () => saveRegionalPref('timezone', tzSel.value));
        }

        if (langSel) {
            if (saved.language) langSel.value = saved.language;
            langSel.addEventListener('change', () => saveRegionalPref('language', langSel.value));
        }

        if (currSel) {
            if (saved.currency) currSel.value = saved.currency;
            currSel.addEventListener('change', () => saveRegionalPref('currency', currSel.value));
        }
    }

    function initPersonalisationPrefs() {
        // Load stored values (with sensible defaults)
        const foilOn          = getPref('castle_pref_foil', true);
        const tiltOn          = getPref('castle_pref_tilt', true);
        const dupesOn         = getPref('castle_pref_dupes', true);
        const reduceOn        = getPref('castle_pref_reduce_motion', false);
        const noAnimOn        = getPref('castle_pref_no_animations', false);
        const photosensOn     = getPref('castle_pref_photosensitivity', false);
        const lightModeOn     = getPref('castle_pref_light_mode', false);
        const sortDefault     = getPref('castle_pref_sort', 'newest');

        // Apply document-level classes immediately
        applyReduceMotion(reduceOn);
        applyNoAnimations(noAnimOn);
        applyLightMode(lightModeOn);
        applyPhotosensitivity(photosensOn);
        applyFoil(foilOn);
        applyTilt(tiltOn);
        applyDupes(dupesOn);

        // Sync toggle UIs
        syncToggleUI(document.getElementById('pref-toggle-foil'), foilOn);
        syncToggleUI(document.getElementById('pref-toggle-tilt'), tiltOn);
        syncToggleUI(document.getElementById('pref-toggle-dupes'), dupesOn);
        syncToggleUI(document.getElementById('pref-toggle-reduce-motion'), reduceOn);
        syncToggleUI(document.getElementById('pref-toggle-no-animations'), noAnimOn);
        syncToggleUI(document.getElementById('pref-toggle-photosensitivity'), photosensOn);
        syncToggleUI(document.getElementById('pref-toggle-light-mode'), lightModeOn);

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
                if (key === 'castle_pref_no_animations') applyNoAnimations(newOn);
                if (key === 'castle_pref_light_mode') applyLightMode(newOn);
                if (key === 'castle_pref_photosensitivity') applyPhotosensitivity(newOn);
                if (key === 'castle_pref_foil') applyFoil(newOn);
                if (key === 'castle_pref_tilt') applyTilt(newOn);
                if (key === 'castle_pref_dupes') applyDupes(newOn);
                flashSavedNotice();
                scheduleServerPrefSave(PREF_SERVER_KEY[key], newOn);
                window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key, value: newOn } }));
            });
        });

        // Wire sort select
        if (sortSel) {
            sortSel.addEventListener('change', () => {
                setPref('castle_pref_sort', sortSel.value);
                flashSavedNotice();
                scheduleServerPrefSave('sort', sortSel.value);
                window.dispatchEvent(new CustomEvent('castle:pref-change', { detail: { key: 'castle_pref_sort', value: sortSel.value } }));
            });
        }
    }

    // Apply document-level classes early from localStorage to avoid flash
    (function applyPrefsEarly() {
        try {
            if (localStorage.getItem('castle_pref_reduce_motion') === 'true')
                document.documentElement.classList.add('castle-reduce-motion');
            if (localStorage.getItem('castle_pref_no_animations') === 'true')
                document.documentElement.classList.add('castle-no-animations');
            if (localStorage.getItem('castle_pref_light_mode') === 'true')
                document.documentElement.classList.add('castle-light-mode');
            if (localStorage.getItem('castle_pref_photosensitivity') === 'true')
                document.documentElement.classList.add('castle-photosensitivity');
            if (localStorage.getItem('castle_pref_foil') === 'false')
                document.documentElement.classList.add('castle-no-foil');
            if (localStorage.getItem('castle_pref_tilt') === 'false')
                document.documentElement.classList.add('castle-no-tilt');
            if (localStorage.getItem('castle_pref_dupes') === 'false')
                document.documentElement.classList.add('castle-hide-dupes');
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
    window.setCastlePrefsCookie = setCastlePrefsCookie;
    window.hydrateLocalStorageFromUiPrefs = hydrateLocalStorageFromUiPrefs;
    window.submitRedeemCode = submitRedeemCode;
    window.applyLightMode = applyLightMode;
    window.applyNoAnimations = applyNoAnimations;
    window.applyPhotosensitivity = applyPhotosensitivity;
    window.applyFoil = applyFoil;
    window.applyTilt = applyTilt;
    window.applyDupes = applyDupes;
})();
