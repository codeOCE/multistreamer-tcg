/**
 * leaderboard.js — Creator Leaderboard Page (/{slug}/leaderboard)
 */
(function () {
'use strict';

const LB_BACKEND = (document.querySelector('meta[name="castle-public-url"]')?.content || '').replace(/\/$/, '');

const LB_SLUG = (() => {
    const parts = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    // /{slug}/leaderboard → slug is parts[0]
    if (parts.length >= 1 && parts[parts.length - 1] !== 'leaderboard') return '';
    return parts[0] ? parts[0].toLowerCase() : '';
})();

function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── State ── */
let leaderboard = [];
let activeTab   = 'collection';
let currentUser = null;

/* ── Boot ── */
(async function init() {
    if (!LB_SLUG) { showNotFound(); return; }

    try {
        const [pageRes, sessionRes] = await Promise.all([
            fetch(`${LB_BACKEND}/api/public/collection-page?streamer=${encodeURIComponent(LB_SLUG)}`),
            fetch(`${LB_BACKEND}/api/auth/session`).catch(() => null),
        ]);

        if (!pageRes.ok) { showNotFound(); return; }
        const pageData = await pageRes.json();
        if (!pageData.streamer) { showNotFound(); return; }

        leaderboard = pageData.leaderboard || [];

        if (sessionRes && sessionRes.ok) {
            const sess = await sessionRes.json().catch(() => null);
            if (sess && sess.user) {
                currentUser = sess.user;
                setupNavUser(sess.user);
            }
        }

        applyBrand(pageData.streamer.brand_color_primary);
        renderHero(pageData.streamer);
        renderBoard();
        showMain();
    } catch (e) {
        console.error('[Leaderboard] init error', e);
        showNotFound();
    }
})();

/* ── Nav user ── */
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

/* ── Brand colour ── */
function applyBrand(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const rgb = `${r}, ${g}, ${b}`;
    const root = document.documentElement;
    root.style.setProperty('--page-accent', hex);
    root.style.setProperty('--page-accent-rgb', rgb);
    root.style.setProperty('--void-accent', hex);
    root.style.setProperty('--void-accent-rgb', rgb);
}

/* ── Hero ── */
function renderHero(streamer) {
    const name = streamer.brand_name || streamer.display_name || streamer.username || LB_SLUG;
    const el = document.getElementById('lb-creator-name');
    if (el) el.textContent = name;
    document.title = `${name} · Leaderboard · Castle TCG`;
}

/* ── Tab public API ── */
window._lbSetTab = function (tab) {
    activeTab = tab;
    document.getElementById('lb-tab-collection')?.classList.toggle('active', tab === 'collection');
    document.getElementById('lb-tab-battles')?.classList.toggle('active', tab === 'battles');
    renderBoard();
};

/* ── Board render ── */
function renderBoard() {
    const titleEl = document.getElementById('lb-board-title');
    const countEl = document.getElementById('lb-board-count');
    const listEl  = document.getElementById('lb-list');
    if (!listEl) return;

    if (activeTab === 'collection') {
        const rows = [...leaderboard]
            .sort((a, b) => (b.card_count ?? b.total_cards ?? 0) - (a.card_count ?? a.total_cards ?? 0))
            .filter(r => (r.card_count ?? r.total_cards ?? 0) > 0);

        if (titleEl) titleEl.textContent = 'Collection Leaderboard';
        if (countEl) countEl.textContent = rows.length ? `${rows.length} collector${rows.length !== 1 ? 's' : ''}` : '';

        if (rows.length === 0) {
            listEl.innerHTML = `<div class="lb-empty">No collectors yet</div>`;
            return;
        }

        listEl.innerHTML = rows.map((r, i) => {
            const count = r.card_count ?? r.total_cards ?? 0;
            const isMe  = currentUser && (r.twitch_id === currentUser.uid || r.twitch_id === currentUser.twitch_id);
            return rowHTML(r, i, `<span class="lb-score-val">${count}</span> card${count !== 1 ? 's' : ''}`, isMe, i === 3);
        }).join('');

    } else {
        const rows = [...leaderboard]
            .sort((a, b) => (b.battle_wins ?? 0) - (a.battle_wins ?? 0))
            .filter(r => (r.battle_wins ?? 0) > 0);

        if (titleEl) titleEl.textContent = 'Battle Leaderboard';
        if (countEl) countEl.textContent = rows.length ? `${rows.length} fighter${rows.length !== 1 ? 's' : ''}` : '';

        if (rows.length === 0) {
            listEl.innerHTML = `<div class="lb-empty">No battles recorded yet</div>`;
            return;
        }

        listEl.innerHTML = rows.map((r, i) => {
            const wins = r.battle_wins ?? 0;
            const isMe = currentUser && (r.twitch_id === currentUser.uid || r.twitch_id === currentUser.twitch_id);
            return rowHTML(r, i, `<span class="lb-score-val">${wins}</span> win${wins !== 1 ? 's' : ''}`, isMe, i === 3);
        }).join('');
    }
}

function rankLabel(i) {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
}

function avatarHTML(r) {
    const name = esc(r.display_name || r.username || r.twitch_id || '?');
    const initial = name.charAt(0).toUpperCase();
    if (r.avatar_url) {
        return `<img class="lb-avatar" src="${esc(r.avatar_url)}" alt="${name}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span
            class="lb-avatar lb-avatar-fallback" style="display:none">${initial}</span>`;
    }
    return `<span class="lb-avatar lb-avatar-fallback">${initial}</span>`;
}

function rowHTML(r, i, scoreHTML, isMe, addDivider) {
    const name     = esc(r.display_name || r.username || r.twitch_id || 'Unknown');
    const rankCls  = i < 3 ? ` lb-rank-${i + 1}` : '';
    const rowCls   = isMe ? ' lb-row-me' : '';
    const youBadge = isMe ? `<span class="lb-you-badge">You</span>` : '';
    const divider  = addDivider ? `<div class="lb-tier-divider"></div>` : '';
    return `${divider}<div class="lb-row${rowCls}">
        <span class="lb-rank${rankCls}">${rankLabel(i)}</span>
        ${avatarHTML(r)}
        <span class="lb-name">${name}</span>
        ${youBadge}
        <span class="lb-score">${scoreHTML}</span>
    </div>`;
}

/* ── Visibility helpers ── */
function showMain() {
    document.getElementById('lb-loading')?.classList.add('hidden');
    document.getElementById('lb-main')?.classList.remove('hidden');
}

function showNotFound() {
    document.getElementById('lb-loading')?.classList.add('hidden');
    document.getElementById('lb-not-found')?.classList.remove('hidden');
}

})();
