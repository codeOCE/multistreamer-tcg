/* public/onboarding-test.js */

const API_BASE = `${window.location.origin}/api`;
let currentStep = 1;
let streamerData = null;
let collectorData = null;
let currentRole = null; // 'creator' or 'collector'
let csrfToken = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[TEST MODE] Initializing onboarding playground...');
    await fetchCSRFToken();
    await checkStatus();
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
        if (streamerData.brand_tagline) document.getElementById('brand-tagline').value = streamerData.brand_tagline;
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

    // Binder color sync
    const colorPicker = document.getElementById('binder-color');
    const colorHex = document.getElementById('binder-color-hex');
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', (e) => colorHex.value = e.target.value);
        colorHex.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) colorPicker.value = e.target.value;
        });
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
    // Hide all step blocks
    document.querySelectorAll('.step-card').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    const stepId = `${prefix}-step-${step}`;
    const nextStepEl = document.getElementById(stepId);
    if (nextStepEl) {
        nextStepEl.classList.remove('hidden');
        setTimeout(() => nextStepEl.classList.add('active'), 10);
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

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function nextStep(step) {
    saveStepProgress(step);
    showStep(step, 'c');
}

async function saveStepProgress(step) {
    console.log('[TEST MODE] Saving progress to step:', step);
    try {
        await fetch(`${API_BASE}/onboarding/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ step }),
            credentials: 'include'
        });
    } catch (e) { console.error('Failed to save step:', e); }
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
    if (!check.checked) {
        showVisualError('Please accept the Terms of Service to continue.', 'c-step-2');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/onboarding/tos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ accepted: true }),
            credentials: 'include'
        });
        if (res.ok) nextStep(3);
        else throw new Error('Failed to save TOS');
    } catch (e) { 
        showVisualError('Failed to save TOS. Please try again.', 'c-step-2');
    }
}

async function saveBranding() {
    const nameInput = document.getElementById('brand-name');
    const name = nameInput.value.trim();
    if (!name) { 
        showVisualError('Please enter a collection name.', 'c-step-4');
        return; 
    }

    try {
        const res = await fetch(`${API_BASE}/onboarding/identity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({
                brand_name: name,
                brand_tagline: document.getElementById('brand-tagline').value,
                binder_color: document.getElementById('binder-color').value,
                battles_enabled: document.getElementById('toggle-battles').checked,
                trading_enabled: document.getElementById('toggle-trading').checked
            }),
            credentials: 'include'
        });
        if (res.ok) {
            const updatedStreamer = await res.json();
            streamerData = updatedStreamer;
            updateOBSLinks();
            nextStep(5);
        }
        else throw new Error('Failed to save branding');
    } catch (e) { showVisualError('Error saving branding.', 'c-step-4'); }
}

async function saveOBSStyle() {
    const anim = localStorage.getItem('onboarding_pack_animation') || 'style1';
    console.log('[TEST MODE] Saving OBS style:', anim);
    try {
        const res = await fetch(`${API_BASE}/onboarding/obs-style`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ pack_style: anim }),
            credentials: 'include'
        });
        if (res.ok) nextStep(9);
        else throw new Error('Failed to save OBS style');
    } catch (e) {
        console.error(e);
        const btn = document.querySelector('#c-step-8 .btn-void');
        if (btn) {
            const originalText = btn.textContent;
            btn.classList.add('bg-red-500/20', 'text-red-500');
            btn.textContent = 'Error Saving';
            setTimeout(() => {
                btn.classList.remove('bg-red-500/20', 'text-red-500');
                btn.textContent = originalText;
            }, 2000);
        }
    }
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
    console.log('[TEST MODE] Selected OBS style:', style);
    document.querySelectorAll('#c-step-8 .option-card').forEach(card => {
        card.classList.remove('selected');
        const onclick = card.getAttribute('onclick');
        if (onclick && onclick.includes(`'${style}'`)) {
            card.classList.add('selected');
        }
    });

    const preview = document.getElementById('pack-preview');
    if (!preview) return;

    // Reset preview
    preview.innerHTML = '';
    preview.className = 'preview-content';

    if (style === 'none' || style === 'bot') {
        preview.innerHTML = '<div class="text-void-muted opacity-50 text-[10px] uppercase tracking-widest">No Overlay / Bot Only</div>';
        return;
    }

    // Create mock card
    const card = document.createElement('div');
    card.className = 'preview-card-mock';

    if (style === 'style1') card.classList.add('animate-preview-standard');
    else if (style === 'style2') card.classList.add('animate-preview-cosmic');
    else if (style === 'style3') card.classList.add('animate-preview-brutalist');

    preview.appendChild(card);
}

async function saveCollectionMethods() {
    console.log('[TEST MODE] Saving collection methods...');
    const methods = {};
    document.querySelectorAll('input[name="method"]').forEach(input => {
        methods[input.value] = input.checked;
    });

    try {
        const res = await fetch(`${API_BASE}/onboarding/collection-methods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ methods }),
            credentials: 'include'
        });
        if (res.ok) nextStep(8);
        else throw new Error('Failed to save methods');
    } catch (e) { showVisualError('Error saving methods.', 'c-step-7'); }
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
    try {
        await fetch(`${API_BASE}/onboarding/collector/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ step }),
            credentials: 'include'
        });
        showStep(step, 'col');
    } catch (e) {
        console.error('Failed to save collector step:', e);
        showStep(step, 'col');
    }
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
        grid.innerHTML = streamers.map(s => `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-void-accent/30 transition-all group">
                <img src="${s.avatar_url || '/placeholder.png'}" class="w-12 h-12 rounded-full border border-white/10">
                <div class="flex-grow min-w-0">
                    <h4 class="font-bold text-sm truncate">${s.brand_name || s.display_name}</h4>
                    <p class="text-[10px] text-void-muted truncate">${s.brand_tagline || `@${s.username}`}</p>
                </div>
                <button onclick="toggleFavorite('${s.id}', this)" class="p-2 rounded-lg bg-white/5 hover:bg-void-accent/20 ${s.is_favorited ? 'bg-void-accent/20 text-void-accent' : 'text-void-muted'} hover:text-void-accent transition-all">
                    <i class="${s.is_favorited ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error('Follows fetch error:', e);
        loading.classList.add('hidden');
        noFollows.classList.remove('hidden');
    }
}

async function toggleFavorite(streamerId, btn) {
    try {
        const res = await fetch(`${API_BASE}/favorites/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ streamer_id: streamerId }),
            credentials: 'include'
        });
        const data = await res.json();

        const icon = btn.querySelector('i');
        if (data.favorited) {
            icon.classList.replace('fa-regular', 'fa-solid');
            icon.classList.add('text-void-accent');
            btn.classList.add('bg-void-accent/20');
        } else {
            icon.classList.replace('fa-solid', 'fa-regular');
            icon.classList.remove('text-void-accent');
            btn.classList.remove('bg-void-accent/20');
        }
    } catch (e) {
        console.error('Favorite toggle failed:', e);
    }
}

function prevStep(step) {
    showStep(step, currentRole === 'creator' ? 'c' : 'col');
}

async function completeCollectorOnboarding() {
    console.log('[TEST MODE] Finalizing collector onboarding...');
    const btn = document.getElementById('btn-col-complete');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Finalizing...';

    try {
        const res = await fetch(`${API_BASE}/onboarding/collector/complete`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            sessionStorage.clear();
            btn.innerHTML = 'All Set! Redirecting...';
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            const err = await res.json();
            showVisualError(err.error || 'Failed to complete onboarding.', 'col-step-3');
            btn.disabled = false;
            btn.innerHTML = 'Get Started <i class="fa-solid fa-circle-play"></i>';
        }
    } catch (e) {
        showVisualError('Onboarding error. Please try again.', 'col-step-3');
        btn.disabled = false;
        btn.innerHTML = 'Get Started <i class="fa-solid fa-circle-play"></i>';
    }
}

async function activateCollection() {
    console.log('[TEST MODE] Activating collection...');
    const btn = document.getElementById('btn-activate');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Activating...';

    try {
        const res = await fetch(`${API_BASE}/onboarding/activate`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            // Clear session cache to ensure app.js picks up new active status
            sessionStorage.clear();

            btn.innerHTML = 'Success! Redirecting...';
            setTimeout(() => {
                const slug = streamerData?.username?.toLowerCase() || 'dashboard';
                window.location.href = `/${slug}`;
            }, 1500);
        } else {
            const err = await res.json();
            showVisualError(err.error || 'Activation failed.', 'c-step-10');
            btn.disabled = false;
            btn.innerHTML = 'Go Live <i class="fa-solid fa-bolt"></i>';
        }
    } catch (e) {
        showVisualError('Activation error.', 'c-step-10');
        btn.disabled = false;
        btn.innerHTML = 'Go Live <i class="fa-solid fa-bolt"></i>';
    }
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
    if (!confirm('This will RESET your onboarding progress for testing. Continue?')) return;

    console.log('[TEST MODE] Resetting onboarding state...');
    try {
        // We'll call a special debug endpoint (to be added) or just reset locally and go to step 1
        const res = await fetch(`${API_BASE}/onboarding/reset-test`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            console.log('[TEST MODE] State reset successful.');
            window.location.reload();
        } else {
            console.error('[TEST MODE] Server reset failed.');
            // Fallback: just reload and hope
            window.location.reload();
        }
    } catch (e) {
        console.error('[TEST MODE] Reset error:', e);
        window.location.reload();
    }
}
