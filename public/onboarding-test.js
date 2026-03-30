/* public/onboarding-test.js
 * Playground / flow test only: no POSTs that persist onboarding, favorites, or activation.
 * Safe reads (status, follows) still hit the API so the UI can show real data when logged in.
 */

const API_BASE = `${window.location.origin}/api`;
let currentStep = 1;
let streamerData = null;
let collectorData = null;
let currentRole = null; // 'creator' or 'collector'
let csrfToken = null;
/** Favorites toggled during this session only (collector step 2); never POSTed from this page */
const testFlowFavoriteIds = new Set();

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[TEST MODE] Initializing onboarding playground...');
    await fetchCSRFToken();
    await checkStatus();

    const tosCheck = document.getElementById('tos-check');
    const tosError = document.getElementById('tos-error');
    if (tosCheck && tosError) {
        tosCheck.addEventListener('change', () => {
            if (tosCheck.checked) tosError.classList.add('hidden');
        });
    }
});

async function fetchCSRFToken() {
    try {
        const res = await fetch(`${API_BASE}/csrf`, {
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            csrfToken = data.token;
        }
    } catch (e) {
        console.error('CSRF token fetch failed:', e);
    }
}

async function checkStatus() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        currentRole = urlParams.get('role');

        const res = await fetch(`${API_BASE}/onboarding/status`, { credentials: 'include' });
        if (res.status === 401) {
            console.warn('[TEST MODE] User not logged in. In a real scenario, this would redirect to login.');
            // For testing, we might want to stay on the page or show a warning
            window.location.href = '/login';
            return;
        }

        const data = await res.json();
        streamerData = data.streamer;

        // Determine if they should be on collector or creator flow
        if (currentRole === 'collector') {
            await initCollectorOnboarding();
        } else if (currentRole === 'creator') {
            await initCreatorOnboarding(data);
        } else {
            // No role specified, show picker
            showRolePicker();
        }
    } catch (e) {
        console.error('Status check failed:', e);
        showRolePicker();
    }
}

function showRolePicker() {
    const rolePicker = document.getElementById('role-picker');
    const stepsContainer = document.getElementById('steps-container');
    const progressStepper = document.getElementById('progress-stepper');

    if (rolePicker) rolePicker.classList.remove('hidden');
    if (stepsContainer) stepsContainer.classList.add('hidden');
    if (progressStepper) progressStepper.classList.add('hidden');
}

function selectRole(role) {
    console.log('[TEST MODE] Selected role:', role);
    currentRole = role;
    const url = new URL(window.location);
    url.searchParams.set('role', role);
    window.history.pushState({}, '', url);

    document.getElementById('role-picker').classList.add('hidden');
    document.getElementById('steps-container').classList.remove('hidden');
    document.getElementById('progress-stepper').classList.remove('hidden');

    if (role === 'creator') {
        initCreatorOnboarding();
    } else {
        initCollectorOnboarding();
    }
}

async function initCreatorOnboarding(data) {
    document.getElementById('creator-steps').classList.remove('hidden');
    document.getElementById('collector-steps').classList.add('hidden');

    const headerRole = document.getElementById('header-role');
    if (headerRole) headerRole.textContent = 'Creator (TEST)';

    if (data && data.streamer) {
        streamerData = data.streamer;

        // Populate fields if they exist
        if (streamerData.brand_name) document.getElementById('brand-name').value = streamerData.brand_name;
        if (streamerData.binder_color) {
            document.getElementById('binder-color').value = streamerData.binder_color;
            document.getElementById('binder-color-hex').value = streamerData.binder_color;
        }
        if (streamerData.battles_enabled !== undefined) document.getElementById('toggle-battles').checked = streamerData.battles_enabled;
        if (streamerData.trading_enabled !== undefined) document.getElementById('toggle-trading').checked = streamerData.trading_enabled;
        if (streamerData.tos_accepted) document.getElementById('tos-check').checked = true;

        // Populate collection methods (only if they've been saved before)
        if (streamerData.collection_methods && Object.keys(streamerData.collection_methods).length > 0) {
            const methods = streamerData.collection_methods;
            document.querySelectorAll('input[name="method"]').forEach(input => {
                input.checked = !!methods[input.value];
            });
        }

        updateOBSLinks();
        showStep(streamerData.onboarding_step || 1, 'c');
    } else {
        showStep(1, 'c');
    }

    // Binder color sync and preview update
    const colorPicker = document.getElementById('binder-color');
    const colorHex = document.getElementById('binder-color-hex');
    const brandNameInput = document.getElementById('brand-name');
    const hueSlider = document.getElementById('hue-slider');
    
    // New preview elements
    const previewBinderItem = document.getElementById('preview-binder-item');
    const previewBinderName = document.getElementById('preview-binder-name');
    const previewSidebarBinder = document.getElementById('preview-sidebar-binder');
    const previewSidebarBinderName = document.getElementById('preview-sidebar-binder-name');
    const previewNavCollection = document.getElementById('preview-nav-collection');
    const previewShareCollectionName = document.getElementById('preview-share-collection-name');
    const previewAccentLogoShell = document.getElementById('preview-accent-logo-shell');
    const previewAccentWordmark = document.getElementById('preview-accent-wordmark');
    const previewAccentRole = document.getElementById('preview-accent-role');
    const previewAccentShareMark = document.getElementById('preview-accent-share-mark');
    const previewAccentTrophy = document.getElementById('preview-accent-trophy');

    const swatch = document.getElementById('color-preview-swatch');
    const popover = document.getElementById('void-picker-popover');
    const satValContainer = document.getElementById('sat-val-container');
    const satValPointer = document.getElementById('sat-val-pointer');
    const hueContainer = document.getElementById('hue-container');
    const huePointer = document.getElementById('hue-pointer');
    const pickerMiniSwatch = document.getElementById('picker-mini-swatch');
    const closePickerBtn = document.getElementById('close-picker');

    let currentH = 180, currentS = 100, currentV = 100;

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHsv(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0;
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }

    function hsvToHex(h, s, v) {
        s /= 100; v /= 100;
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r, g, b;
        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        const toHex = x => Math.round((x + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    function updateFromPicker() {
        const hex = hsvToHex(currentH, currentS, currentV);
        colorPicker.value = hex;
        colorHex.value = hex.replace('#', '');
        updatePreviewColor(hex);
        
        // Update picker UI
        if (satValContainer) satValContainer.style.backgroundColor = hsvToHex(currentH, 100, 100);
        if (satValPointer) {
            satValPointer.style.left = `${currentS}%`;
            satValPointer.style.top = `${100 - currentV}%`;
        }
        if (huePointer) huePointer.style.left = `${(currentH / 360) * 100}%`;
        if (pickerMiniSwatch) pickerMiniSwatch.style.backgroundColor = hex;
    }

    function normalizePreviewHex(hex) {
        let n = (hex != null && String(hex).trim()) ? String(hex).trim() : '#00f2fe';
        if (!n.startsWith('#')) n = '#' + n.replace(/^#/, '');
        n = n.toUpperCase();
        if (!/^#[0-9A-F]{6}$/.test(n)) n = '#00F2FE';
        return n;
    }

    function updatePreviewColor(hex) {
        const normalized = normalizePreviewHex(hex);
        const rgb = hexToRgb(normalized);
        const ra = (a) => (rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a})` : `rgba(0,242,254,${a})`);

        const colorSwatch = document.getElementById('color-preview-swatch');
        if (colorSwatch) {
            colorSwatch.style.backgroundColor = normalized;
            colorSwatch.style.boxShadow = `0 0 20px ${normalized}33`;
        }

        if (previewBinderItem) {
            previewBinderItem.style.background = ra(0.12);
            previewBinderItem.style.borderColor = ra(0.2);
        }
        if (previewSidebarBinder) {
            previewSidebarBinder.style.background = ra(0.08);
            previewSidebarBinder.style.borderColor = ra(0.25);
        }
        if (previewNavCollection) {
            previewNavCollection.style.background = ra(0.15);
        }
        if (previewAccentLogoShell) previewAccentLogoShell.style.backgroundColor = ra(0.12);
        if (previewAccentWordmark) previewAccentWordmark.style.color = normalized;
        if (previewAccentRole) previewAccentRole.style.color = normalized;
        if (previewAccentShareMark) previewAccentShareMark.style.backgroundColor = ra(0.2);
        if (previewAccentTrophy) previewAccentTrophy.style.color = normalized;
    }

    if (swatch) {
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.classList.toggle('hidden');
            if (!popover.classList.contains('hidden')) {
                // Fade in effect
                setTimeout(() => {
                    popover.style.opacity = '1';
                    popover.style.transform = 'scale(1)';
                }, 10);
            } else {
                popover.style.opacity = '0';
                popover.style.transform = 'scale(0.95)';
            }
            // Init picker from current color
            const rgb = hexToRgb(colorPicker.value);
            if (rgb) {
                const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                currentH = hsv.h; currentS = hsv.s; currentV = hsv.v;
                updateFromPicker();
            }
        });
    }

    if (closePickerBtn) {
        closePickerBtn.addEventListener('click', () => {
            popover.style.opacity = '0';
            popover.style.transform = 'scale(0.95)';
            setTimeout(() => popover.classList.add('hidden'), 200);
        });
    }

    document.addEventListener('click', (e) => {
        if (popover && !popover.contains(e.target) && e.target !== swatch) {
            popover.style.opacity = '0';
            popover.style.transform = 'scale(0.95)';
            setTimeout(() => popover.classList.add('hidden'), 200);
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
        const handleMove = (e) => {
            const rect = hueContainer.getBoundingClientRect();
            currentH = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
            updateFromPicker();
        };
        hueContainer.addEventListener('mousedown', (e) => {
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

    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', (e) => {
            const hex = e.target.value.toUpperCase();
            colorHex.value = hex.replace('#', '');
            updatePreviewColor(hex);
        });
        colorHex.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                colorPicker.value = val;
                updatePreviewColor(val);
            }
        });
        
        updatePreviewColor(colorPicker.value.toUpperCase());
    }

    function syncBrandNameToPreview(val) {
        const name = val || 'My Collection';
        if (previewBinderName) previewBinderName.textContent = name;
        if (previewSidebarBinderName) previewSidebarBinderName.textContent = name;
        if (previewShareCollectionName) previewShareCollectionName.textContent = name;
    }

    if (brandNameInput) {
        brandNameInput.addEventListener('input', (e) => {
            syncBrandNameToPreview(e.target.value);
        });
        syncBrandNameToPreview(brandNameInput.value);
    }

}


async function initCollectorOnboarding() {
    document.getElementById('collector-steps').classList.remove('hidden');
    document.getElementById('creator-steps').classList.add('hidden');

    const headerRole = document.getElementById('header-role');
    if (headerRole) headerRole.textContent = 'Collector (TEST)';

    try {
        const res = await fetch(`${API_BASE}/onboarding/collector/status`, { credentials: 'include' });
        const data = await res.json();
        collectorData = data;

        // In TEST MODE, we don't necessarily want to redirect even if complete
        // if (data.is_onboarding_complete) {
        //     console.log('[TEST MODE] Onboarding already complete.');
        // }

        showStep(data.onboarding_collector_step || 1, 'col');
    } catch (e) {
        console.error('Collector status check failed:', e);
        showStep(1, 'col');
    }
}

function showStep(step, prefix) {
    console.log(`[TEST MODE] Showing step ${prefix}-${step}`);
    // Hide all top-level step containers
    document.querySelectorAll('.animate-step').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    const stepId = `${prefix}-step-${step}`;
    const nextStepEl = document.getElementById(stepId);
    if (nextStepEl) {
        nextStepEl.classList.remove('hidden');
        setTimeout(() => nextStepEl.classList.add('active'), 10);
    }

    // Toggle Branding Preview
    const brandingPreview = document.getElementById('branding-preview-container');
    if (brandingPreview) {
        if (prefix === 'c' && step === 4) {
            brandingPreview.classList.remove('hidden');
            setTimeout(() => brandingPreview.classList.add('visible'), 10);
        } else {
            brandingPreview.classList.remove('visible');
            setTimeout(() => brandingPreview.classList.add('hidden'), 600);
        }
    }

    currentStep = step;

    // Update progress bar
    const totalSteps = prefix === 'c' ? 10 : 3;

    // Progress Stepper Mapping
    const progressStepper = document.getElementById('progress-stepper');
    if (prefix === 'c') {
        // Map 10 steps to 3 dots: 1-3 (Init), 4-7 (Config), 8-10 (Deploy)
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        const dot3 = document.getElementById('dot-3');
        const line1 = document.getElementById('line-1');
        const line2 = document.getElementById('line-2');

        if (step <= 3) {
            setActive(dot1, 1);
            setInactive(dot2, 2);
            setInactive(dot3, 3);
            setLine(line1, false);
            setLine(line2, false);
        } else if (step <= 7) {
            setComplete(dot1);
            setActive(dot2, 2);
            setInactive(dot3, 3);
            setLine(line1, true);
            setLine(line2, false);
        } else {
            setComplete(dot1);
            setComplete(dot2);
            setActive(dot3, 3);
            setLine(line1, true);
            setLine(line2, true);
        }
    } else {
        // Original 3-step mapping for collector
        for (let i = 1; i <= 3; i++) {
            const dot = document.getElementById(`dot-${i}`);
            const line = document.getElementById(`line-${i}`);
            if (i < step) setComplete(dot);
            else if (i === step) setActive(dot, i);
            else setInactive(dot, i);
            if (line) setLine(line, i < step);
        }
    }

    function setComplete(el) {
        if (!el) return;
        el.classList.add('complete', 'active');
        el.innerHTML = '<i class="fa-solid fa-check text-xs"></i>';
    }
    function setActive(el, val) {
        if (!el) return;
        el.classList.add('active');
        el.classList.remove('complete');
        el.innerHTML = val;
    }
    function setInactive(el, val) {
        if (!el) return;
        el.classList.remove('active', 'complete');
        el.innerHTML = val;
    }
    function setLine(el, active) {
        if (!el) return;
        if (active) el.classList.add('complete', 'active');
        else el.classList.remove('complete', 'active');
    }

    if (prefix === 'col' && step === 2) {
        loadFollows();
    }

    if (prefix === 'c' && step === 8) {
        const savedAnim = localStorage.getItem('onboarding_pack_animation') || 'style1';
        setTimeout(() => selectAnimation(savedAnim), 60);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function nextStep(step) {
    saveStepProgress(step);
    showStep(step, 'c');
}

async function saveStepProgress(step) {
    console.log('[TEST MODE] Skipping server save for step', step, '(flow test only)');
}

function showVisualError(message, stepId) {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) {
        alert(message);
        return;
    }

    // Try to find an existing error container or create one
    let errorContainer = stepEl.querySelector('.visual-error-popup');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'visual-error-popup fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-xl shadow-2xl font-bold text-sm z-50 animate-step opacity-0 transition-opacity';
        document.body.appendChild(errorContainer);
    }

    errorContainer.textContent = message;
    errorContainer.classList.remove('opacity-0');
    stepEl.classList.add('shake');

    setTimeout(() => {
        errorContainer.classList.add('opacity-0');
        stepEl.classList.remove('shake');
    }, 3000);
}

async function saveTOS() {
    const check = document.getElementById('tos-check');
    const errorEl = document.getElementById('tos-error');

    if (!check.checked) {
        check.parentElement.parentElement.classList.add('shake');
        errorEl.classList.remove('hidden');
        setTimeout(() => {
            check.parentElement.parentElement.classList.remove('shake');
        }, 500);
        return;
    }

    errorEl.classList.add('hidden');
    console.log('[TEST MODE] TOS accept not persisted (flow test only)');
    nextStep(3);
}

async function saveBranding() {
    const nameInput = document.getElementById('brand-name');
    const name = nameInput.value.trim();
    if (!name) { 
        showVisualError('Please enter a collection name.', 'c-step-4');
        return; 
    }

    console.log('[TEST MODE] Branding not persisted (flow test only)');
    streamerData = {
        ...(streamerData || {}),
        brand_name: name,
        brand_tagline: streamerData?.brand_tagline ?? '',
        binder_color: document.getElementById('binder-color').value,
        battles_enabled: document.getElementById('toggle-battles').checked,
        trading_enabled: document.getElementById('toggle-trading').checked
    };
    updateOBSLinks();
    nextStep(5);
}

async function saveOBSStyle() {
    const anim = localStorage.getItem('onboarding_pack_animation') || 'style1';
    console.log('[TEST MODE] OBS style not persisted:', anim, '(flow test only)');
    if (streamerData) streamerData.pack_animation_style = anim;
    nextStep(9);
}

function updateOBSLinks() {
    if (!streamerData) return;
    const origin = window.location.origin;
    const token = streamerData.obs_overlay_token || 'TOKEN_PENDING';
    const user = streamerData.username;

    const packUrl = document.getElementById('obs-pack-url');
    const battleUrl = document.getElementById('obs-battle-url');

    if (packUrl) packUrl.value = `${origin}/obs-overlay?streamer=${user}&token=${token}&type=pack`;
    if (battleUrl) battleUrl.value = `${origin}/obs-overlay?streamer=${user}&token=${token}&type=battle`;
}

function selectAnimation(style) {
    document.querySelectorAll('#c-step-8 .option-card').forEach(card => {
        card.classList.remove('selected');
        const onclick = card.getAttribute('onclick');
        if (onclick && onclick.includes(`'${style}'`)) {
            card.classList.add('selected');
        }
    });

    localStorage.setItem('onboarding_pack_animation', style);

    const placeholder = document.getElementById('pack-preview-placeholder');
    const wrap = document.getElementById('pack-preview-frame-wrap');
    const frame = document.getElementById('pack-overlay-preview-frame');
    if (!placeholder || !wrap || !frame) return;

    if (style === 'none' || style === 'bot') {
        placeholder.classList.remove('hidden');
        wrap.classList.add('hidden');
        frame.removeAttribute('src');
        return;
    }

    placeholder.classList.add('hidden');
    wrap.classList.remove('hidden');

    const src = `/obs.html?preview=${encodeURIComponent(style)}&_cb=${Date.now()}`;
    frame.src = src;
}

async function saveCollectionMethods() {
    console.log('[TEST MODE] Collection methods not persisted (flow test only)');
    nextStep(8);
}

function copyToClipboard(id) {
    const el = document.getElementById(id);
    el.select();
    document.execCommand('copy');
    const btn = el.nextElementSibling;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => {
        btn.innerHTML = originalIcon;
    }, 2000);
}

async function nextCollectorStep(step) {
    console.log('[TEST MODE] Collector step not persisted:', step, '(flow test only)');
    showStep(step, 'col');
}

async function loadFollows() {
    const loading = document.getElementById('follows-loading');
    const grid = document.getElementById('follows-grid');
    const noFollows = document.getElementById('no-follows');

    loading.classList.remove('hidden');
    grid.classList.add('hidden');
    noFollows.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/onboarding/collector/follows`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load follows');
        const streamers = await res.json();

        loading.classList.add('hidden');

        if (streamers.length === 0) {
            noFollows.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        testFlowFavoriteIds.clear();
        streamers.forEach(s => {
            if (s.is_favorited) testFlowFavoriteIds.add(s.id);
        });
        grid.innerHTML = streamers.map(s => {
            const fav = !!s.is_favorited;
            return `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-void-accent/30 transition-all group">
                <img src="${s.avatar_url || '/placeholder.png'}" class="w-12 h-12 rounded-full border border-white/10">
                <div class="flex-grow min-w-0">
                    <h4 class="font-bold text-sm truncate">${s.brand_name || s.display_name}</h4>
                    <p class="text-[10px] text-void-muted truncate">${s.brand_tagline || `@${s.username}`}</p>
                </div>
                <button onclick="toggleFavorite('${s.id}', this)" class="p-2 rounded-lg bg-white/5 hover:bg-void-accent/20 ${fav ? 'bg-void-accent/20 text-void-accent' : 'text-void-muted'} hover:text-void-accent transition-all">
                    <i class="${fav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                </button>
            </div>
        `;
        }).join('');
    } catch (e) {
        console.error('Follows fetch error:', e);
        loading.classList.add('hidden');
        noFollows.classList.remove('hidden');
    }
}

async function toggleFavorite(streamerId, btn) {
    if (testFlowFavoriteIds.has(streamerId)) testFlowFavoriteIds.delete(streamerId);
    else testFlowFavoriteIds.add(streamerId);
    const favorited = testFlowFavoriteIds.has(streamerId);
    console.log('[TEST MODE] Favorite toggled locally only:', streamerId, favorited);

    const icon = btn.querySelector('i');
    if (favorited) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'text-void-accent');
        btn.classList.add('bg-void-accent/20', 'text-void-accent');
    } else {
        icon.classList.remove('fa-solid', 'text-void-accent');
        icon.classList.add('fa-regular');
        btn.classList.remove('bg-void-accent/20', 'text-void-accent');
    }
}

function prevStep(step) {
    showStep(step, currentRole === 'creator' ? 'c' : 'col');
}

async function completeCollectorOnboarding() {
    console.log('[TEST MODE] Collector complete not persisted (flow test only)');
    const btn = document.getElementById('btn-col-complete');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Simulating...';

    await new Promise(r => setTimeout(r, 500));
    btn.disabled = false;
    btn.innerHTML = 'Get Started <i class="fa-solid fa-circle-play"></i>';

    let note = document.getElementById('test-flow-collector-complete-note');
    if (!note) {
        note = document.createElement('p');
        note.id = 'test-flow-collector-complete-note';
        note.className = 'text-xs text-void-muted text-center mt-3 max-w-sm mx-auto leading-snug';
        btn.parentElement.appendChild(note);
    }
    note.textContent = 'Playground only: collector onboarding was not saved on the server. You can still open the hub below.';
}

async function activateCollection() {
    console.log('[TEST MODE] Launch collection not persisted (flow test only)');
    const btn = document.getElementById('btn-activate');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Simulating...';

    await new Promise(r => setTimeout(r, 600));
    btn.disabled = false;
    btn.innerHTML = 'Launch Collection <i class="fa-solid fa-bolt"></i>';

    let note = document.getElementById('test-flow-activate-note');
    if (!note) {
        note = document.createElement('p');
        note.id = 'test-flow-activate-note';
        note.className = 'text-xs text-void-muted text-center mt-3 max-w-sm mx-auto leading-snug';
        btn.parentElement.appendChild(note);
    }
    note.textContent = 'Playground only: your collection was not activated on the server. Use the real onboarding page to go live.';
}

function validateColTOS() {
    const check = document.getElementById('col-tos-check');
    if (!check.checked) {
        showVisualError('Please accept the Terms to continue.', 'col-step-1');
        return;
    }
    nextCollectorStep(2);
}

// --- TEST MODE HELPERS ---

async function resetTestState() {
    if (!confirm('Reload this playground? Nothing on the server is changed; your real onboarding progress stays as-is.')) return;

    console.log('[TEST MODE] Reloading page (no server reset)');
    window.location.reload();
}
