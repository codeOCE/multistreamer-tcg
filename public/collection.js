/**
 * collection.js — Creator Collection Page (/[username])
 * Wrapped in an IIFE so its locals never clash with app.js globals when
 * the SPA injects this page via document.write() pre-deployment.
 */
(function () {
'use strict';

/* ── Config ────────────────────────────────────────────────────────────────── */
const CP_BACKEND = (document.querySelector('meta[name="castle-public-url"]')?.content || '').replace(/\/$/, '');
// Support both /{username} direct routing and /collection.html?slug={username} redirect
const CP_SLUG = (() => {
    const qSlug = new URLSearchParams(window.location.search).get('slug');
    if (qSlug) return qSlug.toLowerCase();
    const pathSlug = window.location.pathname.slice(1).split('/')[0];
    return (pathSlug && !pathSlug.includes('.')) ? pathSlug.toLowerCase() : '';
})();

/* ── Nav user ───────────────────────────────────────────────────────────────── */
function setupNavUser(user) {
    if (!user) return;
    window.currentUser = { ...user, avatar: user.avatar_url || user.avatar };
    const navAvatar = document.getElementById('nav-avatar');
    const menuAvatar = document.getElementById('nav-user-menu-avatar');
    if (navAvatar)  navAvatar.src  = window.currentUser.avatar || '';
    if (menuAvatar) menuAvatar.src = window.currentUser.avatar || '';
    const preview = document.getElementById('nav-user-preview');
    if (preview) { preview.classList.remove('hidden'); preview.style.display = 'flex'; }
    window.initNavUserMenu?.();
    window.updateNavUserMenuLabels?.();
}

/* ── State ──────────────────────────────────────────────────────────────────── */
let streamerData  = null;
let catalogCards  = [];
let sets          = [];
let leaderboard   = [];
let ownedCardIds  = new Set();

let activeSetId  = '__all__';
let activeRarity = '__all__';

// card_id → { user_card_id, rarity } for the logged-in user's owned cards on this creator
let ownedUserCards = new Map();

let showcaseCards = [];
let showcaseIdx   = 0;
let showcaseTimer = null;

const RARITY_ORDER = { Legendary: 0, Epic: 1, Rare: 2, Common: 3 };

/* ── Boot ───────────────────────────────────────────────────────────────────── */
console.log('[Collection] Script loaded. CP_SLUG:', CP_SLUG, '| CP_BACKEND:', CP_BACKEND);
(async function init() {
    try {
        console.log('[Collection] Init() running');
        if (!CP_SLUG) { console.warn('[Collection] No slug — showing not found'); showNotFound(); return; }

        // Single aggregate fetch — replaces 4 parallel round trips with 1.
        const pageRes = await fetch(`${CP_BACKEND}/api/public/collection-page?streamer=${encodeURIComponent(CP_SLUG)}`);
        console.log('[Collection] Fetch complete. pageRes:', pageRes.status);
        if (!pageRes.ok) {
            console.warn('[Collection] Collection-page fetch failed — showing not found');
            showNotFound(); return;
        }
        const pageData = await pageRes.json();
        streamerData = pageData.streamer;
        console.log('[Collection] Streamer data:', streamerData?.username);
        if (!streamerData) { showNotFound(); return; }
        catalogCards = pageData.catalog    || [];
        sets         = pageData.sets       || [];
        leaderboard  = pageData.leaderboard || [];

        // Restore clean URL (/codeoce instead of /collection.html?slug=codeoce)
        if (new URLSearchParams(window.location.search).get('slug') && CP_SLUG) {
            history.replaceState(null, '', '/' + CP_SLUG);
        }

        applyBrandColor(streamerData.binder_color || streamerData.brand_color_primary);
        renderHero(streamerData, null);

        // Try to fetch the viewer's own collection + user data (401 silently if not logged in)
        try {
            const [colRes, bsRes] = await Promise.all([
                fetch(`${CP_BACKEND}/api/collection?streamer=${encodeURIComponent(CP_SLUG)}`, { credentials: 'include' }),
                fetch(`${CP_BACKEND}/api/v2/bootstrap?streamer=${encodeURIComponent(CP_SLUG)}`, { credentials: 'include' }),
            ]);
            if (colRes.ok) {
                const col = await colRes.json();
                ownedCardIds = new Set((col || []).map(c => c.card_id));
                ownedUserCards = new Map((col || [])
                    .filter(c => c.user_card_id)
                    .map(c => [c.card_id, { user_card_id: c.user_card_id, rarity: c.rarity }]));
                const binderBtn = document.getElementById('cp-binder-btn');
                const binderCount = document.getElementById('cp-binder-count');
                if (binderBtn) binderBtn.classList.remove('hidden');
                if (binderCount) binderCount.textContent = `My Binder · ${ownedCardIds.size}`;
                const btn = document.getElementById('cp-view-collection-btn');
                if (btn) btn.classList.remove('hidden');
            }
            if (bsRes.ok) {
                const bs = await bsRes.json();
                const user = bs?.user;
                if (user?.twitch_id) {
                    setupNavUser(user);
                }
            }
        } catch { /* not critical */ }

        // Update stat badges with real numbers now that all data is loaded
        const statCards     = document.getElementById('stat-total-cards');
        const statSets      = document.getElementById('stat-total-sets');
        const statCollectors = document.querySelector('#cp-hero-stats .val:last-child');
        if (statCards)  statCards.textContent  = catalogCards.length;
        if (statSets)   statSets.textContent   = sets.length;
        // Collectors val is the third pill — re-render whole stats block with numbers
        const statsEl = document.getElementById('cp-hero-stats');
        if (statsEl) statsEl.innerHTML = `
            <span class="cp-stat"><span class="val">${catalogCards.length}</span> Cards</span>
            <span class="cp-stat"><span class="val">${sets.length}</span> Sets</span>
            <span class="cp-stat"><span class="val">${leaderboard.length}</span> Collectors</span>`;

        renderSetTabs();
        renderShowcase();
        renderLeaderboard();
        renderCatalog();
        updateProgress();
        loadActivityFeed(streamerData.id);

        document.getElementById('cp-loading')?.classList.add('hidden');
        document.getElementById('cp-main')?.classList.remove('hidden');
    } catch (err) {
        console.error('[Collection] Init error:', err);
        showNotFound();
    }
})();

/* ── Brand color ────────────────────────────────────────────────────────────── */
function applyBrandColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--page-accent', hex);
    document.documentElement.style.setProperty('--page-accent-rgb', `${r}, ${g}, ${b}`);
    const glow = document.getElementById('cp-bg-glow');
    if (glow) glow.style.background = `radial-gradient(circle at 15% 25%,rgba(${r},${g},${b},0.07) 0%,transparent 45%),radial-gradient(circle at 85% 75%,rgba(${r},${g},${b},0.04) 0%,transparent 45%),var(--void-bg)`;
}

/* ── Hero ───────────────────────────────────────────────────────────────────── */
function renderHero(streamer, user) {
    document.title = `${streamer.brand_name || streamer.display_name || streamer.username} · Castle TCG`;
    // Small label = streamer handle
    const brandEl = document.getElementById('cp-brand-name');
    if (brandEl) brandEl.textContent = streamer.username || CP_SLUG;
    // Big heading = collection/brand name 
    const nameEl = document.getElementById('cp-creator-name');
    if (nameEl) nameEl.textContent = (streamer.brand_name).toUpperCase();
    if (streamer.is_live) document.getElementById('cp-live-wrap')?.classList.remove('hidden');

    const statsEl = document.getElementById('cp-hero-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="cp-stat"><span class="val" id="stat-total-cards">—</span> Cards</span>
            <span class="cp-stat"><span class="val" id="stat-total-sets">${sets.length || '—'}</span> Sets</span>
            <span class="cp-stat"><span class="val">${leaderboard.length || '—'}</span> Collectors</span>`;
    }

    // Action + social pills row
    const actionsEl = document.getElementById('cp-actions');
    if (actionsEl) {
        const watchUrl = streamer.username
            ? `https://twitch.tv/${streamer.username}`
            : (streamer.kick_username ? `https://kick.com/${streamer.kick_username}` : '#');

        const socials = [];
        if (streamer.username)      socials.push({ href: `https://twitch.tv/${streamer.username}`, icon: 'bx bxl-twitch', label: 'Twitch' });
        if (streamer.kick_username) socials.push({ href: `https://kick.com/${streamer.kick_username}`, icon: 'bx bxl-kickstarter', label: 'Kick' });
        if (streamer.twitter)       socials.push({ href: streamer.twitter, icon: 'bx bxl-twitter', label: 'X' });
        if (streamer.youtube)       socials.push({ href: streamer.youtube, icon: 'bx bxl-youtube', label: 'YouTube' });
        if (streamer.discord)       socials.push({ href: streamer.discord, icon: 'bx bxl-discord', label: 'Discord' });

        const pill = (extra = '') => `cp-stat gap-2 hover:border-white/20 hover:text-void-text transition-all cursor-pointer no-underline ${extra}`.trim();

        actionsEl.innerHTML =
            // Get Packs CTA
            `<a href="${escapeHTML(watchUrl)}" target="_blank" rel="noopener" class="${pill()}" style="border-color:rgba(var(--page-accent-rgb),0.3);color:rgba(var(--page-accent-rgb),0.9)">` +
                `<i class="bx bxs-archive-out text-[0.8rem]"></i>Get Packs` +
            `</a>` +
            // My Binder (hidden until collection loads)
            `<button id="cp-binder-btn" class="${pill('hidden')}" onclick="window._cpOpenBinder()" style="background:none;border:1px solid rgba(255,255,255,0.06)">` +
                `<i class="bx bxs-book-open text-[0.8rem]"></i><span id="cp-binder-count">My Binder</span>` +
            `</button>` +
            // Social links
            socials.map(l =>
                `<a href="${escapeHTML(l.href)}" target="_blank" rel="noopener" class="${pill()}"><i class="${l.icon} text-[0.8rem]"></i>${l.label}</a>`
            ).join('');
    }

    const navPacks = document.getElementById('nav-packs');
    if (navPacks) navPacks.href = `/?streamer=${encodeURIComponent(streamer.username || CP_SLUG)}`;
}

/* ── Card Showcase Carousel (5 visible) ─────────────────────────────────────── */
// positions relative to center: -2, -1, 0, +1, +2

function renderShowcase() {
    showcaseCards = [...catalogCards]
        .filter(c => !!c.image_url)
        .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9))
        .slice(0, 12);
    if (showcaseCards.length === 0) {
        const s = document.getElementById('hero-showcase');
        if (s) s.style.display = 'none';
        return;
    }
    buildShowcaseDOM();
    updateShowcasePositions();
    buildShowcaseDots();
    updateShowcaseLabel();
    showcaseTimer = setInterval(() => {
        showcaseIdx = (showcaseIdx + 1) % showcaseCards.length;
        updateShowcasePositions(); updateShowcaseLabel(); buildShowcaseDots();
    }, 3500);
}

function buildShowcaseDOM() {
    const wrap = document.getElementById('cp-showcase-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    showcaseCards.forEach((card, i) => {
        const slot = document.createElement('div');
        slot.className = 'showcase-slot';
        slot.dataset.index = i;
        slot.dataset.rarity = card.rarity || 'Common';
        slot.innerHTML = `<img src="${escapeHTML(card.image_url)}" alt="${escapeHTML(card.name)}" loading="lazy"><div class="showcase-glow"></div>`;
        slot.onclick = () => {
            showcaseIdx = i;
            updateShowcasePositions(); updateShowcaseLabel(); buildShowcaseDots(); resetShowcaseTimer();
        };
        wrap.appendChild(slot);
    });
}

function updateShowcasePositions() {
    const n = showcaseCards.length;
    document.querySelectorAll('.showcase-slot').forEach((slot, i) => {
        const d = ((i - showcaseIdx) % n + n) % n;
        // 5 visible: center(0), near-right(1), far-right(2), near-left(n-1), far-left(n-2)
        if      (d === 0)     slot.dataset.pos = 'center';
        else if (d === 1)     slot.dataset.pos = 'right1';
        else if (d === 2)     slot.dataset.pos = 'right2';
        else if (d === n - 1) slot.dataset.pos = 'left1';
        else if (d === n - 2) slot.dataset.pos = 'left2';
        else                  slot.dataset.pos = 'hidden';
    });
}

function buildShowcaseDots() {
    const dots = document.getElementById('showcase-dots');
    if (!dots) return;
    dots.innerHTML = showcaseCards.map((_, i) =>
        `<div class="showcase-dot ${i === showcaseIdx ? 'active' : ''}" onclick="window._cpJumpShowcase(${i})"></div>`
    ).join('');
}

function updateShowcaseLabel() {
    const card = showcaseCards[showcaseIdx];
    if (!card) return;
    const n = document.getElementById('showcase-card-name'); if (n) n.textContent = card.name;
    const r = document.getElementById('showcase-card-rarity'); if (r) { r.textContent = card.rarity; r.style.color = rarityColor(card.rarity); }
}

function resetShowcaseTimer() {
    clearInterval(showcaseTimer);
    showcaseTimer = setInterval(() => {
        showcaseIdx = (showcaseIdx + 1) % showcaseCards.length;
        updateShowcasePositions(); updateShowcaseLabel(); buildShowcaseDots();
    }, 3500);
}

/* ── Set tabs ───────────────────────────────────────────────────────────────── */
function renderSetTabs() {
    // Update hero stat counters even though the set-tabs section is removed
    const statsEl = document.getElementById('stat-total-cards'); if (statsEl) statsEl.textContent = catalogCards.length;
    const statSets = document.getElementById('stat-total-sets');  if (statSets) statSets.textContent = sets.length;
    const tabsEl = document.getElementById('cp-set-tabs');
    if (!tabsEl) return;

    const DEFAULT_PACK_CDN = 'https://cdn.codeoce.com/branding/default-pack.png';
    const rawStreamerPack = streamerData?.pack_image_url;
    const fallbackPack = (rawStreamerPack?.startsWith('http') ? rawStreamerPack : null) || DEFAULT_PACK_CDN;

    // "All" pill
    let html = `<div class="set-tab-all active" data-set="__all__" onclick="window._cpFilterSet('__all__')">All · <span class="set-count">${catalogCards.length}</span></div>`;

    // One visual pack card per set
    sets.forEach(s => {
        const count = catalogCards.filter(c => c.set_id === s.id).length;
        if (count === 0) return;
        const img = s.pack_image_url || fallbackPack;
        html += `
        <div class="set-pack-card" data-set="${s.id}" onclick="window._cpFilterSet('${s.id}')">
            <div class="set-pack-img-wrap">
                <img src="${escapeHTML(img)}" alt="${escapeHTML(s.name)}" loading="lazy" decoding="async">
            </div>
            <div class="set-pack-info">
                <div class="set-pack-name">${escapeHTML(s.name)}</div>
                <div class="set-pack-count">${count} cards</div>
            </div>
        </div>`;
    });

    tabsEl.innerHTML = html;
}

/* ── Leaderboard ────────────────────────────────────────────────────────────── */
function lbAvatar(r) {
    const name = escapeHTML(r.display_name || r.username || r.twitch_id || '?');
    if (r.avatar_url) {
        return `<img class="lb-avatar" src="${escapeHTML(r.avatar_url)}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="lb-avatar lb-avatar-fallback" style="display:none">${name.charAt(0).toUpperCase()}</span>`;
    }
    return `<span class="lb-avatar lb-avatar-fallback">${name.charAt(0).toUpperCase()}</span>`;
}

function renderLeaderboard() {
    const cardEl = document.getElementById('lb-cards-list');
    if (cardEl) {
        const rows = leaderboard.slice(0, 10);
        cardEl.innerHTML = rows.length === 0
            ? `<p class="text-[10px] text-void-muted text-center py-3">No collectors yet</p>`
            : rows.map((r, i) => {
                const count = r.card_count ?? r.total_cards ?? 0;
                return `<div class="lb-row">
                    <span class="lb-rank lb-rank-${i+1}">${rankLabel(i+1)}</span>
                    ${lbAvatar(r)}
                    <span class="lb-name">${escapeHTML(r.display_name || r.username || r.twitch_id)}</span>
                    <span class="lb-count">${count} card${count !== 1 ? 's' : ''}</span>
                </div>`;
            }).join('');
    }
    const battleEl = document.getElementById('lb-battle-list');
    if (battleEl) {
        const rows = [...leaderboard]
            .sort((a,b) => (b.battle_wins ?? 0) - (a.battle_wins ?? 0))
            .slice(0, 10);
        const hasBattles = rows.some(r => (r.battle_wins ?? 0) > 0);
        battleEl.innerHTML = !hasBattles
            ? `<p class="text-[10px] text-void-muted text-center py-3">No battles yet</p>`
            : rows.filter(r => (r.battle_wins ?? 0) > 0).map((r, i) => {
                const wins = r.battle_wins ?? 0;
                return `<div class="lb-row">
                    <span class="lb-rank lb-rank-${i+1}">${rankLabel(i+1)}</span>
                    ${lbAvatar(r)}
                    <span class="lb-name">${escapeHTML(r.display_name || r.username || r.twitch_id)}</span>
                    <span class="lb-count">${wins} win${wins !== 1 ? 's' : ''}</span>
                </div>`;
            }).join('');
    }
}

/* ── Catalog ────────────────────────────────────────────────────────────────── */
function renderCatalog() {
    const grid = document.getElementById('cp-card-grid');
    if (!grid) return;

    let filtered = catalogCards;
    if (activeSetId === '__none__')      filtered = filtered.filter(c => !c.set_id);
    else if (activeSetId !== '__all__')  filtered = filtered.filter(c => c.set_id === activeSetId);
    if (activeRarity !== '__all__')      filtered = filtered.filter(c => c.rarity === activeRarity);

    if (filtered.length === 0) { grid.innerHTML = `<div class="col-span-full text-center py-20 text-void-muted text-xs font-black uppercase tracking-widest">No cards found</div>`; return; }

    filtered.sort((a, b) => {
        const rd = (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9);
        return rd !== 0 ? rd : (a.card_number ?? 999) - (b.card_number ?? 999);
    });

    grid.innerHTML = filtered.map(card => {
        const owned  = ownedCardIds.has(card.id);
        const locked = ownedCardIds.size > 0 && !owned;
        return `<div class="cp-card rarity-${card.rarity}${locked?' locked':''}" onclick="window._cpOpenModal(${JSON.stringify(card.id)})" title="${escapeHTML(card.name)}">
            ${card.image_url ? `<img src="${card.image_url}" alt="${escapeHTML(card.name)}" loading="lazy" decoding="async">` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0d0f14,#161820)"></div>`}
            <div class="lock-icon"><i class="bx bxs-lock"></i></div>
            <div class="rarity-pip rarity-pip-${card.rarity}"></div>
            ${card.card_number != null ? `<div class="card-num">#${card.card_number}</div>` : ''}
        </div>`;
    }).join('');

    // Rarity filter pills
    const filterEl = document.getElementById('cp-rarity-filter');
    if (filterEl) {
        const rarities = ['__all__', ...new Set(catalogCards.map(c => c.rarity).filter(Boolean))];
        filterEl.innerHTML = rarities.map(r => {
            const count = r === '__all__' ? filtered.length : filtered.filter(c => c.rarity === r).length;
            const active = activeRarity === r;
            return `<button onclick="window._cpFilterRarity('${r}')" class="cp-stat cursor-pointer transition-all ${active?'bg-white/[0.07] border-white/20 text-void-text':''}" style="${active&&r!=='__all__'?`color:${rarityColor(r)};border-color:${rarityColor(r)}40`:''}">${r==='__all__'?'All':r} <span class="val">${count}</span></button>`;
        }).join('');
    }
}

function updateProgress() {
    const el = document.getElementById('cp-collection-progress');
    const label = document.getElementById('progress-label');
    const fill  = document.getElementById('progress-fill');
    if (!el || !label || !fill) return;
    if (ownedCardIds.size === 0) { el.classList.add('hidden'); return; }
    let pool = catalogCards;
    if (activeSetId === '__none__')     pool = pool.filter(c => !c.set_id);
    else if (activeSetId !== '__all__') pool = pool.filter(c => c.set_id === activeSetId);
    if (activeRarity !== '__all__')     pool = pool.filter(c => c.rarity === activeRarity);
    const total = pool.length, owned = pool.filter(c => ownedCardIds.has(c.id)).length;
    if (total === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    label.textContent = `${owned} / ${total} Collected`;
    fill.style.width = `${Math.round((owned/total)*100)}%`;
}

/* ── Card modal ─────────────────────────────────────────────────────────────── */
function openModal(cardId) {
    const card = catalogCards.find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('cp-modal-img').src     = card.image_url || '';
    document.getElementById('cp-modal-img').alt     = card.name;
    document.getElementById('cp-modal-name').textContent = card.name;
    const metaEl = document.getElementById('cp-modal-meta');
    if (metaEl) { metaEl.textContent = [card.rarity, card.type, card.set_name].filter(Boolean).join(' · '); metaEl.style.color = rarityColor(card.rarity); }
    const descEl = document.getElementById('cp-modal-desc'); if (descEl) descEl.textContent = card.description || 'No description.';
    const statsEl = document.getElementById('cp-modal-stats'); if (statsEl) statsEl.innerHTML = card.card_number != null ? `<div class="cp-modal-stat"><div class="label">Card #</div><div class="value">#${card.card_number}</div></div>` : '';
    const isOwned = ownedCardIds.has(card.id);
    document.getElementById('cp-modal-owned-badge')?.classList.toggle('hidden', !isOwned);

    const burnWrap = document.getElementById('cp-modal-burn-wrap');
    if (burnWrap) {
        const owned = ownedUserCards.get(card.id);
        if (owned) {
            const dustMult = { legendary: 4, epic: 3, rare: 2 }[(card.rarity || '').toLowerCase()] || 1;
            const dustEarned = 5 * dustMult;
            const label = document.getElementById('cp-modal-burn-label');
            if (label) label.textContent = `Burn for ${dustEarned} dust`;
            burnWrap.classList.remove('hidden');
            burnWrap.dataset.userCardId = owned.user_card_id;
            burnWrap.dataset.cardName = card.name;
            burnWrap.dataset.dustEarned = dustEarned;
        } else {
            burnWrap.classList.add('hidden');
        }
    }

    document.getElementById('cp-card-modal')?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('cp-card-modal')?.classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
        closeBinder();
    }
});

function showNotFound() {
    document.getElementById('cp-loading')?.classList.add('hidden');
    document.getElementById('cp-not-found')?.classList.remove('hidden');
}

/* ── Utilities ──────────────────────────────────────────────────────────────── */
function escapeHTML(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function rarityColor(r) { return {Legendary:'#fbbf24',Epic:'#a855f7',Rare:'#3faaff',Common:'#94a3b8'}[r]||'#94a3b8'; }
function rankLabel(rank) { return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`#${rank}`; }

/* ── Binder overlay ──────────────────────────────────────────────────────────── */
function openBinder() {
    renderBinder();
    document.getElementById('cp-binder-modal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeBinder() {
    document.getElementById('cp-binder-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderBinder() {
    const grid  = document.getElementById('cp-binder-grid');
    const empty = document.getElementById('cp-binder-empty');
    if (!grid) return;

    const owned = catalogCards.filter(c => ownedCardIds.has(c.id));
    const total = catalogCards.length;

    // Progress
    const label = document.getElementById('cp-binder-progress-label');
    const fill  = document.getElementById('cp-binder-progress-fill');
    if (label) label.textContent = `${owned.length} / ${total}`;
    if (fill)  fill.style.width  = total > 0 ? `${Math.round((owned.length / total) * 100)}%` : '0%';

    if (owned.length === 0) {
        grid.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    // Sort by rarity then card number
    owned.sort((a, b) => {
        const rd = (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9);
        return rd !== 0 ? rd : (a.card_number ?? 999) - (b.card_number ?? 999);
    });

    grid.innerHTML = owned.map(card => `
        <div class="binder-card rarity-${card.rarity}" onclick="window._cpOpenModal(${JSON.stringify(card.id)})" title="${escapeHTML(card.name)}">
            ${card.image_url
                ? `<img src="${escapeHTML(card.image_url)}" alt="${escapeHTML(card.name)}" loading="lazy" decoding="async">`
                : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0d0f14,#161820)"></div>`}
            <div class="rarity-pip rarity-pip-${card.rarity}"></div>
        </div>`).join('');
}

/* ── Global handles (called from onclick in HTML) ───────────────────────────── */
/* ── Activity feed ──────────────────────────────────────────────────────────── */
function renderFeed(rows) {
    const list = document.getElementById('cp-feed-list');
    if (!list) return;
    if (!rows?.length) {
        list.innerHTML = `<p style="font-size:0.65rem;color:var(--void-muted);text-align:center;padding:20px 0">No recent activity yet</p>`;
        return;
    }
    const ICONS = { grant: '🃏', trade: '🤝', battle: '⚔️' };
    list.innerHTML = rows.slice(0, 20).map(r => {
        const icon = ICONS[r.category] || '📋';
        const ts = new Date(r.created_at);
        const age = Math.floor((Date.now() - ts) / 60000);
        const timeStr = age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
        return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid rgba(255,255,255,0.04)">
            <span style="font-size:0.85rem;flex-shrink:0;margin-top:1px">${icon}</span>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.65rem;color:var(--void-text);line-height:1.4">${escapeHTML(r.message)}</div>
            </div>
            <span style="font-size:0.55rem;color:var(--void-muted);white-space:nowrap;flex-shrink:0">${timeStr}</span>
        </div>`;
    }).join('');
}

async function loadActivityFeed(streamerId) {
    if (!streamerId) return;
    try {
        const res = await fetch(`${CP_BACKEND}/api/public/activity-feed?streamer_id=${encodeURIComponent(streamerId)}`);
        if (!res.ok) return;
        const data = await res.json();
        renderFeed(data.feed || []);
    } catch (_) {}
}

/* ── Card burn ──────────────────────────────────────────────────────────────── */
function openBurnConfirm() {
    const wrap = document.getElementById('cp-modal-burn-wrap');
    if (!wrap) return;
    const cardName = wrap.dataset.cardName || 'this card';
    const dust = wrap.dataset.dustEarned || '?';
    const el = document.getElementById('cp-burn-confirm-text');
    if (el) el.textContent = `Burn "${cardName}" and receive ${dust} magic dust? This cannot be undone.`;
    const modal = document.getElementById('cp-burn-modal');
    if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
    document.body.style.overflow = 'hidden';
}

function cancelBurn() {
    const modal = document.getElementById('cp-burn-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
}

async function confirmBurn() {
    const wrap = document.getElementById('cp-modal-burn-wrap');
    if (!wrap) return;
    const userCardId = wrap.dataset.userCardId;
    if (!userCardId) return;

    const btn = document.getElementById('cp-burn-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Burning…'; }

    try {
        const res = await fetch(`${CP_BACKEND}/api/dust/burn-card`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_card_id: userCardId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        cancelBurn();
        closeModal();

        // Remove from local state so the UI reflects the burn immediately
        for (const [cid, owned] of ownedUserCards.entries()) {
            if (owned.user_card_id === userCardId) {
                ownedUserCards.delete(cid);
                ownedCardIds.delete(cid);
                break;
            }
        }
        renderCatalog();
        updateProgress();

        // Show dust earned toast if toast helper exists
        if (window.showToast) {
            window.showToast(`Card burned! +${data.dust_earned} dust (total: ${data.magic_dust})`, 'success');
        }
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Burn it'; }
        alert(e.message || 'Burn failed');
    }
}

window._cpOpenModal    = openModal;
window._cpCloseModal   = closeModal;
window._cpBurnCard     = openBurnConfirm;
window._cpCancelBurn   = cancelBurn;
window._cpConfirmBurn  = confirmBurn;
window._cpOpenBinder   = openBinder;
window._cpCloseBinder  = closeBinder;
window._cpFilterSet    = function(setId)  { activeSetId = setId;    document.querySelectorAll('.set-pack-card, .set-tab-all, .set-tab').forEach(t=>t.classList.toggle('active',t.dataset.set===setId)); renderCatalog(); updateProgress(); };
window._cpFilterRarity = function(rarity) { activeRarity = rarity;  renderCatalog(); updateProgress(); };
window._cpJumpShowcase = function(i)      { showcaseIdx = i; updateShowcasePositions(); updateShowcaseLabel(); buildShowcaseDots(); resetShowcaseTimer(); };

})(); // end IIFE
