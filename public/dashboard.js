

const BACKEND_URL =
    typeof getCastleBackendOrigin === 'function'
        ? getCastleBackendOrigin()
        : 'https://multistreamer-tcg.codeoce.workers.dev';

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const scripts = document.querySelectorAll('script[data-dynamic-src]');
        for (const s of scripts) {
            if (s.getAttribute('data-dynamic-src') === src) {
                if (s.getAttribute('data-loaded') === '1') {
                    resolve();
                    return;
                }
                s.addEventListener('load', () => resolve(), { once: true });
                s.addEventListener('error', () => reject(new Error('Load failed: ' + src)), { once: true });
                return;
            }
        }
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.setAttribute('data-dynamic-src', src);
        el.onload = () => {
            el.setAttribute('data-loaded', '1');
            resolve();
        };
        el.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(el);
    });
}

async function ensureChartJsLoaded() {
    if (typeof Chart !== 'undefined') return;
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
}

/** Shipped default booster pack art (`public/default_pack.png`) */
const DEFAULT_PACK_IMAGE_URL = 'https://cdn.codeoce.com/branding/default-pack.png';

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Matches migration 003 defaults — show empty field so platform uses achievements.name */
const LEGACY_ACHIEVEMENT_NAME_INPUTS = {
    beginner: "Beginner Collector",
    hoarder: "Card Hoarder",
    rare: "Rare Find",
    epic: "Epic Moment",
    legendary: "Legendary Luck",
    completionist: "Completionist",
    traveler: "World Traveler",
    streak: "Hot Streak",
    trader: "Trader Debut",
};

/** Keys stored in streamers.collection_methods (JSON). Twitch + Kick + site preferences. */
const COLLECTION_METHOD_KEYS = [
    "subs",
    "bits",
    "channel_points",
    "kick_subscriptions",
    "kick_gifts",
    "kick_rewards",
    "website",
];

const ACHIEVEMENT_BRANDING_FIELDS = [
    { key: "beginner", standard: "Fresh Spawn", short: "First card" },
    { key: "hoarder", standard: "Novice Collector", short: "10 unique cards" },
    { key: "master_collector", standard: "Master Collector", short: "50 unique cards" },
    { key: "rare", standard: "Rare Find", short: "Pull a Rare" },
    { key: "epic", standard: "Epic Moment", short: "Pull an Epic" },
    { key: "legendary", standard: "Legendary Luck", short: "Pull a Legendary" },
    { key: "completionist", standard: "The Completionist", short: "Complete a set" },
    { key: "traveler", standard: "World Traveler", short: "2+ sets" },
    { key: "streak", standard: "Hot Streak", short: "Rare+ streak" },
    { key: "trader", standard: "Trader Debut", short: "First trade" },
];

function ensureAchievementBrandingGrid() {
    const grid = document.getElementById("settings-achievement-names-grid");
    if (!grid || grid.dataset.rendered === "1") return;
    grid.dataset.rendered = "1";
    grid.innerHTML = ACHIEVEMENT_BRANDING_FIELDS.map(
        (f) => `
        <div class="space-y-1.5">
            <label for="ach-override-${escapeHTML(f.key)}" class="block text-[9px] font-black uppercase tracking-widest text-void-muted leading-tight">
                ${escapeHTML(f.standard)} <span class="text-white/35 font-bold normal-case tracking-normal">· ${escapeHTML(f.short)}</span>
            </label>
            <input type="text" id="ach-override-${escapeHTML(f.key)}" autocomplete="off"
                placeholder="Custom title (optional)"
                class="w-full bg-void-bg/50 border border-white/10 rounded-lg px-3 py-2.5 text-xs font-bold text-white placeholder:text-white/25 focus:border-void-accent transition-all" />
        </div>`
    ).join("");
}

function achievementOverrideInputValue(stored, key) {
    const raw = stored && stored[key];
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) return "";
    const leg = LEGACY_ACHIEVEMENT_NAME_INPUTS[key];
    if (leg && v === leg) return "";
    return v;
}

/**
 * Custom void-dropdown (synced native <select> + styled trigger). Required on dashboard — app.js is not loaded here.
 */
function syncVoidDropdownMenu(wrapper) {
    const select = wrapper.querySelector('.void-dropdown-native');
    const menu = wrapper.querySelector('.void-dropdown-menu');
    const label = wrapper.querySelector('.void-dropdown-label');
    if (!select || !menu || !label) return;

    const options = Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.text
    }));

    menu.innerHTML = options.map(opt => `
        <div class="void-dropdown-option" role="option" data-value="${opt.value}">${opt.text}</div>
    `).join('');

    menu.querySelectorAll('.void-dropdown-option').forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            select.value = opt.dataset.value;
            label.textContent = opt.textContent;
            menu.hidden = true;
            menu.setAttribute('aria-hidden', 'true');
            wrapper.querySelector('.void-dropdown-trigger').setAttribute('aria-expanded', 'false');
            wrapper.classList.remove('void-dropdown-open');
            select.dispatchEvent(new Event('change', { bubbles: true }));
        };
    });

    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
        label.textContent = selectedOption.text;
    }
}

function initVoidDropdown(wrapper) {
    if (wrapper.dataset.voidDropdownInit === 'true') return;
    wrapper.dataset.voidDropdownInit = 'true';

    const select = wrapper.querySelector('.void-dropdown-native');
    const trigger = wrapper.querySelector('.void-dropdown-trigger');
    const menu = wrapper.querySelector('.void-dropdown-menu');
    const label = wrapper.querySelector('.void-dropdown-label');
    if (!select || !trigger || !menu || !label) return;

    const open = () => {
        syncVoidDropdownMenu(wrapper);
        menu.hidden = false;
        menu.setAttribute('aria-hidden', 'false');
        trigger.setAttribute('aria-expanded', 'true');
        wrapper.classList.add('void-dropdown-open');
    };
    const close = () => {
        menu.hidden = true;
        menu.setAttribute('aria-hidden', 'true');
        trigger.setAttribute('aria-expanded', 'false');
        wrapper.classList.remove('void-dropdown-open');
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        if (menu.hidden) {
            open();
            const handler = (e2) => {
                if (!wrapper.contains(e2.target)) {
                    close();
                    document.removeEventListener('click', handler);
                }
            };
            setTimeout(() => document.addEventListener('click', handler), 0);
        } else {
            close();
        }
    };

    select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            label.textContent = selectedOption.text;
        }
    });

    syncVoidDropdownMenu(wrapper);
}

function initAllVoidDropdowns() {
    document.querySelectorAll('.void-dropdown').forEach(el => {
        if (!el.dataset.voidDropdownInit) initVoidDropdown(el);
    });
}

function syncCardCreatorVoidDropdowns() {
    ['card-creator-rarity', 'card-creator-set', 'card-creator-template'].forEach(id => {
        const sel = document.getElementById(id);
        const wrapper = sel && sel.closest('.void-dropdown');
        if (wrapper) {
            syncVoidDropdownMenu(wrapper);
            if (id === 'card-creator-template') {
                sel.onchange = onTemplateDropdownChange;
            }
        }
    });
}

// --- GLOBAL IMAGE FALLBACK HANDLER ---
// Catches all 404/broken images automatically
window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.dataset.fallbackApplied) return; // Prevent infinite loop
        e.target.dataset.fallbackApplied = 'true';
        
        // Determine fallback based on visual context (avatar vs card vs logo)
        const isAvatar = e.target.id.includes('avatar') || e.target.className.includes('rounded-full') || e.target.src.includes('twitchcdn');
        
        if (isAvatar) {
            e.target.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=fallback';
        } else {
            e.target.src = ''; // Main card fallback
        }
    }
}, true); // useCapture = true is strictly required for 'error' events which don't bubble

const ACT_AS_STREAMER_STORAGE_KEY = 'castle_act_as_streamer_id';

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!result) return '0, 242, 254';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/** Sync Tailwind/CSS --void-accent with streamer binder color immediately (avoids default cyan flash). */
function applyDashboardAccent(streamer) {
    const s = streamer || {};
    const brandColor = s.binder_color || s.brand_color_primary || '#00f2fe';
    if (!brandColor) return;
    const root = document.documentElement;
    root.style.setProperty('--void-accent', brandColor);
    root.style.setProperty('--void-accent-rgb', hexToRgb(brandColor));
}

function getActAsHeaders() {
    try {
        const aid = localStorage.getItem(ACT_AS_STREAMER_STORAGE_KEY);
        if (aid && aid.trim()) return { 'X-Act-As-Streamer-Id': aid.trim() };
    } catch (_) { /* ignore */ }
    return {};
}

let currentUser = null;
/** Card id when Card Studio details modal is open — used to close on delete. */
let cardStudioDetailsModalCardId = null;
let creatorCards = [];
let creatorTemplates = [];
let creatorStats = {};
let csrfToken = null;

/** Last binder color persisted in DB — Settings “Reset to saved” target. */
let settingsBinderColorSaved = '#00F2FE';

/** Set by initSettingsVoidBinderColorPicker — setFromHex / resetToSaved. */
let settingsBinderPickerApi = null;

function normalizeBinderHex(hex) {
    let n = hex != null && String(hex).trim() ? String(hex).trim() : '#00f2fe';
    if (!n.startsWith('#')) n = '#' + n.replace(/^#/, '');
    n = n.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(n)) n = '#00F2FE';
    return n;
}

/** Full collector list for Admin tab (from analytics/collectors?full=1) */
let adminCollectorsCache = [];
/** member_twitch_id -> 'moderator' | 'editor' */
let channelTeamRoleByTwitchId = new Map();
/** blocked Twitch IDs for current channel (act-as aware) */
let adminBlockedTwitchIds = new Set();
/** GET /api/creator/team allowed (channel owner only) */
let channelTeamManageAllowed = false;

/**
 * Drop-in fetch wrapper that:
 * - Always sends credentials (cookies)
 * - Automatically attaches the current CSRF token for mutating requests
 * - Sends X-Act-As-Streamer-Id for /api/creator/* when a channel is selected (team helpers)
 * - On a 403 "CSRF blocked" response, refreshes the token and retries once
 */
async function apiFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const urlStr = typeof url === 'string' ? url : String(url);

    const buildHeaders = () => {
        const h = {
            ...(options.headers || {}),
            ...(isMutation && csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        };
        if (urlStr.includes('/api/creator/')) {
            Object.assign(h, getActAsHeaders());
        }
        return h;
    };

    const res = await fetch(url, { ...options, credentials: 'include', headers: buildHeaders() });

    if (res.status === 403 && isMutation) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === 'CSRF blocked') {
            console.warn('[CSRF] Token mismatch — refreshing and retrying...');
            await fetchCSRFToken();
            return fetch(url, { ...options, credentials: 'include', headers: buildHeaders() });
        }
        // Non-CSRF 403 — return a reconstructed response so callers can still read the body
        return new Response(JSON.stringify(body), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return res;
}

async function syncPlatformAuthStateFromServer() {
    if (!currentUser) return;
    try {
        const mer = await fetch(`${BACKEND_URL}/api/me`, { credentials: 'include', cache: 'no-store' });
        if (mer.ok) {
            const me = await mer.json();
            if (typeof me.kick_linked === 'boolean') currentUser.kick_linked = me.kick_linked;
        }
    } catch (_) {
        /* ignore */
    }
}

let collectorGrowthChartInstance = null;
let packActivityChartInstance = null;
let battlesChartInstance = null;
let revenueChartInstance = null;
let analyticsData = {
    overview: null,
    cards: null,
    collectors: null,
    packs: null,
    battles: null,
    revenue: null,
};
/** Last period loaded for analytics (native select value). Used to clear stale in-memory data when the range changes. */
let lastAnalyticsTimeRangeLoaded = null;
let analyticsOffset = 0; // 0 = current period, 1 = one period back, etc.

let creatorSets = [];
let selectedCardIds = new Set();
let bulkSelectMode = false;
let cardToEdit = null;


const CACHE_KEY = 'bootstrap_api_bootstrap_lite_v1';

const SKELETON_IDS = ['nav-user-menu-name'];

function setDashboardSkeleton(active) {
    SKELETON_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (active) {
            el.dataset.realContent = el.textContent;
            el.classList.add('skeleton-pulse');
        } else {
            el.classList.remove('skeleton-pulse');
        }
    });
}

function hideDashboardVeil(instant = false) {
    const veil = document.getElementById('dashboard-loading-veil');
    if (!veil) return;
    if (instant) {
        veil.style.transition = 'none';
    }
    veil.classList.add('veil-hidden');
    veil.addEventListener('transitionend', () => veil.remove(), { once: true });
    if (instant) setTimeout(() => veil.remove(), 50);
}

async function initDashboard() {
    const cachedData = sessionStorage.getItem(CACHE_KEY);

    // 1. Immediate Chart.js preload (non-blocking)
    void ensureChartJsLoaded();

    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            applyBootstrapData(data);
            // Seed the in-memory token from cache so actions work immediately
            if (data.csrf_token) csrfToken = data.csrf_token;
            hideDashboardVeil(true);
        } catch (e) {
            console.error("[Dashboard] Cache parse error:", e);
            setDashboardSkeleton(true);
        }
    } else {
        setDashboardSkeleton(true);
    }

    // 2. Start all critical fetches in parallel
    // We start them now, but we'll await bootstrap first since it's the gatekeeper
    const bootstrapPromise = bootstrapDashboard();
    const profilePromise = hydrateCreatorStreamerFromProfile();
    const analyticsPromise = loadAnalytics(true); // silent background load

    const bootstrapData = await bootstrapPromise;

    if (bootstrapData?.csrf_token) {
        // Use the token that matches the cookie bootstrap just set
        csrfToken = bootstrapData.csrf_token;
    } else if (!csrfToken) {
        // Fallback: bootstrap failed or returned no token — fetch one explicitly
        await fetchCSRFToken();
    }

    setDashboardSkeleton(false);
    hideDashboardVeil(false);
    initSettingsVoidBinderColorPicker();
    setupEventListeners();

    try {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('kick') === 'linked') {
            showToast('Kick connected', 'success');
            sp.delete('kick');
            const clean = window.location.pathname + (sp.toString() ? `?${sp.toString()}` : '');
            window.history.replaceState({}, '', clean);
            void refreshStreamingPlatformCards();
        }
    } catch (_) {
        /* ignore */
    }

    // Await remaining parallel tasks
    await Promise.allSettled([profilePromise, analyticsPromise]);

    // Final UI sync — section from ?section=, or legacy /card-studio /stream-features paths
    const params = new URLSearchParams(window.location.search);
    const qsSection = params.get('section');
    const initPath = window.location.pathname.replace(/\/+$/, '') || '/dashboard';
    let initialSection = 'dashboard';
    if (qsSection && SECTIONS[qsSection]) {
        initialSection = qsSection;
    } else if (initPath === '/card-studio') {
        initialSection = 'card-studio';
    } else if (initPath === '/stream-features') {
        initialSection = 'stream-features';
    }
    switchSection(initialSection);

    const qsTab = params.get('tab');
    if (qsTab && SECTIONS[initialSection]?.tabs.includes(qsTab)) {
        switchTab(qsTab);
    }
}

/** Onboarding-style HSV void picker for Settings binder color (matches onboarding.html). */
function initSettingsVoidBinderColorPicker() {
    const colorPicker = document.getElementById('settings-binder-color');
    if (!colorPicker || colorPicker.dataset.voidInit === '1') return;
    const colorHex = document.getElementById('settings-binder-color-hex');
    const swatch = document.getElementById('settings-color-preview-swatch');
    const popover = document.getElementById('settings-void-picker-popover');
    const satValContainer = document.getElementById('settings-sat-val-container');
    const satValPointer = document.getElementById('settings-sat-val-pointer');
    const hueContainer = document.getElementById('settings-hue-container');
    const huePointer = document.getElementById('settings-hue-pointer');
    const pickerMiniSwatch = document.getElementById('settings-picker-mini-swatch');
    const closePickerBtn = document.getElementById('settings-close-picker');
    const resetBtn = document.getElementById('settings-binder-color-reset');
    if (!colorHex || !swatch) return;

    colorPicker.dataset.voidInit = '1';

    let currentH = 180;
    let currentS = 100;
    let currentV = 100;

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
              }
            : null;
    }

    function rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const v = max;
        const d = max - min;
        const s = max === 0 ? 0 : d / max;
        let h = 0;
        if (max !== min) {
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                default:
                    h = (r - g) / d + 4;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }

    function hsvToHex(h, s, v) {
        s /= 100;
        v /= 100;
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r;
        let g;
        let b;
        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    function syncBrandTabAndAccent(hex) {
        const bc = document.getElementById('brand-color');
        const bh = document.getElementById('brand-color-hex');
        if (bc) bc.value = hex;
        if (bh) bh.textContent = hex.toUpperCase();
        applyDashboardAccent({ binder_color: hex });
    }

    function updateSettingsSwatchOnly(hex) {
        swatch.style.backgroundColor = hex;
        swatch.style.boxShadow = `0 0 20px ${hex}33`;
    }

    function updateFromPicker() {
        const hex = hsvToHex(currentH, currentS, currentV);
        colorPicker.value = hex;
        colorHex.value = hex.replace('#', '');
        syncBrandTabAndAccent(hex);
        updateSettingsSwatchOnly(hex);
        if (satValContainer) satValContainer.style.backgroundColor = hsvToHex(currentH, 100, 100);
        if (satValPointer) {
            satValPointer.style.left = `${currentS}%`;
            satValPointer.style.top = `${100 - currentV}%`;
        }
        if (huePointer) huePointer.style.left = `${(currentH / 360) * 100}%`;
        if (pickerMiniSwatch) pickerMiniSwatch.style.backgroundColor = hex;
    }

    function setFromHex(hexRaw) {
        const hex = normalizeBinderHex(hexRaw);
        colorPicker.value = hex;
        colorHex.value = hex.replace('#', '');
        const rgb = hexToRgb(hex);
        if (rgb) {
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            currentH = hsv.h;
            currentS = hsv.s;
            currentV = hsv.v;
        }
        syncBrandTabAndAccent(hex);
        updateSettingsSwatchOnly(hex);
        if (satValContainer) satValContainer.style.backgroundColor = hsvToHex(currentH, 100, 100);
        if (satValPointer) {
            satValPointer.style.left = `${currentS}%`;
            satValPointer.style.top = `${100 - currentV}%`;
        }
        if (huePointer) huePointer.style.left = `${(currentH / 360) * 100}%`;
        if (pickerMiniSwatch) pickerMiniSwatch.style.backgroundColor = hex;
    }

    function resetToSaved() {
        setFromHex(settingsBinderColorSaved);
    }

    swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popover) popover.classList.toggle('hidden');
        const rgb = hexToRgb(colorPicker.value);
        if (rgb) {
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            currentH = hsv.h;
            currentS = hsv.s;
            currentV = hsv.v;
            updateFromPicker();
        }
    });

    if (closePickerBtn) {
        closePickerBtn.addEventListener('click', () => popover && popover.classList.add('hidden'));
    }

    document.addEventListener('click', (e) => {
        if (popover && !popover.contains(e.target) && !swatch.contains(e.target)) {
            popover.classList.add('hidden');
        }
    });

    if (satValContainer) {
        const handleMove = (e) => {
            const rect = satValContainer.getBoundingClientRect();
            currentS = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            currentV = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
            updateFromPicker();
        };
        satValContainer.addEventListener('mousedown', (e) => {
            handleMove(e);
            const moveHandler = (me) => handleMove(me);
            const upHandler = () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
        });
    }

    if (hueContainer) {
        const handleHue = (e) => {
            const rect = hueContainer.getBoundingClientRect();
            currentH = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
            updateFromPicker();
        };
        hueContainer.addEventListener('mousedown', (e) => {
            handleHue(e);
            const moveHandler = (me) => handleHue(me);
            const upHandler = () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
        });
    }

    colorPicker.addEventListener('input', (e) => {
        const hex = e.target.value.toUpperCase();
        colorHex.value = hex.replace('#', '');
        const rgb = hexToRgb(hex);
        if (rgb) {
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            currentH = hsv.h;
            currentS = hsv.s;
            currentV = hsv.v;
        }
        syncBrandTabAndAccent(hex);
        updateSettingsSwatchOnly(hex);
        if (satValContainer) satValContainer.style.backgroundColor = hsvToHex(currentH, 100, 100);
        if (satValPointer) {
            satValPointer.style.left = `${currentS}%`;
            satValPointer.style.top = `${100 - currentV}%`;
        }
        if (huePointer) huePointer.style.left = `${(currentH / 360) * 100}%`;
        if (pickerMiniSwatch) pickerMiniSwatch.style.backgroundColor = hex;
    });

    colorHex.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorPicker.value = val;
            const rgb = hexToRgb(val);
            if (rgb) {
                const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                currentH = hsv.h;
                currentS = hsv.s;
                currentV = hsv.v;
            }
            syncBrandTabAndAccent(val);
            updateSettingsSwatchOnly(val);
            if (satValContainer) satValContainer.style.backgroundColor = hsvToHex(currentH, 100, 100);
            if (satValPointer) {
                satValPointer.style.left = `${currentS}%`;
                satValPointer.style.top = `${100 - currentV}%`;
            }
            if (huePointer) huePointer.style.left = `${(currentH / 360) * 100}%`;
            if (pickerMiniSwatch) pickerMiniSwatch.style.backgroundColor = val;
        }
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => resetToSaved());
    }

    setFromHex(colorPicker.value);
    settingsBinderPickerApi = { setFromHex, resetToSaved };
}

function setupEventListeners() {
    const battleToggle = document.getElementById('settings-battles-toggle');
    const tradingToggle = document.getElementById('settings-trading-toggle');
    const colorPicker = document.getElementById('brand-color');
    const packArtUpload = document.getElementById('pack-art-placeholder');

    if (battleToggle) {
        battleToggle.checked = currentUser.streamer?.battles_enabled !== false;
        battleToggle.onchange = (e) => saveSettings({ battles_enabled: e.target.checked });
    }
    if (tradingToggle) {
        tradingToggle.checked = currentUser.streamer?.trading_enabled !== false;
        tradingToggle.onchange = (e) => saveSettings({ trading_enabled: e.target.checked });
    }
    if (colorPicker) {
        colorPicker.oninput = (e) => {
            const v = e.target.value;
            const hex = document.getElementById('brand-color-hex');
            if (hex) hex.textContent = v.toUpperCase();
            if (settingsBinderPickerApi) {
                settingsBinderPickerApi.setFromHex(v);
            } else {
                applyDashboardAccent({ binder_color: v });
            }
        };
    }
    if (packArtUpload) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => handlePackArtUpload(e.target.files[0]);
        packArtUpload.parentElement.onclick = () => fileInput.click();
    }

    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.oninput = () => {
            debounce(() => {
                if (adminCollectorsCache.length) renderAdminUserList();
                else fetchUserList();
            }, 300)();
        };
    }

    const logSearch = document.getElementById('log-search');
    if (logSearch) {
        logSearch.oninput = (e) => {
            debounce(() => fetchAdminLogs(), 500)();
        };
    }

    const logCategory = document.getElementById('log-category-filter');
    if (logCategory) {
        logCategory.onchange = () => fetchAdminLogs();
    }

    document.getElementById('channel-team-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-team]');
        if (!btn) return;
        const tid = btn.getAttribute('data-remove-team');
        if (tid) removeChannelTeamMember(tid);
    });

    document.getElementById('admin-user-list')?.addEventListener('click', (e) => {
        const grant = e.target.closest('[data-admin-grant]');
        if (grant) {
            const tid = grant.getAttribute('data-twitch-id');
            if (tid) openUserGrantFromMemberRow(tid);
            return;
        }
        const team = e.target.closest('[data-admin-team]');
        if (team) {
            const tid = team.getAttribute('data-twitch-id');
            const role = team.getAttribute('data-role');
            if (tid && role) addChannelTeamMemberByTwitchId(tid, role);
            return;
        }
        const blk = e.target.closest('[data-admin-block]');
        if (blk) {
            const tid = blk.getAttribute('data-twitch-id');
            if (tid) setCollectorBlocked(tid, true);
            return;
        }
        const ublk = e.target.closest('[data-admin-unblock]');
        if (ublk) {
            const tid = ublk.getAttribute('data-twitch-id');
            if (tid) setCollectorBlocked(tid, false);
            return;
        }
        const wipe = e.target.closest('[data-admin-wipe]');
        if (wipe) {
            const tid = wipe.getAttribute('data-twitch-id');
            if (tid) wipeCollectorCollection(tid);
        }
    });

    setupStreamingPlatformDisconnects();
}

function setupStreamingPlatformDisconnects() {
    const goHome = () => {
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch (_) {
            /* ignore */
        }
        window.location.href = '/';
    };

    document.getElementById('btn-disconnect-twitch')?.addEventListener('click', () => {
        showConfirmModal(
            'Disconnect Twitch?',
            'Removes Twitch OAuth from Castle. Your collection and cards stay on your account.',
            async () => {
                try {
                    const res = await apiFetch(`${BACKEND_URL}/api/auth/disconnect/twitch`, { method: 'POST' });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Failed');
                    showToast('Twitch disconnected', 'success');
                    await syncPlatformAuthStateFromServer();
                    void refreshStreamingPlatformCards();
                } catch (e) {
                    showToast(e.message || 'Failed', 'error');
                }
            },
            'Disconnect'
        );
    });

    document.getElementById('btn-disconnect-kick')?.addEventListener('click', () => {
        showConfirmModal(
            'Disconnect Kick?',
            'Removes Kick OAuth from Castle. Your collection stays on your account. If you only use Kick to sign in, you will be signed out.',
            async () => {
                try {
                    const res = await apiFetch(`${BACKEND_URL}/api/auth/disconnect/kick`, { method: 'POST' });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Failed');
                    if (data.logged_out) {
                        showToast('Signed out', 'success');
                        goHome();
                        return;
                    }
                    showToast('Kick disconnected', 'success');
                    currentUser.kick_linked = false;
                    await syncPlatformAuthStateFromServer();
                    void refreshStreamingPlatformCards();
                } catch (e) {
                    showToast(e.message || 'Failed', 'error');
                }
            },
            'Disconnect'
        );
    });
}

/** Section config: which tabs belong to each top-nav section, the default tab, and the header title. */
const SECTIONS = {
    'dashboard':        { tabs: ['analytics', 'monetization', 'admin', 'activity-log', 'achievements', 'platforms', 'settings'], default: 'analytics', title: 'Dashboard' },
    'card-studio':      { tabs: ['cards', 'sets', 'promo', 'granting'], default: 'cards', title: 'Card Studio' },
    'stream-features':  { tabs: ['overlay', 'queue', 'battle-settings', 'channel-points'], default: 'overlay', title: 'Stream Features' }
};
let currentSection = 'dashboard';

function switchSection(sectionId) {
    const section = SECTIONS[sectionId];
    if (!section) return;
    currentSection = sectionId;

    // Update top nav buttons
    document.querySelectorAll('.section-nav-btn').forEach(btn => {
        btn.classList.remove('text-void-accent', 'bg-void-accent/10');
        btn.classList.add('text-void-muted', 'hover:text-void-text', 'hover:bg-white/[0.04]');
    });
    const activeBtn = document.getElementById(`section-btn-${sectionId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-void-muted', 'hover:text-void-text', 'hover:bg-white/[0.04]');
        activeBtn.classList.add('text-void-accent', 'bg-void-accent/10');
    }

    // Show/hide sidebar groups
    document.querySelectorAll('.sidebar-group').forEach(g => g.classList.add('hidden'));
    const sidebarGroup = document.getElementById(`sidebar-${sectionId}`);
    if (sidebarGroup) sidebarGroup.classList.remove('hidden');

    // Switch to default tab for this section
    switchTab(section.default);

    // Stay on /dashboard; encode section in ?section= (legacy /card-studio URLs normalized on load)
    try {
        const u = new URL(window.location.href);
        u.pathname = '/dashboard';
        if (sectionId === 'dashboard') {
            u.searchParams.delete('section');
        } else {
            u.searchParams.set('section', sectionId);
        }
        history.replaceState({ section: sectionId }, '', u.pathname + u.search);
    } catch (_) {
        const q = sectionId === 'dashboard' ? '' : `?section=${encodeURIComponent(sectionId)}`;
        history.replaceState({ section: sectionId }, '', `/dashboard${q}`);
    }
}
window.switchSection = switchSection;

function switchTab(tabId) {
    document.querySelectorAll('.dashboard-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(panel => {
        panel.classList.remove('active');
    });
    const activePanel = document.getElementById(`content-${tabId}`);
    if (activePanel) activePanel.classList.add('active');

    const contentArea = document.querySelector('.dashboard-content-area');
    if (contentArea) contentArea.scrollTop = 0;

    try {
        const u = new URL(window.location.href);
        const sectionDefault = SECTIONS[currentSection]?.default;
        if (tabId === sectionDefault) {
            u.searchParams.delete('tab');
        } else {
            u.searchParams.set('tab', tabId);
        }
        history.replaceState({ section: currentSection, tab: tabId }, '', u.pathname + u.search);
    } catch (_) {}

    loadTabData(tabId);
}


function loadTabData(tabId) {
    if (tabId !== 'queue') stopQueueAutoRefresh();

    switch (tabId) {
        case 'battle':
            fetchCardsForGrid('battle-card-grid');
            break;
        case 'trading':
            fetchCardsForGrid('trading-card-grid');
            break;
        case 'overlay':
            populateOverlaySettings();
            break;
        case 'queue':
            loadObsQueue(false);
            startQueueAutoRefresh();
            break;
        case 'admin':
            adminCollectorsCache = [];
            channelTeamRoleByTwitchId = new Map();
            adminBlockedTwitchIds = new Set();
            (async () => {
                await fetchUserList();
                await fetchChannelTeam();
                renderAdminUserList();
            })();
            break;
        case 'activity-log':
            fetchAdminLogs();
            document.querySelectorAll('#content-activity-log .void-dropdown').forEach((w) => {
                if (!w.dataset.voidDropdownInit) initVoidDropdown(w);
            });
            break;
        case 'achievements':
            loadCreatorProgress();
            break;
        case 'events':
            checkActiveEvent();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'platforms':
            void refreshStreamingPlatformCards();
            break;
        case 'channel-points':
            loadChannelPointsTab();
            break;
        case 'settings':
            syncSettingsTabFromStreamer();
            break;
        case 'cards':
            loadSets();
            switchSubTab('cards', 'all');
            break;
        case 'monetization':
            loadStripeStatus();
            break;
    }
}


function switchSubTab(parentTab, subTabId) {
    console.log(`[Dashboard] Switching sub-tab: ${parentTab} -> ${subTabId}`);

    document.querySelectorAll(`[id^="subtab-${parentTab}-"]`).forEach(btn => {
        btn.classList.remove('active', 'bg-void-accent', 'text-void-bg', 'shadow-lg', 'shadow-void-accent/20');
        btn.classList.add('bg-white/5', 'text-void-muted');
    });

    const activeBtn = document.getElementById(`subtab-${parentTab}-${subTabId}`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-void-accent', 'text-void-bg', 'shadow-lg', 'shadow-void-accent/20');
        activeBtn.classList.remove('bg-white/5', 'text-void-muted');
    }

    document.querySelectorAll(`[id^="${parentTab}-subcontent-"]`).forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`${parentTab}-subcontent-${subTabId}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
        activePanel.classList.add('active');
    }

    loadSubTabData(parentTab, subTabId);
}

function loadSubTabData(parentTab, subTabId) {
    if (parentTab === 'cards') {
        if (subTabId === 'all') fetchCardsForGrid('creator-cards-grid');
        if (subTabId === 'sets') loadSets();
        if (subTabId === 'pack') loadPackSettings();
        if (subTabId === 'backs') fetchCardBacks();
        if (subTabId === 'templates') loadTemplates();
        if (subTabId === 'layer-editor' && typeof renderEditorView === 'function') renderEditorView();
    }
}

function populateOverlaySettings() {
    if (!currentUser || !currentUser.streamer) return;
    const s = currentUser.streamer;
    const token = s.obs_overlay_token || "PENDING_TOKEN";
    const baseUrl = window.location.origin;

    const packsInput = document.getElementById('packs-obs-link');
    const battlesInput = document.getElementById('battles-obs-link');

    // Pass the streamer parameter to match what the backend expects
    const authParams = `streamer=${encodeURIComponent(currentUser.name)}&token=${token}`;

    if (packsInput) packsInput.value = `${baseUrl}/obs-overlay?${authParams}&type=pack`;
    if (battlesInput) battlesInput.value = `${baseUrl}/obs-overlay?${authParams}&type=battle`;

    const animSelect = document.getElementById('pack-animation-style');
    const iframe = document.getElementById('anim-preview-iframe');
    const label = document.getElementById('anim-preview-label');

    if (animSelect) {
        animSelect.value = s.pack_animation_style || 'style1';
        if (iframe) iframe.src = `/obs-overlay?${authParams}&preview=${animSelect.value}`;
        if (label && animSelect.selectedIndex >= 0) label.textContent = animSelect.options[animSelect.selectedIndex].text;

        animSelect.onchange = (e) => {
            saveSettings({ pack_animation_style: e.target.value });
            if (iframe) iframe.src = `/obs-overlay?${authParams}&preview=${e.target.value}`;
            if (label && e.target.selectedIndex >= 0) label.textContent = e.target.options[e.target.selectedIndex].text;
        };
    }

    const soundSelect = document.getElementById('pack-sound-effect');
    if (soundSelect) {
        soundSelect.value = s.pack_open_sound_url || '/packopensound.wav';
        soundSelect.onchange = (e) => saveSettings({ pack_open_sound_url: e.target.value });
    }
}


async function bootstrapDashboard() {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/bootstrap?streamer=all&lite=1`, { credentials: 'include' });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const hint = errBody?.hint ? ` — ${errBody.hint}` : '';
            throw new Error(`Initialization failed (${res.status})${hint}`);
        }

        const data = await res.json();
        
        // Save to cache for next time
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        
        return applyBootstrapData(data);
    } catch (err) {
        console.error("[Dashboard] Bootstrap error:", err);
        showToast("System error during initialization", "error");
        return null;
    }
}

/**
 * Applies bootstrap data to the global state and UI.
 * Can be called multiple times (cache then fresh).
 */
function applyBootstrapData(data) {
    const hasTeam =
        Array.isArray(data.user?.team_memberships) && data.user.team_memberships.length > 0;
    if (!data.user || (!data.user.is_creator && !hasTeam)) {
        console.warn("[Dashboard] Unauthorized attempt. Redirecting...");
        window.location.href = '/';
        return null;
    }

    const isTeamHelperOnly = !data.user.is_creator && hasTeam;
    const st = data.user.streamer || {};
    const streamerNavLabel = (st.display_name && String(st.display_name).trim())
        || st.username
        || data.user.username
        || 'Creator';

    currentUser = {
        name: streamerNavLabel,
        display_name: streamerNavLabel,
        avatar: data.user.avatar_url,
        twitch_id: data.user.twitch_id,
        is_creator: data.user.is_creator,
        is_team_helper_only: isTeamHelperOnly,
        streamer: st,
        streamer_id: st.id,
        trade_code: data.user.trade_code,
        team_memberships: Array.isArray(data.user.team_memberships) ? data.user.team_memberships : [],
        kick_linked: !!data.user.kick_linked
    };
    try {
        window.currentUser = currentUser;
    } catch (_) { /* ignore */ }
    if (isTeamHelperOnly) {
        const ids = new Set(currentUser.team_memberships.map((m) => String(m.streamer_id)));
        let saved = '';
        try {
            saved = localStorage.getItem(ACT_AS_STREAMER_STORAGE_KEY) || '';
        } catch (_) { /* ignore */ }
        if (!saved || !ids.has(saved)) {
            const first = currentUser.team_memberships[0]?.streamer_id;
            if (first) {
                try {
                    localStorage.setItem(ACT_AS_STREAMER_STORAGE_KEY, String(first));
                } catch (_) { /* ignore */ }
                window.location.reload();
                return null;
            }
            window.location.href = '/';
            return null;
        }
    }

    updateActAsContextBanner();
    if (typeof initNavUserMenu === 'function') initNavUserMenu();
    if (typeof updateNavUserMenuLabels === 'function') updateNavUserMenuLabels();

    // Update Nav UI (streamer / Twitch identity — not collection brand name)
    const navUsername = document.getElementById('nav-username');
    const navAvatar = document.getElementById('nav-avatar');
    if (navUsername) navUsername.textContent = streamerNavLabel;
    if (navAvatar) {
        navAvatar.src = currentUser.avatar || '/default-avatar.png';
        navAvatar.onerror = () => navAvatar.src = '/default-avatar.png';
    }

    creatorStats = data.stats || {};
    
    // Populate sections
    populateBranding();
    populateOverlaySettings();
    checkActiveEvent();
    
    return data;
}

async function hydrateCreatorStreamerFromProfile() {
    // We proceed even if currentUser is null, as this might be running in parallel with bootstrap
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const profile = await res.json();
        if (!profile || !profile.id) return;
        
        // If bootstrap hasn't finished yet, we'll store it but wait for applyBootstrapData to run
        if (!currentUser) {
            console.warn('[Dashboard] Profile arrived before bootstrap. Retrying assignment...');
            // Simple retry or just wait for initDashboard to handle it
            let retries = 0;
            while (!currentUser && retries < 10) {
                await new Promise(r => setTimeout(r, 100));
                retries++;
            }
        }

        if (!currentUser) return; // Still not there? Give up.

        currentUser.streamer = profile;
        currentUser.streamer_id = profile.id;
        const lbl =
            (profile.display_name && String(profile.display_name).trim()) ||
            profile.username ||
            currentUser.name;
        currentUser.display_name = lbl;
        currentUser.name = lbl;
        try {
            window.currentUser = currentUser;
        } catch (_) { /* ignore */ }
        const navUsername = document.getElementById('nav-username');
        if (navUsername) navUsername.textContent = lbl;
        if (typeof updateNavUserMenuLabels === 'function') updateNavUserMenuLabels();
        await syncPlatformAuthStateFromServer();
        populateBranding();
        populateOverlaySettings();
    } catch (e) {
        console.warn('[Dashboard] Profile hydrate failed', e);
    }
}

/**
 * Team channel context: show a banner when viewing another channel as mod/editor.
 * Channel switching uses the profile menu (Team channels). Creators can return to “My channel” here.
 */
function updateActAsContextBanner() {
    const banner = document.getElementById('act-as-context-banner');
    const main = document.querySelector('main.dashboard-container');
    const exitBtn = document.getElementById('act-as-exit-btn');
    const hint = document.getElementById('act-as-banner-hint');
    const chEl = document.getElementById('act-as-banner-channel');
    const roleEl = document.getElementById('act-as-banner-role');
    if (!banner || !currentUser) return;

    const memberships = currentUser.team_memberships || [];
    const teamOnly = !!currentUser.is_team_helper_only;
    let saved = '';
    try {
        saved = localStorage.getItem(ACT_AS_STREAMER_STORAGE_KEY) || '';
    } catch (_) { /* ignore */ }

    const m = memberships.find((x) => String(x.streamer_id) === String(saved));

    let show = false;
    if (teamOnly) {
        show = memberships.length > 0 && !!m;
    } else {
        show = !!(saved && m);
    }

    if (!show) {
        banner.classList.add('hidden');
        banner.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dashboard-act-as-banner-visible');
        if (main) main.classList.remove('dashboard-with-act-as-banner');
        return;
    }

    const label = m
        ? m.streamer?.brand_name || m.streamer?.display_name || m.streamer?.username || 'Channel'
        : 'Channel';
    const roleLabel = m.role === 'editor' ? 'Editor' : 'Mod';
    if (chEl) chEl.textContent = label;
    if (roleEl) roleEl.textContent = roleLabel;

    if (exitBtn && hint) {
        if (teamOnly) {
            exitBtn.classList.add('hidden');
            hint.classList.remove('hidden');
        } else {
            exitBtn.classList.remove('hidden');
            hint.classList.add('hidden');
            exitBtn.onclick = () => {
                try {
                    localStorage.removeItem(ACT_AS_STREAMER_STORAGE_KEY);
                } catch (_) { /* ignore */ }
                window.location.reload();
            };
        }
    }

    banner.classList.remove('hidden');
    banner.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dashboard-act-as-banner-visible');
    if (main) main.classList.add('dashboard-with-act-as-banner');
}

async function fetchChannelTeam() {
    const list = document.getElementById('channel-team-list');
    if (!list) return;

    list.innerHTML =
        '<div class="admin-panel-empty py-6">Loading team…</div>';

    channelTeamRoleByTwitchId = new Map();
    channelTeamManageAllowed = false;

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/team`, { credentials: 'include' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error || err.message || 'Could not load team';
            list.innerHTML = `<div class="admin-panel-empty text-amber-400/90 leading-relaxed">${escapeHTML(msg)}</div>`;
            channelTeamManageAllowed = false;
            return;
        }
        channelTeamManageAllowed = true;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            list.innerHTML = `<div class="admin-panel-empty py-8 leading-relaxed max-w-md mx-auto">No team members yet. Add mods or editors from the member list below.</div>`;
            return;
        }
        rows.forEach((r) => {
            channelTeamRoleByTwitchId.set(String(r.member_twitch_id), r.role);
        });
        list.innerHTML = rows
            .map((row) => {
                const tid = String(row.member_twitch_id);
                const idEsc = escapeHTML(tid);
                const fromCache = adminCollectorsCache.find((c) => String(c.twitch_id) === tid);
                const nameLine = fromCache?.username
                    ? escapeHTML(fromCache.username)
                    : `Twitch ID ${idEsc}`;
                const role = row.role === 'editor' ? 'Editor' : 'Moderator';
                const when = row.created_at ? escapeHTML(new Date(row.created_at).toLocaleDateString()) : '';
                return `
                <div class="admin-team-row">
                    <div class="min-w-0">
                        <div class="text-[11px] font-black text-white uppercase tracking-tight truncate">${nameLine}</div>
                        <div class="text-[9px] text-void-muted uppercase mt-1">${role}${when ? ` · since ${when}` : ''}</div>
                    </div>
                    <button type="button" data-remove-team="${idEsc}" class="admin-action-btn admin-action-btn--remove shrink-0">
                        Remove
                    </button>
                </div>`;
            })
            .join('');
    } catch (e) {
        list.innerHTML = `<div class="admin-panel-empty text-red-400/90">Failed to load team</div>`;
        channelTeamManageAllowed = false;
    }
}

async function fetchBlockedCollectors() {
    adminBlockedTwitchIds = new Set();
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/blocked-collectors`, { credentials: 'include' });
        if (!res.ok) return;
        const rows = await res.json();
        if (Array.isArray(rows)) {
            rows.forEach((r) => {
                if (r && r.blocked_twitch_id != null) adminBlockedTwitchIds.add(String(r.blocked_twitch_id));
            });
        }
    } catch (_) { /* ignore */ }
}

async function setCollectorBlocked(twitchId, blocked) {
    const tid = String(twitchId || '').trim();
    if (!tid) return;
    const msg = blocked
        ? 'Block this user from earning cards on this channel (Channel Points and grants)?'
        : 'Unblock this user?';
    if (!confirm(msg)) return;
    showToast(blocked ? 'Blocking…' : 'Unblocking…', 'loading');
    try {
        const res = blocked
            ? await apiFetch(`${BACKEND_URL}/api/creator/blocked-collectors`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ twitch_id: tid })
              })
            : await apiFetch(
                  `${BACKEND_URL}/api/creator/blocked-collectors?twitch_id=${encodeURIComponent(tid)}`,
                  { method: 'DELETE', credentials: 'include' }
              );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || data.message || 'Request failed', 'error');
            return;
        }
        showToast(blocked ? 'User blocked' : 'User unblocked', 'success');
        await fetchBlockedCollectors();
        renderAdminUserList();
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function wipeCollectorCollection(twitchId) {
    const tid = String(twitchId || '').trim();
    if (!tid) return;
    if (
        !confirm(
            'Remove ALL cards and achievements for this user on your channel? This cannot be undone.'
        )
    ) {
        return;
    }
    showToast('Wiping collection…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/collector-wipe`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ twitch_id: tid })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || data.message || 'Wipe failed', 'error');
            return;
        }
        showToast('Collection cleared', 'success');
        await fetchUserList();
        renderAdminUserList();
    } catch (e) {
        showToast('Network error', 'error');
    }
}

function openUserGrantFromMemberRow(twitchId) {
    const u = adminCollectorsCache.find((c) => String(c.twitch_id) === String(twitchId));
    openUserGrant(u?.username || '', twitchId);
}

function renderAdminUserList() {
    const container = document.getElementById('admin-user-list');
    if (!container) return;

    const filter = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
    let users = adminCollectorsCache;
    if (filter) {
        users = users.filter(
            (u) =>
                (u.username && u.username.toLowerCase().includes(filter)) ||
                String(u.twitch_id).includes(filter)
        );
    }

    const ownerTwitchId =
        currentUser?.streamer?.twitch_id != null ? String(currentUser.streamer.twitch_id) : '';
    const sessionTwitchId = currentUser?.twitch_id != null ? String(currentUser.twitch_id) : '';

    if (!users.length) {
        container.innerHTML = `<div class="admin-panel-empty">No members match your search</div>`;
        return;
    }

    container.innerHTML = users
        .map((u) => {
            const tid = String(u.twitch_id);
            const avatarHtml = u.avatar_url
                ? `<img src="${escapeHTML(u.avatar_url)}" class="w-10 h-10 rounded-xl border border-white/10 object-cover" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20\\'><i class=\\'bx bxs-user text-xs\\'></i></div>'">`
                : `<div class="w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20"><i class="bx bxs-user text-xs"></i></div>`;
            const teamRole = channelTeamRoleByTwitchId.get(tid);
            const teamBadge = teamRole
                ? `<span class="admin-badge admin-badge--team">${teamRole === 'editor' ? 'Editor' : 'Mod'}</span>`
                : '';
            const isBlocked = adminBlockedTwitchIds.has(tid);
            const blockedBadge = isBlocked
                ? `<span class="admin-badge admin-badge--blocked">Blocked</span>`
                : '';
            const isSelf = (ownerTwitchId && tid === ownerTwitchId) || (sessionTwitchId && tid === sessionTwitchId);
            const teamButtons =
                !channelTeamManageAllowed || isSelf
                    ? isSelf
                        ? `<span class="text-[8px] text-void-muted uppercase font-bold tracking-wider">You</span>`
                        : ''
                    : `
                <button type="button" data-admin-team data-twitch-id="${escapeHTML(tid)}" data-role="moderator" class="admin-action-btn admin-action-btn--mod" title="Moderator: grants & queue">
                    Mod
                </button>
                <button type="button" data-admin-team data-twitch-id="${escapeHTML(tid)}" data-role="editor" class="admin-action-btn admin-action-btn--editor" title="Editor: cards, sets, branding">
                    Editor
                </button>
            `;
            const modButtons = !isSelf
                ? isBlocked
                    ? `<button type="button" data-admin-unblock data-twitch-id="${escapeHTML(tid)}" class="admin-action-btn admin-action-btn--unblock">Unblock</button>`
                    : `<button type="button" data-admin-block data-twitch-id="${escapeHTML(tid)}" class="admin-action-btn admin-action-btn--block">Block</button>`
                : '';
            const wipeBtn = !isSelf
                ? `<button type="button" data-admin-wipe data-twitch-id="${escapeHTML(tid)}" class="admin-action-btn admin-action-btn--wipe" title="Remove all cards and achievements for this channel">Wipe</button>`
                : '';
            return `
                <div class="admin-member-row">
                    <div class="flex items-center gap-4 min-w-0">
                        ${avatarHtml}
                        <div class="min-w-0">
                            <div class="text-[11px] font-black text-white uppercase truncate tracking-tight">${escapeHTML(u.username || 'Unknown')}</div>
                            <div class="text-[9px] text-void-muted uppercase mt-1 flex items-center gap-2 flex-wrap font-bold tracking-wide">
                                <span>Cards: ${u.total_cards} · Unique: ${u.unique_cards}</span>
                                ${teamBadge}
                                ${blockedBadge}
                            </div>
                        </div>
                    </div>
                    <div class="admin-member-actions">
                        <button type="button" data-admin-grant data-twitch-id="${escapeHTML(tid)}" class="admin-action-btn admin-action-btn--grant" ${isBlocked ? 'disabled aria-disabled="true" title="Unblock to grant"' : ''}>
                            Grant
                        </button>
                        ${teamButtons}
                        ${modButtons}
                        ${wipeBtn}
                    </div>
                </div>`;
        })
        .join('');
}

async function fetchUserList() {
    const container = document.getElementById('admin-user-list');
    if (!container) return;

    container.innerHTML =
        '<div class="admin-panel-empty py-8">Loading members…</div>';

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/analytics/collectors?days=90&full=1`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        adminCollectorsCache = data.all_collectors || data.top_collectors || [];
        await fetchBlockedCollectors();
    } catch (err) {
        container.innerHTML = `<div class="admin-panel-empty text-red-400/90">Failed to load members</div>`;
    }
}

async function addChannelTeamMemberByTwitchId(twitchId, role) {
    const raw = String(twitchId || '').trim();
    if (!raw) return;

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/team`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                member_twitch_id: raw,
                role: role === 'editor' ? 'editor' : 'moderator'
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || data.message || 'Could not add member', 'error');
            return;
        }
        showToast('Team member saved', 'success');
        await fetchChannelTeam();
        renderAdminUserList();
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function removeChannelTeamMember(twitchId) {
    if (!twitchId || !confirm('Remove this person from your channel team?')) return;
    try {
        const res = await apiFetch(
            `${BACKEND_URL}/api/creator/team?member_twitch_id=${encodeURIComponent(twitchId)}`,
            { method: 'DELETE', credentials: 'include' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || data.message || 'Could not remove', 'error');
            return;
        }
        showToast('Removed from team', 'success');
        await fetchChannelTeam();
        renderAdminUserList();
    } catch (e) {
        showToast('Network error', 'error');
    }
}


async function fetchCSRFToken() {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/csrf`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            csrfToken = data.token;
        }
    } catch (e) {
        console.error('CSRF fetch failed:', e);
    }
}


function populateBranding() {
    if (!currentUser) return;
    const s = currentUser.streamer || {};
    applyDashboardAccent(s);

    const color = s.binder_color || s.brand_color_primary || '#00f2fe';
    const navLabel = (s.display_name && String(s.display_name).trim()) || s.username || currentUser.name;
    currentUser.display_name = navLabel;
    currentUser.name = navLabel;
    try {
        window.currentUser = currentUser;
    } catch (_) { /* ignore */ }

    if (document.getElementById('nav-username')) document.getElementById('nav-username').textContent = navLabel;
    if (typeof updateNavUserMenuLabels === 'function') updateNavUserMenuLabels();

    if (document.getElementById('brand-name')) document.getElementById('brand-name').value = s.brand_name || '';
    if (document.getElementById('brand-color')) {
        document.getElementById('brand-color').value = color;
        document.getElementById('brand-color-hex').textContent = color.toUpperCase();
    }

    const packPrev = document.getElementById('pack-art-preview');
    if (packPrev) {
        if (s.pack_image_url) {
            packPrev.src = s.pack_image_url;
            packPrev.classList.remove('hidden');
            document.getElementById('pack-art-placeholder')?.classList.add('hidden');
        } else {
            packPrev.src = DEFAULT_PACK_IMAGE_URL;
            packPrev.classList.remove('hidden');
            document.getElementById('pack-art-placeholder')?.classList.add('hidden');
        }
    }

    syncSettingsTabFromStreamer();
    void refreshStreamingPlatformCards();
}

/** Settings tab: binders + toggles + collection methods from currentUser.streamer */
function syncSettingsTabFromStreamer() {
    if (!currentUser?.streamer) return;
    const s = currentUser.streamer;
    const color = s.binder_color || s.brand_color_primary || '#00f2fe';
    settingsBinderColorSaved = normalizeBinderHex(color);

    const sn = document.getElementById('settings-brand-name');
    if (sn) sn.value = s.brand_name || '';

    if (settingsBinderPickerApi) {
        settingsBinderPickerApi.setFromHex(settingsBinderColorSaved);
    } else {
        const sc = document.getElementById('settings-binder-color');
        const sh = document.getElementById('settings-binder-color-hex');
        if (sc) sc.value = settingsBinderColorSaved;
        if (sh) sh.textContent = settingsBinderColorSaved.replace('#', '');
    }

    const bt = document.getElementById('settings-battles-toggle');
    if (bt) bt.checked = s.battles_enabled !== false;
    const tt = document.getElementById('settings-trading-toggle');
    if (tt) tt.checked = s.trading_enabled !== false;

    const cm = s.collection_methods && typeof s.collection_methods === 'object' ? s.collection_methods : {};
    COLLECTION_METHOD_KEYS.forEach((key) => {
        const el = document.querySelector(`input[name="collection-method"][value="${key}"]`);
        if (el) el.checked = cm[key] === true;
    });

    ensureAchievementBrandingGrid();
    const names = s.achievement_names && typeof s.achievement_names === 'object' ? s.achievement_names : {};
    ACHIEVEMENT_BRANDING_FIELDS.forEach((f) => {
        const el = document.getElementById(`ach-override-${f.key}`);
        if (el) el.value = achievementOverrideInputValue(names, f.key);
    });
}

async function saveSettingsBranding() {
    const brand_name = document.getElementById('settings-brand-name')?.value?.trim() || '';
    const binder_color = normalizeBinderHex(document.getElementById('settings-binder-color')?.value || '#00f2fe');
    const bn = document.getElementById('brand-name');
    const bc = document.getElementById('brand-color');
    const bh = document.getElementById('brand-color-hex');
    if (bn) bn.value = brand_name;
    if (bc) bc.value = binder_color;
    if (bh) bh.textContent = binder_color.toUpperCase();

    ensureAchievementBrandingGrid();
    const achievement_names = {};
    ACHIEVEMENT_BRANDING_FIELDS.forEach((f) => {
        const el = document.getElementById(`ach-override-${f.key}`);
        if (!el) return;
        const v = el.value.trim();
        if (v) achievement_names[f.key] = v;
    });

    showToast('Saving…', 'loading');
    const ok = await saveSettings({ brand_name, binder_color, achievement_names });
    if (ok) {
        settingsBinderColorSaved = binder_color;
        showToast('Branding saved', 'success');
        populateBranding();
    } else {
        showToast('Could not save branding', 'error');
    }
}

async function saveCollectionMethods() {
    const methods = {};
    COLLECTION_METHOD_KEYS.forEach((key) => {
        const el = document.querySelector(`input[name="collection-method"][value="${key}"]`);
        methods[key] = !!(el && el.checked);
    });
    showToast('Saving…', 'loading');
    const ok = await saveSettings({ collection_methods: methods });
    if (ok) {
        showToast('Collection methods saved', 'success');
    } else {
        showToast('Could not save collection methods', 'error');
    }
}

window.saveSettingsBranding = saveSettingsBranding;
window.saveCollectionMethods = saveCollectionMethods;

/** Twitch / Kick row status on Streaming Platforms tab (OAuth health via /api/auth/twitch-status) */
async function refreshStreamingPlatformCards() {
    if (!currentUser) return;
    const uid = String(currentUser.twitch_id || '');
    const isKickAccount = uid.startsWith('kick_');

    let st = null;
    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/twitch-status`, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
            st = await res.json().catch(() => null);
        }
    } catch (_) {
        st = null;
    }

    if (st && typeof st.kick_linked === 'boolean') {
        currentUser.kick_linked = st.kick_linked;
    }

    // Twitch: token_valid alone — needs_reauth is also true when scopes are incomplete, which would wrongly hide "Connected"
    const twitchOAuthOk =
        !isKickAccount && !!st?.twitch && st.twitch.token_valid === true;
    const kickOAuthOk = isKickAccount
        ? !!(st?.kick && st.kick.token_valid)
        : !!(st?.kick_linked && st?.kick && st.kick.token_valid);

    const twitchShowConnected = st ? twitchOAuthOk : !isKickAccount;
    const kickShowConnected = st
        ? kickOAuthOk
        : isKickAccount || !!currentUser.kick_linked;

    const twitchConnected = document.getElementById('twitch-platform-connected');
    const twitchConnectBtn = document.getElementById('btn-twitch-platform-connect');
    const twitchDisconnectBtn = document.getElementById('btn-disconnect-twitch');
    if (twitchConnected && twitchConnectBtn && twitchDisconnectBtn) {
        if (isKickAccount) {
            twitchConnected.classList.add('hidden');
            twitchDisconnectBtn.classList.add('hidden');
            twitchConnectBtn.classList.remove('hidden');
            twitchConnectBtn.onclick = () => {
                window.location.href = `${BACKEND_URL}/auth/twitch?role=creator`;
            };
        } else if (twitchShowConnected) {
            twitchConnected.classList.remove('hidden');
            twitchDisconnectBtn.classList.remove('hidden');
            twitchConnectBtn.classList.add('hidden');
        } else {
            twitchConnected.classList.add('hidden');
            twitchDisconnectBtn.classList.add('hidden');
            twitchConnectBtn.classList.remove('hidden');
            twitchConnectBtn.onclick = () => {
                window.location.href = `${BACKEND_URL}/auth/twitch?role=creator`;
            };
        }
    }

    const kickConnected = document.getElementById('kick-platform-connected');
    const kickConnect = document.getElementById('btn-kick-oauth-connect');
    const kickDisconnectBtn = document.getElementById('btn-disconnect-kick');
    if (kickConnected && kickConnect && kickDisconnectBtn) {
        if (kickShowConnected) {
            kickConnected.classList.remove('hidden');
            kickDisconnectBtn.classList.remove('hidden');
            kickConnect.classList.add('hidden');
        } else {
            kickConnected.classList.add('hidden');
            kickDisconnectBtn.classList.add('hidden');
            kickConnect.classList.remove('hidden');
            kickConnect.onclick = () => {
                window.location.href = `${BACKEND_URL}/auth/kick?mode=link&role=creator`;
            };
        }
    }
}

function confirmResetPackArt() {
    showConfirmModal(
        'Reset Pack Art',
        'Reset your pack art back to the default image? Your custom art will be removed.',
        () => {
            const preview = document.getElementById('pack-art-preview');
            preview.src = DEFAULT_PACK_IMAGE_URL;
            saveSettings({ pack_image_url: null });
            showToast('Pack art reset to default', 'success');
        }
    );
}

function resetPackArt() {
    confirmResetPackArt();
}

function showConfirmModal(title, message, onConfirm, confirmLabel = 'Confirm') {
    const modal = document.getElementById('confirm-action-modal');
    if (!modal) { if (onConfirm && confirm(message)) onConfirm(); return; }
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    const btn = document.getElementById('confirm-modal-action-btn');
    btn.textContent = confirmLabel;
    btn.onclick = () => { closeConfirmModal(); onConfirm(); };
    modal.classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirm-action-modal')?.classList.add('hidden');
}

function copyOBSLink(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => showToast('Copied to clipboard', 'success'));
}

function updateAnimPreview(style) {
    const label = document.getElementById('anim-preview-label');
    const box = document.getElementById('anim-preview-box');
    if (!label || !box) return;

    const labels = { standard: 'Standard', cosmic: 'Cosmic Burst', brutalist: 'Brutalist Jitter' };
    label.textContent = labels[style] || style;

    // Remove old anim classes
    box.classList.remove('anim-standard', 'anim-cosmic', 'anim-brutalist');
    void box.offsetWidth; // Force reflow
    box.classList.add(`anim-${style}`);
}

function closeGrantModal() {
    document.getElementById('grant-card-modal')?.classList.add('hidden');
    const oldModal = document.getElementById('grant-modal');
    if (oldModal) oldModal.remove();
}

async function handlePackArtUpload(file) {
    if (!file) return;

    showToast("Uploading pack art...", "loading");

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData,
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('pack-art-preview').src = data.url;
            document.getElementById('pack-art-preview').classList.remove('hidden');
            document.getElementById('pack-art-placeholder').classList.add('hidden');

            await saveSettings({ pack_image_url: data.url });
            showToast("Art updated successfully", "success");
        } else {
            showToast("Upload failed", "error");
        }
    } catch (err) {
        showToast("Connection failure", "error");
    }
}

// --- Pack editor (composite design + foil; API allows moderators for pack fields + upload) ---
const PACK_EDITOR_BODY = { x: 52, y: 128, w: 296, h: 300 };
const PACK_EDITOR_FOIL_TOP = { x: 40, y: 36, w: 320, h: 56 };
const PACK_EDITOR_FOIL_BOT = { x: 40, y: 468, w: 320, h: 56 };

let packEditorState = { mockupImg: null, designImg: null, designFile: null };

function packEditorLoadImage(src) {
    return new Promise((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('load'));
        im.src = src;
    });
}

async function openPackEditor() {
    const modal = document.getElementById('pack-editor-modal');
    if (!modal) return;
    packEditorState = { mockupImg: null, designImg: null, designFile: null };

    const scale = document.getElementById('pack-editor-design-scale');
    const scaleVal = document.getElementById('pack-editor-scale-value');
    const foil = document.getElementById('pack-editor-foil-color');
    const foilHex = document.getElementById('pack-editor-foil-hex');
    const clearBtn = document.getElementById('pack-editor-clear-design');

    if (scale) scale.value = '100';
    if (scaleVal) scaleVal.textContent = '100%';
    const s = currentUser?.streamer || {};
    if (foil) foil.value = s.pack_foil_color || '#c9a227';
    if (foilHex) foilHex.textContent = (foil?.value || '#c9a227').toUpperCase();
    if (clearBtn) clearBtn.classList.add('hidden');

    modal.classList.remove('hidden');

    try {
        packEditorState.mockupImg = await packEditorLoadImage('/packmockup.png');
    } catch (_) {
        try {
            packEditorState.mockupImg = await packEditorLoadImage(DEFAULT_PACK_IMAGE_URL);
        } catch (_) {
            packEditorState.mockupImg = null;
        }
    }

    const designUrl = s.pack_design_url;
    if (designUrl) {
        try {
            const bust = designUrl + (designUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now();
            packEditorState.designImg = await packEditorLoadImage(bust);
            if (clearBtn) clearBtn.classList.remove('hidden');
        } catch (_) {
            packEditorState.designImg = null;
        }
    }

    updatePackEditorPreview();
}

function closePackEditor() {
    document.getElementById('pack-editor-modal')?.classList.add('hidden');
}

function handlePackEditorDesignUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Please choose an image', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const im = new Image();
        im.onload = () => {
            packEditorState.designImg = im;
            packEditorState.designFile = file;
            document.getElementById('pack-editor-clear-design')?.classList.remove('hidden');
            updatePackEditorPreview();
        };
        im.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function clearPackEditorDesign() {
    packEditorState.designImg = null;
    packEditorState.designFile = null;
    document.getElementById('pack-editor-clear-design')?.classList.add('hidden');
    updatePackEditorPreview();
}

function updatePackEditorPreview() {
    const canvas = document.getElementById('pack-editor-canvas');
    const empty = document.getElementById('pack-editor-empty');
    const scaleEl = document.getElementById('pack-editor-design-scale');
    const scaleVal = document.getElementById('pack-editor-scale-value');
    const foilEl = document.getElementById('pack-editor-foil-color');
    const foilHex = document.getElementById('pack-editor-foil-hex');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const W = 400;
    const H = 560;
    /* Transparent backing — saved PNG alpha works in OBS (no baked-in matte). */
    ctx.clearRect(0, 0, W, H);

    const pct = scaleEl ? parseInt(scaleEl.value, 10) / 100 : 1;
    if (scaleVal) scaleVal.textContent = `${Math.round(pct * 100)}%`;

    const foilColor = foilEl?.value || '#c9a227';
    if (foilHex) foilHex.textContent = foilColor.toUpperCase();

    const rect = PACK_EDITOR_BODY;
    const design = packEditorState.designImg;
    if (design && design.naturalWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        const ir = rect.w / design.naturalWidth;
        const baseScale = ir * pct;
        let dw = design.naturalWidth * baseScale;
        let dh = design.naturalHeight * baseScale;
        if (dh > rect.h * 1.2) {
            const r = (rect.h * 1.05) / dh;
            dw *= r;
            dh *= r;
        }
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        ctx.drawImage(design, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
    }

    const mock = packEditorState.mockupImg;
    if (mock && mock.naturalWidth) {
        ctx.drawImage(mock, 0, 0, W, H);
    }

    const top = PACK_EDITOR_FOIL_TOP;
    const bot = PACK_EDITOR_FOIL_BOT;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = foilColor;
    ctx.fillRect(top.x, top.y, top.w, top.h);
    ctx.fillRect(bot.x, bot.y, bot.w, bot.h);
    ctx.restore();

    if (empty) empty.classList.toggle('hidden', !!(design && design.naturalWidth));
}

async function savePackFromEditor() {
    const canvas = document.getElementById('pack-editor-canvas');
    if (!canvas) return;

    showToast('Saving pack…', 'loading');
    try {
        let packDesignUrl = currentUser?.streamer?.pack_design_url || null;

        if (packEditorState.designFile) {
            const fd = new FormData();
            fd.append('file', packEditorState.designFile);
            const up = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: fd,
                credentials: 'include'
            });
            if (!up.ok) {
                const err = await up.json().catch(() => ({}));
                showToast(err.error || err.message || 'Design upload failed', 'error');
                return;
            }
            const uj = await up.json();
            packDesignUrl = uj.url;
        }

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
        if (!blob) {
            showToast('Could not render pack', 'error');
            return;
        }
        const fd2 = new FormData();
        fd2.append('file', blob, 'pack-composite.png');
        const up2 = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: fd2,
            credentials: 'include'
        });
        if (!up2.ok) {
            const err = await up2.json().catch(() => ({}));
            showToast(err.error || err.message || 'Pack upload failed', 'error');
            return;
        }
        const uj2 = await up2.json();
        const packImageUrl = uj2.url;
        const foil = document.getElementById('pack-editor-foil-color')?.value || '#c9a227';

        const payload = { pack_image_url: packImageUrl, pack_foil_color: foil };
        if (packDesignUrl) payload.pack_design_url = packDesignUrl;

        const ok = await saveSettings(payload);
        if (ok) {
            showToast('Pack saved', 'success');
            const prev = document.getElementById('pack-art-preview');
            if (prev) {
                prev.src = packImageUrl + (packImageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                prev.classList.remove('hidden');
                document.getElementById('pack-art-placeholder')?.classList.add('hidden');
            }
            closePackEditor();
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Something went wrong', 'error');
    }
}

window.openPackEditor = openPackEditor;
window.closePackEditor = closePackEditor;
window.handlePackEditorDesignUpload = handlePackEditorDesignUpload;
window.clearPackEditorDesign = clearPackEditorDesign;
window.updatePackEditorPreview = updatePackEditorPreview;
window.savePackFromEditor = savePackFromEditor;

async function saveBranding() {
    await saveSettingsBranding();
}

async function saveSettings(payload) {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (res.ok) {

            if (currentUser.streamer) {
                Object.assign(currentUser.streamer, payload);
                if (payload.binder_color !== undefined) {
                    applyDashboardAccent(currentUser.streamer);
                }
            }
            return true;
        }
        return false;
    } catch (err) {
        console.error("Save error:", err);
        return false;
    }
}


async function fetchCardsForGrid(gridId = 'cards-grid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-full py-12 text-center text-void-muted uppercase tracking-widest text-[10px]"><i class="bx bx-loader-alt animate-spin mr-2"></i>Loading Cards...</div>`;

    try {
        // Load templates in parallel so the template dropdown is populated when editing a card
        const [res] = await Promise.all([
            apiFetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' }),
            creatorTemplates.length === 0 ? loadTemplates() : Promise.resolve(),
        ]);
        if (!res.ok) throw new Error("Access denied");

        creatorCards = await res.json();
        renderCardGrid(gridId, creatorCards);
    } catch (err) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-500 uppercase tracking-widest text-[10px]">Connection failure</div>`;
    }
}

function renderCardGrid(gridId, cards) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (cards.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-void-muted uppercase tracking-widest text-[10px]">No cards found</div>`;
        return;
    }

    if (gridId === 'creator-cards-grid') {
        grid.innerHTML = cards.map(card => {
            const isSelected = selectedCardIds.has(card.id);
            return `
                <div class="card-select-item ${isSelected ? 'selected' : ''}" onclick="${bulkSelectMode ? `toggleCardSelection('${escapeHTML(card.id)}')` : `selectCardStudioDetails('${escapeHTML(card.id)}')`}">
                    ${bulkSelectMode ? `<div class="card-select-check"></div>` : ''}
                    <div class="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl">
                        <img src="${escapeHTML(card.image_url || '')}" class="w-full h-full object-cover transition-all duration-500 hover:scale-105">
                    </div>
                    <div class="p-4 bg-white/5 flex flex-col gap-2">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="text-[11px] font-black text-white uppercase truncate">${escapeHTML(card.name)}</div>
                                <div class="text-[8px] font-bold text-void-accent/50 uppercase tracking-widest">${escapeHTML(card.rarity)}</div>
                            </div>
                            ${!bulkSelectMode ? `
                                <button onclick="event.stopPropagation(); deleteCard('${escapeHTML(card.id)}')" class="text-red-500/30 hover:text-red-500 transition-colors">
                                    <i class="bx bxs-trash text-[10px]"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="h-px bg-white/5 w-full"></div>
                        <div class="flex justify-between items-center text-[7px] font-black text-void-muted uppercase">
                            <span>ATK: ${parseInt(card.attack || 0)}</span>
                            <span>DEF: ${parseInt(card.defense || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    const field = gridId === 'battle-card-grid' ? 'is_battle_eligible' : 'is_trading_eligible';
    grid.innerHTML = cards.map(card => `
        <div class="card-select-item ${card[field] ? 'selected' : ''}" onclick="toggleCardEligibility('${escapeHTML(card.id)}', '${escapeHTML(field)}', this)">
            <div class="card-select-check"></div>
            <div class="aspect-[2/3] w-full flex items-center justify-center">
                <img src="${escapeHTML(card.image_url || '')}" class="w-full h-full object-cover ${card[field] ? '' : 'grayscale opacity-50'} transition-all duration-500">
            </div>
            <div class="p-3 bg-white/5">
                <div class="text-[9px] font-black text-white uppercase truncate">${escapeHTML(card.name)}</div>
                <div class="text-[7px] font-bold text-void-accent uppercase mt-1 tracking-widest">${escapeHTML(card.rarity)}</div>
            </div>
        </div>
    `).join('');
}

async function toggleCardEligibility(cardId, field, element) {
    const newState = !element.classList.contains('selected');
    element.classList.toggle('selected', newState);
    const img = element.querySelector('img');
    if (img) {
        if (newState) img.classList.remove('grayscale', 'opacity-50');
        else img.classList.add('grayscale', 'opacity-50');
    }

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            credentials: 'include',
            body: JSON.stringify({ [field]: newState })
        });

        if (res.ok) {
            const card = creatorCards.find(c => c.id === cardId);
            if (card) card[field] = newState;
        } else {
            throw new Error();
        }
    } catch (err) {
        showToast("Something went wrong", "error");
        element.classList.toggle('selected', !newState);
        if (img) {
            if (!newState) img.classList.remove('grayscale', 'opacity-50');
            else img.classList.add('grayscale', 'opacity-50');
        }
    }
}




const ANALYTICS_CACHE_TTL = 60 * 1000; // 1 minute — sessionStorage primer only; combined API is uncached server-side

function updateAnalyticsPeriodDisplay() {
    const timeRange = document.getElementById('analytics-time-range')?.value || '7';
    const isAll = timeRange === 'all';
    const days = isAll ? 365 : Math.max(1, parseInt(timeRange, 10) || 7);

    const windowEnd   = new Date(Date.now() - analyticsOffset * days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const fmt = { month: 'short', day: 'numeric', year: 'numeric' };
    const rangeEl  = document.getElementById('analytics-period-range');
    const daysEl   = document.getElementById('analytics-period-days');
    const nextBtn  = document.getElementById('analytics-period-next');

    if (rangeEl) rangeEl.textContent = `${windowStart.toLocaleDateString(undefined, fmt)} – ${windowEnd.toLocaleDateString(undefined, fmt)}`;
    if (daysEl)  daysEl.textContent  = isAll ? 'All Time' : `${days} day${days === 1 ? '' : 's'}`;
    if (nextBtn) nextBtn.disabled    = analyticsOffset === 0;
}

function shiftAnalyticsPeriod(direction) {
    // direction: -1 = go back (left arrow), +1 = go forward (right arrow)
    if (direction === 1 && analyticsOffset === 0) return;
    analyticsOffset = Math.max(0, analyticsOffset + (direction === -1 ? 1 : -1));
    analyticsData = { overview: null, cards: null, collectors: null, packs: null, battles: null, revenue: null };
    void loadAnalytics();
}
window.shiftAnalyticsPeriod = shiftAnalyticsPeriod;

async function loadAnalytics(isBackground = false) {
    await ensureChartJsLoaded();

    const timeRange = document.getElementById('analytics-time-range')?.value || '7';
    const cacheKey = `castle_analytics_cache_${timeRange}_${analyticsOffset}`;

    if (
        !isBackground &&
        lastAnalyticsTimeRangeLoaded !== null &&
        lastAnalyticsTimeRangeLoaded !== timeRange
    ) {
        analyticsOffset = 0;
        analyticsData = { overview: null, cards: null, collectors: null, packs: null, battles: null, revenue: null };
    }
    if (!isBackground) {
        lastAnalyticsTimeRangeLoaded = timeRange;
        updateAnalyticsPeriodDisplay();
    }

    // 1. Try Memory Cache first (already populated)
    if (analyticsData.overview && !isBackground) {
        await renderAnalytics();
    }

    // 2. Try SessionStorage if memory is empty
    if (!analyticsData.overview) {
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < ANALYTICS_CACHE_TTL) {
                    Object.assign(analyticsData, data);
                    await renderAnalytics();
                }
            }
        } catch (_) {}
    }

    // 3. Fetch from API

    const container = document.getElementById('content-analytics');
    const showLoading = !analyticsData.overview && !isBackground;

    if (showLoading && container) {
        container.classList.add('analytics-loading');
    }

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/analytics/combined?days=${timeRange}&offset=${analyticsOffset}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load combined analytics');
        
        const data = await res.json();

        if (isBackground) {
            const selNow = document.getElementById('analytics-time-range')?.value || '7';
            if (selNow !== timeRange) return;
        }

        // Update global state
        analyticsData.overview = data.overview;
        analyticsData.cards = data.cards;
        analyticsData.packs = data.packs;
        analyticsData.collectors = data.collectors;
        analyticsData.battles = data.battles;
        analyticsData.revenue = data.revenue;

        // Update SessionStorage
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));

        // Render pass
        await renderAnalytics();
    } catch (err) {
        if (!isBackground) console.error('Analytics loading error:', err);
        if (analyticsData.overview || analyticsData.cards || analyticsData.packs || analyticsData.collectors) {
            try {
                await renderAnalytics();
            } catch (_) {
                /* ignore */
            }
        }
    } finally {
        if (container) container.classList.remove('analytics-loading');
    }
}

function analyticsMetricPanelIsVisible(panelId) {
    const el = document.getElementById(panelId);
    return !!(el && !el.classList.contains('hidden'));
}

function applyTrend(elId, current, previous) {
    const el = document.getElementById(elId);
    if (!el) return;
    const diff = current - previous;
    if (diff > 0) {
        el.textContent = '↑';
        el.classList.remove('down');
        el.style.display = '';
    } else if (diff < 0) {
        el.textContent = '↓';
        el.classList.add('down');
        el.style.display = '';
    } else {
        el.style.display = 'none';
    }
}

function renderAnalyticsStatTiles() {
    const packOpenings  = analyticsData.packs?.total_openings ?? null;
    const packPrev      = analyticsData.packs?.prev_total ?? null;
    const collectors    = analyticsData.overview?.total_collectors ?? null;
    const colChange     = analyticsData.overview?.collectors_change ?? 0;
    const totalBattles  = analyticsData.battles?.total_battles ?? null;
    const battlesPrev   = analyticsData.battles?.prev_total ?? null;
    const revenueCents  = analyticsData.revenue?.total_cents ?? null;
    const revenuePrev   = analyticsData.revenue?.prev_cents ?? null;

    const packVal     = document.getElementById('stat-tile-packs-value');
    const colVal      = document.getElementById('stat-tile-collectors-value');
    const battlesVal  = document.getElementById('stat-tile-battles-value');
    const revenueVal  = document.getElementById('stat-tile-revenue-value');

    if (packVal)    packVal.textContent    = packOpenings !== null ? packOpenings.toLocaleString()  : '—';
    if (colVal)     colVal.textContent     = collectors   !== null ? collectors.toLocaleString()    : '—';
    if (battlesVal) battlesVal.textContent = totalBattles !== null ? totalBattles.toLocaleString()  : '—';
    if (revenueVal) revenueVal.textContent = revenueCents !== null
        ? (revenueCents === 0 ? '$0.00' : `$${(revenueCents / 100).toFixed(2)}`)
        : '—';

    // Trend arrows — compare current period vs previous period of same length
    if (packOpenings !== null && packPrev !== null) applyTrend('stat-tile-packs-trend', packOpenings, packPrev);
    applyTrend('stat-tile-collectors-trend', colChange, 0); // colChange is already a diff
    if (totalBattles !== null && battlesPrev !== null) applyTrend('stat-tile-battles-trend', totalBattles, battlesPrev);
    if (revenueCents !== null && revenuePrev !== null) applyTrend('stat-tile-revenue-trend', revenueCents, revenuePrev);
}

async function renderAnalytics() {
    renderAnalyticsStatTiles();
    const growthSeries =
        analyticsData.overview && Array.isArray(analyticsData.overview.growth_data)
            ? analyticsData.overview.growth_data
            : null;
    /** Chart.js needs a visible panel — only create/update the chart whose tab is shown (default: pack activity). */
    if (
        growthSeries &&
        (collectorGrowthChartInstance || analyticsMetricPanelIsVisible('analytics-chart-panel-collectors'))
    ) {
        await renderCollectorGrowthChart(growthSeries);
    }
    const packSeries = Array.isArray(analyticsData.packs?.activity_data) ? analyticsData.packs.activity_data : [];
    if (packActivityChartInstance || analyticsMetricPanelIsVisible('analytics-chart-panel-packs')) {
        await renderPackActivityChart(packSeries);
    }
    const battleSeries = Array.isArray(analyticsData.battles?.activity_data) ? analyticsData.battles.activity_data : [];
    if (battlesChartInstance || analyticsMetricPanelIsVisible('analytics-chart-panel-battles')) {
        await renderBattlesChart(battleSeries);
    }
    const revenueSeries = Array.isArray(analyticsData.revenue?.activity_data) ? analyticsData.revenue.activity_data : [];
    if (revenueChartInstance || analyticsMetricPanelIsVisible('analytics-chart-panel-revenue')) {
        await renderRevenueChart(revenueSeries);
    }
    if (analyticsData.cards) {
        renderCardPerformance();
        if (analyticsData.cards.community_discovery) {
            renderCommunityDiscovery(analyticsData.cards.community_discovery);
        }
    }
    renderCollectorLeaderboard();
    requestAnimationFrame(() => {
        try {
            collectorGrowthChartInstance?.resize();
            packActivityChartInstance?.resize();
        } catch (_) { /* ignore */ }
    });
}

/** Twitch-style metric tabs: swap collector growth vs pack activity chart (single chart area). */
function switchAnalyticsMetricTab(which) {
    const panels = {
        collectors: 'analytics-chart-panel-collectors',
        packs:      'analytics-chart-panel-packs',
        battles:    'analytics-chart-panel-battles',
        revenue:    'analytics-chart-panel-revenue',
    };
    const tabs = {
        collectors: 'analytics-tab-collectors',
        packs:      'analytics-tab-packs',
        battles:    'analytics-tab-battles',
        revenue:    'analytics-tab-revenue',
    };
    const gran   = document.getElementById('pack-granularity')?.parentElement;
    const legend = document.getElementById('pack-activity-legend');

    // Show/hide panels and set tile active state
    for (const [key, panelId] of Object.entries(panels)) {
        const panel = document.getElementById(panelId);
        const tab   = document.getElementById(tabs[key]);
        const active = key === which;
        if (panel) { panel.classList.toggle('hidden', !active); panel.setAttribute('aria-hidden', String(!active)); }
        if (tab)   { tab.classList.toggle('analytics-stat-tile--active', active); tab.setAttribute('aria-selected', String(active)); }
    }

    // Pack-only controls
    if (gran)   gran.style.display   = which === 'packs' ? '' : 'none';
    if (legend) legend.style.display = which === 'packs' ? '' : 'none';
    const packSeries = Array.isArray(analyticsData.packs?.activity_data) ? analyticsData.packs.activity_data : [];
    const growthSeries =
        analyticsData.overview && Array.isArray(analyticsData.overview.growth_data)
            ? analyticsData.overview.growth_data
            : null;
    if (which === 'packs') {
        void renderPackActivityChart(packSeries);
    } else if (which === 'collectors' && growthSeries) {
        void renderCollectorGrowthChart(growthSeries);
    } else if (which === 'battles') {
        const battleSeries = Array.isArray(analyticsData.battles?.activity_data) ? analyticsData.battles.activity_data : [];
        void renderBattlesChart(battleSeries);
    } else if (which === 'revenue') {
        const revenueSeries = Array.isArray(analyticsData.revenue?.activity_data) ? analyticsData.revenue.activity_data : [];
        void renderRevenueChart(revenueSeries);
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            try {
                collectorGrowthChartInstance?.resize();
                packActivityChartInstance?.resize();
                battlesChartInstance?.resize();
                revenueChartInstance?.resize();
            } catch (_) { /* ignore */ }
        });
    });
}
window.switchAnalyticsMetricTab = switchAnalyticsMetricTab;

function renderCardPerformance() {
    const data = analyticsData.cards;
    const topCollected = document.getElementById('top-collected-cards');
    const rarest = document.getElementById('rarest-cards');

    if (topCollected && data.most_collected) {
        topCollected.innerHTML = data.most_collected.slice(0, 5).map((card, idx) => `
            <div class="performance-item">
                <div class="performance-rank">${idx + 1}</div>
                <img src="${escapeHTML(card.image_url || '')}" class="w-10 h-14 rounded border border-white/10 object-cover">
                <div class="flex-1">
                    <div class="text-[11px] font-black text-white uppercase">${escapeHTML(card.name)}</div>
                    <div class="text-[9px] text-void-accent uppercase mt-0.5">${parseInt(card.collection_count || 0)} Collected</div>
                </div>
            </div>
        `).join('');
    }

    if (rarest && data.rarest) {
        rarest.innerHTML = data.rarest.slice(0, 5).map((card, idx) => `
            <div class="performance-item hover:border-purple-500/30">
                <div class="performance-rank bg-purple-500/10 text-purple-400">${idx + 1}</div>
                <img src="${escapeHTML(card.image_url || '')}" class="w-10 h-14 rounded border border-white/10 object-cover">
                <div class="flex-1">
                    <div class="text-[11px] font-black text-white uppercase">${escapeHTML(card.name)}</div>
                    <div class="text-[9px] text-purple-400 uppercase mt-0.5">${parseInt(card.collection_count || 0)} Collected</div>
                </div>
            </div>
        `).join('');
    }
}

function renderCommunityDiscovery(data) {
    const container = document.getElementById('community-discovery-stats');
    if (!container || !data) return;

    const colors = {
        common: 'bg-void-muted',
        rare: 'bg-void-accent',
        epic: 'bg-purple-500',
        legendary: 'bg-orange-500'
    };

    let html = '';
    ['common', 'rare', 'epic', 'legendary'].forEach(rarity => {
        if (!data[rarity] || data[rarity].total === 0) return;
        const stat = data[rarity];
        const pct = Math.round((stat.found / stat.total) * 100);
        const color = colors[rarity] || 'bg-white/10';

        html += `
            <div class="space-y-2">
                <div class="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span class="text-void-muted">${rarity}</span>
                    <span class="text-white">${stat.found} / ${stat.total} [${pct}%]</span>
                </div>
                <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${color} transition-all duration-1000 shadow-[0_0_10px_rgba(var(--void-accent-rgb),0.3)]" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<div class="text-[9px] text-void-muted uppercase text-center py-4">No data available</div>';
}

function renderCollectorLeaderboard() {
    const data = analyticsData.collectors;
    const leaderboard = document.getElementById('collector-leaderboard');
    if (!leaderboard || !data || !data.top_collectors) return;

    leaderboard.innerHTML = data.top_collectors.slice(0, 9).map((u, idx) => `
        <div class="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-void-accent/30 transition-all">
            <div class="w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20 font-black text-xs">
                ${idx + 1}
            </div>
            <div class="flex-1">
                <div class="text-[11px] font-black text-white uppercase">${u.username}</div>
                <div class="text-[9px] text-void-muted uppercase mt-1">CARDS: ${u.total_cards} | UNIQUE: ${u.unique_cards}</div>
            </div>
        </div>
    `).join('');
}

/** Shared: build Twitch-style tooltip HTML — bold date header, then swatch+label rows. */
function buildAnalyticsTooltip(dateRaw, rows) {
    const d = new Date((String(dateRaw).length === 10 ? dateRaw + 'T12:00:00' : dateRaw));
    const header = isNaN(d) ? String(dateRaw) : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const rowHtml = rows.map(({ color, label }) => `
<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
<span style="flex-shrink:0;width:8px;height:8px;border-radius:2px;background:${color}"></span>
<span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.85)">${escapeHTML(label)}</span>
</div>`).join('');
    return `<div style="display:flex;flex-direction:column;align-items:center;">
<div style="width:0;height:0;margin-bottom:-1px;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:6px solid #18181b;"></div>
<div style="background:#18181b;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px 12px 9px;min-width:130px;box-shadow:0 4px 20px rgba(0,0,0,0.6);">
<div style="font-size:11px;font-weight:800;color:#fff;letter-spacing:0.01em">${escapeHTML(header)}</div>
${rowHtml}
</div></div>`;
}

/** Shared: manage tooltip element lifecycle and position for all analytics charts.
 *  Appended directly to body so no overflow:hidden ancestor can clip it. */
function analyticsExternalTooltip(context, attrSelector, buildFn) {
    const { chart, tooltip } = context;
    const attrName = attrSelector.replace(/[\[\]]/g, '');
    // Only look among direct children of body to avoid finding stale elements inside the chart panel
    let el = null;
    for (const child of document.body.children) {
        if (child.hasAttribute(attrName)) { el = child; break; }
    }
    if (!el) {
        el = document.createElement('div');
        el.setAttribute(attrName, '1');
        el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;opacity:0;transition:opacity .1s ease';
        document.body.appendChild(el);
    }
    if (tooltip.opacity === 0) { el.style.opacity = '0'; return; }
    const idx = tooltip.dataPoints?.[0]?.dataIndex;
    if (idx == null) { el.style.opacity = '0'; return; }
    el.innerHTML = buildFn(chart, tooltip, idx);
    const rect = chart.canvas.getBoundingClientRect();
    const x = rect.left + (tooltip.caretX ?? 0);
    const y = rect.top  + (tooltip.caretY ?? 0);
    el.style.opacity = '1';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    // Always anchor above the caret — caretY is the bar top, so there's always room above
    el.style.transform = 'translate(-50%, calc(-100% - 10px))';
}

async function renderCollectorGrowthChart(data) {
    if (!Array.isArray(data)) return;
    const canvas = document.getElementById('collector-growth-chart');
    if (!canvas) return;

    const rawDates = data.map(d => d.date);
    const labels = data.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = data.map(d => d.count);

    const maxVal = Math.max(...values, 0);
    if (collectorGrowthChartInstance) {
        collectorGrowthChartInstance._rawDates = rawDates;
        collectorGrowthChartInstance.data.labels = labels;
        collectorGrowthChartInstance.data.datasets[0].data = values;
        collectorGrowthChartInstance.options.scales.y.suggestedMax = maxVal > 0 ? undefined : 5;
        collectorGrowthChartInstance.update('none');
        return;
    }
    collectorGrowthChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Collectors',
                data: values,
                backgroundColor: 'rgba(0,242,254,0.7)',
                hoverBackgroundColor: '#00f2fe',
                borderSkipped: false,
                minBarLength: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: { enabled: false, external: collectorsExternalTooltip } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 7 } },
                y: {
                    display: true,
                    beginAtZero: true,
                    suggestedMax: maxVal > 0 ? undefined : 5,
                    grid: { color: ctx => ctx.tick.value === 0 ? 'transparent' : 'rgba(255,255,255,0.07)', borderDash: [4,4], drawBorder: false },
                    border: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 9 }, maxTicksLimit: 4, precision: 0 }
                }
            }
        }
    });
    collectorGrowthChartInstance._rawDates = rawDates;
}

function collectorsExternalTooltip(context) {
    analyticsExternalTooltip(context, '[data-collectors-tooltip]', (chart, tooltip, idx) => {
        const raw = tooltip.dataPoints?.[0]?.raw ?? 0;
        return buildAnalyticsTooltip(chart._rawDates?.[idx] ?? chart.data.labels?.[idx], [
            { color: '#00f2fe', label: `${raw} Collector${raw === 1 ? '' : 's'}` }
        ]);
    });
}

const PACK_ACTIVITY_SOURCE_ORDER = [
    ['granted', 'Granted cards'],
    ['twitch_subs', 'Twitch subs'],
    ['kick_subs', 'Kick subs'],
    ['castle_site', 'Direct purchases'],
    ['codes', 'Codes'],
    ['twitch_bits', 'Twitch bits'],
    ['twitch_channel_points', 'Twitch channel points'],
    ['kick_channel_points', 'Kick channel points'],
];

/** Swatch colors for pack activity bars and tooltip (hex only — canvas can't resolve CSS vars). */
const PACK_SOURCE_SWATCH_COLORS = {
    granted: '#a78bfa',
    kick_subs: '#53fc18',
    twitch_subs: '#9146ff',
    twitch_bits: '#facc15',
    castle_site: '#00f2fe',
    codes: '#94a3b8',
    kick_channel_points: '#2dd4bf',
    twitch_channel_points: '#38bdf8',
};

function packActivityExternalTooltip(context) {
    analyticsExternalTooltip(context, '[data-pack-activity-tooltip]', (chart, _tooltip, idx) => {
        const rows = chart._packActivityRows;
        if (!rows) return '';
        const row = rows[idx];
        const bs = row?.by_source;
        const total = row?.count ?? 0;
        const sourceRows = PACK_ACTIVITY_SOURCE_ORDER.map(([key, label]) => ({
            color: (bs && (bs[key] ?? 0) > 0) ? PACK_SOURCE_SWATCH_COLORS[key] || '#94a3b8' : 'rgba(255,255,255,0.15)',
            label: `${(bs && bs[key]) ? bs[key] : 0} ${label}`,
        }));
        const swatches = [
            { color: '#ffffff', label: `${total} Pack Opening${total === 1 ? '' : 's'}` },
            ...sourceRows,
        ];
        return buildAnalyticsTooltip(row?.date ?? chart.data.labels?.[idx], swatches);
    });
}

async function renderBattlesChart(data) {
    if (!Array.isArray(data)) return;
    const canvas = document.getElementById('battles-chart');
    if (!canvas) return;

    const rawDates = data.map(d => d.date);
    const labels = data.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = data.map(d => d.count);
    const maxVal = Math.max(...values, 0);

    if (battlesChartInstance) {
        battlesChartInstance._rawDates = rawDates;
        battlesChartInstance.data.labels = labels;
        battlesChartInstance.data.datasets[0].data = values;
        battlesChartInstance.options.scales.y.suggestedMax = maxVal > 0 ? undefined : 5;
        battlesChartInstance.update('none');
        return;
    }

    battlesChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Battles',
                data: values,
                backgroundColor: 'rgba(161,139,250,0.7)',
                hoverBackgroundColor: '#a78bfa',
                borderSkipped: false,
                minBarLength: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: { enabled: false, external: battlesExternalTooltip } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 7 } },
                y: {
                    display: true,
                    beginAtZero: true,
                    suggestedMax: maxVal > 0 ? undefined : 5,
                    grid: { color: ctx => ctx.tick.value === 0 ? 'transparent' : 'rgba(255,255,255,0.07)', borderDash: [4,4], drawBorder: false },
                    border: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 9 }, maxTicksLimit: 4, precision: 0 }
                }
            }
        }
    });
    battlesChartInstance._rawDates = rawDates;
}

function battlesExternalTooltip(context) {
    analyticsExternalTooltip(context, '[data-battles-tooltip]', (chart, tooltip, idx) => {
        const raw = tooltip.dataPoints?.[0]?.raw ?? 0;
        return buildAnalyticsTooltip(chart._rawDates?.[idx] ?? chart.data.labels?.[idx], [
            { color: '#a78bfa', label: `${raw} Battle${raw === 1 ? '' : 's'}` }
        ]);
    });
}

async function renderRevenueChart(data) {
    if (!Array.isArray(data)) return;
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;

    const rawDates = data.map(d => d.date);
    const labels = data.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = data.map(d => d.amount_cents / 100);
    const maxVal = Math.max(...values, 0);

    if (revenueChartInstance) {
        revenueChartInstance._rawDates = rawDates;
        revenueChartInstance.data.labels = labels;
        revenueChartInstance.data.datasets[0].data = values;
        revenueChartInstance.options.scales.y.suggestedMax = maxVal > 0 ? undefined : 10;
        revenueChartInstance.update('none');
        return;
    }

    revenueChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                backgroundColor: 'rgba(52,211,153,0.7)',
                hoverBackgroundColor: '#34d399',
                borderSkipped: false,
                minBarLength: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: { enabled: false, external: revenueExternalTooltip } },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 7 } },
                y: {
                    display: true,
                    beginAtZero: true,
                    suggestedMax: maxVal > 0 ? undefined : 10,
                    grid: { color: ctx => ctx.tick.value === 0 ? 'transparent' : 'rgba(255,255,255,0.07)', borderDash: [4,4], drawBorder: false },
                    border: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.25)', font: { size: 9 }, maxTicksLimit: 4,
                        callback: v => `$${v % 1 === 0 ? v : v.toFixed(2)}`
                    }
                }
            }
        }
    });
    revenueChartInstance._rawDates = rawDates;
}

function revenueExternalTooltip(context) {
    analyticsExternalTooltip(context, '[data-revenue-tooltip]', (chart, tooltip, idx) => {
        const dollars = tooltip.dataPoints?.[0]?.raw ?? 0;
        return buildAnalyticsTooltip(chart._rawDates?.[idx] ?? chart.data.labels?.[idx], [
            { color: '#34d399', label: `$${dollars.toFixed(2)} Revenue` }
        ]);
    });
}

function renderPackActivityLegend(activeSources) {
    const el = document.getElementById('pack-activity-legend');
    if (!el) return;
    if (activeSources.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = activeSources.map(([key, label]) => `
        <span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;">
            <span style="width:8px;height:8px;border-radius:1px;background:${PACK_SOURCE_SWATCH_COLORS[key] || '#94a3b8'};flex-shrink:0;display:inline-block"></span>
            <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.35)">${escapeHTML(label)}</span>
        </span>
    `).join('');
}

async function renderPackActivityChart(data) {
    if (!Array.isArray(data)) return;
    const canvas = document.getElementById('pack-activity-chart');
    if (!canvas) return;

    const labels = data.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

    // Only include sources with at least one non-zero value across the window
    const activeSources = PACK_ACTIVITY_SOURCE_ORDER.filter(([key]) =>
        data.some(d => (d.by_source?.[key] ?? 0) > 0)
    );

    const datasets = activeSources.length > 0
        ? activeSources.map(([key, label]) => ({
            label,
            data: data.map(d => d.by_source?.[key] ?? 0),
            backgroundColor: PACK_SOURCE_SWATCH_COLORS[key] || '#94a3b8',
            hoverBackgroundColor: PACK_SOURCE_SWATCH_COLORS[key] || '#94a3b8',
            borderSkipped: false,
            minBarLength: 4,
        }))
        : [{
            label: 'Cards Granted',
            data: data.map(d => d.count),
            backgroundColor: '#00f2fe',
            hoverBackgroundColor: '#00f2fe',
            borderSkipped: false,
            minBarLength: 4,
        }];

    const maxVal = Math.max(...data.map(d => d.count), 0);

    renderPackActivityLegend(activeSources);

    if (packActivityChartInstance) {
        packActivityChartInstance.data.labels = labels;
        packActivityChartInstance.data.datasets = datasets;
        packActivityChartInstance._packActivityRows = data;
        packActivityChartInstance.update('none');
        return;
    }

    packActivityChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false, external: packActivityExternalTooltip },
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 7 }
                },
                y: {
                    stacked: true,
                    display: true,
                    beginAtZero: true,
                    suggestedMax: maxVal > 0 ? undefined : 5,
                    grid: {
                        color: ctx => ctx.tick.value === 0 ? 'transparent' : 'rgba(255,255,255,0.07)',
                        borderDash: [4, 4],
                        drawBorder: false,
                    },
                    border: { display: false },
                    ticks: {
                        color: 'rgba(255,255,255,0.25)',
                        font: { size: 9 },
                        maxTicksLimit: 4,
                        precision: 0,
                    }
                }
            }
        }
    });
    packActivityChartInstance._packActivityRows = data;
}


let debounceTimer;
function debounce(func, delay) {
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
}

function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (window.lastLoadingToast && type !== 'loading') {
        const prevLoading = window.lastLoadingToast;
        window.lastLoadingToast = null;
        prevLoading.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => prevLoading.remove(), 500);
    }

    const toast = document.createElement('div');
    toast.className = `px-6 py-3 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-500 translate-y-20 opacity-0 flex items-center gap-3`;

    if (type === 'error') toast.className += " bg-red-500/10 border-red-500/20 text-red-500";
    else if (type === 'success') toast.className += " bg-void-accent/10 border-void-accent/20 text-void-accent";
    else if (type === 'loading') toast.className += " bg-white/5 border-white/10 text-white";
    else toast.className += " bg-white/5 border-white/10 text-white";

    toast.innerHTML = `
        ${type === 'loading' ? '<i class="bx bx-loader-alt animate-spin text-xs"></i>' : ''}
        <span class="text-[10px] font-black uppercase tracking-widest">${msg}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
    }, 10);

    if (type !== 'loading') {
        setTimeout(() => {
            toast.classList.add('translate-y-[-20px]', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    } else {

        window.lastLoadingToast = toast;
    }
}

async function initiateEventPulse() {
    const targetRarity = document.getElementById('event-boost-rarity').value;
    const multiplier = document.getElementById('event-multiplier').value;
    const durationSec = document.getElementById('event-duration').value;

    showToast("Starting Special Event...", "loading");

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                type: 'rarity_boost',
                target_rarity: targetRarity,
                multiplier: multiplier,
                duration: Math.floor(durationSec / 3600)
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`${targetRarity.toUpperCase()} BOOST ACTIVE`, "success");
            updateEventUI(true, data.name, data.ends_at);
        } else {
            showToast(data.error || "Event failed to start", "error");
        }
    } catch (err) {
        showToast("Connection error: " + err.message, "error");
    }
}

async function checkActiveEvent() {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const streamer = await res.json();

        const evRes = await apiFetch(`${BACKEND_URL}/api/creator/events/active`, { credentials: 'include' });
        if (evRes.ok) {
            const data = await evRes.json();
            if (data && data.id) {
                updateEventUI(true, data.name, data.ends_at);
            } else {
                updateEventUI(false);
            }
        }
    } catch (e) { }
}

function updateEventUI(isActive, name = "", endsAt = null) {
    const statusIndicator = document.querySelector('#content-events .px-4.py-2 span');
    if (!statusIndicator) return;

    if (isActive) {
        statusIndicator.textContent = "ACTIVE: " + name.toUpperCase();
        statusIndicator.classList.remove('text-red-500');
        statusIndicator.classList.add('text-void-accent');
        statusIndicator.parentElement.classList.remove('bg-red-500/10', 'border-red-500/20');
        statusIndicator.parentElement.classList.add('bg-void-accent/10', 'border-void-accent/20');

        if (endsAt) {
            const timer = document.createElement('div');
            timer.id = 'event-countdown';
            timer.className = 'text-[8px] font-bold text-void-accent/50 uppercase mt-1 text-center';
            const end = new Date(endsAt).getTime();

            const updateTimer = () => {
                const now = Date.now();
                const diff = end - now;
                if (diff <= 0) {
                    clearInterval(window.eventInterval);
                    updateEventUI(false);
                    return;
                }
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                timer.textContent = `Ends in: ${h}h ${m}m ${s}s`;
            };

            if (window.eventInterval) clearInterval(window.eventInterval);
            window.eventInterval = setInterval(updateTimer, 1000);
            updateTimer();

            const parent = statusIndicator.parentElement.parentElement;
            const existingTimer = document.getElementById('event-countdown');
            if (existingTimer) existingTimer.remove();
            parent.appendChild(timer);
        }
    } else {
        statusIndicator.textContent = "STANDBY";
        statusIndicator.classList.remove('text-void-accent');
        statusIndicator.classList.add('text-red-500');
        statusIndicator.parentElement.classList.remove('bg-void-accent/10', 'border-void-accent/20');
        statusIndicator.parentElement.classList.add('bg-red-500/10', 'border-red-500/20');
        const timer = document.getElementById('event-countdown');
        if (timer) timer.remove();
        if (window.eventInterval) clearInterval(window.eventInterval);
    }
}

async function openUserGrant(username = null, twitchId = null) {
    const isGeneric = !twitchId;
    let allCards = [];

    const modalHtml = `
        <div id="grant-modal" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div class="glass-card w-full max-w-lg p-10 animate-in fade-in zoom-in duration-300 border border-white/10 shadow-2xl">
                <div class="flex items-center justify-between mb-8">
                    <div class="flex flex-col">
                        <h3 class="text-2xl font-black uppercase italic tracking-tighter text-white">Grant Card</h3>
                        <div class="text-[9px] font-bold text-void-accent tracking-[.3em] uppercase opacity-60">Admin Action</div>
                    </div>
                    <button onclick="closeGrantModal()" class="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-void-accent hover:text-void-bg transition-all duration-300">
                        <i class="bx bx-x text-lg"></i>
                    </button>
                </div>

                <div class="space-y-6">
                    <!-- Recipient Section -->
                    <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <div class="text-[9px] font-black uppercase text-void-accent tracking-widest mb-4">
                            <span>Recipient</span>
                        </div>
                        ${isGeneric ? `
                            <label for="grant-castle-code" class="text-[8px] font-black uppercase tracking-widest text-void-muted mb-2 block">Castle code</label>
                            <input type="text" id="grant-castle-code" placeholder="e.g. ABC12XY8" autocomplete="off"
                                class="w-full bg-void-bg/50 border border-white/5 rounded-2xl px-6 py-4 text-sm font-mono font-bold tracking-wider focus:border-void-accent outline-none transition-all">
                            <p class="text-[9px] text-void-muted mt-3 leading-relaxed">Collectors find their code under Account → profile settings.</p>
                        ` : `
                            <div class="flex items-center gap-4">
                                <div class="w-14 h-14 rounded-2xl bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent shadow-inner">
                                    <i class="bx bxs-shield text-xl"></i>
                                </div>
                                <div>
                                    <div class="font-black text-white text-lg tracking-tight uppercase">${username}</div>
                                    <div class="text-[8px] font-mono text-white/40">UID: ${twitchId}</div>
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <div class="text-[9px] font-black uppercase text-void-accent tracking-widest mb-4 flex justify-between">
                            <span>Select Card</span>
                            <span class="opacity-50 text-[8px]">Specific or random</span>
                        </div>
                        <div class="relative group mb-3">
                            <i class="bx bxs-filter-alt absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-void-accent transition-colors"></i>
                            <input type="text" id="card-search" placeholder="Card Name or Rarity..." 
                                class="w-full bg-void-bg/50 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:border-void-accent focus:ring-1 focus:ring-void-accent outline-none transition-all">
                        </div>
                        <select id="grant-card-id" class="w-full bg-void-bg/50 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-void-accent transition-all appearance-none cursor-pointer">
                            <option value="">Loading cards...</option>
                        </select>
                    </div>

                    <div class="p-4 flex items-center justify-between bg-void-accent/5 rounded-2xl border border-void-accent/10">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black uppercase tracking-wider text-white">Silent Grant</span>
                            <span class="text-[8px] text-white/40 uppercase font-bold">Skip stream overlay notification</span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="grant-silent" class="sr-only peer">
                            <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-void-accent"></div>
                        </label>
                    </div>

                    <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <label for="grant-quantity" class="text-[9px] font-black uppercase text-void-accent tracking-widest mb-3 block">Quantity</label>
                        <div class="flex items-center gap-4">
                            <input type="number" id="grant-quantity" min="1" max="200" value="1"
                                class="w-28 bg-void-bg/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-void-accent outline-none">
                            <span class="text-[8px] text-void-muted uppercase font-bold leading-relaxed">Repeat this grant up to <span class="text-white/70">200</span> times (stress-test OBS overlay &amp; queue). Random picks a new card each time.</span>
                        </div>
                    </div>

                    <div class="flex gap-4 pt-4">
                        <button onclick="closeGrantModal()" class="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[.2em] transition-all duration-300">Cancel</button>
                        <button id="execute-grant-btn" class="flex-1 py-5 bg-void-accent text-void-bg hover:bg-white rounded-2xl text-[10px] font-black uppercase tracking-[.2em] transition-all duration-300 shadow-[0_0_20px_rgba(30,144,255,0.3)]">Execute</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const cardSelect = document.getElementById('grant-card-id');
    const cardSearch = document.getElementById('card-search');

    allCards = await fetchAllCreatorCards();

    const populateCards = (filter = '') => {
        let filtered = allCards.filter(c =>
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.rarity.toLowerCase().includes(filter.toLowerCase())
        );

        let options = '<option value="">-- Select a Card --</option>';

        if (!filter || 'random'.includes(filter.toLowerCase())) {
            options += `
                <optgroup label="RANDOM">
                    <option value="random:common">Random Common Card</option>
                    <option value="random:rare">Random Rare Card</option>
                    <option value="random:epic">Random Epic Card</option>
                    <option value="random:legendary">Random Legendary Card</option>
                    <option value="random">Fully Random</option>
                </optgroup>
            `;
        }

        options += '<optgroup label="SPECIFIC CARDS">';
        options += filtered.map(c => `<option value="${c.id}">${c.rarity.toUpperCase()} | ${c.name}</option>`).join('');
        options += '</optgroup>';

        cardSelect.innerHTML = options;
    };

    populateCards();

    cardSearch.oninput = (e) => populateCards(e.target.value);

    document.getElementById('execute-grant-btn').onclick = () => {
        let targetTwitchId = twitchId;
        let targetUsername = username;
        let castleCode = '';

        if (isGeneric) {
            const codeEl = document.getElementById('grant-castle-code');
            castleCode = codeEl && codeEl.value ? String(codeEl.value).trim() : '';
            if (!castleCode) return showToast("Enter the collector's Castle code", 'error');
            targetTwitchId = '';
            targetUsername = '';
        }

        const selection = cardSelect.value;
        if (!selection) return showToast("Please select a card", "error");

        const isSilent = document.getElementById('grant-silent').checked;
        const qtyEl = document.getElementById('grant-quantity');
        let quantity = qtyEl ? parseInt(String(qtyEl.value), 10) : 1;
        if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
        if (quantity > 200) quantity = 200;

        if (selection.startsWith('random')) {
            const parts = selection.split(':');
            executeGrant(targetTwitchId, targetUsername, 'random', parts[1] || null, isSilent, quantity, castleCode);
        } else {
            executeGrant(targetTwitchId, targetUsername, selection, null, isSilent, quantity, castleCode);
        }
    };
}

async function executeGrant(
    twitchId,
    username,
    cardId,
    randomRarity = null,
    isSilent = false,
    quantity = 1,
    castleCode = ''
) {
    const q = Math.min(200, Math.max(1, parseInt(String(quantity), 10) || 1));
    showToast(q > 1 ? `Granting ${q} cards…` : 'Granting card…', 'loading');

    try {
        const body = {
            card_id: cardId,
            random_rarity: randomRarity,
            is_silent: isSilent,
            quantity: q
        };
        const cc = castleCode && String(castleCode).trim();
        if (cc) {
            body.castle_code = cc;
        } else {
            body.twitch_id = twitchId;
            body.username = username;
        }

        const res = await apiFetch(`${BACKEND_URL}/api/creator/grant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            const g = typeof data.granted === 'number' ? data.granted : q;
            if (data.partial && g < q) {
                const why = data.stop_reason ? ` — ${data.stop_reason}` : '';
                showToast(`Granted ${g} of ${q}${why}`, 'info');
            } else if (g > 1) {
                showToast(`Granted ${g} cards`, 'success');
            } else {
                showToast('Card granted successfully', 'success');
            }
            closeGrantModal();
            fetchUserList().then(() => renderAdminUserList());
            fetchAdminLogs();
        } else {
            const data = await res.json();
            showToast(data.error || "Failed to grant card", "error");
        }
    } catch (err) {
        showToast("Connection error: " + err.message, "error");
    }
}

/** Static grant card modal in dashboard.html — recipient via Castle code only. */
window.submitGrant = async function submitGrant() {
    const input = document.getElementById('grant-castle-code-input');
    const raw = input && String(input.value || '').trim();
    const cardNative = document.getElementById('grant-card-select');
    const cardId = cardNative && cardNative.value;
    if (!raw) {
        showToast("Enter the collector's Castle code", 'error');
        return;
    }
    if (!cardId) {
        showToast('Choose a card', 'error');
        return;
    }
    await executeGrant('', '', cardId, null, false, 1, raw);
};

/** Opens the Activity log tab in the creator dashboard (replaces old modal / slide-over). */
function openActivityLogModal() {
    switchTab('activity-log');
}

function closeActivityLogModal() {
    /* Dashboard uses a full tab, not a modal; kept for compatibility with shared snippets. */
}

function activityLogPlatformLabel(p) {
    if (p == null || p === '') return '';
    const k = String(p).toLowerCase();
    if (k === 'twitch') return 'Twitch';
    if (k === 'dashboard') return 'Dashboard';
    return String(p).charAt(0).toUpperCase() + String(p).slice(1);
}

/** Prefer names + platform from metadata; fall back to stored message (legacy rows). */
function formatActivityLogSummary(log) {
    const m = log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
    const platform = activityLogPlatformLabel(m.platform);
    const platSuffix = platform ? ` · ${platform}` : '';

    if (log.category === 'grant') {
        const user = m.recipient_username || m.target_username;
        const card = m.card_name;
        if (m.bulk_grant && user && m.quantity) {
            return `${m.quantity}× grant → ${user}${platSuffix}`;
        }
        const qty = m.quantity && Number(m.quantity) > 1 ? `${m.quantity}× ` : '';
        if (card && user) {
            let line = `${qty}${card} → ${user}${platSuffix}`;
            if (m.platform === 'twitch' && m.twitch_context) {
                line += ` (${m.twitch_context})`;
            }
            return line;
        }
    }

    if (log.category === 'admin') {
        if (m.blocked_username || m.blocked_twitch_id) {
            const who = m.blocked_username || m.blocked_twitch_id;
            return `Blocked ${who}${platSuffix}`;
        }
        if (m.wiped_username || m.wiped_twitch_id) {
            const who = m.wiped_username || m.wiped_twitch_id;
            return `Wiped collection · ${who}${platSuffix}`;
        }
    }

    return log.message || '';
}

async function fetchAdminLogs() {
    const container = document.getElementById('admin-activity-logs');
    if (!container) return;

    const search = document.getElementById('log-search')?.value || '';
    const category = document.getElementById('log-category-filter')?.value || 'all';

    try {
        const res = await apiFetch(
            `${BACKEND_URL}/api/creator/events?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`,
            { credentials: 'include' }
        );
        if (res.ok) {
            const logs = await res.json();
            renderAdminLogs(logs);
        }
    } catch (err) {
        console.error("Failed to fetch logs:", err);
    }
}

function renderAdminLogs(logs) {
    const container = document.getElementById('admin-activity-logs');
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = `<div class="admin-panel-empty py-10">No activity recorded</div>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const levelClass = log.level === 'error' ? 'text-red-500' : (log.level === 'warn' ? 'text-amber-500' : 'text-void-accent');
        const summary = formatActivityLogSummary(log);

        return `
            <div class="admin-log-row">
                <div class="col-span-2 text-[9px] font-mono text-void-muted">${time}</div>
                <div class="col-span-2">
                    <span class="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${levelClass} bg-current/10">${log.level || 'INFO'}</span>
                </div>
                <div class="col-span-2 text-[9px] font-black uppercase text-white/40 tracking-widest">${log.category || 'SYSTEM'}</div>
                <div class="col-span-6 text-[10px] font-bold text-white/80 admin-log-row__msg">${escapeHTML(summary)}</div>
            </div>
        `;
    }).join('');
}

async function fetchAllCreatorCards() {
    if (creatorCards && creatorCards.length > 0) return creatorCards;
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (res.ok) {
            creatorCards = await res.json();
            return creatorCards;
        }
    } catch (e) {
        console.error("Failed to fetch creator cards:", e);
    }
    return [];
}

async function openGenericGrant() {
    openUserGrant(); // Now opens generic modal
}


function formatTimeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

async function logout() {
    try {
        await fetch(`${BACKEND_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch (e) {
        console.error('[Logout]', e);
    } finally {
        try {
            sessionStorage.clear();
        } catch (_) { /* ignore */ }
        window.location.href = '/login';
    }
}



async function loadSets() {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' });
        if (res.ok) {
            creatorSets = await res.json();
            renderSetsList();
            populateSetDropdowns();
        }
    } catch (err) { }
}

function renderSetsList() {
    const list = document.getElementById('sets-list');
    if (!list) return;

    if (creatorSets.length === 0) {
        list.innerHTML = `
            <div class="col-span-full border-2 border-dashed border-white/5 rounded-3xl p-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-void-muted">
                    <i class="bx bxs-folder-open text-2xl"></i>
                </div>
                <h3 class="text-white font-black uppercase text-sm italic tracking-widest">No Card Sets Yet</h3>
                <p class="text-void-muted text-[10px] uppercase mt-2">Create a set to organize your cards into groups</p>
                <button onclick="openSetManager()" class="mt-6 px-6 py-3 bg-void-accent text-void-bg text-[11px] font-black uppercase italic rounded-xl hover:scale-105 transition-transform">
                    Create New Set
                </button>
            </div>
        `;
        return;
    }

    list.innerHTML = creatorSets.map(set => `
        <div class="glass-card group p-6 cursor-pointer" onclick="editSet('${set.id}')">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent text-xl">
                    <i class="bx bxs-layer"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-black text-white uppercase truncate">${set.name}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <div class="text-[9px] text-void-accent font-bold uppercase tracking-widest">${set.total_cards || 0} Units</div>
                        ${set.is_active !== false ? `<span class="text-[7px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">ACTIVE</span>` : `<span class="text-[7px] font-black uppercase tracking-widest text-void-muted bg-white/5 px-1.5 py-0.5 rounded">INACTIVE</span>`}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); deleteSet('${set.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 p-2">
                    <i class="bx bxs-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function populateSetDropdowns() {
    const dropdowns = [
        document.getElementById('card-creator-set'),
        document.getElementById('card-filter-set'),
        document.getElementById('bulk-set-assign')
    ];

    dropdowns.forEach(dropdown => {
        if (!dropdown) return;
        const currentValue = dropdown.value;
        dropdown.innerHTML = dropdown.id === 'card-creator-set' ? '<option value="">No Set</option>' : '<option value="">All Sets</option>';
        creatorSets.forEach(set => {
            const option = document.createElement('option');
            option.value = set.id;
            option.textContent = `${set.name.toUpperCase()} (${set.total_cards || 0})`;
            dropdown.appendChild(option);
        });
        if (currentValue) dropdown.value = currentValue;
        const wrapper = dropdown.closest('.void-dropdown');
        if (wrapper) syncVoidDropdownMenu(wrapper);
    });
}

function resetSetForm() {
    const idInput = document.getElementById('set-edit-id');
    if (idInput) idInput.value = '';
    const nameInput = document.getElementById('set-name-input');
    if (nameInput) nameInput.value = '';
    const descInput = document.getElementById('set-description-input');
    if (descInput) descInput.value = '';
    const title = document.getElementById('set-form-title');
    if (title) title.textContent = 'New Set';
    const deleteBtn = document.getElementById('set-delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
    const iconPreview = document.getElementById('set-icon-preview');
    if (iconPreview) { iconPreview.classList.add('hidden'); iconPreview.src = ''; }
    const iconPlaceholder = document.getElementById('set-icon-placeholder');
    if (iconPlaceholder) iconPlaceholder.classList.remove('hidden');
    // Reset pack art
    const packPreview = document.getElementById('set-pack-preview');
    if (packPreview) { packPreview.classList.add('hidden'); packPreview.src = ''; }
    const packPlaceholder = document.getElementById('set-pack-placeholder');
    if (packPlaceholder) packPlaceholder.classList.remove('hidden');
    const packUpload = document.getElementById('set-pack-upload');
    if (packUpload) packUpload.value = '';
}

function previewSetPack(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('set-pack-preview');
        const placeholder = document.getElementById('set-pack-placeholder');
        if (preview) { preview.src = e.target.result; preview.classList.remove('hidden'); }
        if (placeholder) placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}
window.previewSetPack = previewSetPack;

function editSet(setId) {
    const set = creatorSets.find(s => s.id === setId);
    if (!set) return;

    openSetManager();
    document.getElementById('set-edit-id').value = set.id;
    document.getElementById('set-name-input').value = set.name;
    document.getElementById('set-description-input').value = set.description || '';
    document.getElementById('set-form-title').textContent = 'Edit Set';
    const isActiveToggle = document.getElementById('set-is-active');
    if (isActiveToggle) isActiveToggle.checked = set.is_active !== false; // default true
    const deleteBtn = document.getElementById('set-delete-btn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');
    // Populate pack art preview if set has one
    const packPreview = document.getElementById('set-pack-preview');
    const packPlaceholder = document.getElementById('set-pack-placeholder');
    if (set.pack_image_url && packPreview) {
        packPreview.src = set.pack_image_url;
        packPreview.classList.remove('hidden');
        if (packPlaceholder) packPlaceholder.classList.add('hidden');
    }
}

async function saveSet() {
    const name = document.getElementById('set-name-input').value;
    const description = document.getElementById('set-description-input').value;
    const setId = document.getElementById('set-edit-id').value;
    const isActive = document.getElementById('set-is-active')?.checked ?? true;

    if (!name) return showToast("Set name required", "error");

    showToast("Saving set...", "loading");

    try {
        // Upload pack art if a new file was selected
        let packImageUrl;
        const packFile = document.getElementById('set-pack-upload')?.files?.[0];
        if (packFile) {
            const formData = new FormData();
            formData.append('file', packFile);
            const uploadRes = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                packImageUrl = uploadData.url;
            } else {
                showToast("Pack art upload failed", "error");
                return;
            }
        }

        const payload = { id: setId || undefined, name, description, is_active: isActive };
        if (packImageUrl !== undefined) payload.pack_image_url = packImageUrl;

        const url = setId ? `${BACKEND_URL}/api/creator/sets/${setId}` : `${BACKEND_URL}/api/creator/sets`;
        const res = await apiFetch(url, {
            method: setId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Set saved", "success");
            closeSetManager();
            loadSets();
        } else {
            const data = await res.json();
            showToast(data.error || "Failed to save set", "error");
        }
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}

async function deleteSet(setId) {
    showConfirmModal(
        'Delete Set',
        'Are you sure you want to delete this set? Cards in this set will not be deleted.',
        async () => {
            showToast("Deleting set...", "loading");
            try {
                const res = await apiFetch(`${BACKEND_URL}/api/creator/sets/${setId}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': csrfToken },
                    credentials: 'include'
                });
                if (res.ok) { showToast("Set deleted", "success"); loadSets(); }
                else showToast("Failed to delete set", "error");
            } catch (err) { showToast("Something went wrong", "error"); }
        },
        'Delete'
    );
}


function toggleBulkSelect() {
    bulkSelectMode = !bulkSelectMode;
    const toolbar = document.getElementById('bulk-actions-toolbar');
    if (toolbar) toolbar.classList.toggle('hidden', !bulkSelectMode);
    if (!bulkSelectMode) selectedCardIds.clear();
    fetchCardsForGrid('creator-cards-grid');
    updateSelectedCount();
}

function clearBulkSelect() {
    selectedCardIds.clear();
    updateSelectedCount();
    fetchCardsForGrid('creator-cards-grid');
}

function toggleCardSelection(cardId) {
    if (selectedCardIds.has(cardId)) selectedCardIds.delete(cardId);
    else selectedCardIds.add(cardId);
    updateSelectedCount();
    fetchCardsForGrid('creator-cards-grid');
}

function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = `${selectedCardIds.size} Cards Selected`;
}

async function bulkAssignSet() {
    const setId = document.getElementById('bulk-set-assign').value;
    if (!setId || selectedCardIds.size === 0) return showToast("Select a set and at least one card", "error");

    showToast(`Assigning ${selectedCardIds.size} cards...`, "loading");

    try {
        let success = 0;
        for (const cardId of selectedCardIds) {
            const res = await apiFetch(`${BACKEND_URL}/api/creator/cards/${cardId}/assign-set`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ set_id: setId }),
                credentials: 'include'
            });
            if (res.ok) success++;
        }
        showToast(`Assigned ${success} cards`, "success");
        toggleBulkSelect();
        fetchCardsForGrid('creator-cards-grid');
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}

async function bulkDeleteCards() {
    if (selectedCardIds.size === 0) return;
    showConfirmModal(
        `Delete ${selectedCardIds.size} Cards`,
        `Are you sure you want to permanently delete ${selectedCardIds.size} selected card(s)? This cannot be undone.`,
        async () => {
            showToast(`Deleting ${selectedCardIds.size} cards...`, "loading");
            try {
                let success = 0;
                for (const cardId of selectedCardIds) {
                    const res = await apiFetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
                        method: 'DELETE',
                        headers: { 'X-CSRF-Token': csrfToken },
                        credentials: 'include'
                    });
                    if (res.ok) success++;
                }
                showToast(`Deleted ${success} cards`, "success");
                toggleBulkSelect();
                fetchCardsForGrid('creator-cards-grid');
            } catch (err) { showToast("Something went wrong", "error"); }
        },
        'Delete All'
    );
}


async function loadPackSettings() {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' });
        if (res.ok) {
            const settings = await res.json();
            const prev = document.getElementById('pack-art-preview');
            if (!prev) return;
            if (settings.pack_image_url) {
                prev.src = settings.pack_image_url;
                prev.classList.remove('hidden');
                document.getElementById('pack-art-placeholder')?.classList.add('hidden');
            } else {
                prev.src = DEFAULT_PACK_IMAGE_URL;
                prev.classList.remove('hidden');
                document.getElementById('pack-art-placeholder')?.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Failed to load pack settings:", err);
    }
}

async function savePackCustomization() {
    const imageFile = document.getElementById('pack-image-upload')?.files[0];
    showToast("Updating pack art...", "loading");

    try {
        let imageUrl = null;
        if (imageFile) {
            const formData = new FormData();
            formData.append('file', imageFile);
            const uploadRes = await apiFetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.url;
            }
        }

        const res = await apiFetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ pack_image_url: imageUrl }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Pack art updated", "success");
            if (imageUrl) document.getElementById('pack-preview-image').src = imageUrl;
        } else {
            showToast("Update Failure", "error");
        }
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}


// --- ACCESSIBILITY HELPER: Keyboard Support ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = [
            'card-creator-modal',
            'set-manager-modal',
            'grant-card-modal',
            'confirm-action-modal',
            'pack-editor-modal',
            'card-studio-details-modal'
        ];
        modals.forEach(id => {
            const modal = document.getElementById(id);
            if (modal && !modal.classList.contains('hidden')) {
                // Determine which close function to call
                if (id === 'card-creator-modal') closeCardCreator();
                else if (id === 'set-manager-modal') closeSetManager();
                else if (id === 'grant-card-modal') closeGrantModal();
                else if (id === 'confirm-action-modal') closeConfirmModal();
                else if (id === 'pack-editor-modal') closePackEditor();
                else if (id === 'card-studio-details-modal') closeCardStudioDetailsModal();
            }
        });
    }
});

window.openSetManager = () => {
    const modal = document.getElementById('set-manager-modal');
    if (modal) {
        modal.classList.remove('hidden');
        resetSetForm();
        // Focus management: focus the first input or the close button
        setTimeout(() => {
            const firstInput = document.getElementById('set-name-input');
            if (firstInput) firstInput.focus();
        }, 100);
    }
};
window.closeSetManager = () => document.getElementById('set-manager-modal')?.classList.add('hidden');

// --- TEMPLATE MANAGEMENT ---

// (creatorTemplates moved to top)
let templateCanvas = null;
let templateCtx = null;
let templateAsset = null;
let isDrawingTraitArea = false;
let isResizingTraitArea = false;
let dragHandleIndex = -1;
const HANDLE_SIZE = 12;
let traitAreaStart = { x: 0, y: 0 };
let currentTraitArea = { x: 0, y: 0, w: 0, h: 0 };

function getHandleAt(mx, my) {
    if (currentTraitArea.w === 0 || currentTraitArea.h === 0) return -1;
    
    const { x, y, w, h } = currentTraitArea;
    const handles = [
        { x: x, y: y },              // Top-left (0)
        { x: x + w/2, y: y },        // Top-mid (1)
        { x: x + w, y: y },          // Top-right (2)
        { x: x + w, y: y + h/2 },    // Mid-right (3)
        { x: x + w, y: y + h },      // Bottom-right (4)
        { x: x + w/2, y: y + h },    // Bottom-mid (5)
        { x: x, y: y + h },          // Bottom-left (6)
        { x: x, y: y + h/2 }         // Mid-left (7)
    ];

    for (let i = 0; i < handles.length; i++) {
        const h = handles[i];
        if (mx >= h.x - HANDLE_SIZE/2 && mx <= h.x + HANDLE_SIZE/2 &&
            my >= h.y - HANDLE_SIZE/2 && my <= h.y + HANDLE_SIZE/2) {
            return i;
        }
    }
    return -1;
}

async function loadTemplates() {
    const grid = document.getElementById('templates-list');
    if (grid) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-void-muted uppercase text-[9px]"><i class="bx bx-loader-alt animate-spin mr-2"></i>Loading templates...</div>';
    }

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/templates`, { credentials: 'include' });
        if (res.ok) {
            creatorTemplates = await res.json();
            renderTemplateList();
            updateCardCreatorTemplateDropdown();
        } else {
            const errText = await res.text();
            console.error("Load templates failed:", res.status, errText);
            if (grid) grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 uppercase text-[9px]">Failed to load templates: ${res.status} ${errText}</div>`;
        }
    } catch (err) {
        console.error("Load templates error:", err);
        if (grid) grid.innerHTML = '<div class="col-span-full py-12 text-center text-red-400 uppercase text-[9px]">Network error loading templates</div>';
    }
}

function renderTemplateList() {
    const grid = document.getElementById('templates-list');
    if (!grid) return;

    if (creatorTemplates.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center glass-card">
                <div class="w-20 h-20 rounded-3xl bg-void-accent/5 border border-void-accent/10 flex items-center justify-center text-void-accent/30 text-3xl mx-auto mb-6">
                    <i class="bx bxs-magic-wand"></i>
                </div>
                <h3 class="text-xl font-black uppercase italic tracking-tight text-white mb-2">No templates yet</h3>
                <p class="text-[10px] text-void-muted uppercase font-bold tracking-[0.2em] mb-8">Create a template to start making dynamic cards</p>
                <button onclick="openTemplateEditor()" class="saas-button mx-auto">
                    <i class="bx bxs-plus mr-2"></i>Create First Template
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = creatorTemplates.map(t => `
        <div class="glass-card group hover:border-void-accent/30 transition-all p-4">
            <div class="aspect-[2/3] rounded-2xl overflow-hidden bg-black/40 mb-5 relative border border-white/5">
                <img src="${t.image_url}" class="w-full h-full object-contain">
                <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                    <button onclick="editTemplate('${t.id}')" class="saas-button py-3 px-6 text-[10px] w-32">
                        <i class="bx bxs-pen mr-2"></i>Edit
                    </button>
                    <button onclick="deleteTemplate('${t.id}')" class="saas-button saas-button-secondary py-3 px-6 text-[10px] w-32 border-red-500/30 text-red-400 hover:bg-red-500/10">
                        <i class="bx bxs-trash mr-2"></i>Delete
                    </button>
                </div>
            </div>
            <div class="px-1">
                <h4 class="text-sm font-black uppercase tracking-tight text-white mb-1 truncate">${escapeHTML(t.name)}</h4>
                <div class="flex items-center justify-between">
                    <span class="text-[8px] font-black text-void-accent uppercase tracking-widest opacity-70">Dynamic Template</span>
                    <span class="text-[8px] font-mono text-void-muted">#${t.id.slice(0, 8)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function openTemplateEditor(templateId = null) {
    const modal = document.getElementById('template-editor-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    
    // Reset form
    document.getElementById('template-edit-id').value = '';
    document.getElementById('template-name').value = '';
    document.getElementById('template-image-url').value = '';
    document.getElementById('template-font-size').value = '32';
    document.getElementById('template-icon-size').value = '32';
    document.getElementById('template-font-color').value = '#ffffff';
    document.getElementById('template-font-color-hex').textContent = '#FFFFFF';
    document.getElementById('template-asset-upload').value = '';
    setTemplateAlign('center');
    
    currentTraitArea = { x: 0, y: 0, w: 0, h: 0 };
    templateAsset = null;
    
    initTemplateCanvas();
    
    if (typeof templateId === 'string') {
        const template = creatorTemplates.find(t => t.id === templateId);
        if (template) {
            document.getElementById('template-edit-id').value = template.id;
            document.getElementById('template-name').value = template.name;
            document.getElementById('template-image-url').value = template.image_url;
            document.getElementById('template-font-size').value = template.font_size;
            document.getElementById('template-icon-size').value = template.icon_size || 32;
            document.getElementById('template-font-color').value = template.font_color;
            document.getElementById('template-font-color-hex').textContent = template.font_color.toUpperCase();
            setTemplateAlign(template.text_align);
            
            if (template.trait_area) {
                currentTraitArea = { ...template.trait_area };
            }
            
            if (template.image_url) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    templateAsset = img;
                    drawTemplatePreview();
                    document.getElementById('template-canvas-placeholder').classList.add('hidden');
                };
                img.src = template.image_url;
            }
        }
    } else {
        document.getElementById('template-canvas-placeholder').classList.remove('hidden');
        drawTemplatePreview();
    }
}

window.closeTemplateEditor = () => document.getElementById('template-editor-modal')?.classList.add('hidden');

function initTemplateCanvas() {
    templateCanvas = document.getElementById('template-canvas');
    if (!templateCanvas) return;
    templateCtx = templateCanvas.getContext('2d');
    
    // Remove old listeners to avoid duplicates
    templateCanvas.onmousedown = null;
    window.onmousemove = null;
    window.onmouseup = null;

    templateCanvas.onmousedown = (e) => {
        if (!templateAsset) return;
        
        const rect = templateCanvas.getBoundingClientRect();
        const scaleX = templateCanvas.width / rect.width;
        const scaleY = templateCanvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        const handle = getHandleAt(mx, my);
        if (handle !== -1) {
            isResizingTraitArea = true;
            dragHandleIndex = handle;
            return;
        }

        isDrawingTraitArea = true;
        traitAreaStart = { x: mx, y: my };
        currentTraitArea = { x: mx, y: my, w: 0, h: 0 };
    };

    window.onmousemove = (e) => {
        const rect = templateCanvas.getBoundingClientRect();
        const scaleX = templateCanvas.width / rect.width;
        const scaleY = templateCanvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        if (isResizingTraitArea) {
            const { x, y, w, h } = currentTraitArea;
            switch(dragHandleIndex) {
                case 0: // TL
                    currentTraitArea.x = mx; currentTraitArea.y = my;
                    currentTraitArea.w = (x + w) - mx; currentTraitArea.h = (y + h) - my;
                    break;
                case 1: // TM
                    currentTraitArea.y = my; currentTraitArea.h = (y + h) - my;
                    break;
                case 2: // TR
                    currentTraitArea.y = my; currentTraitArea.w = mx - x; currentTraitArea.h = (y + h) - my;
                    break;
                case 3: // MR
                    currentTraitArea.w = mx - x;
                    break;
                case 4: // BR
                    currentTraitArea.w = mx - x; currentTraitArea.h = my - y;
                    break;
                case 5: // BM
                    currentTraitArea.h = my - y;
                    break;
                case 6: // BL
                    currentTraitArea.x = mx; currentTraitArea.w = (x + w) - mx; currentTraitArea.h = my - y;
                    break;
                case 7: // ML
                    currentTraitArea.x = mx; currentTraitArea.w = (x + w) - mx;
                    break;
            }
            drawTemplatePreview();
            return;
        }

        if (!isDrawingTraitArea) {
            // Cursor hint
            if (getHandleAt(mx, my) !== -1) {
                templateCanvas.style.cursor = 'nwse-resize';
            } else {
                templateCanvas.style.cursor = 'crosshair';
            }
            return;
        }

        currentTraitArea.w = mx - traitAreaStart.x;
        currentTraitArea.h = my - traitAreaStart.y;
        drawTemplatePreview();
    };

    window.onmouseup = () => {
        isDrawingTraitArea = false;
        isResizingTraitArea = false;
        dragHandleIndex = -1;
        
        // Normalize rect
        if (currentTraitArea.w < 0) {
            currentTraitArea.x += currentTraitArea.w;
            currentTraitArea.w = Math.abs(currentTraitArea.w);
        }
        if (currentTraitArea.h < 0) {
            currentTraitArea.y += currentTraitArea.h;
            currentTraitArea.h = Math.abs(currentTraitArea.h);
        }
        drawTemplatePreview();
    };
    
    templateCanvas.onclick = (e) => {
        if (isDrawingTraitArea) return;
        // If they just clicked (no drag), maybe they want to clear
        if (currentTraitArea.w < 5 && currentTraitArea.h < 5) {
             currentTraitArea = { x: 0, y: 0, w: 0, h: 0 };
             drawTemplatePreview();
        }
    };
}

function drawTemplatePreview() {
    if (!templateCtx) return;
    templateCtx.clearRect(0, 0, templateCanvas.width, templateCanvas.height);
    
    if (templateAsset) {
        templateCtx.drawImage(templateAsset, 0, 0, templateCanvas.width, templateCanvas.height);
    }
    
    // Draw Trait Area Box
    if (currentTraitArea.w > 0 || currentTraitArea.h > 0 || isDrawingTraitArea) {
        templateCtx.strokeStyle = '#00f2fe';
        templateCtx.lineWidth = 4;
        templateCtx.setLineDash([10, 5]);
        templateCtx.strokeRect(currentTraitArea.x, currentTraitArea.y, currentTraitArea.w, currentTraitArea.h);
        
        templateCtx.fillStyle = 'rgba(0, 242, 254, 0.1)';
        templateCtx.fillRect(currentTraitArea.x, currentTraitArea.y, currentTraitArea.w, currentTraitArea.h);
        
        // Handles
        templateCtx.setLineDash([]);
        templateCtx.fillStyle = '#00f2fe';
        const { x, y, w, h } = currentTraitArea;
        const handles = [
            { x: x, y: y }, { x: x + w/2, y: y }, { x: x + w, y: y },
            { x: x + w, y: y + h/2 }, { x: x + w, y: y + h }, { x: x + w/2, y: y + h },
            { x: x, y: y + h }, { x: x, y: y + h/2 }
        ];
        handles.forEach(h => {
            templateCtx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
            templateCtx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        });

        // Sample Text
        const fontSize = parseInt(document.getElementById('template-font-size').value || 32);
        const iconSizeParam = parseInt(document.getElementById('template-icon-size').value || 32);
        const fontColor = document.getElementById('template-font-color').value || '#ffffff';
        const textAlign = document.getElementById('template-text-align').value || 'center';
        
        document.getElementById('template-font-color-hex').textContent = fontColor.toUpperCase();
        
        templateCtx.fillStyle = fontColor;
        templateCtx.textAlign = textAlign;
        
        let textX = currentTraitArea.x + 10;
        if (textAlign === 'center') textX = currentTraitArea.x + (currentTraitArea.w / 2);
        if (textAlign === 'right') textX = currentTraitArea.x + currentTraitArea.w - 10;
        
        const iconSize = iconSizeParam;
        const spacing = 15; // Gap between icon and name text

        let iconX = textX;
        let nameX = textX;

        if (textAlign === 'center') {
            // When centered, icon is to the left of the name
            // We need to offset the total width (icon + spacing + nameWidth)
            templateCtx.font = `900 ${fontSize}px Inter, sans-serif`;
            const nameWidth = templateCtx.measureText('GENESIS: MIMIC').width;
            const totalWidth = iconSize + spacing + nameWidth;
            iconX = textX - (totalWidth / 2);
            nameX = iconX + iconSize + spacing + (nameWidth / 2); // Center alignment for name text
        } else if (textAlign === 'left') {
            iconX = textX;
            nameX = iconX + iconSize + spacing;
        } else if (textAlign === 'right') {
            // Text is right aligned, icon is to the left of the name
            templateCtx.font = `900 ${fontSize}px Inter, sans-serif`;
            const nameWidth = templateCtx.measureText('GENESIS: MIMIC').width;
            iconX = textX - (nameWidth + spacing + iconSize);
            nameX = textX; // name is right aligned at textX
        }

        const mockIcon = new Image();
        mockIcon.src = 'https://cdn.codeoce.com/traits/mimic-icon.png';
        if (mockIcon.complete) {
            templateCtx.drawImage(mockIcon, iconX, currentTraitArea.y + 40, iconSize, iconSize);
        } else {
            mockIcon.onload = () => drawTemplatePreview();
        }

        // Mock Name
        templateCtx.font = `900 ${fontSize}px Inter, sans-serif`;
        templateCtx.textAlign = textAlign;
        templateCtx.fillText('GENESIS: MIMIC', nameX, currentTraitArea.y + 40 + (iconSize/2) + (fontSize/3));

        // Mock Description
        templateCtx.font = `500 ${fontSize * 0.6}px Inter, sans-serif`;
        templateCtx.globalAlpha = 0.8;
        const mockDesc = "Copy the stats of the card to the left and the traits of the card to the right.";
        
        // Simple wrap
        const words = mockDesc.split(' ');
        let line = '';
        let lineY = currentTraitArea.y + 40 + Math.max(iconSize, fontSize) + 20;
        const maxWidth = currentTraitArea.w - 20;

        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = templateCtx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                templateCtx.fillText(line, textX, lineY);
                line = words[n] + ' ';
                lineY += (fontSize * 0.6) * 1.4;
            } else {
                line = testLine;
            }
        }
        templateCtx.fillText(line, textX, lineY);
        templateCtx.globalAlpha = 1.0;
    }
}

function setTemplateAlign(align) {
    document.getElementById('template-text-align').value = align;
    document.querySelectorAll('.template-align-button').forEach(btn => {
        btn.classList.remove('active');
    });
    const active = document.getElementById(`align-${align}`);
    if (active) {
        active.classList.add('active');
    }
    drawTemplatePreview();
}

async function handleTemplateAssetUpload(file) {
    if (!file) return;
    showToast("Uploading asset...", "loading");
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        if (res.ok) {
            const data = await res.json();
            document.getElementById('template-image-url').value = data.url;
            
            // Use local Blob URL for immediate preview to bypass CORS/CDN delay & potential CORS issues during canvas draw
            const blobUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                templateAsset = img;
                drawTemplatePreview();
                document.getElementById('template-canvas-placeholder').classList.add('hidden');
                showToast("Asset uploaded", "success");
                // Note: remote URL will be used for final save
            };
            img.onerror = () => {
                console.error("Failed to load local preview of uploaded image:", blobUrl);
                showToast("Upload error: Preview failed to load", "error");
            };
            img.src = blobUrl;
        } else {
            const errText = await res.text();
            console.error("Upload fail:", errText);
            showToast(`Upload failed: ${errText}`, "error");
        }
    } catch (err) {
        console.error("Upload exception:", err);
        showToast("Upload error", "error");
    }
}

async function saveTemplate() {
    const name = document.getElementById('template-name').value;
    const imageUrl = document.getElementById('template-image-url').value;
    const templateId = document.getElementById('template-edit-id').value;
    const fontSize = parseInt(document.getElementById('template-font-size').value || 32);
    const fontColor = document.getElementById('template-font-color').value || '#ffffff';
    const iconSize = parseInt(document.getElementById('template-icon-size').value || 32);

    if (!name) return showToast("Template name required", "error");
    if (!imageUrl) return showToast("Template asset required", "error");
    if (currentTraitArea.w <= 0 || currentTraitArea.h <= 0) return showToast("Please define a trait area on the card", "error");

    showToast("Saving template...", "loading");

    const textAlignVal = document.getElementById('template-text-align')?.value || 'center';

    const payload = {
        name,
        image_url: imageUrl,
        trait_area: currentTraitArea,
        font_size: fontSize,
        font_color: fontColor,
        text_align: textAlignVal,
        icon_size: iconSize
    };

    try {
        const url = templateId ? `${BACKEND_URL}/api/creator/templates/${templateId}` : `${BACKEND_URL}/api/creator/templates`;
        const res = await apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Template saved", "success");
            closeTemplateEditor();
            loadTemplates();
        } else {
            showToast("Failed to save template", "error");
        }
    } catch (err) {
        showToast("Save error", "error");
    }
}

function editTemplate(id) {
    openTemplateEditor(id);
}

async function deleteTemplate(id) {
    if (!confirm("Delete this template? Cards using it will revert to their static images.")) return;
    
    showToast("Deleting...", "loading");
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/templates?id=${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            showToast("Template deleted", "success");
            loadTemplates();
        } else {
            showToast("Delete failed", "error");
        }
    } catch (err) {
        showToast("Delete error", "error");
    }
}

function updateCardCreatorTemplateDropdown() {
    const sel = document.getElementById('card-creator-template');
    if (!sel) return;
    
    const wrapper = sel.closest('.void-dropdown');
    const menu = wrapper?.querySelector('.void-dropdown-menu');
    
    sel.innerHTML = '<option value="">None (Static Image)</option>' + 
        creatorTemplates.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join('');
        
    if (menu) {
        syncVoidDropdownMenu(wrapper);
    }
}

function onTemplateDropdownChange() {
    const sel = document.getElementById('card-creator-template');
    const container = document.getElementById('card-creator-trait-container');
    if (sel && container) {
        if (sel.value) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }
}

function openCardCreator() {
    window.location.href = '/card-creator';
}
window.closeCardCreator = () => {};

window.switchSubTab = switchSubTab;
window.saveSet = saveSet;
window.editSet = editSet;
window.deleteSet = deleteSet;
window.toggleBulkSelect = toggleBulkSelect;
window.clearBulkSelect = clearBulkSelect;
window.bulkAssignSet = bulkAssignSet;
window.bulkDeleteCards = bulkDeleteCards;
window.savePackCustomization = savePackCustomization;
window.resetPackImage = () => {
    const img = document.getElementById('pack-preview-image');
    if (img) img.src = DEFAULT_PACK_IMAGE_URL;
    const input = document.getElementById('pack-image-upload');
    if (input) input.value = '';
};

// Global Exposure for Template Management
window.openTemplateEditor = openTemplateEditor;
window.saveTemplate = saveTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.setTemplateAlign = setTemplateAlign;
window.handleTemplateAssetUpload = handleTemplateAssetUpload;
window.onTemplateDropdownChange = onTemplateDropdownChange;
window.loadTemplates = loadTemplates;


async function saveCard() {
    const name = document.getElementById('card-creator-name').value;
    const rarity = document.getElementById('card-creator-rarity').value;
    const description = document.getElementById('card-creator-description').value;
    const attack = parseInt(document.getElementById('card-creator-attack').value || 0);
    const defense = parseInt(document.getElementById('card-creator-defense').value || 0);
    const setId = document.getElementById('card-creator-set').value;
    const cardId = document.getElementById('card-edit-id').value;
    const imageFile = document.getElementById('card-image-upload')?.files[0];
    const isBattleable = document.getElementById('card-creator-battleable')?.checked ?? true;
    const isTradable = document.getElementById('card-creator-tradable')?.checked ?? true;

    if (!name) return showToast("Card name required", "error");

    showToast("Saving card...", "loading");

    try {
        let imageUrl = null;
        if (imageFile) {
            const formData = new FormData();
            formData.append('file', imageFile);
            const uploadRes = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.url;
            }
        } else if (cardId) {

            const preview = document.getElementById('card-image-preview');
            if (preview && !preview.classList.contains('hidden')) imageUrl = preview.src;
        }

        const templateId = document.getElementById('card-creator-template')?.value || null;
        const autoRoll = !!templateId; // Auto-roll if template selected

        const payload = {
            id: cardId || undefined,
            name,
            rarity,
            description,
            attack,
            defense,
            set_id: setId || null,
            image_url: imageUrl || '',
            is_battle_eligible: isBattleable,
            is_trading_eligible: isTradable,
            template_id: templateId,
            trait_list: [],
            auto_roll_traits: autoRoll
        };

        const res = await apiFetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Card saved", "success");
            closeCardCreator();
            fetchCardsForGrid('creator-cards-grid');
        } else {
            const data = await res.json();
            showToast(data.error || "Sync failure", "error");
        }
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}

async function deleteCard(cardId) {
    if (!confirm("Are you sure you want to delete this card?")) return;

    showToast("Deleting card...", "loading");

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Card deleted", "success");
            if (cardStudioDetailsModalCardId === cardId) closeCardStudioDetailsModal();
            fetchCardsForGrid('creator-cards-grid');
        } else {
            showToast("Failed to delete card", "error");
        }
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}

function openCardInCreator(cardId) {
    if (!cardId) return;
    window.location.href = `/card-creator?id=${encodeURIComponent(cardId)}`;
}
window.openCardInCreator = openCardInCreator;

function closeCardStudioDetailsModal() {
    cardStudioDetailsModalCardId = null;
    const modal = document.getElementById('card-studio-details-modal');
    if (modal) modal.classList.add('hidden');
}
window.closeCardStudioDetailsModal = closeCardStudioDetailsModal;

function _cardStudioModalSetLabel(card) {
    if (!card.set_id) return 'No set';
    const sn = (creatorSets || []).find(s => s.id === card.set_id)?.name;
    return sn ? String(sn) : 'Set';
}

function renderCardStudioModalContent(card, mode) {
    const body = document.getElementById('card-studio-details-modal-body');
    if (!body || !card) return;

    if (mode === 'view') {
        const setLabel = _cardStudioModalSetLabel(card);
        body.innerHTML = `
            <div class="flex flex-col gap-4">
                <div class="mx-auto w-[5.75rem] aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-white/10 bg-zinc-900/80 shadow-inner">
                    <img src="${escapeHTML(card.image_url || '')}" alt="" class="w-full h-full object-cover">
                </div>
                <div class="text-center space-y-1.5">
                    <p class="text-[15px] font-black uppercase italic text-white leading-tight tracking-tight px-1">${escapeHTML(card.name || 'Untitled')}</p>
                    <span class="inline-flex items-center justify-center rounded-md bg-void-accent/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-void-accent">${escapeHTML(card.rarity || '')}</span>
                </div>
                <div class="flex gap-2 justify-center">
                    <div class="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                        <span class="text-[8px] font-black uppercase tracking-widest text-void-muted">Atk</span>
                        <span class="text-lg font-mono font-bold tabular-nums text-white leading-none">${parseInt(card.attack || 0, 10)}</span>
                    </div>
                    <div class="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                        <span class="text-[8px] font-black uppercase tracking-widest text-void-muted">Def</span>
                        <span class="text-lg font-mono font-bold tabular-nums text-white leading-none">${parseInt(card.defense || 0, 10)}</span>
                    </div>
                </div>
                <p class="text-center text-[10px] text-void-muted"><span class="text-void-muted/80">Set</span> <span class="text-white/90">${escapeHTML(setLabel)}</span></p>
                <div class="flex flex-col gap-2 pt-1">
                    <button type="button" onclick="openCardInCreator('${escapeHTML(card.id)}')"
                        class="w-full py-2.5 rounded-xl bg-void-accent text-void-bg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-void-accent/20 hover:brightness-110 transition-all">
                        Open in Card Creator
                    </button>
                    <button type="button" onclick="cardStudioDetailsEnterEdit()"
                        class="w-full py-2 rounded-xl border border-white/10 bg-transparent text-[10px] font-bold uppercase tracking-widest text-void-muted hover:text-white hover:bg-white/[0.04] transition-colors">
                        Quick edit
                    </button>
                </div>
            </div>`;
        return;
    }

    const setOptions = ['<option value="">No set</option>'].concat(
        (creatorSets || []).map(s =>
            `<option value="${escapeHTML(s.id)}" ${card.set_id === s.id ? 'selected' : ''}>${escapeHTML(s.name || 'Untitled')}</option>`
        )
    ).join('');

    body.innerHTML = `
        <div class="space-y-3">
            <p class="text-[10px] text-center text-void-muted">Rarity is edited in Card Creator <span class="text-white/70">(${escapeHTML(card.rarity || '')})</span></p>
            <div>
                <label for="cs-modal-name" class="block text-[9px] font-black uppercase tracking-widest text-void-muted mb-1.5">Name</label>
                <input type="text" id="cs-modal-name" value="${escapeHTML(card.name || '')}"
                    class="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-[12px] font-bold text-white placeholder:text-void-muted/50 focus:border-void-accent/50 focus:ring-1 focus:ring-void-accent/30 focus:outline-none">
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label for="cs-modal-attack" class="block text-[9px] font-black uppercase tracking-widest text-void-muted mb-1.5">Attack</label>
                    <input type="number" id="cs-modal-attack" min="0" max="9999" value="${parseInt(card.attack || 0, 10)}"
                        class="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-[12px] font-mono font-bold text-white focus:border-void-accent/50 focus:ring-1 focus:ring-void-accent/30 focus:outline-none">
                </div>
                <div>
                    <label for="cs-modal-defense" class="block text-[9px] font-black uppercase tracking-widest text-void-muted mb-1.5">Defense</label>
                    <input type="number" id="cs-modal-defense" min="0" max="9999" value="${parseInt(card.defense || 0, 10)}"
                        class="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-[12px] font-mono font-bold text-white focus:border-void-accent/50 focus:ring-1 focus:ring-void-accent/30 focus:outline-none">
                </div>
            </div>
            <div>
                <label for="cs-modal-set" class="block text-[9px] font-black uppercase tracking-widest text-void-muted mb-1.5">Set</label>
                <select id="cs-modal-set"
                    class="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-semibold text-white focus:border-void-accent/50 focus:ring-1 focus:ring-void-accent/30 focus:outline-none">
                    ${setOptions}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onclick="cardStudioDetailsCancelEdit()"
                    class="py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-widest text-void-muted hover:text-white hover:bg-white/[0.06] transition-colors">
                    Cancel
                </button>
                <button type="button" onclick="cardStudioDetailsSaveEdit()"
                    class="py-2.5 rounded-xl bg-void-accent text-void-bg text-[10px] font-black uppercase tracking-widest shadow-md shadow-void-accent/20 hover:brightness-110 transition-all">
                    Save
                </button>
            </div>
        </div>`;
}

function openCardStudioDetailsModal(card) {
    if (!card) return;
    cardStudioDetailsModalCardId = card.id;
    renderCardStudioModalContent(card, 'view');
    const modal = document.getElementById('card-studio-details-modal');
    if (modal) modal.classList.remove('hidden');
}
window.openCardStudioDetailsModal = openCardStudioDetailsModal;

function cardStudioDetailsEnterEdit() {
    const card = creatorCards.find(c => c.id === cardStudioDetailsModalCardId);
    if (card) renderCardStudioModalContent(card, 'edit');
}
window.cardStudioDetailsEnterEdit = cardStudioDetailsEnterEdit;

function cardStudioDetailsCancelEdit() {
    const card = creatorCards.find(c => c.id === cardStudioDetailsModalCardId);
    if (card) renderCardStudioModalContent(card, 'view');
}
window.cardStudioDetailsCancelEdit = cardStudioDetailsCancelEdit;

async function cardStudioDetailsSaveEdit() {
    const cardId = cardStudioDetailsModalCardId;
    const card = creatorCards.find(c => c.id === cardId);
    if (!card) return;
    const nameEl = document.getElementById('cs-modal-name');
    const atkEl = document.getElementById('cs-modal-attack');
    const defEl = document.getElementById('cs-modal-defense');
    const setEl = document.getElementById('cs-modal-set');
    if (!nameEl || !atkEl || !defEl || !setEl) return;
    const name = nameEl.value.trim();
    if (!name) {
        showToast('Name is required', 'error');
        return;
    }
    const attack = Math.max(0, Math.min(9999, parseInt(atkEl.value, 10) || 0));
    const defense = Math.max(0, Math.min(9999, parseInt(defEl.value, 10) || 0));
    const set_id = setEl.value.trim() || null;

    showToast('Saving…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            credentials: 'include',
            body: JSON.stringify({ name, attack, defense, set_id })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Save failed');
        }
        const data = await res.json();
        const idx = creatorCards.findIndex(c => c.id === cardId);
        if (idx >= 0) creatorCards[idx] = { ...creatorCards[idx], ...data };
        showToast('Card updated', 'success');
        renderCardGrid('creator-cards-grid', filterCards());
        renderCardStudioModalContent(creatorCards[idx], 'view');
    } catch (e) {
        showToast(e.message || 'Save failed', 'error');
    }
}
window.cardStudioDetailsSaveEdit = cardStudioDetailsSaveEdit;

function selectCardStudioDetails(cardId) {
    const card = creatorCards.find(c => c.id === cardId);
    if (card) openCardStudioDetailsModal(card);
}
window.selectCardStudioDetails = selectCardStudioDetails;

function editCard(cardId) {
    openCardInCreator(cardId);
}


async function fetchCardBacks() {
    const grid = document.getElementById('card-backs-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-12 text-center text-void-muted uppercase text-[9px]"><i class="bx bx-loader-alt animate-spin mr-2"></i>Loading card backs...</div>';

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/card-backs`, { credentials: 'include' });
        if (res.ok) {
            const backs = await res.json();
            if (backs.length === 0) {
                grid.innerHTML = '<div class="col-span-full py-12 text-center text-void-muted uppercase text-[9px]">No custom backs detected</div>';
                return;
            }

        }
    } catch (e) { }
}


function setupCardFilters() {
    const searchInput = document.getElementById('card-search-input');
    const rarityFilter = document.getElementById('card-filter-rarity');
    const setFilter = document.getElementById('card-filter-set');

    if (searchInput) {
        searchInput.oninput = (e) => {
            debounce(() => renderCardGrid('creator-cards-grid', filterCards()), 300)();
        };
    }
    if (rarityFilter) {
        rarityFilter.onchange = () => renderCardGrid('creator-cards-grid', filterCards());
    }
    if (setFilter) {
        setFilter.onchange = () => renderCardGrid('creator-cards-grid', filterCards());
    }
}

function filterCards() {
    const searchTerm = document.getElementById('card-search-input')?.value.toLowerCase() || '';
    const rarity = document.getElementById('card-filter-rarity')?.value || '';
    const setId = document.getElementById('card-filter-set')?.value || '';

    return creatorCards.filter(card => {
        const matchesSearch = !searchTerm || card.name.toLowerCase().includes(searchTerm) || (card.description && card.description.toLowerCase().includes(searchTerm));
        const matchesRarity = !rarity || card.rarity === rarity;
        const matchesSet = !setId || card.set_id === setId;
        return matchesSearch && matchesRarity && matchesSet;
    });
}


function previewCardImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('card-image-preview');
            const placeholder = document.getElementById('card-image-placeholder');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewSetIcon(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('set-icon-preview');
            const placeholder = document.getElementById('set-icon-placeholder');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}


function setupBulkUpload() {
    const zone = document.getElementById('card-upload-zone');
    const input = document.getElementById('card-image-upload-bulk');
    if (!zone || !input) return;

    zone.onclick = () => input.click();
    zone.ondragover = (e) => {
        e.preventDefault();
        zone.classList.add('border-void-accent', 'bg-void-accent/5');
    };
    zone.ondragleave = () => {
        zone.classList.remove('border-void-accent', 'bg-void-accent/5');
    };
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.classList.remove('border-void-accent', 'bg-void-accent/5');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) handleBulkImageUpload(files);
    };
    input.onchange = (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) handleBulkImageUpload(files);
        input.value = '';
    };
}

async function handleBulkImageUpload(files) {
    showToast(`Uploading ${files.length} images...`, "loading");

    let successCount = 0;
    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await apiFetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                const res = await apiFetch(`${BACKEND_URL}/api/creator/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                    body: JSON.stringify({
                        name: file.name.split('.')[0].toUpperCase(),
                        rarity: 'common',
                        image_url: uploadData.url
                    }),
                    credentials: 'include'
                });
                if (res.ok) successCount++;
            }
        } catch (err) {
            console.error("Bulk upload failure:", err);
        }
    }

    showToast(`Upload complete: ${successCount} cards created.`, "success");
    closeBulkUpload();
    fetchCardsForGrid('creator-cards-grid');
}


window.saveCard = saveCard;
window.editCard = editCard;
window.deleteCard = deleteCard;
window.saveSet = saveSet;
window.editSet = editSet;
window.deleteSet = deleteSet;
window.bulkAssignSet = bulkAssignSet;
window.bulkDeleteCards = bulkDeleteCards;
window.toggleBulkSelect = toggleBulkSelect;
window.clearBulkSelect = clearBulkSelect;
window.toggleCardSelection = toggleCardSelection;
window.openCardCreator = openCardCreator;
window.closeCardCreator = closeCardCreator;
window.openSetManager = openSetManager;
window.closeSetManager = closeSetManager;
window.previewCardImage = previewCardImage;
window.previewSetIcon = previewSetIcon;
window.switchSubTab = switchSubTab;
window.resetPackArt = resetPackArt;
window.confirmResetPackArt = confirmResetPackArt;
window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.copyOBSLink = copyOBSLink;
window.updateAnimPreview = updateAnimPreview;
window.closeGrantModal = closeGrantModal;
window.saveBranding = saveBranding;
window.fetchAdminLogs = fetchAdminLogs;
window.openActivityLogModal = openActivityLogModal;
window.closeActivityLogModal = closeActivityLogModal;
window.openGenericGrant = openGenericGrant;
window.randomizeStats = function () {
    const rarity = document.getElementById('card-creator-rarity').value;
    let budget = 6;
    if (rarity === 'rare') budget = 10;
    else if (rarity === 'epic') budget = 12;
    else if (rarity === 'legendary') budget = 14;
    else if (rarity === 'common') budget = 8;

    const attack = Math.floor(Math.random() * (budget - 1)) + 1;
    const defense = budget - attack;

    document.getElementById('card-creator-attack').value = attack;
    document.getElementById('card-creator-defense').value = defense;
    showToast(`Stats randomized (Budget: ${budget})`, "success");
};
window.initiateEventPulse = initiateEventPulse;
window.logout = logout;

window.addEventListener('DOMContentLoaded', () => {
    initAllVoidDropdowns();
    initDashboard();
    setupCardFilters();
    setupBulkUpload();
});

// ════════════════════════════════════════════════════════════════
//  OBS QUEUE MANAGEMENT
// ════════════════════════════════════════════════════════════════

let queueAutoRefreshTimer = null;
/** Background poll while Queue tab is active (popout uses 3s; slightly gentler on the worker). */
const QUEUE_DASHBOARD_POLL_MS = 4000;

const RARITY_META = {
    legendary: { color: '#facc15', shadow: 'shadow-yellow-400/40', label: 'Legendary', dot: 'bg-yellow-400' },
    epic:      { color: '#c084fc', shadow: 'shadow-purple-400/40', label: 'Epic',      dot: 'bg-purple-400' },
    rare:      { color: '#60a5fa', shadow: 'shadow-blue-400/40',   label: 'Rare',      dot: 'bg-blue-400'   },
    common:    { color: '#94a3b8', shadow: '',                     label: 'Common',    dot: 'bg-gray-400'   },
};

function rarityMeta(rarity) {
    return RARITY_META[(rarity || 'common').toLowerCase()] || RARITY_META.common;
}

function timeAgo(isoString) {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60)  return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function buildQueueRow(item, isPending, isFirst) {
    const card  = item.cards  || {};
    const user  = item.users  || {};
    const meta  = rarityMeta(card.rarity);
    const thumb = card.image_url
        ? `<img src="${escapeHTML(card.image_url)}" class="queue-thumb" onerror="this.src=''">`
        : `<div class="queue-thumb flex items-center justify-center bg-white/5 text-void-muted text-xs"><i class="bx bxs-id-card"></i></div>`;

    const actions = isPending
        ? `<button class="queue-btn play-now" onclick="replayQueueItem('${escapeHTML(item.id)}', true)" title="Move to front"><i class="bx bx-fast-forward"></i> Now</button>
           <button class="queue-btn skip" onclick="skipQueueItem('${escapeHTML(item.id)}')"><i class="bx bx-fast-forward"></i> Skip</button>`
        : `<button class="queue-btn replay" onclick="replayQueueItem('${escapeHTML(item.id)}', false)"><i class="bx bx-undo"></i> Replay</button>`;

    return `
        <div class="queue-card-row${isFirst ? ' is-first' : ''}" data-id="${escapeHTML(item.id)}">
            ${thumb}
            <div class="flex items-center gap-1.5 flex-shrink-0 w-[72px]">
                <div class="queue-rarity-dot ${meta.dot}"></div>
                <span class="text-[9px] font-black uppercase tracking-widest" style="color:${meta.color}">${meta.label}</span>
            </div>
            <div class="min-w-0 flex-1">
                <div class="text-[11px] font-black text-white truncate">${escapeHTML(card.name || 'Unknown Card')}</div>
                <div class="text-[9px] font-bold text-void-muted truncate">
                    ${user.username ? `<i class="bx bxl-twitch text-purple-400"></i> ${escapeHTML(user.username)} · ` : ''}${timeAgo(item.created_at)}
                </div>
            </div>
            <div class="queue-actions">${actions}</div>
        </div>`;
}

/**
 * @param {boolean} [silent] If true, skip loading placeholders (for background poll).
 */
async function loadObsQueue(silent) {
    const pendingList  = document.getElementById('queue-pending-list');
    const consumedList = document.getElementById('queue-consumed-list');
    if (!pendingList || !consumedList) return;

    if (!silent) {
        const loadingHtml = `<div class="text-center py-6 text-void-muted text-[11px] font-bold uppercase tracking-widest opacity-40"><i class="bx bx-loader-alt bx-spin mr-2"></i>Loading…</div>`;
        pendingList.innerHTML  = loadingHtml;
        consumedList.innerHTML = loadingHtml;
    }

    try {
        const res  = await apiFetch(`${BACKEND_URL}/api/creator/obs-queue`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load queue');

        const { pending = [], consumed = [], obs_settings, obs_paused } = data;

        // Update badge
        const badge = document.getElementById('queue-pending-badge');
        if (badge) badge.textContent = `${pending.length} Pending`;

        // Sync pause button state
        syncDashboardPauseBtn(!!obs_paused);

        // Populate pending
        if (pending.length === 0) {
            pendingList.innerHTML = `<div class="text-center py-8 text-void-muted text-[11px] font-bold uppercase tracking-widest opacity-40"><i class="bx bxs-check-circle mr-2 text-green-400 opacity-60"></i>Queue is empty</div>`;
        } else {
            pendingList.innerHTML = pending.map((item, i) => buildQueueRow(item, true, i === 0)).join('');
        }

        // Populate consumed
        if (consumed.length === 0) {
            consumedList.innerHTML = `<div class="text-center py-8 text-void-muted text-[11px] font-bold uppercase tracking-widest opacity-40">No recent animations</div>`;
        } else {
            consumedList.innerHTML = consumed.map(item => buildQueueRow(item, false, false)).join('');
        }

        // Apply rarity filter checkboxes from saved settings
        if (obs_settings?.show_rarities) {
            document.querySelectorAll('.rarity-filter-cb').forEach(cb => {
                cb.checked = obs_settings.show_rarities.includes(cb.value);
            });
        }
    } catch (err) {
        if (!silent) {
            const errHtml = `<div class="text-center py-6 text-red-400 text-[11px] font-bold uppercase tracking-widest">${escapeHTML(err.message)}</div>`;
            pendingList.innerHTML  = errHtml;
            consumedList.innerHTML = errHtml;
        } else {
            console.warn('[Queue] Silent refresh failed:', err.message);
        }
    }
}

async function skipQueueItem(id) {
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/obs-queue/skip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to skip');
        showToast('Card skipped', 'success');
        await loadObsQueue(true);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function replayQueueItem(id, moveToFront) {
    // moveToFront=true uses "Play Now" semantics — we still just re-queue it;
    // the backend always pushes replayed items to the END (created_at = now).
    // "Play Now" would require more complex re-ordering; for now both replay.
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/obs-queue/replay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to replay');
        showToast(moveToFront ? 'Added to queue' : 'Queued for replay', 'success');
        await loadObsQueue(true);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function clearObsQueue() {
    const confirmed = await new Promise(resolve => {
        // use the existing custom confirm modal if available
        if (typeof showCustomConfirm === 'function') {
            showCustomConfirm({
                title: 'Clear Queue',
                message: 'Mark all pending animations as consumed? This cannot be undone.',
                confirmText: 'Clear All',
                cancelText: 'Cancel',
                icon: 'fa-trash-can',
                onConfirm: () => resolve(true),
                onCancel:  () => resolve(false),
            });
        } else {
            resolve(window.confirm('Clear all pending queue items?'));
        }
    });
    if (!confirmed) return;

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/obs-queue/clear`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to clear queue');
        showToast('Queue cleared', 'success');
        await loadObsQueue(true);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveObsSettings() {
    const checkboxes = document.querySelectorAll('.rarity-filter-cb');
    const showRarities = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (showRarities.length === 0) {
        showToast('Select at least one rarity to display', 'error');
        return;
    }

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/obs-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obs_settings: { show_rarities: showRarities } }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
        showToast('Display filter saved', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function stopQueueAutoRefresh() {
    if (queueAutoRefreshTimer) {
        clearInterval(queueAutoRefreshTimer);
        queueAutoRefreshTimer = null;
    }
}

function startQueueAutoRefresh() {
    stopQueueAutoRefresh();
    queueAutoRefreshTimer = setInterval(() => {
        const queuePanel = document.getElementById('content-queue');
        if (!queuePanel || !queuePanel.classList.contains('active')) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        loadObsQueue(true);
    }, QUEUE_DASHBOARD_POLL_MS);
}

/** @deprecated Prefer start/stopQueueAutoRefresh; kept for any external callers */
function toggleQueueAutoRefresh(enabled) {
    if (enabled) startQueueAutoRefresh();
    else stopQueueAutoRefresh();
}

if (typeof document !== 'undefined' && !window.__queueDashVisibilityHook) {
    window.__queueDashVisibilityHook = true;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        const q = document.getElementById('content-queue');
        if (q && q.classList.contains('active')) loadObsQueue(true);
    });
}

function openQueuePopout() {
    if (!currentUser?.streamer?.obs_overlay_token) {
        showToast('No overlay token found. Check your Overlay tab.', 'error');
        return;
    }
    const streamer = currentUser.name || (currentUser.streamer && currentUser.streamer.username);
    const token    = currentUser.streamer.obs_overlay_token;
    const popoutUrl = `${window.location.origin}/queue-control?streamer=${encodeURIComponent(streamer)}&token=${encodeURIComponent(token)}`;
    window.open(popoutUrl, 'queue-control', 'width=380,height=680,resizable=yes,scrollbars=yes');
}

// Expose to HTML
/* ── Dashboard: Pause / Skip Now ─────────────────────────────────── */
let _dashQueuePaused = false;

function syncDashboardPauseBtn(paused) {
    _dashQueuePaused = paused;
    const btn   = document.getElementById('queue-pause-btn');
    const label = document.getElementById('queue-pause-label');
    if (!btn || !label) return;
    if (paused) {
        label.textContent = 'Resume';
        btn.querySelector('i').className = 'bx bxs-play';
        btn.classList.add('bg-amber-500/25', 'border-amber-400/40');
    } else {
        label.textContent = 'Pause';
        btn.querySelector('i').className = 'bx bxs-pause';
        btn.classList.remove('bg-amber-500/25', 'border-amber-400/40');
    }
}

async function toggleQueuePause() {
    const endpoint = _dashQueuePaused ? 'resume' : 'pause';
    syncDashboardPauseBtn(!_dashQueuePaused); // optimistic
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/obs-queue/${endpoint}`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...getActAsHeaders() }
        });
        if (!res.ok) { syncDashboardPauseBtn(!_dashQueuePaused); throw new Error((await res.json()).error || 'Failed'); }
        showToast(_dashQueuePaused ? 'Queue paused — overlay will hold' : 'Queue resumed', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

async function skipOverlayNow() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/obs-queue/skip-now`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...getActAsHeaders() }
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed');
        showToast('Skip signal sent to overlay', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

window.loadObsQueue    = loadObsQueue;
window.openQueuePopout = openQueuePopout;
window.skipQueueItem   = skipQueueItem;
window.replayQueueItem = replayQueueItem;
window.clearObsQueue   = clearObsQueue;
window.saveObsSettings = saveObsSettings;
window.toggleQueueAutoRefresh = toggleQueueAutoRefresh;
window.toggleQueuePause  = toggleQueuePause;
window.skipOverlayNow    = skipOverlayNow;

/** ISO + label — Stripe Connect Express; keep in sync with src/index.ts STRIPE_EXPRESS_CONNECT_COUNTRIES */
const STRIPE_CONNECT_COUNTRY_OPTIONS = [
    ['AE', 'United Arab Emirates'], ['AT', 'Austria'], ['AU', 'Australia'], ['BE', 'Belgium'], ['BG', 'Bulgaria'],
    ['CA', 'Canada'], ['CH', 'Switzerland'], ['CY', 'Cyprus'], ['CZ', 'Czech Republic'], ['DE', 'Germany'],
    ['DK', 'Denmark'], ['EE', 'Estonia'], ['ES', 'Spain'], ['FI', 'Finland'], ['FR', 'France'],
    ['GB', 'United Kingdom'], ['GI', 'Gibraltar'], ['GR', 'Greece'], ['HK', 'Hong Kong'], ['HR', 'Croatia'],
    ['HU', 'Hungary'], ['IE', 'Ireland'], ['IT', 'Italy'], ['JP', 'Japan'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'],
    ['LV', 'Latvia'], ['MT', 'Malta'], ['MX', 'Mexico'], ['MY', 'Malaysia'], ['NL', 'Netherlands'], ['NO', 'Norway'],
    ['NZ', 'New Zealand'], ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'], ['SE', 'Sweden'],
    ['SG', 'Singapore'], ['SI', 'Slovenia'], ['SK', 'Slovakia'], ['TH', 'Thailand'], ['US', 'United States'],
];

function ensureStripeCountrySelect() {
    const sel = document.getElementById('stripe-connect-country');
    if (!sel || sel.dataset.populated === '1') return;
    sel.dataset.populated = '1';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select country…';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);
    [...STRIPE_CONNECT_COUNTRY_OPTIONS]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([code, name]) => {
            const o = document.createElement('option');
            o.value = code;
            o.textContent = name;
            sel.appendChild(o);
        });
}

async function loadStripeStatus() {
    const loading = document.getElementById('stripe-status-loading');
    const onboarding = document.getElementById('stripe-onboarding-section');
    const active = document.getElementById('stripe-active-section');
    const verifiedPanel = document.getElementById('stripe-verified-panel');
    const deferredPanel = document.getElementById('stripe-deferred-panel');

    if (!loading || !onboarding || !active) return;

    loading.classList.remove('hidden');
    onboarding.classList.add('hidden');
    active.classList.add('hidden');
    if (verifiedPanel) verifiedPanel.classList.add('hidden');
    if (deferredPanel) deferredPanel.classList.add('hidden');

    try {
        await hydrateCreatorStreamerFromProfile();
        const s = currentUser.streamer;

        loading.classList.add('hidden');

        if (!s || !s.stripe_connect_id) {
            ensureStripeCountrySelect();
            onboarding.classList.remove('hidden');
            return;
        }

        active.classList.remove('hidden');

        let st = null;
        try {
            const stRes = await fetch(`${BACKEND_URL}/api/creator/stripe/status`, { credentials: 'include' });
            if (stRes.ok) st = await stRes.json();
        } catch (_) { /* ignore */ }

        if (st && st.transfers_active) {
            if (verifiedPanel) verifiedPanel.classList.remove('hidden');
        } else {
            if (deferredPanel) deferredPanel.classList.remove('hidden');
            const amt = document.getElementById('stripe-pending-amount');
            if (amt && st) {
                const c = Number(st.pending_payout_cents || 0);
                amt.textContent = '$' + (c / 100).toFixed(2);
            }
        }
    } catch (e) {
        console.error('[Stripe] Status load failed', e);
        showToast('Failed to load Stripe status', 'error');
        loading.classList.add('hidden');
    }
}

async function loadCreatorProgress() {
    const loading = document.getElementById('creator-progress-loading');
    const content = document.getElementById('creator-progress-content');
    const badge = document.getElementById('creator-tier-badge');
    if (!loading || !content) return;

    loading.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/progress`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load progress');
        const data = await res.json();

        loading.classList.add('hidden');
        content.classList.remove('hidden');

        const tierLabels = { base: 'Creator', affiliate: 'Affiliate', partner: 'Partner' };
        const tierColors = { base: 'border-white/20 text-void-muted', affiliate: 'border-purple-400/50 text-purple-300 bg-purple-400/10', partner: 'border-yellow-400/50 text-yellow-300 bg-yellow-400/10' };
        if (badge) {
            badge.classList.remove('hidden');
            badge.className = `px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${tierColors[data.current_tier] || tierColors.base}`;
            badge.textContent = tierLabels[data.current_tier] || 'Base Creator';
        }

        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        function reqRow(label, current, required, met, suffix = '') {
            const pct = Math.min(100, Math.round((current / required) * 100));
            return `<div class="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                <div class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${met ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-void-muted'}">
                    <i class="bx ${met ? 'bx-check' : 'bx-minus'} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-white/80">${label}</span>
                        <span class="text-xs font-black ${met ? 'text-green-400' : 'text-void-muted'}">${current}${suffix} / ${required}${suffix}</span>
                    </div>
                    <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700 ${met ? 'bg-green-500' : 'bg-void-accent'}" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>`;
        }

        function monthBar(stat) {
            const threshold = stat._threshold || 0;
            const pct = threshold ? Math.min(100, Math.round((stat.cards_purchased / threshold) * 100)) : 0;
            const met = stat.cards_purchased >= threshold;
            return `<div class="flex flex-col items-center gap-1">
                <div class="w-8 bg-white/5 rounded-sm overflow-hidden relative" style="height:40px">
                    <div class="absolute bottom-0 w-full rounded-sm transition-all ${met ? 'bg-green-500/70' : 'bg-void-accent/50'}" style="height:${pct}%"></div>
                </div>
                <span class="text-[9px] text-void-muted">${MONTHS[stat.month - 1]}</span>
            </div>`;
        }

        function perksBlock(perks) {
            return `<div class="mt-3 pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${perks.map(p => `<div class="flex items-center gap-2 text-xs text-void-muted">
                    <i class="bx bx-check-circle text-void-accent text-sm flex-shrink-0"></i>${p}
                </div>`).join('')}
            </div>`;
        }

        function tierCard({ id, icon, name, split, status, statusColor, reqsHtml, perks, monthStatsHtml, locked }) {
            const statusBadge = status ? `<span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${statusColor}">${status}</span>` : '';
            return `<div class="glass-card overflow-hidden ${locked ? 'opacity-60' : ''}">
                <div class="flex items-center gap-3 px-4 py-3 cursor-pointer" onclick="toggleTierSection('${id}')">
                    <div class="w-12 h-12 flex-shrink-0 flex items-center justify-center">${icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-black uppercase italic tracking-tight text-white">${name}</span>
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-void-accent/10 border border-void-accent/20 text-void-accent">${split} split</span>
                            ${locked ? '<span class="flex items-center gap-1 text-[9px] text-void-muted"><i class="bx bx-lock-alt"></i> Complete Affiliate first</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${statusBadge}
                        <i class="bx bx-chevron-down text-void-muted transition-transform tier-chevron-${id} text-base"></i>
                    </div>
                </div>
                <div id="tier-body-${id}" class="hidden border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                    ${reqsHtml ? `<div><p class="text-[9px] font-black uppercase tracking-widest text-void-muted mb-2">Requirements</p>${reqsHtml}</div>` : ''}
                    ${monthStatsHtml ? `<div><p class="text-[9px] font-black uppercase tracking-widest text-void-muted mb-2">Monthly Activity (last 6 months)</p><div class="flex items-end gap-2 h-12">${monthStatsHtml}</div></div>` : ''}
                    ${perksBlock(perks)}
                </div>
            </div>`;
        }

        const affiliateMonths = data.monthly_stats.map(m => ({ ...m, _threshold: 150 }));
        const partnerMonths   = data.monthly_stats.map(m => ({ ...m, _threshold: 500 }));

        const affiliateStatus = data.affiliate.unlocked ? { label: 'ACHIEVED', color: 'border-green-500/40 text-green-400 bg-green-500/10' } : data.affiliate.eligible ? { label: 'ELIGIBLE', color: 'border-purple-400/40 text-purple-300 bg-purple-400/10' } : { label: 'IN PROGRESS', color: 'border-white/20 text-void-muted' };
        const partnerStatus   = data.partner.unlocked ? { label: 'ACHIEVED', color: 'border-green-500/40 text-green-400 bg-green-500/10' } : data.partner.eligible ? { label: 'ELIGIBLE', color: 'border-yellow-400/40 text-yellow-300 bg-yellow-400/10' } : { label: 'IN PROGRESS', color: 'border-white/20 text-void-muted' };

        const aReqs = data.affiliate.requirements;
        const pReqs = data.partner.requirements;

        const affiliatePerks = ['80/20 revenue split', 'Listed in the marketplace', 'Affiliate referral code', 'Priority support'];
        const partnerPerks   = ['90/10 revenue split', 'Promoted in marketplace', 'Add custom trinkets to the site', 'Exclusive partner badge', 'Referral revenue share'];

        const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const ACHIEVEMENT_ICONS = {
            genesis: '/Achievement_Genesis_Hollow_White.png',
            supply_1: '/Achievement_Supply_Demand.png', supply_2: '/Achievement_Supply_Demand.png', supply_3: '/Achievement_Supply_Demand.png', supply_4: '/Achievement_Supply_Demand.png', supply_5: '/Achievement_Supply_Demand.png',
            knights_tale: '/Achievement_Knights_Tale.png', fit_for_king: '/Achievement_Fit_For_King.png',
            noble_steed: '/Achievement_Noble_Steed.png', drawbridge: '/Achievement_Lower_Drawbridge.png',
            llc_1: '/Achievement_LLC.png', llc_2: '/Achievement_LLC.png', llc_3: '/Achievement_LLC.png', llc_4: '/Achievement_LLC.png', llc_5: '/Achievement_LLC.png',
            brick_by_brick: '/Achievement_Brick_by_Brick.png',
        };

        function fmtProgress(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'M';
            if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'K';
            return String(n);
        }

        function achievementRow({ id, name, desc, tier, progress, total }) {
            const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 100;
            const tierLabel = ROMAN[tier] || String(tier);
            const iconVal = ACHIEVEMENT_ICONS[id] || '🏆';
            const iconHtml = typeof iconVal === 'string' && iconVal.startsWith('/')
                ? `<img src="${iconVal}" alt="" class="w-full h-full object-contain rounded-md p-0.5" />`
                : iconVal;
            return `<div class="relative overflow-hidden rounded-2xl border border-white/5" style="background:rgba(255,255,255,0.02)">
                <div class="flex items-center gap-3 px-4 py-2.5">
                    <div class="relative flex-shrink-0 w-10 h-10">
                        <div class="w-full h-full flex items-center justify-center text-xl">${iconHtml}</div>
                        <span style="position:absolute;top:-4px;right:-4px;width:26px;height:18px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;background:#00f2fe;color:#000;overflow:hidden;flex-shrink:0">${tierLabel}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-white text-sm leading-snug">${name}</p>
                        <p class="text-[10px] text-void-muted mb-1.5">${desc}</p>
                        <div class="flex items-center gap-2">
                            <div class="flex-1 rounded-full overflow-hidden" style="height:6px;background:rgba(255,255,255,0.08)">
                                <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%;background:#00f2fe"></div>
                            </div>
                            <span class="text-[10px] font-bold whitespace-nowrap" style="color:rgba(255,255,255,0.45)">${fmtProgress(progress)} / ${fmtProgress(total)}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        const achievementsHtml = (data.creator_achievements || []).length
            ? `<div class="space-y-2">${data.creator_achievements.map(achievementRow).join('')}</div>`
            : '';

        content.innerHTML = [
            '<p class="text-[9px] font-black uppercase tracking-widest text-void-muted">Creator Tiers</p>',
            tierCard({
                id: 'affiliate', icon: '<img src="/Affiliate%20BLUE.png" alt="" class="w-full h-full object-contain" />', name: 'Affiliate', split: '80/20',
                status: affiliateStatus.label, statusColor: affiliateStatus.color,
                reqsHtml: [
                    reqRow('Upload 25 unique cards', aReqs.cards_uploaded.current, aReqs.cards_uploaded.required, aReqs.cards_uploaded.met),
                    reqRow('5 different collectors', aReqs.unique_collectors.current, aReqs.unique_collectors.required, aReqs.unique_collectors.met),
                    reqRow('150+ cards purchased for 2 consecutive months', aReqs.qualifying_months.current, aReqs.qualifying_months.required, aReqs.qualifying_months.met, ' mo'),
                ].join(''),
                monthStatsHtml: affiliateMonths.map(monthBar).join(''),
                perks: affiliatePerks, locked: false,
            }),
            tierCard({
                id: 'partner', icon: '<img src="/Partner%20BLUE.png" alt="" class="w-full h-full object-contain" />', name: 'Partner', split: '90/10',
                status: data.partner.locked ? '' : partnerStatus.label, statusColor: partnerStatus.color,
                reqsHtml: [
                    reqRow('Upload 75 unique cards', pReqs.cards_uploaded.current, pReqs.cards_uploaded.required, pReqs.cards_uploaded.met),
                    reqRow('20 different collectors', pReqs.unique_collectors.current, pReqs.unique_collectors.required, pReqs.unique_collectors.met),
                    reqRow('500+ cards purchased for 3 consecutive months', pReqs.qualifying_months.current, pReqs.qualifying_months.required, pReqs.qualifying_months.met, ' mo'),
                ].join(''),
                monthStatsHtml: partnerMonths.map(monthBar).join(''),
                perks: partnerPerks, locked: !!data.partner.locked,
            }),
            achievementsHtml ? '<p class="text-[9px] font-black uppercase tracking-widest text-void-muted pt-2">Achievements</p>' : '',
            achievementsHtml,
        ].join('');

        if (data.current_tier !== 'base') toggleTierSection(data.current_tier);

    } catch (e) {
        console.error('[CreatorProgress]', e);
        if (loading) loading.classList.add('hidden');
        if (content) {
            content.classList.remove('hidden');
            content.innerHTML = '<div class="glass-card py-10 text-center text-void-muted text-xs">Failed to load creator progress.</div>';
        }
    }
}

function toggleTierSection(id) {
    const body = document.getElementById(`tier-body-${id}`);
    const chevron = document.querySelector(`.tier-chevron-${id}`);
    if (!body) return;
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

async function openStripeOnboardingLink() {
    try {
        showToast('Opening Stripe…', 'info');
        const res = await apiFetch(`${BACKEND_URL}/api/creator/stripe/onboarding-link`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not start verification');
        if (data.url) window.location.href = data.url;
    } catch (e) {
        console.error('[Stripe] Onboarding link failed', e);
        showToast(e.message || 'Verification link failed', 'error');
    }
}

async function disconnectStripeFromChannel() {
    if (!confirm('Disconnect Stripe from this channel? Pack purchases will be disabled until you connect again.')) return;
    try {
        showToast('Removing Stripe link…', 'info');
        const res = await apiFetch(`${BACKEND_URL}/api/creator/stripe/disconnect`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not disconnect Stripe');
        showToast('Stripe disconnected', 'success');
        await hydrateCreatorStreamerFromProfile();
        await loadStripeStatus();
    } catch (e) {
        console.error('[Stripe] Disconnect failed', e);
        showToast(e.message || 'Disconnect failed', 'error');
    }
}

async function startStripeOnboarding() {
    try {
        const countryEl = document.getElementById('stripe-connect-country');
        const country = (countryEl && countryEl.value) ? countryEl.value.trim().toUpperCase() : '';
        if (!country) {
            showToast('Please select your country or region', 'error');
            return;
        }

        const btn = event?.currentTarget;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="bx bx-loader-circle bx-spin"></i> Generating Link...';
        }

        showToast('Connecting Stripe…', 'info');
        const res = await apiFetch(`${BACKEND_URL}/api/creator/stripe/onboarding`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to connect Stripe');

        if (data.url) {
            window.location.href = data.url;
            return;
        }

        if (data.deferred) {
            showToast(data.message || 'Stripe connected — pack sales enabled.', 'success');
            await hydrateCreatorStreamerFromProfile();
            await loadStripeStatus();
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bx bxl-stripe text-2xl"></i> Connect with Stripe';
            }
            return;
        }
    } catch (e) {
        console.error('[Stripe] Onboarding failed', e);
        showToast(e.message, 'error');

        const btn = document.querySelector('#stripe-onboarding-section button');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bx bxl-stripe text-2xl"></i> Connect with Stripe';
        }
    }
}

function cpCardOptionsHtml(cardList, selectedId) {
    const sel = selectedId != null && selectedId !== '' ? String(selectedId) : '';
    let html = '<option value="">Pick a card</option>';
    (cardList || []).forEach((c) => {
        if (!c || !c.id) return;
        const id = String(c.id);
        const opt = `<option value="${escapeHTML(id)}"${sel === id ? ' selected' : ''}>${escapeHTML(c.name || '')} (${escapeHTML(c.rarity || '')})</option>`;
        html += opt;
    });
    return html;
}

function wireCpHexColorSync(colorId, hexId) {
    const color = document.getElementById(colorId);
    const hex = document.getElementById(hexId);
    if (!color || !hex) return;
    hex.oninput = () => {
        let h = (hex.value || '').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
        hex.value = h;
        if (h.length === 6) {
            try {
                color.value = `#${h}`;
            } catch (_) { /* ignore */ }
        }
    };
    color.oninput = () => {
        const h = (color.value || '').replace('#', '').toUpperCase();
        if (h.length === 6) hex.value = h;
    };
}

function resetCpRewardVisualDefaults(prefix) {
    const hx = prefix === 'cp-pack' ? '9146FF' : '00E5CB';
    const hexEl = document.getElementById(`${prefix}-bg-hex`);
    const colorEl = document.getElementById(`${prefix}-bg-color`);
    if (hexEl) hexEl.value = hx;
    if (colorEl) {
        try {
            colorEl.value = `#${hx}`;
        } catch (_) { /* ignore */ }
    }
    const en = document.getElementById(`${prefix}-enabled`);
    const paused = document.getElementById(`${prefix}-paused`);
    const skip = document.getElementById(`${prefix}-skip-queue`);
    if (en) en.checked = true;
    if (paused) paused.checked = false;
    if (skip) skip.checked = true;
}

function applyHelixRewardToCpForm(prefix, r) {
    if (!r) return;
    const title = document.getElementById(`${prefix}-title`);
    const cost = document.getElementById(`${prefix}-cost`);
    if (title && r.title != null) title.value = String(r.title);
    if (cost && r.cost != null) cost.value = String(r.cost);

    let hx = String(r.background_color || '').replace(/^#/, '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(hx)) hx = prefix === 'cp-pack' ? '9146FF' : '00E5CB';
    const hexEl = document.getElementById(`${prefix}-bg-hex`);
    const colorEl = document.getElementById(`${prefix}-bg-color`);
    if (hexEl) hexEl.value = hx;
    if (colorEl) {
        try {
            colorEl.value = `#${hx}`;
        } catch (_) { /* ignore */ }
    }

    if (prefix === 'cp-pack') {
        const once = document.getElementById('cp-pack-once-stream');
        const userIn = document.getElementById('cp-pack-user-input');
        const cdOn = document.getElementById('cp-pack-cooldown-on');
        const cdSec = document.getElementById('cp-pack-cooldown-sec');
        if (once) once.checked = !!r.is_max_per_stream_enabled;
        if (userIn) userIn.checked = !!r.is_user_input_required;
        if (cdOn) cdOn.checked = !!r.is_global_cooldown_enabled;
        if (cdSec && r.global_cooldown_seconds != null) cdSec.value = String(r.global_cooldown_seconds);
    }

    const en = document.getElementById(`${prefix}-enabled`);
    const paused = document.getElementById(`${prefix}-paused`);
    const skip = document.getElementById(`${prefix}-skip-queue`);
    if (en) en.checked = r.is_enabled !== false;
    if (paused) paused.checked = !!r.is_paused;
    if (skip) skip.checked = r.should_redemptions_skip_request_queue !== false;
}

function collectCpPackRewardPayload() {
    const title = (document.getElementById('cp-pack-title') && document.getElementById('cp-pack-title').value.trim()) || 'Open a Card Pack';
    const cost = parseInt((document.getElementById('cp-pack-cost') || {}).value || '500', 10) || 500;
    const once = document.getElementById('cp-pack-once-stream') && document.getElementById('cp-pack-once-stream').checked;
    const userIn = document.getElementById('cp-pack-user-input') && document.getElementById('cp-pack-user-input').checked;
    const cdOn = document.getElementById('cp-pack-cooldown-on') && document.getElementById('cp-pack-cooldown-on').checked;
    const cdSec = parseInt((document.getElementById('cp-pack-cooldown-sec') || {}).value || '60', 10) || 60;
    let hx = ((document.getElementById('cp-pack-bg-hex') || {}).value || '9146FF').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
    const background_color = hx.length === 6 ? `#${hx}` : '#9146FF';
    const body = {
        title,
        cost,
        is_max_per_stream_enabled: once,
        max_per_stream: 1,
        is_max_per_user_per_stream_enabled: false,
        max_per_user_per_stream: 1,
        is_user_input_required: userIn,
        is_global_cooldown_enabled: cdOn,
        global_cooldown_seconds: cdOn ? cdSec : 60,
        background_color,
        is_enabled: !!(document.getElementById('cp-pack-enabled') && document.getElementById('cp-pack-enabled').checked),
        is_paused: !!(document.getElementById('cp-pack-paused') && document.getElementById('cp-pack-paused').checked),
        should_redemptions_skip_request_queue: !!(document.getElementById('cp-pack-skip-queue') && document.getElementById('cp-pack-skip-queue').checked),
    };
    return body;
}

function collectCpBattleRewardPayload() {
    const title = (document.getElementById('cp-battle-title') && document.getElementById('cp-battle-title').value.trim()) || 'Start a battle';
    const cost = parseInt((document.getElementById('cp-battle-cost') || {}).value || '200', 10) || 200;
    let hx = ((document.getElementById('cp-battle-bg-hex') || {}).value || '00E5CB').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
    const background_color = hx.length === 6 ? `#${hx}` : '#00E5CB';
    const body = {
        title,
        cost,
        is_max_per_stream_enabled: false,
        max_per_stream: 1,
        is_max_per_user_per_stream_enabled: false,
        max_per_user_per_stream: 1,
        is_global_cooldown_enabled: false,
        global_cooldown_seconds: 60,
        background_color,
        is_enabled: !!(document.getElementById('cp-battle-enabled') && document.getElementById('cp-battle-enabled').checked),
        is_paused: !!(document.getElementById('cp-battle-paused') && document.getElementById('cp-battle-paused').checked),
        should_redemptions_skip_request_queue: !!(document.getElementById('cp-battle-skip-queue') && document.getElementById('cp-battle-skip-queue').checked),
    };
    return body;
}

function cpUpdateLinkedVisibilityToggleLabels() {
    const packRow = document.getElementById('cp-pack-linked-row');
    const packBtn = document.getElementById('btn-cp-pack-toggle-vis');
    const packEn = document.getElementById('cp-pack-enabled');
    if (packBtn && packRow && !packRow.classList.contains('hidden')) {
        packBtn.textContent = packEn && packEn.checked ? 'Hide from channel' : 'Show in channel';
    }
    const battleRow = document.getElementById('cp-battle-linked-row');
    const battleBtn = document.getElementById('btn-cp-battle-toggle-vis');
    const battleEn = document.getElementById('cp-battle-enabled');
    if (battleBtn && battleRow && !battleRow.classList.contains('hidden')) {
        battleBtn.textContent = battleEn && battleEn.checked ? 'Hide from channel' : 'Show in channel';
    }
}

async function loadChannelPointsTab() {
    if (!csrfToken) {
        try {
            const r = await apiFetch(`${BACKEND_URL}/api/csrf`, { credentials: 'include' });
            const d = await r.json().catch(() => ({}));
            if (d.token) csrfToken = d.token;
        } catch (_) { /* ignore */ }
    }

    const [stRes, mapRes, cardsRes, cpHelixRes, tsRes] = await Promise.all([
        apiFetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' }),
        apiFetch(`${BACKEND_URL}/api/creator/channel-point-fixed-cards`, { credentials: 'include' }),
        apiFetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' }),
        apiFetch(`${BACKEND_URL}/api/creator/twitch/custom-rewards`, { credentials: 'include' }),
        apiFetch(`${BACKEND_URL}/api/auth/twitch-status`, { credentials: 'include' }),
    ]);

    const cpBanner = document.getElementById('cp-twitch-banner');
    const cpBannerText = document.getElementById('cp-twitch-banner-text');
    const cpReconnect = document.getElementById('cp-twitch-reconnect');
    if (cpBanner) {
        let show = false;
        let msg = '';
        if (tsRes && tsRes.ok) {
            try {
                const ts = await tsRes.json();
                const tw = ts.twitch;
                if (tw && ts.auth_provider === 'twitch' && (tw.needs_reauth || !tw.token_valid)) {
                    show = true;
                    const missing = Array.isArray(tw.scopes_missing) && tw.scopes_missing.length
                        ? ` Missing scopes: ${tw.scopes_missing.join(', ')}.`
                        : '';
                    if (Array.isArray(tw.scopes_missing) && tw.scopes_missing.some((s) => String(s).includes('redemptions'))) {
                        msg = `Twitch needs Channel Points permissions to create or update rewards here.${missing}`;
                    } else if (tw.token_error === 'no_twitch_token') {
                        msg = 'Sign in with Twitch (creator) to manage Channel Points rewards.';
                    } else {
                        msg = `Your Twitch login may be expired or revoked. Reconnect to fix “OAuth” errors from Twitch.${missing}`;
                    }
                }
            } catch (_) { /* ignore */ }
        }
        if (show) {
            cpBanner.classList.remove('hidden');
            if (cpBannerText) cpBannerText.textContent = msg;
            if (cpReconnect) cpReconnect.href = `${BACKEND_URL}/auth/twitch?role=creator&reauth=1`;
        } else {
            cpBanner.classList.add('hidden');
        }
    }

    let packId = '';
    let battleId = '';
    if (stRes.ok) {
        const st = await stRes.json().catch(() => ({}));
        packId = st.twitch_reward_id || '';
        battleId = st.twitch_battle_reward_id || '';
    }
    const packSpan = document.getElementById('cp-display-pack-id');
    const battleSpan = document.getElementById('cp-display-battle-id');
    if (packSpan) packSpan.textContent = packId || '—';
    if (battleSpan) battleSpan.textContent = battleId || '—';

    const packLinked = document.getElementById('cp-pack-linked-row');
    const battleLinked = document.getElementById('cp-battle-linked-row');
    if (packLinked) {
        if (packId) packLinked.classList.remove('hidden');
        else packLinked.classList.add('hidden');
    }
    if (battleLinked) {
        if (battleId) battleLinked.classList.remove('hidden');
        else battleLinked.classList.add('hidden');
    }

    const helixById = {};
    if (cpHelixRes && cpHelixRes.ok) {
        try {
            const crj = await cpHelixRes.json();
            (crj.rewards || []).forEach((rw) => {
                if (rw && rw.id) helixById[rw.id] = rw;
            });
        } catch (_) { /* ignore */ }
    }

    if (packId && helixById[packId]) applyHelixRewardToCpForm('cp-pack', helixById[packId]);
    else resetCpRewardVisualDefaults('cp-pack');

    if (battleId && helixById[battleId]) applyHelixRewardToCpForm('cp-battle', helixById[battleId]);
    else resetCpRewardVisualDefaults('cp-battle');

    wireCpHexColorSync('cp-pack-bg-color', 'cp-pack-bg-hex');
    wireCpHexColorSync('cp-battle-bg-color', 'cp-battle-bg-hex');

    let definitions = [];
    let mappings = [];
    if (mapRes.ok) {
        const j = await mapRes.json().catch(() => ({}));
        if (Array.isArray(j)) mappings = j;
        else {
            definitions = j.definitions || [];
            mappings = j.mappings || [];
        }
    }

    const rawCards = cardsRes.ok ? await cardsRes.json().catch(() => []) : [];
    const cardList = Array.isArray(rawCards) ? rawCards : rawCards.cards || [];

    const customSel = document.getElementById('cp-custom-card-id');
    if (customSel) customSel.innerHTML = cpCardOptionsHtml(cardList, '');

    renderCpPresetSlots(definitions, mappings, cardList, helixById);
    renderCpCustomFixedList(mappings);

    const btnPack = document.getElementById('btn-cp-create-pack');
    if (btnPack) btnPack.onclick = () => createCpPackReward();
    const btnBattle = document.getElementById('btn-cp-create-battle');
    if (btnBattle) btnBattle.onclick = () => createCpBattleReward();
    const btnPackToggle = document.getElementById('btn-cp-pack-toggle-vis');
    const btnPackDel = document.getElementById('btn-cp-pack-delete');
    if (btnPackToggle) {
        btnPackToggle.onclick = () => {
            const en = document.getElementById('cp-pack-enabled');
            const next = !(en && en.checked);
            cpQuickRewardState('pack', { is_enabled: next });
        };
    }
    if (btnPackDel) btnPackDel.onclick = () => cpDeleteLinkedReward('pack');
    const btnBattleToggle = document.getElementById('btn-cp-battle-toggle-vis');
    const btnBattleDel = document.getElementById('btn-cp-battle-delete');
    if (btnBattleToggle) {
        btnBattleToggle.onclick = () => {
            const en = document.getElementById('cp-battle-enabled');
            const next = !(en && en.checked);
            cpQuickRewardState('battle', { is_enabled: next });
        };
    }
    if (btnBattleDel) btnBattleDel.onclick = () => cpDeleteLinkedReward('battle');

    cpUpdateLinkedVisibilityToggleLabels();
    const btnCustom = document.getElementById('btn-cp-custom-add');
    if (btnCustom) btnCustom.onclick = () => addCpCustomFixed();
}

async function cpQuickRewardState(kind, patch) {
    const span = document.getElementById(kind === 'pack' ? 'cp-display-pack-id' : 'cp-display-battle-id');
    const pre = kind === 'pack' ? 'cp-pack' : 'cp-battle';
    const rid = span && span.textContent && span.textContent.trim() !== '—' ? span.textContent.trim() : '';
    if (!rid) {
        showToast('No reward linked yet', 'error');
        return;
    }
    showToast('Updating…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/twitch/custom-reward-state`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reward_id: rid, ...patch }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        const en = document.getElementById(`${pre}-enabled`);
        if (en && typeof patch.is_enabled === 'boolean') en.checked = patch.is_enabled;
        showToast('Updated on Twitch', 'success');
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

async function cpDeleteLinkedReward(kind) {
    const span = document.getElementById(kind === 'pack' ? 'cp-display-pack-id' : 'cp-display-battle-id');
    const rid = span && span.textContent && span.textContent.trim() !== '—' ? span.textContent.trim() : '';
    if (!rid) return;
    const msg =
        kind === 'pack'
            ? 'Delete this pack reward on Twitch and unlink it from Castle? You can create a new one after.'
            : 'Delete this battle reward on Twitch and unlink it?';
    if (!confirm(msg)) return;
    showToast('Deleting…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/twitch/custom-reward-delete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reward_id: rid, unlink: kind }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        showToast('Reward deleted', 'success');
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

function cpFixedCardName(m) {
    const c = m && m.cards;
    if (!c) return 'Card';
    if (Array.isArray(c)) return (c[0] && c[0].name) || 'Card';
    return c.name || 'Card';
}

function renderCpCustomFixedList(mappings) {
    const root = document.getElementById('cp-custom-fixed-list');
    if (!root) return;
    const rows = (mappings || []).filter((m) => m && !m.preset_key);
    if (!rows.length) {
        root.innerHTML = '<p class="text-[10px] text-void-muted">No custom reward links yet.</p>';
        return;
    }
    root.innerHTML = rows
        .map((m) => {
            const id = escapeHTML(String(m.id || ''));
            const name = escapeHTML(cpFixedCardName(m));
            const ridShort = escapeHTML(String(m.twitch_reward_id || '').slice(0, 10));
            return `<div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/10" data-cp-fixed-id="${id}">
      <div class="min-w-0 text-xs">
        <span class="font-bold text-white">${name}</span>
        <span class="text-void-muted font-mono text-[10px] ml-2">${ridShort}…</span>
      </div>
      <div class="flex flex-wrap gap-1.5 shrink-0">
        <button type="button" class="cp-fixed-remove px-2.5 py-1.5 rounded-lg bg-white/5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 border border-white/10">Unlink</button>
        <button type="button" class="cp-fixed-delete-twitch px-2.5 py-1.5 rounded-lg border border-red-500/35 text-[10px] font-black uppercase tracking-widest text-red-300/95 hover:bg-red-500/10">Twitch delete</button>
      </div>
    </div>`;
        })
        .join('');

    root.querySelectorAll('[data-cp-fixed-id]').forEach((row) => {
        const id = row.getAttribute('data-cp-fixed-id');
        const rm = row.querySelector('.cp-fixed-remove');
        const dt = row.querySelector('.cp-fixed-delete-twitch');
        if (rm && id) {
            rm.onclick = () => removeCpFixedRow(id, false);
        }
        if (dt && id) {
            dt.onclick = () => removeCpFixedRow(id, true);
        }
    });
}

async function removeCpFixedRow(rowId, deleteTwitch) {
    if (!rowId) return;
    if (deleteTwitch) {
        if (!confirm('Delete this reward on Twitch and remove the link?')) return;
    } else if (!confirm('Remove this link from Castle? (Reward stays on Twitch.)')) return;
    showToast(deleteTwitch ? 'Deleting…' : 'Removing…', 'loading');
    try {
        const q = deleteTwitch ? '?delete_twitch=1' : '';
        const res = await apiFetch(
            `${BACKEND_URL}/api/creator/channel-point-fixed-cards/${encodeURIComponent(rowId)}${q}`,
            { method: 'DELETE', credentials: 'include' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        showToast(deleteTwitch ? 'Removed from Twitch' : 'Link removed', 'success');
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

async function deleteCpPresetSlot(key) {
    if (!key) return;
    if (!confirm('Delete this preset’s reward on Twitch and remove it from Castle?')) return;
    showToast('Deleting…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/channel-point-preset`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset_key: key, action: 'delete' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        showToast('Preset removed', 'success');
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

function hydrateCpPresetWrapFromHelix(wrap, r) {
    if (!wrap || !r) return;
    const hxEl = wrap.querySelector('.cp-pr-bg-hex');
    const cEl = wrap.querySelector('.cp-pr-bg-color');
    let h = String(r.background_color || '').replace(/^#/, '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(h)) h = '9146FF';
    if (hxEl) hxEl.value = h;
    if (cEl) {
        try {
            cEl.value = `#${h}`;
        } catch (_) { /* ignore */ }
    }
    const vis = wrap.querySelector('.cp-pr-visible');
    const pa = wrap.querySelector('.cp-pr-paused');
    const sk = wrap.querySelector('.cp-pr-skip-q');
    if (vis) vis.checked = r.is_enabled !== false;
    if (pa) pa.checked = !!r.is_paused;
    if (sk) sk.checked = r.should_redemptions_skip_request_queue !== false;
    const titleIn = wrap.querySelector('.cp-pr-title');
    const costIn = wrap.querySelector('.cp-pr-cost');
    if (titleIn && r.title != null) titleIn.value = String(r.title);
    if (costIn && r.cost != null) costIn.value = String(r.cost);
}

function renderCpPresetSlots(definitions, mappings, cardList, helixById) {
    const root = document.getElementById('cp-presets-container');
    helixById = helixById || {};
    if (!root) return;
    if (!definitions.length) {
        root.innerHTML = '<p class="text-xs text-void-muted">Nothing to show.</p>';
        return;
    }
    const byKey = {};
    (mappings || []).forEach((m) => {
        if (m && m.preset_key) byKey[m.preset_key] = m;
    });

    root.innerHTML = definitions
        .map((def) => {
            const m = byKey[def.key];
            const on = !!(m && m.is_enabled && m.twitch_reward_id);
            const cardId = m && m.card_id ? String(m.card_id) : '';
            const titleVal = escapeHTML((m && m.label) || def.default_title || def.label);
            const costVal = def.default_cost != null ? def.default_cost : 1;
            const showOv = m && m.hide_from_overlay === false;
            return `
<div class="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5 h-full flex flex-col" data-cp-preset="${escapeHTML(def.key)}">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <span class="font-bold text-white text-sm">${escapeHTML(def.label)}</span>
    <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-void-muted cursor-pointer">
      <span>On</span>
      <div class="saas-toggle shrink-0"><input type="checkbox" class="cp-pr-on" ${on ? 'checked' : ''} /><span class="slider"></span></div>
    </label>
  </div>
  <select class="cp-pr-card w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-void-accent/40 appearance-none cursor-pointer">${cpCardOptionsHtml(cardList, cardId)}</select>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <input type="text" class="cp-pr-title w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-void-accent/40" maxlength="45" value="${titleVal}" placeholder="Title" />
    <input type="number" class="cp-pr-cost w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-void-accent/40" min="1" value="${costVal}" />
  </div>
  <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-void-accent/30 transition-all">
    <span class="text-sm font-bold text-white">Overlay</span>
    <div class="saas-toggle shrink-0"><input type="checkbox" class="cp-pr-overlay" ${showOv ? 'checked' : ''} /><span class="slider"></span></div>
  </label>
  <details class="rounded-lg border border-white/8 bg-white/[0.02] text-left">
    <summary class="cursor-pointer list-none px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-void-muted hover:text-white [&::-webkit-details-marker]:hidden">Twitch look &amp; behavior</summary>
    <div class="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-white/5">
      <div class="flex h-11 min-h-11 box-border items-center gap-2 px-2 rounded-2xl bg-white/[0.03] border border-white/5">
        <input type="color" class="cp-pr-bg-color h-9 w-10 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer" value="#9146FF" />
        <div class="flex flex-1 min-w-0 items-center gap-1 border-l border-white/10 pl-2">
          <span class="text-xs font-mono text-void-muted/30 shrink-0">#</span>
          <input type="text" class="cp-pr-bg-hex bg-transparent border-none p-0 w-full min-w-0 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:ring-0" maxlength="6" value="9146FF" placeholder="HEX" />
        </div>
      </div>
      <p class="text-[9px] text-void-muted/80 px-0.5">Reward icon: set in Twitch Creator Dashboard if needed.</p>
      <div class="space-y-1.5">
        <label class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-void-accent/30 transition-all">
          <span class="text-xs font-bold text-white">Listed in Channel Points</span>
          <div class="saas-toggle shrink-0 scale-90 origin-right"><input type="checkbox" class="cp-pr-visible" checked /><span class="slider"></span></div>
        </label>
        <label class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-void-accent/30 transition-all">
          <span class="text-xs font-bold text-white">Paused</span>
          <div class="saas-toggle shrink-0 scale-90 origin-right"><input type="checkbox" class="cp-pr-paused" /><span class="slider"></span></div>
        </label>
        <label class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-void-accent/30 transition-all">
          <span class="text-xs font-bold text-white">Auto-fulfill</span>
          <div class="saas-toggle shrink-0 scale-90 origin-right"><input type="checkbox" class="cp-pr-skip-q" checked /><span class="slider"></span></div>
        </label>
      </div>
    </div>
  </details>
  <div class="flex flex-col gap-2 mt-auto pt-1">
  ${
      m && m.twitch_reward_id
          ? `<button type="button" class="cp-pr-delete w-full py-2 rounded-lg border border-red-500/35 text-[10px] font-black uppercase tracking-widest text-red-300/90 hover:bg-red-500/10">Delete preset</button>`
          : ''
  }
  <button type="button" class="cp-pr-save w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10">Save</button>
  </div>
</div>`;
        })
        .join('');

    root.querySelectorAll('[data-cp-preset]').forEach((wrap) => {
        const key = wrap.getAttribute('data-cp-preset');
        const m = key ? byKey[key] : null;
        const rid = m && m.twitch_reward_id;
        if (rid && helixById[rid]) hydrateCpPresetWrapFromHelix(wrap, helixById[rid]);

        const c = wrap.querySelector('.cp-pr-bg-color');
        const hx = wrap.querySelector('.cp-pr-bg-hex');
        if (c && hx) {
            hx.addEventListener('input', () => {
                let t = (hx.value || '').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
                hx.value = t;
                if (t.length === 6) {
                    try {
                        c.value = `#${t}`;
                    } catch (_) { /* ignore */ }
                }
            });
            c.addEventListener('input', () => {
                const t = (c.value || '').replace('#', '').toUpperCase();
                if (t.length === 6) hx.value = t;
            });
        }

        const delBtn = wrap.querySelector('.cp-pr-delete');
        if (delBtn && key) delBtn.onclick = () => deleteCpPresetSlot(key);

        const save = wrap.querySelector('.cp-pr-save');
        if (save && key) save.onclick = () => saveCpPresetSlot(key, wrap);
    });
}

async function saveCpPresetSlot(key, wrap) {
    const on = wrap.querySelector('.cp-pr-on') && wrap.querySelector('.cp-pr-on').checked;
    const cardId = (wrap.querySelector('.cp-pr-card') && wrap.querySelector('.cp-pr-card').value) || '';
    const title = (wrap.querySelector('.cp-pr-title') && wrap.querySelector('.cp-pr-title').value.trim()) || '';
    const cost = parseInt((wrap.querySelector('.cp-pr-cost') && wrap.querySelector('.cp-pr-cost').value) || '1', 10) || 1;
    const showOverlay = wrap.querySelector('.cp-pr-overlay') && wrap.querySelector('.cp-pr-overlay').checked;

    if (on && !cardId) {
        showToast('Pick a card', 'error');
        return;
    }

    let hx = ((wrap.querySelector('.cp-pr-bg-hex') && wrap.querySelector('.cp-pr-bg-hex').value) || '9146FF')
        .replace(/[^0-9A-Fa-f]/g, '')
        .slice(0, 6)
        .toUpperCase();
    const background_color = hx.length === 6 ? `#${hx}` : '#9146FF';
    const reward = {
        title: title || undefined,
        cost,
        background_color,
        is_enabled: !!(wrap.querySelector('.cp-pr-visible') && wrap.querySelector('.cp-pr-visible').checked),
        is_paused: !!(wrap.querySelector('.cp-pr-paused') && wrap.querySelector('.cp-pr-paused').checked),
        should_redemptions_skip_request_queue: !!(wrap.querySelector('.cp-pr-skip-q') && wrap.querySelector('.cp-pr-skip-q').checked),
    };

    showToast('Saving…', 'loading');
    try {
        const body = on
            ? {
                  preset_key: key,
                  enabled: true,
                  card_id: cardId,
                  hide_from_overlay: !showOverlay,
                  reward,
              }
            : { preset_key: key, enabled: false };

        const res = await apiFetch(`${BACKEND_URL}/api/creator/channel-point-preset`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        showToast(on ? 'Saved' : 'Turned off', 'success');
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Error', 'error');
    }
}

async function createCpPackReward() {
    const body = collectCpPackRewardPayload();
    const span = document.getElementById('cp-display-pack-id');
    const existing = (span && span.textContent && span.textContent.trim() !== '—' && span.textContent.trim()) || '';
    if (existing) body.update_reward_id = existing;
    else body.assign_as = 'pack';

    showToast(existing ? 'Updating…' : 'Creating…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/twitch/channel-reward`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Twitch said no');
        showToast(data.updated ? 'Pack reward updated' : 'Pack reward set', 'success');
        if (span) span.textContent = data.reward_id || existing || '—';
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

async function createCpBattleReward() {
    const body = collectCpBattleRewardPayload();
    const span = document.getElementById('cp-display-battle-id');
    const existing = (span && span.textContent && span.textContent.trim() !== '—' && span.textContent.trim()) || '';
    if (existing) body.update_reward_id = existing;
    else body.assign_as = 'battle';

    showToast(existing ? 'Updating…' : 'Creating…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/twitch/channel-reward`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Twitch said no');
        showToast(data.updated ? 'Battle reward updated' : 'Battle reward set', 'success');
        if (span) span.textContent = data.reward_id || existing || '—';
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

async function addCpCustomFixed() {
    const rid = (document.getElementById('cp-custom-reward-id') && document.getElementById('cp-custom-reward-id').value.trim()) || '';
    const cid = (document.getElementById('cp-custom-card-id') && document.getElementById('cp-custom-card-id').value) || '';
    const showOv = document.getElementById('cp-custom-show-overlay') && document.getElementById('cp-custom-show-overlay').checked;
    if (!rid || !cid) {
        showToast('Need reward ID and card', 'error');
        return;
    }
    showToast('Adding…', 'loading');
    try {
        const res = await apiFetch(`${BACKEND_URL}/api/creator/channel-point-fixed-cards`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                twitch_reward_id: rid,
                card_id: cid,
                hide_from_overlay: !showOv,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Failed');
        showToast('Added', 'success');
        const input = document.getElementById('cp-custom-reward-id');
        if (input) input.value = '';
        await loadChannelPointsTab();
    } catch (e) {
        showToast(e.message || 'Failed', 'error');
    }
}

// ── Dashboard Search ────────────────────────────────────────────────────────

const DASH_SEARCH_INDEX = [
    // Creator Dashboard
    { section: 'dashboard', tab: 'analytics',     label: 'Analytics',       desc: 'Pack openings, collectors, battles & revenue', icon: 'bx-line-chart',   keywords: ['analytics','stats','packs','revenue','collectors','chart','battles'] },
    { section: 'dashboard', tab: 'monetization',  label: 'Monetization',    desc: 'Earnings and revenue management',               icon: 'bx-dollar',       keywords: ['monetization','earnings','revenue','money'] },
    { section: 'dashboard', tab: 'admin',          label: 'Admin Panel',     desc: 'User management and moderation',                icon: 'bxs-shield',      keywords: ['admin','moderation','users','ban','manage'] },
    { section: 'dashboard', tab: 'activity-log',  label: 'Activity Log',    desc: 'Recent events and channel activity',            icon: 'bxs-bolt',        keywords: ['activity','log','events','history','recent'] },
    { section: 'dashboard', tab: 'achievements',  label: 'Achievements',    desc: 'Channel achievements and milestones',            icon: 'bxs-trophy',      keywords: ['achievements','trophies','badges','milestones'] },
    { section: 'dashboard', tab: 'platforms',     label: 'Link Platforms',  desc: 'Connect Twitch, Kick and other platforms',      icon: 'bx-link-alt',     keywords: ['platforms','twitch','kick','link','connect','accounts'] },
    { section: 'dashboard', tab: 'settings',      label: 'Settings',        desc: 'Channel settings and preferences',              icon: 'bxs-cog',         keywords: ['settings','preferences','config','channel'] },
    // Card Studio
    { section: 'card-studio', tab: 'cards',       label: 'Cards',           desc: 'Upload and manage your cards',                  icon: 'bxs-id-card',     keywords: ['cards','collection','upload','manage'] },
    { section: 'card-studio', tab: 'sets',        label: 'Sets',            desc: 'Manage card sets and series',                   icon: 'bxs-layer',       keywords: ['sets','series','packs','collection'] },
    { section: 'card-studio', tab: 'promo',       label: 'Promo Codes',     desc: 'Promotional codes and campaigns',               icon: 'bxs-gift',        keywords: ['promo','codes','promotional','gift','campaign'] },
    { section: 'card-studio', tab: 'granting',    label: 'Granting',        desc: 'Grant cards to your viewers',                   icon: 'bxs-hand',        keywords: ['granting','give','grant','viewers','gift'] },
    // Stream Features
    { section: 'stream-features', tab: 'overlay',         label: 'Overlays',        desc: 'OBS overlays and stream widgets',           icon: 'bxs-layer',   keywords: ['overlay','obs','stream','widget','browser source'] },
    { section: 'stream-features', tab: 'queue',           label: 'Queue System',    desc: 'Battle queue and queue management',         icon: 'bxs-detail',  keywords: ['queue','battle','system','manage'] },
    { section: 'stream-features', tab: 'battle-settings', label: 'Battle Settings', desc: 'Configure battle rules and game settings',  icon: 'bx-joystick', keywords: ['battle','settings','rules','game','pvp'] },
    { section: 'stream-features', tab: 'channel-points',  label: 'Channel Points',  desc: 'Twitch & Kick channel point rewards',       icon: 'bxs-coin',    keywords: ['channel points','rewards','twitch','kick','points'] },
];

const DASH_SEARCH_SECTION_LABELS = {
    'dashboard':       'Creator Dashboard',
    'card-studio':     'Card Studio',
    'stream-features': 'Stream Features',
};

let dashSearchActiveIdx = -1;
let dashSearchVisible = [];

function initDashSearch() {
    const input   = document.getElementById('dash-search-input');
    const results = document.getElementById('dash-search-results');
    const kbd     = document.getElementById('dash-search-kbd');
    if (!input || !results) return;

    // ⌘K / Ctrl+K global shortcut
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
        }
        if (e.key === 'Escape' && document.activeElement === input) {
            closeDashSearch();
            input.blur();
        }
    });

    input.addEventListener('focus', () => {
        if (kbd) kbd.style.display = 'none';
        renderDashSearch(input.value);
    });

    input.addEventListener('blur', () => {
        // Delay so click on result fires first
        setTimeout(() => {
            closeDashSearch();
            if (kbd && !input.value) kbd.style.display = '';
        }, 150);
    });

    input.addEventListener('input', () => {
        dashSearchActiveIdx = -1;
        renderDashSearch(input.value);
    });

    input.addEventListener('keydown', e => {
        if (results.style.display !== 'none') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                dashSearchActiveIdx = Math.min(dashSearchActiveIdx + 1, dashSearchVisible.length - 1);
                updateDashSearchActive(results);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                dashSearchActiveIdx = Math.max(dashSearchActiveIdx - 1, 0);
                updateDashSearchActive(results);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = dashSearchVisible[dashSearchActiveIdx] ?? dashSearchVisible[0];
                if (item) navigateDashSearch(item, input);
            }
        }
    });
}

function renderDashSearch(query) {
    const input   = document.getElementById('dash-search-input');
    const results = document.getElementById('dash-search-results');
    if (!results) return;

    const q = query.trim().toLowerCase();
    const matches = q
        ? DASH_SEARCH_INDEX.filter(item =>
            item.label.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.keywords.some(k => k.includes(q))
          )
        : DASH_SEARCH_INDEX;

    dashSearchVisible = matches;
    dashSearchActiveIdx = matches.length > 0 ? 0 : -1;

    if (matches.length === 0) {
        results.innerHTML = `<div class="dash-search-empty">No results for "<strong>${escapeHTML(query)}</strong>"</div>`;
        results.style.display = '';
        input?.setAttribute('aria-expanded', 'true');
        return;
    }

    // Group by section
    const grouped = {};
    for (const item of matches) {
        (grouped[item.section] = grouped[item.section] || []).push(item);
    }

    let html = '';
    let flatIdx = 0;
    for (const [section, items] of Object.entries(grouped)) {
        html += `<div class="dash-search-section-header">${escapeHTML(DASH_SEARCH_SECTION_LABELS[section] || section)}</div>`;
        for (const item of items) {
            const isActive = flatIdx === dashSearchActiveIdx;
            html += `<div class="dash-search-result${isActive ? ' dash-search-result--active' : ''}" data-idx="${flatIdx}" role="option" aria-selected="${isActive}">
                <div class="dash-search-result-icon"><i class="bx ${escapeHTML(item.icon)}"></i></div>
                <div class="dash-search-result-text">
                    <div class="dash-search-result-name">${escapeHTML(item.label)}</div>
                    <div class="dash-search-result-desc">${escapeHTML(item.desc)}</div>
                </div>
            </div>`;
            flatIdx++;
        }
    }

    results.innerHTML = html;
    results.style.display = '';
    input?.setAttribute('aria-expanded', 'true');

    results.querySelectorAll('.dash-search-result').forEach(el => {
        el.addEventListener('mousedown', e => {
            e.preventDefault();
            const idx = parseInt(el.dataset.idx, 10);
            const item = dashSearchVisible[idx];
            if (item) navigateDashSearch(item, document.getElementById('dash-search-input'));
        });
        el.addEventListener('mouseover', () => {
            dashSearchActiveIdx = parseInt(el.dataset.idx, 10);
            updateDashSearchActive(results);
        });
    });
}

function updateDashSearchActive(results) {
    results.querySelectorAll('.dash-search-result').forEach((el, i) => {
        const active = i === dashSearchActiveIdx;
        el.classList.toggle('dash-search-result--active', active);
        el.setAttribute('aria-selected', String(active));
        if (active) el.scrollIntoView({ block: 'nearest' });
    });
}

function navigateDashSearch(item, input) {
    closeDashSearch();
    if (input) { input.value = ''; input.blur(); }
    switchSection(item.section);
    if (item.tab !== SECTIONS[item.section]?.default) {
        switchTab(item.tab);
    }
}

function closeDashSearch() {
    const results = document.getElementById('dash-search-results');
    const input   = document.getElementById('dash-search-input');
    if (results) results.style.display = 'none';
    if (input) input.setAttribute('aria-expanded', 'false');
    dashSearchActiveIdx = -1;
    dashSearchVisible = [];
}

document.addEventListener('DOMContentLoaded', initDashSearch);
