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
let myRank      = null;       // viewer's own rank/stats (even if outside top 100)
let sortKey     = 'points';   // default sort = weighted rarity points (always highest-first)

// Battles tab (lazy-loaded on first open)
let battleLeaderboard = [];
let myBattleRank      = null;
let battleSortKey     = 'rating';   // default sort = Castle rank
let battleLoaded      = false;

/* Leaderboard point weights (from "weight on leaderboard").
   Points are computed client-side from each collector's CURRENT rarity
   holdings so the score always reflects the live collection. */
const LB_POINT_WEIGHTS = {
    legendary_count: 20,
    epic_count:      10,
    rare_count:       5,
    uncommon_count:   2,
    common_count:     1,
};
function lbPoints(r) {
    let pts = 0;
    for (const key in LB_POINT_WEIGHTS) pts += (Number(r[key]) || 0) * LB_POINT_WEIGHTS[key];
    return pts;
}
function lbVal(r, key) {
    return key === 'points' ? lbPoints(r) : (Number(r[key]) || 0);
}

/* Sortable numeric columns (after rank + collector).
   `short` is the compact header label; `cls` colours nonzero values. */
const LB_COLS = [
    { key: 'points',          label: 'Points',    short: 'Points', cls: 'lb-cell-points' },
    { key: 'card_count',      label: 'Total Cards', short: 'Cards', cls: '' },
    { key: 'legendary_count', label: 'Legendary', short: 'Leg',  cls: 'lb-r-legendary' },
    { key: 'epic_count',      label: 'Epic',      short: 'Epic', cls: 'lb-r-epic' },
    { key: 'rare_count',      label: 'Rare',      short: 'Rare', cls: 'lb-r-rare' },
    { key: 'uncommon_count',  label: 'Uncommon',  short: 'Unc',  cls: 'lb-r-uncommon' },
    { key: 'common_count',    label: 'Common',    short: 'Com',  cls: 'lb-r-common' },
];

/* Battle table columns. Castle rank is the ELO rating; win % is wins over
   total battles. `fmt` formats the displayed value; `noDim` keeps a value
   coloured even when it's 0. */
const BATTLE_COLS = [
    { key: 'rating',        label: 'Castle Rank',   short: 'Castle Rank', cls: 'lb-cell-points', noDim: true },
    { key: 'wins',          label: 'Wins',          short: 'Wins',        cls: 'lb-c-win' },
    { key: 'losses',        label: 'Losses',        short: 'Losses',      cls: 'lb-c-loss' },
    { key: 'win_rate',      label: 'Win %',         short: 'Win %',       cls: '', fmt: (v) => `${(Number(v) || 0).toFixed(1)}%` },
    { key: 'total_battles', label: 'Total Battles', short: 'Battles',     cls: '' },
];

/* ── Boot ── */
(async function init() {
    if (!LB_SLUG) { showNotFound(); return; }

    try {
        const [pageRes, sessionRes] = await Promise.all([
            // lbv bumps the edge-cache key so the leaderboard always gets the
            // rarity-aware response shape (increment if the payload shape changes).
            fetch(`${LB_BACKEND}/api/public/collection-page?streamer=${encodeURIComponent(LB_SLUG)}&lbv=2`),
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

        // Fetch the viewer's own rank in the background; re-render to append
        // their "your position" row if they're outside the top 100.
        if (currentUser) loadMyRank();
    } catch (e) {
        console.error('[Leaderboard] init error', e);
        showNotFound();
    }
})();

/* ── Viewer's own rank (even if outside top 100) ── */
async function loadMyRank() {
    try {
        const res = await fetch(
            `${LB_BACKEND}/api/public/collector-rank?streamer=${encodeURIComponent(LB_SLUG)}`,
            { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        myRank = data?.rank || null;
        if (myRank && activeTab === 'collection') renderBoard();
    } catch (_) { /* non-fatal */ }
}

/* ── Battles data (lazy-loaded the first time the tab is opened) ── */
async function loadBattles() {
    if (battleLoaded) return;
    battleLoaded = true;
    try {
        const res = await fetch(`${LB_BACKEND}/api/public/battle-leaderboard?streamer=${encodeURIComponent(LB_SLUG)}&blv=3`);
        if (res.ok) {
            const d = await res.json().catch(() => null);
            battleLeaderboard = d?.leaderboard || [];
        }
    } catch (_) { /* non-fatal */ }
    if (currentUser) loadMyBattleRank();
    if (activeTab === 'battles') renderBoard();
}

async function loadMyBattleRank() {
    try {
        const res = await fetch(
            `${LB_BACKEND}/api/public/battle-rank?streamer=${encodeURIComponent(LB_SLUG)}`,
            { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        myBattleRank = data?.rank || null;
        if (myBattleRank && activeTab === 'battles') renderBoard();
    } catch (_) { /* non-fatal */ }
}

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
    const gameName   = streamer.brand_name || streamer.display_name || streamer.username || LB_SLUG;
    const streamerNm = streamer.display_name || streamer.username || LB_SLUG;

    const titleEl = document.getElementById('lb-creator-name');
    if (titleEl) titleEl.textContent = gameName;

    // "by {streamer}" beneath the game name
    const subEl = document.getElementById('lb-subtitle');
    if (subEl) subEl.textContent = `by ${streamerNm}`;

    document.title = `${gameName} · Leaderboard · Castle TCG`;
}

/* ── Tab public API ── */
window._lbSetTab = function (tab) {
    activeTab = tab;
    document.getElementById('lb-tab-collection')?.classList.toggle('active', tab === 'collection');
    document.getElementById('lb-tab-battles')?.classList.toggle('active', tab === 'battles');
    renderBoard();
    // Keep the info modal in sync if it's open while switching tabs.
    if (document.getElementById('lb-info-modal')?.classList.contains('open')) fillInfoModal();
};

/* ── Sort public API ── */
/* Always sorts highest-first; clicking a column just changes which metric. */
window._lbSort = function (key) {
    sortKey = key;
    renderBoard();
};
window._lbSortBattle = function (key) {
    battleSortKey = key;
    renderBoard();
};

/* ── Board render ── */
function renderBoard() {
    const titleEl = document.getElementById('lb-board-title');
    const countEl = document.getElementById('lb-board-count');
    const listEl  = document.getElementById('lb-list');
    if (!listEl) return;

    if (activeTab === 'collection') {
        renderCollectionTable(titleEl, countEl, listEl);
    } else {
        renderBattles(titleEl, countEl, listEl);
    }
}

/* Sortable multi-column collection table.
   Default sort is weighted rarity points; any column header re-sorts. */
function renderCollectionTable(titleEl, countEl, listEl) {
    const rows = leaderboard.filter(r => (r.card_count ?? r.total_cards ?? 0) > 0);

    if (titleEl) titleEl.textContent = 'Collection Leaderboard';
    if (countEl) countEl.textContent = rows.length ? `${rows.length} collector${rows.length !== 1 ? 's' : ''}` : '';

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="lb-empty">No collectors yet</div>`;
        return;
    }

    rows.sort((a, b) => {
        const av = lbVal(a, sortKey);
        const bv = lbVal(b, sortKey);
        if (av === bv) return lbPoints(b) - lbPoints(a); // stable tiebreak on points
        return bv - av; // always highest-first
    });

    const headCells = headCellsHTML(LB_COLS, sortKey, '_lbSort');

    const bodyRows = rows.map((r, i) => {
        const isMe = isViewer(r.twitch_id);
        const rankCls = i < 3 ? ` lb-rank-${i + 1}` : '';
        return `<tr class="${isMe ? 'lb-row-me' : ''}">
            <td class="lb-cell-rank${rankCls}">${rankLabel(i)}</td>
            <td class="lb-cell-name">${nameCellHTML(r, isMe)}</td>
            ${numCellsHTML(r, LB_COLS, sortKey, lbVal)}
        </tr>`;
    }).join('');

    // Append the viewer's own row when they're logged in, have a ranked
    // collection, and aren't already shown in the top 100 above.
    let viewerRow = '';
    if (myRank && myRank.twitch_id && !rows.some(r => r.twitch_id === myRank.twitch_id)) {
        const rnk = Number(myRank['rank_' + sortKey] ?? myRank.rank_points ?? 0);
        viewerRow = viewerRowHTML(myRank, rnk, LB_COLS, sortKey, lbVal);
    }

    listEl.innerHTML = tableHTML('Collector', LB_COLS, sortKey, '_lbSort', bodyRows, viewerRow);
}

/* ── Battles: sortable table (Castle rank, wins, losses, win %, total) ── */
function renderBattles(titleEl, countEl, listEl) {
    if (titleEl) titleEl.textContent = 'Battle Leaderboard';

    if (!battleLoaded) {
        if (countEl) countEl.textContent = '';
        listEl.innerHTML = `<div class="lb-empty">Loading battles...</div>`;
        loadBattles();
        return;
    }

    const rows = battleLeaderboard.filter(r => (Number(r.total_battles) || 0) > 0);
    if (countEl) countEl.textContent = rows.length ? `${rows.length} fighter${rows.length !== 1 ? 's' : ''}` : '';

    if (rows.length === 0) {
        listEl.innerHTML = `<div class="lb-empty">No battles recorded yet</div>`;
        return;
    }

    const bVal = (r, k) => Number(r[k]) || 0;
    rows.sort((a, b) => {
        const av = bVal(a, battleSortKey);
        const bv = bVal(b, battleSortKey);
        if (av === bv) return bVal(b, 'rating') - bVal(a, 'rating'); // tiebreak on Castle rank
        return bv - av; // always highest-first
    });

    const bodyRows = rows.map((r, i) => {
        const isMe = isViewer(r.twitch_id);
        const rankCls = i < 3 ? ` lb-rank-${i + 1}` : '';
        return `<tr class="${isMe ? 'lb-row-me' : ''}">
            <td class="lb-cell-rank${rankCls}">${rankLabel(i)}</td>
            <td class="lb-cell-name">${nameCellHTML(r, isMe)}</td>
            ${numCellsHTML(r, BATTLE_COLS, battleSortKey, bVal)}
            ${deckCellHTML(r)}
        </tr>`;
    }).join('');

    let viewerRow = '';
    if (myBattleRank && myBattleRank.twitch_id && !rows.some(r => r.twitch_id === myBattleRank.twitch_id)) {
        const rnk = Number(myBattleRank['rank_' + battleSortKey] ?? myBattleRank.rank_rating ?? 0);
        viewerRow = viewerRowHTML(myBattleRank, rnk, BATTLE_COLS, battleSortKey, bVal, deckCellHTML(myBattleRank));
    }

    const deckHead = `<th class="lb-col-deck">Active Deck</th>`;
    listEl.innerHTML = tableHTML('Fighter', BATTLE_COLS, battleSortKey, '_lbSortBattle', bodyRows, viewerRow, deckHead);
}

/* ── Shared table builders ── */

/* Is this twitch_id the logged-in viewer? */
function isViewer(twitchId) {
    return !!currentUser && (twitchId === currentUser.uid || twitchId === currentUser.twitch_id);
}

/* Sortable column headers. */
function headCellsHTML(cols, activeKey, sortFn) {
    return cols.map(col => {
        const active = col.key === activeKey;
        return `<th class="lb-col-num${active ? ' lb-sort-active' : ''}" title="Sort by ${col.label}"
            onclick="window.${sortFn}('${col.key}')">${col.short}${active ? `<span class="lb-sort-arrow">▼</span>` : ''}</th>`;
    }).join('');
}

/* Numeric value cells for one row, given a column set + value accessor. */
function numCellsHTML(r, cols, activeKey, valueFn) {
    return cols.map(col => {
        const raw    = valueFn ? valueFn(r, col.key) : (Number(r[col.key]) || 0);
        const sorted = col.key === activeKey ? ' lb-col-sorted' : '';
        const valCls = (raw === 0 && !col.noDim) ? 'lb-zero' : col.cls;
        const disp   = col.fmt ? col.fmt(raw) : raw;
        return `<td class="lb-col-num${sorted}"><span class="${valCls}">${disp}</span></td>`;
    }).join('');
}

/* The pinned "your position" row. `extraCell` is an optional trailing <td>. */
function viewerRowHTML(r, rnk, cols, activeKey, valueFn, extraCell = '') {
    const span = cols.length + 2 + (extraCell ? 1 : 0);
    return `<tr class="lb-viewer-sep"><td colspan="${span}"></td></tr>
        <tr class="lb-row-me lb-row-viewer">
            <td class="lb-cell-rank">#${rnk}</td>
            <td class="lb-cell-name">${nameCellHTML(r, true)}</td>
            ${numCellsHTML(r, cols, activeKey, valueFn)}
            ${extraCell}
        </tr>`;
}

/* Assemble the full table markup. `extraHead` is an optional trailing <th>. */
function tableHTML(nameHead, cols, activeKey, sortFn, bodyRows, viewerRow, extraHead = '') {
    return `<div class="lb-table-wrap"><table class="lb-table">
        <thead><tr>
            <th class="lb-col-rank">#</th>
            <th class="lb-col-name">${nameHead}</th>
            ${headCellsHTML(cols, activeKey, sortFn)}
            ${extraHead}
        </tr></thead>
        <tbody>${bodyRows}${viewerRow}</tbody>
    </table></div>`;
}

/* Active-deck thumbnails cell (up to 3 cards). Hovering shows a larger
   popover of the full deck (looked up by owner twitch_id). */
function deckCellHTML(r) {
    const deck = r && r.deck;
    if (!Array.isArray(deck) || deck.length === 0) {
        return `<td class="lb-cell-deck"><span class="lb-deck-empty">None</span></td>`;
    }
    const slots = deck.slice(0, 3).map(card => {
        const img = card && card.image;
        const nm  = esc((card && card.name) || '');
        if (!img) return `<span class="lb-deck-slot"></span>`;
        return `<span class="lb-deck-slot"><img src="${esc(img)}" alt="${nm}" loading="lazy"
            onerror="this.style.visibility='hidden'"></span>`;
    }).join('');
    return `<td class="lb-cell-deck"><div class="lb-deck" data-owner="${esc(r.twitch_id || '')}"
        onmouseenter="window._lbDeckTip(event,this)" onmouseleave="window._lbDeckHide()">${slots}</div></td>`;
}

/* ── Active-deck hover popover ── */
function findDeck(owner) {
    const inList = battleLeaderboard.find(x => x.twitch_id === owner);
    if (inList) return inList.deck;
    if (myBattleRank && myBattleRank.twitch_id === owner) return myBattleRank.deck;
    return null;
}
function ensureDeckTip() {
    let tip = document.getElementById('lb-deck-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'lb-deck-tip';
        document.body.appendChild(tip);
    }
    return tip;
}
const RARITY_COLORS = {
    legendary: '#fbbf24', epic: '#c084fc', rare: '#60a5fa', uncommon: '#4ade80', common: 'rgba(255,255,255,0.18)',
};
// Crossed-swords icon for attack (boxicons has no swords glyph).
const SWORDS_SVG = `<svg class="lb-swords" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3v5l-11 9l-4 4l-3-3l4-4l9-11z"/><path d="M5 13l6 6"/><path d="M14.32 17.32l3.68 3.68l3-3l-3.68-3.68"/><path d="M19 3l-6 6"/></svg>`;
function pipHTML(m) {
    if (!m) return '';
    const icon = m.icon || '';
    const nm = esc(m.name || '');
    const isUrl = icon.startsWith('/') || icon.startsWith('http');
    return `<span class="lb-tip-pip" title="${nm}">${isUrl ? `<img src="${esc(icon)}" alt="${nm}">` : esc(icon)}</span>`;
}
window._lbDeckTip = function (e, el) {
    const deck = findDeck(el.dataset.owner);
    if (!Array.isArray(deck) || !deck.length) return;
    const cards = deck.slice(0, 3).map(card => {
        const img = card && card.image;
        const nm  = esc((card && card.name) || '');
        const rarColor = RARITY_COLORS[String(card && card.rarity || '').toLowerCase()] || 'rgba(255,255,255,0.12)';
        const imgHTML = img
            ? `<img src="${esc(img)}" alt="${nm}" style="border-color:${rarColor}" onerror="this.style.visibility='hidden'">`
            : `<div class="lb-tip-noimg" style="border-color:${rarColor}"></div>`;
        const atk = (card && card.attack != null) ? card.attack : '-';
        const def = (card && card.defense != null) ? card.defense : '-';
        const pips = [pipHTML(card && card.mechanic), pipHTML(card && card.genesis)].join('');
        return `<div class="lb-tip-card">
            ${imgHTML}
            <span class="lb-tip-name">${nm || '&nbsp;'}</span>
            <div class="lb-tip-stats">
                <span class="lb-tip-atk">${SWORDS_SVG}${atk}</span>
                <span class="lb-tip-def"><i class="bx bxs-shield"></i>${def}</span>
            </div>
            ${pips.trim() ? `<div class="lb-tip-pips">${pips}</div>` : ''}
        </div>`;
    }).join('');
    const tip = ensureDeckTip();
    tip.innerHTML = `<div class="lb-tip-title">Active Deck</div><div class="lb-tip-cards">${cards}</div>`;
    tip.classList.add('show');

    const r  = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    let top = r.top - tr.height - 10;
    if (top < 8) top = r.bottom + 10; // flip below if no room above
    tip.style.left = `${left}px`;
    tip.style.top  = `${top}px`;
};
window._lbDeckHide = function () {
    document.getElementById('lb-deck-tip')?.classList.remove('show');
};

/* Avatar + name + "You" badge cell for the collection table. */
function nameCellHTML(r, isMe) {
    const name = esc(r.display_name || r.username || r.twitch_id || 'Unknown');
    const you  = isMe ? `<span class="lb-you-badge">You</span>` : '';
    return `<div class="lb-name-inner">${avatarHTML(r)}<span class="lb-name-txt">${name}</span>${you}</div>`;
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

/* ── Info modal ── */
const INFO_COLLECTION = `
    <div class="lb-info-section">
        <h3><i class="bx bxs-star"></i> Points</h3>
        <p>Your score comes from the cards you <strong>own right now</strong>. Rarer cards are worth more, so chasing legendaries pays off. When you pull or trade for new cards, your points go up.</p>
        <div class="lb-info-weights">
            <div><span class="lb-r-legendary">Legendary</span><b>20 pts</b></div>
            <div><span class="lb-r-epic">Epic</span><b>10 pts</b></div>
            <div><span class="lb-r-rare">Rare</span><b>5 pts</b></div>
            <div><span class="lb-r-uncommon">Uncommon</span><b>2 pts</b></div>
            <div><span class="lb-r-common">Common</span><b>1 pt</b></div>
        </div>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-sort-down"></i> Sorting</h3>
        <p>The board ranks by <strong>Points</strong> to start. Want to see who has the most of something? Tap any column header (Cards or a rarity) to rank by that. It always puts the highest at the top.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-list-ol"></i> Top 100 &amp; your spot</h3>
        <p>Only the top 100 collectors show up here. If you're signed in and sitting below 100, your own spot gets pinned at the bottom so you can always find yourself.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-collection"></i> Columns</h3>
        <p><strong>Cards</strong> is how many cards you own in total. The rarity columns break that down by how many of each you've got.</p>
    </div>`;

const INFO_BATTLES = `
    <div class="lb-info-section">
        <h3><i class="bx bxs-trophy"></i> Castle Rank</h3>
        <p><strong>Castle Rank</strong> is your battle rating. Win a battle and it climbs, lose and it drops.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-sort-down"></i> Sorting</h3>
        <p>The board ranks by <strong>Castle Rank</strong> to start. Tap any column header to rank by Wins, Losses, Win %, or Total Battles instead. It always puts the highest at the top.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bx-list-ol"></i> Top 100 &amp; your spot</h3>
        <p>Only the top 100 fighters show up here. If you're signed in and sitting below 100, your own spot gets pinned at the bottom so you can always find yourself.</p>
    </div>
    <div class="lb-info-section">
        <h3><i class="bx bxs-grid-alt"></i> Active Deck</h3>
        <p>The last column shows the three cards each fighter battles with. Hover a deck to see each card's attack, defense, and traits.</p>
    </div>`;

function fillInfoModal() {
    const battles  = activeTab === 'battles';
    const eyebrow  = document.getElementById('lb-info-eyebrow');
    const body     = document.getElementById('lb-info-body');
    if (eyebrow) eyebrow.textContent = battles ? 'Battles' : 'Collection';
    if (body)    body.innerHTML = battles ? INFO_BATTLES : INFO_COLLECTION;
}

window._lbOpenInfo = function () {
    fillInfoModal();
    document.getElementById('lb-info-modal')?.classList.add('open');
};
window._lbCloseInfo = function (e) {
    // When triggered by the backdrop, only close on a direct backdrop click.
    if (e && e.type === 'click' && e.target && e.target.id !== 'lb-info-modal') return;
    document.getElementById('lb-info-modal')?.classList.remove('open');
};
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window._lbCloseInfo();
});

/* ── Visibility helpers ── */
function showMain() {
    document.getElementById('lb-loading')?.classList.add('hidden');
    document.getElementById('lb-main')?.classList.remove('hidden');
    document.getElementById('lb-info-btn')?.classList.remove('hidden');
}

function showNotFound() {
    document.getElementById('lb-loading')?.classList.add('hidden');
    document.getElementById('lb-not-found')?.classList.remove('hidden');
}

})();
