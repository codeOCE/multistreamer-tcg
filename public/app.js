const BACKEND_URL = window.location.origin; // Use same domain for cookies to work

// --- DYNAMIC VIEW ENGINE ---
const loadedViews = new Set();
async function loadView(viewName) {
    if (loadedViews.has(viewName)) return true;
    
    console.log(`[ViewEngine] Loading view: ${viewName}`);
    try {
        const response = await fetch(`/views/${viewName}.html`);
        if (!response.ok) throw new Error(`Failed to load view: ${viewName}`);
        
        const html = await response.text();
        const mount = document.getElementById('dynamic-view-mount');
        if (mount) {
            // Append the new view to the mount point
            const temp = document.createElement('div');
            temp.innerHTML = html;
            while (temp.firstChild) {
                mount.appendChild(temp.firstChild);
            }
            loadedViews.add(viewName);
            // Re-initialize events for the newly loaded view
            if (typeof initViewEvents === 'function') initViewEvents(viewName);
            return true;
        }
    } catch (error) {
        console.error(`[ViewEngine] Error loading view ${viewName}:`, error);
    }
    return false;
}

/**
 * Re-initializes event listeners and state for dynamically loaded views.
 */
function initViewEvents(viewName) {
    console.log(`[ViewEngine] Initializing events for: ${viewName}`);
    if (viewName === 'viewer-dashboard') {
        initViewerDashboardEvents();
    } else if (viewName === 'creator-dashboard') {
        initCreatorDashboardEvents();
    }
}

function initViewerDashboardEvents() {
    console.log("[ViewEngine] Initializing Viewer Dashboard events...");
    
    const tabAdmin = document.getElementById('tab-admin');
    if (tabAdmin) tabAdmin.onclick = async () => {
        if (!currentUser.is_admin) {
            showToast("Unauthorized", "error");
            return;
        }
        switchView('admin');
        loadAdminCards();
        if (currentUser.is_admin) {
            // Show global admin panels
            const panels = ['admin-stats-panel', 'admin-users-panel', 'admin-grant-panel', 'admin-upload-panel', 'admin-bulk-panel', 'admin-config-panel'];
            panels.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
            loadAdminStats();
            loadAdminUsers();
            loadAdminConfig();
        } else {
            // Hide global admin panels for normal creators
            const panels = ['admin-stats-panel', 'admin-users-panel', 'admin-grant-panel', 'admin-upload-panel', 'admin-bulk-panel', 'admin-config-panel'];
            panels.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
        }
    };

    const viewLogsBtn = document.getElementById('view-logs');
    if (viewLogsBtn) viewLogsBtn.onclick = () => {
        const modal = document.getElementById('logs-modal');
        if (modal) {
            modal.classList.remove('hidden');
            scrollLock();
            loadSystemLogs();
        }
    };

    const closeLogsBtn = document.getElementById('close-logs-modal');
    if (closeLogsBtn) closeLogsBtn.onclick = () => {
        const modal = document.getElementById('logs-modal');
        if (modal) {
            modal.classList.add('hidden');
            scrollUnlock();
        }
    };

    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    if (refreshLogsBtn) refreshLogsBtn.onclick = loadSystemLogs;

    const logSearch = document.getElementById('log-search');
    if (logSearch) logSearch.oninput = debounce(loadSystemLogs, 300);

    const logCategoryFilter = document.getElementById('log-category-filter');
    if (logCategoryFilter) logCategoryFilter.onchange = loadSystemLogs;

    const refreshUsersBtn = document.getElementById('refresh-users');
    if (refreshUsersBtn) refreshUsersBtn.onclick = loadAdminUsers;

    const refreshCardsBtn = document.getElementById('refresh-cards');
    if (refreshCardsBtn) refreshCardsBtn.onclick = loadAdminCards;

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.onclick = showHowToPlay;
}

function initCreatorDashboardEvents() {
    console.log("[ViewEngine] Initializing Creator Dashboard events...");

    const addCardForm = document.getElementById('add-card-form');
    if (addCardForm) {
        addCardForm.onsubmit = async (e) => {
            e.preventDefault();
            const setDropdown = document.getElementById('ac-set-dropdown');
            const payload = {
                id: document.getElementById('ac-id')?.value,
                name: document.getElementById('ac-name')?.value,
                image_url: document.getElementById('ac-image')?.value,
                rarity: document.getElementById('ac-rarity')?.value,
                set_id: setDropdown?.value,
                card_number: document.getElementById('ac-card-number')?.value
            };

            const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (res.ok) {
                showToast("Card Created!", "success");
                e.target.reset();
                loadAdminCards();
            } else {
                showToast("Failed. Check your session or card data.", "error");
            }
        };
    }

    const acUpload = document.getElementById('ac-upload');
    if (acUpload) {
        acUpload.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const preview = document.getElementById('ac-image-preview');
            const reader = new FileReader();
            reader.onload = (re) => { if (preview) preview.innerHTML = `<img src="${re.target.result}" class="w-full h-full object-cover">`; };
            reader.readAsDataURL(file);
            try {
                const button = e.target.nextElementSibling;
                if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>...'; }
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch(`${BACKEND_URL}/api/admin/upload`, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: formData, credentials: 'include' });
                const data = await res.json();
                if (data.success) {
                    const acImage = document.getElementById('ac-image');
                    if (acImage) acImage.value = data.url;
                    if (button) { button.innerHTML = '<i class="fa-solid fa-check mr-2"></i>DONE'; }
                }
                if (button) button.disabled = false;
            } catch (err) { if (button) button.disabled = false; }
        };
    }

    const createSetForm = document.getElementById('create-set-form');
    if (createSetForm) {
        createSetForm.onsubmit = async (e) => {
            e.preventDefault();
            const payload = {
                id: document.getElementById('set-id')?.value,
                name: document.getElementById('set-name')?.value,
                code: document.getElementById('set-code')?.value,
                release_date: document.getElementById('set-release-date')?.value || null,
                icon_url: document.getElementById('set-icon-url')?.value || null,
                description: document.getElementById('set-description')?.value || null,
                total_cards: parseInt(document.getElementById('set-total-cards')?.value) || 0,
                card_back_url: document.getElementById('set-back-url')?.value || null
            };

            try {
                const res = await fetch(`${BACKEND_URL}/api/creator/sets`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });

                if (res.ok) {
                    const setIdInput = document.getElementById('set-id');
                    showToast(setIdInput && setIdInput.disabled ? "Set updated!" : "Set created successfully!", "success");
                    e.target.reset();
                    resetSetForm();
                    loadSets();
                } else {
                    const error = await res.json();
                    showToast(`Failed: ${error.error}`, "error");
                }
            } catch (err) {
                showToast("Connection error", "error");
            }
        };
    }

    const cancelSetEditBtn = document.getElementById('cancel-set-edit');
    if (cancelSetEditBtn) cancelSetEditBtn.onclick = window.cancelSetEdit;

    const processCsvBtn = document.getElementById('process-csv-btn');
    if (processCsvBtn) {
        processCsvBtn.onclick = async () => {
            const fileInput = document.getElementById('csv-upload');
            const file = fileInput ? fileInput.files[0] : null;
            if (!file) { showToast("Select CSV", "error"); return; }
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result;
                const lines = text ? text.split('\n').filter(l => l.trim()) : [];
                const cards = lines.slice(1).map(l => { const [id, name, img, rar, sid, num] = l.split(',').map(s => s.trim()); return { id, name, image_url: img, rarity: rar, set_id: sid, card_number: num }; });
                const res = await fetch(`${BACKEND_URL}/api/admin/cards/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ cards }), credentials: 'include' });
                if (res.ok) { showToast("Bulk upload success!", "success"); loadAdminCards(); }
            };
            reader.readAsText(file);
        };
    }

    // Rarity Config
    ['cfg-rarity-common', 'cfg-rarity-rare', 'cfg-rarity-epic', 'cfg-rarity-legendary'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateRarityTotal);
    });

    const saveConfigBtn = document.getElementById('save-config-btn');
    if (saveConfigBtn) {
        saveConfigBtn.onclick = async () => {
            const configs = [
                { id: 'rarity_weights', data: { common: parseInt(document.getElementById('cfg-rarity-common').value), rare: parseInt(document.getElementById('cfg-rarity-rare').value), epic: parseInt(document.getElementById('cfg-rarity-epic').value), legendary: parseInt(document.getElementById('cfg-rarity-legendary').value) } },
                { id: 'gifting_rules', data: { cards_per_sub: parseInt(document.getElementById('cfg-gift-per-sub').value), bonus_per_5: parseInt(document.getElementById('cfg-gift-bonus').value) } },
                { id: 'visuals', data: { global_card_back_url: document.getElementById('cfg-global-back').value } }
            ];
            for (const cfg of configs) { await fetch(`${BACKEND_URL}/api/admin/config`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(cfg), credentials: 'include' }); }
            showToast("Config saved!", "success");
        };
    }

    const cfgBackUpload = document.getElementById('cfg-back-upload');
    if (cfgBackUpload) {
        cfgBackUpload.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${BACKEND_URL}/api/admin/upload`, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: formData, credentials: 'include' });
            if (res.ok) { const data = await res.json(); document.getElementById('cfg-global-back').value = data.url; showToast("Back uploaded!", "success"); }
        };
    }

}

async function loadModals() {
    if (loadedViews.has('modals')) return;
    console.log(`[ViewEngine] Loading modals...`);
    try {
        const response = await fetch('/views/modals.html');
        if (response.ok) {
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
            loadedViews.add('modals');
            if (typeof initModalEvents === 'function') initModalEvents();
        }
    } catch (e) {
        console.error("[ViewEngine] Failed to load modals:", e);
    }
}

function initModalEvents() {
    console.log("[ViewEngine] Initializing modal events...");
    
    const obNext = document.getElementById('onboarding-next');
    if (obNext) {
        obNext.onclick = () => {
            if (currentOnboardingSlide < totalOnboardingSlides - 1) {
                currentOnboardingSlide++;
                updateOnboardingUI();
            } else {
                if (typeof window.closeOnboarding === 'function') window.closeOnboarding();
            }
        };
    }

    const obPrev = document.getElementById('onboarding-prev');
    if (obPrev) {
        obPrev.onclick = () => {
            if (currentOnboardingSlide > 0) {
                currentOnboardingSlide--;
                updateOnboardingUI();
            }
        };
    }

    const obSkip = document.getElementById('onboarding-skip');
    if (obSkip) obSkip.onclick = window.closeOnboarding;

    // Admin Console Events
    const adminUserSearch = document.getElementById('admin-user-search');
    if (adminUserSearch) adminUserSearch.addEventListener('input', renderAdminUsers);

    const bulkDeleteCardsBtn = document.getElementById('bulk-delete-cards');
    if (bulkDeleteCardsBtn) {
        bulkDeleteCardsBtn.onclick = async () => {
            if (!await showConfirm("⚠️ WARNING: This will DELETE ALL user cards! This cannot be undone.")) return;
            if (!await showConfirm("FINAL WARNING: Are you absolutely sure?")) return;

            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/bulk/delete-all-cards`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': csrfToken },
                    credentials: 'include'
                });

                if (res.ok) {
                    showToast("All cards deleted from database", "success");
                    refreshAdminPanel();
                } else {
                    showToast("Failed to delete cards", "error");
                }
            } catch (e) {
                showToast("Error: " + e.message, "error");
            }
        };
    }

    const bulkDeleteTradesBtn = document.getElementById('bulk-delete-trades');
    if (bulkDeleteTradesBtn) {
        bulkDeleteTradesBtn.onclick = async () => {
            if (!await showConfirm("⚠️ WARNING: This will DELETE ALL trade records! This cannot be undone.")) return;

            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/bulk/delete-all-trades`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': csrfToken },
                    credentials: 'include'
                });

                if (res.ok) {
                    showToast("All trades cleared", "success");
                    if (typeof fetchTrades === 'function') fetchTrades();
                    refreshAdminPanel();
                } else {
                    showToast("Failed to clear trades", "error");
                }
            } catch (e) {
                showToast("Error: " + e.message, "error");
            }
        };
    }

    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
        exportDataBtn.onclick = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/export`, {
                    credentials: 'include'
                });

                if (res.ok) {
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tcg-export-${new Date().toISOString()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    showToast('Export failed', 'error');
                }
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
            }
        };
    }
}

// --- GLOBAL IMAGE FALLBACK HANDLER ---
// Catches all 404/broken images even in dynamically inserted HTML
window.addEventListener('error', function (e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.dataset.fallbackApplied) return; // Prevent infinite loop
        e.target.dataset.fallbackApplied = 'true';

        // Determine fallback based on visual context (avatar vs card)
        const isAvatar = e.target.id.includes('avatar') || e.target.className.includes('rounded-full') || e.target.className.includes('rounded-[1.2rem]') || e.target.src.includes('twitchcdn');

        if (isAvatar) {
            e.target.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=fallback';
        } else {
            e.target.src = '/pack.png'; // Main card fallback
        }
    }
}, true); // useCapture = true is strictly required for 'error' events which don't bubble

let APP_STREAMER = null; // Global streamer context
window.activeStreamerFilter = null; // null = use APP_STREAMER context, 'all' = global binder

let currentUser = null;
let userCollection = [];
let uniqueCards = [];
let leaderboardData = [];
let battlesData = [];
// allMechanics removed
let currentPage = 1;
let currentView = 'collection'; // 'collection' or 'leaderboard'
const ITEMS_PER_PAGE = 9;
let lastCardId = null;
let authInProgress = false;
let csrfToken = null; // CSRF Token Storage

// Card image upload limits (must match server)
const CARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024;   // 8MB
const CARD_IMAGE_MAX_EDGE_PX = 2000;            // max width or height
const CARD_IMAGE_WEBP_QUALITY = 0.85;

// --- LANDING MODE MANAGEMENT ---
const LANDING_COPY = {
    viewer: {
        'hero-title': 'SUPPORT.<br>COLLECT.<br><span class="text-void-accent">FLEX.</span>',
        'hero-subtitle': 'Castle TCG is where streamers and fans collect together. Discover unique cards from your favorite creators and trade with the community to complete your collection.',
        'hero-secondary-btn': 'View Platform',
        'login-nav-btn': 'Start Setup',
        'hero-login-btn': 'Get Started',
        'how-tagline': 'The Community',
        'how-title': 'How it Works',
        'step-1-title': '01. Connect Twitch',
        'step-1-desc': 'Join the community by linking your Twitch account to start your collecting journey.',
        'step-2-title': '02. Collect Cards',
        'step-2-desc': 'Support your favorite streamers and earn rare cards through drops and rewards.',
        'step-3-title': '03. Trade & Battle',
        'step-3-desc': 'Trade with friends to complete your sets and battle others to show off your best cards.',
        'step-1-icon': 'fa-solid fa-link text-xl',
        'step-2-icon': 'fa-solid fa-layer-group text-xl',
        'step-3-icon': 'fa-solid fa-repeat text-xl'
    },
    streamer: {
        'hero-title': 'CREATE.<br>REWARD.<br><span class="text-void-accent">GROW.</span>',
        'hero-subtitle': 'Castle TCG is the ultimate engagement layer for your stream. Create custom digital collectibles, reward your most loyal fans, and watch your community grow.',
        'hero-secondary-btn': 'Launch Collection',
        'login-nav-btn': 'Start Setup',
        'hero-login-btn': 'Start Setup',
        'how-tagline': 'The Platform',
        'how-title': 'Streamer Toolkit',
        'step-1-title': '01. Connect Channel',
        'step-1-desc': "Link your Twitch channel to get started. We'll automatically sync your rewards and subscriber data.",
        'step-2-title': '02. Create Cards',
        'step-2-desc': 'Design and create your own digital cards.',
        'step-3-title': '03. Automate Drops',
        'step-3-desc': "Set up automated card drops for subs, bits, and channel points.",
        'step-1-icon': 'fa-solid fa-plug text-xl',
        'step-2-icon': 'fa-solid fa-wand-magic-sparkles text-xl',
        'step-3-icon': 'fa-solid fa-robot text-xl'
    }
};

let currentLandingMode = localStorage.getItem('landing-mode') || 'viewer';

function setLandingMode(mode, skipAnimation = false) {
    if (skipAnimation) {
        applyLandingMode(mode);
        return;
    }

    const sections = document.querySelectorAll('.landing-section');

    // Phase 1: Fade & Slide Out
    sections.forEach(s => {
        s.classList.remove('landing-content-in');
        s.classList.add('landing-content-out');
    });

    // Phase 2: Swap Content & Fade/Slide In
    setTimeout(() => {
        applyLandingMode(mode);

        sections.forEach(s => {
            s.classList.remove('landing-content-out');
            void s.offsetWidth; // Force reflow
            s.classList.add('landing-content-in');
        });

        // Cleanup
        setTimeout(() => {
            sections.forEach(s => s.classList.remove('landing-content-in'));
        }, 650);
    }, 300);
}

function applyLandingMode(mode) {
    currentLandingMode = mode;
    localStorage.setItem('landing-mode', mode);
    document.body.setAttribute('data-landing-mode', mode);

    // Update Toggle UI
    document.getElementById('mode-viewer-btn')?.classList.toggle('active', mode === 'viewer');
    document.getElementById('mode-streamer-btn')?.classList.toggle('active', mode === 'streamer');

    const indicator = document.getElementById('mode-indicator');
    const activeBtn = mode === 'viewer' ? document.getElementById('mode-viewer-btn') : document.getElementById('mode-streamer-btn');
    if (indicator && activeBtn) {
        indicator.style.width = `${activeBtn.offsetWidth}px`;
        indicator.style.left = `${activeBtn.offsetLeft}px`;
    }

    // Update Content
    const copy = LANDING_COPY[mode];
    for (const [id, text] of Object.entries(copy)) {
        const el = document.getElementById(id);
        if (el) {
            if (id.includes('icon')) el.className = text;
            else if (id.includes('btn')) el.firstChild.textContent = text;
            else el.innerHTML = text;
        }
    }

    // Update CTA actions
    const secondaryBtn = document.getElementById('hero-secondary-btn');
    if (secondaryBtn) {
        secondaryBtn.onclick = mode === 'viewer'
            ? () => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })
            : () => window.location.href = '/onboarding.html';
    }
}

/**
 * Process a card image: validate size, resize to max edge, convert to WebP, strip metadata.
 * @param {File} file - Image file
 * @param {number} maxEdgePx - Max width or height in pixels (default 2000)
 * @param {number} quality - WebP quality 0–1 (default 0.85)
 * @returns {Promise<Blob>} WebP blob
 */
function processCardImage(file, maxEdgePx = CARD_IMAGE_MAX_EDGE_PX, quality = CARD_IMAGE_WEBP_QUALITY) {
    if (file.size > CARD_IMAGE_MAX_BYTES) {
        return Promise.reject(new Error(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`));
    }
    if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error('File must be an image.'));
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxEdgePx || h > maxEdgePx) {
                if (w >= h) {
                    h = Math.round((h * maxEdgePx) / w);
                    w = maxEdgePx;
                } else {
                    w = Math.round((w * maxEdgePx) / h);
                    h = maxEdgePx;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas not supported'));
                return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('WebP export failed'));
                },
                'image/webp',
                quality
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };
        img.src = url;
    });
}

// --- Card image CROP modal (position + zoom within card frame, real-time) ---
// Pokémon / standard US trading card ratio: 2.5" x 3.5" = 5:7
const CARD_CROP_EXPORT_W = 500;
const CARD_CROP_EXPORT_H = 700; // 5:7

let _cardCropState = null;

function closeCardImageCropModal() {
    if (_cardCropState && _cardCropState.objectUrl) {
        URL.revokeObjectURL(_cardCropState.objectUrl);
    }
    const modal = document.getElementById('card-image-crop-modal');
    if (modal) modal.classList.add('hidden');
    _cardCropState = null;
}

window.closeCardImageCropModal = closeCardImageCropModal;

function applyCardCropTransform() {
    if (!_cardCropState || !_cardCropState.img) return;
    const { img, frameW, frameH, scalePercent, offsetX, offsetY } = _cardCropState;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const baseScale = Math.min(frameW / iw, frameH / ih);
    const displayScale = baseScale * (scalePercent / 100);
    const wrapW = iw * displayScale;
    const wrapH = ih * displayScale;
    const wrap = document.getElementById('card-crop-image-wrap');
    const cropImg = document.getElementById('card-crop-image');
    if (wrap && cropImg) {
        wrap.style.width = wrapW + 'px';
        wrap.style.height = wrapH + 'px';
        wrap.style.left = '0';
        wrap.style.top = '0';
        wrap.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        cropImg.style.width = wrapW + 'px';
        cropImg.style.height = wrapH + 'px';
    }
}

function openCardImageCropModal(file, onApply) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > CARD_IMAGE_MAX_BYTES) {
        showToast(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 'error');
        return;
    }
    const modal = document.getElementById('card-image-crop-modal');
    const frameEl = document.getElementById('card-crop-frame');
    const wrapEl = document.getElementById('card-crop-image-wrap');
    const cropImgEl = document.getElementById('card-crop-image');
    const zoomInput = document.getElementById('card-crop-zoom');
    const zoomValueEl = document.getElementById('card-crop-zoom-value');
    const applyBtn = document.getElementById('card-crop-apply-btn');
    if (!modal || !frameEl || !cropImgEl || !wrapEl) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const frameRect = frameEl.getBoundingClientRect();
        let frameW = frameRect.width;
        let frameH = frameRect.height;
        if (!frameW || !frameH) {
            frameW = 300;
            frameH = 420; // 5:7
        }
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const baseScale = Math.min(frameW / iw, frameH / ih);
        const initialScalePercent = 100;
        const wrapW = iw * baseScale;
        const wrapH = ih * baseScale;
        const offsetX = (frameW - wrapW) / 2;
        const offsetY = (frameH - wrapH) / 2;

        _cardCropState = {
            file,
            img,
            objectUrl: url,
            frameW,
            frameH,
            scalePercent: initialScalePercent,
            offsetX,
            offsetY,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            filterPreset: 'none',
            rotateDeg: 0,
            onApply
        };

        cropImgEl.src = url;
        cropImgEl.style.width = wrapW + 'px';
        cropImgEl.style.height = wrapH + 'px';
        wrapEl.style.width = wrapW + 'px';
        wrapEl.style.height = wrapH + 'px';
        wrapEl.style.left = '0';
        wrapEl.style.top = '0';
        wrapEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

        zoomInput.value = initialScalePercent;
        zoomValueEl.textContent = initialScalePercent + '%';

        zoomInput.oninput = () => {
            const pct = parseInt(zoomInput.value, 10);
            zoomValueEl.textContent = pct + '%';
            _cardCropState.scalePercent = pct;
            applyCardCropTransform();
        };

        function buildEditorFilterCSS() {
            const s = _cardCropState;
            if (!s) return '';
            const b = s.brightness / 100, c = s.contrast / 100, sat = s.saturation / 100;
            let parts = [`brightness(${b})`, `contrast(${c})`, `saturate(${sat})`];
            if (s.filterPreset === 'grayscale') parts.push('grayscale(1)');
            else if (s.filterPreset === 'sepia') parts.push('sepia(1)');
            else if (s.filterPreset === 'vivid') parts.push('saturate(1.5)', 'contrast(1.1)');
            return parts.join(' ');
        }
        function applyEditorFilters() {
            if (!_cardCropState || !cropImgEl) return;
            const rot = _cardCropState.rotateDeg;
            cropImgEl.style.transform = rot ? `rotate(${rot}deg)` : '';
            cropImgEl.style.filter = buildEditorFilterCSS();
        }

        const brightnessInput = document.getElementById('card-editor-brightness');
        const contrastInput = document.getElementById('card-editor-contrast');
        const saturationInput = document.getElementById('card-editor-saturation');
        [brightnessInput, contrastInput, saturationInput].forEach((el, i) => {
            if (!el) return;
            const key = ['brightness', 'contrast', 'saturation'][i];
            el.oninput = () => {
                _cardCropState[key] = parseInt(el.value, 10);
                applyEditorFilters();
            };
        });

        function setFilterPreset(preset) {
            _cardCropState.filterPreset = preset;
            ['none', 'grayscale', 'sepia', 'vivid'].forEach(id => {
                const btn = document.getElementById('card-editor-filter-' + id);
                if (btn) {
                    const active = preset === id;
                    btn.classList.toggle('bg-void-accent/20', active);
                    btn.classList.toggle('border-void-accent/40', active);
                    btn.classList.toggle('text-void-accent', active);
                    btn.classList.toggle('bg-white/5', !active);
                    btn.classList.toggle('border-white/10', !active);
                    btn.classList.toggle('text-void-muted', !active);
                }
            });
            applyEditorFilters();
        }
        document.getElementById('card-editor-filter-none')?.addEventListener('click', () => setFilterPreset('none'));
        document.getElementById('card-editor-filter-grayscale')?.addEventListener('click', () => setFilterPreset('grayscale'));
        document.getElementById('card-editor-filter-sepia')?.addEventListener('click', () => setFilterPreset('sepia'));
        document.getElementById('card-editor-filter-vivid')?.addEventListener('click', () => setFilterPreset('vivid'));

        document.getElementById('card-editor-rotate-left')?.addEventListener('click', () => {
            _cardCropState.rotateDeg = (_cardCropState.rotateDeg - 90 + 360) % 360;
            applyEditorFilters();
        });
        document.getElementById('card-editor-rotate-right')?.addEventListener('click', () => {
            _cardCropState.rotateDeg = (_cardCropState.rotateDeg + 90) % 360;
            applyEditorFilters();
        });

        let dragStartX = 0, dragStartY = 0, startOffsetX = 0, startOffsetY = 0;
        function onPointerDown(e) {
            e.preventDefault();
            dragStartX = e.clientX ?? e.touches[0].clientX;
            dragStartY = e.clientY ?? e.touches[0].clientY;
            startOffsetX = _cardCropState.offsetX;
            startOffsetY = _cardCropState.offsetY;
            document.addEventListener('mousemove', onPointerMove);
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            document.addEventListener('touchend', onPointerUp);
        }
        function onPointerMove(e) {
            e.preventDefault();
            const x = e.clientX ?? e.touches[0].clientX;
            const y = e.clientY ?? e.touches[0].clientY;
            const dx = x - dragStartX;
            const dy = y - dragStartY;
            _cardCropState.offsetX = startOffsetX + dx;
            _cardCropState.offsetY = startOffsetY + dy;
            applyCardCropTransform();
        }
        function onPointerUp() {
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchmove', onPointerMove);
            document.removeEventListener('touchend', onPointerUp);
        }
        frameEl.onmousedown = onPointerDown;
        frameEl.ontouchstart = onPointerDown;

        applyBtn.onclick = () => {
            const s = _cardCropState;
            if (!s || !s.img) return;

            const canvas = document.createElement('canvas');
            canvas.width = CARD_CROP_EXPORT_W;
            canvas.height = CARD_CROP_EXPORT_H;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const iw = s.img.naturalWidth;
            const ih = s.img.naturalHeight;
            const rot = s.rotateDeg || 0;
            const baseScale = Math.min(s.frameW / (rot === 90 || rot === 270 ? ih : iw), s.frameH / (rot === 90 || rot === 270 ? iw : ih));
            const displayScale = baseScale * (s.scalePercent / 100);
            const wrapW = (rot === 90 || rot === 270 ? ih : iw) * displayScale;
            const wrapH = (rot === 90 || rot === 270 ? iw : ih) * displayScale;
            const sx = -s.offsetX * (iw / wrapW);
            const sy = -s.offsetY * (ih / wrapH);
            const sw = s.frameW * (iw / wrapW);
            const sh = s.frameH * (ih / wrapH);

            const b = s.brightness / 100, c = s.contrast / 100, sat = s.saturation / 100;
            let filterStr = `brightness(${b}) contrast(${c}) saturate(${sat})`;
            if (s.filterPreset === 'grayscale') filterStr += ' grayscale(1)';
            else if (s.filterPreset === 'sepia') filterStr += ' sepia(1)';
            else if (s.filterPreset === 'vivid') filterStr += ' saturate(1.5) contrast(1.1)';
            ctx.clearRect(0, 0, CARD_CROP_EXPORT_W, CARD_CROP_EXPORT_H);

            ctx.save();
            ctx.filter = filterStr;
            if (rot) {
                const tempCanvas = document.createElement('canvas');
                const rw = rot === 90 || rot === 270 ? ih : iw;
                const rh = rot === 90 || rot === 270 ? iw : ih;
                tempCanvas.width = rw;
                tempCanvas.height = rh;
                const tctx = tempCanvas.getContext('2d');
                if (tctx) {
                    tctx.translate(rw / 2, rh / 2);
                    tctx.rotate((rot * Math.PI) / 180);
                    tctx.drawImage(s.img, -iw / 2, -ih / 2, iw, ih);
                    tctx.setTransform(1, 0, 0, 1, 0, 0);
                    const sx0 = Math.max(0, -s.offsetX / displayScale);
                    const sy0 = Math.max(0, -s.offsetY / displayScale);
                    const sw2 = Math.min(s.frameW / displayScale, rw - sx0);
                    const sh2 = Math.min(s.frameH / displayScale, rh - sy0);
                    if (sw2 > 0 && sh2 > 0) {
                        ctx.drawImage(tempCanvas, sx0, sy0, sw2, sh2, 0, 0, CARD_CROP_EXPORT_W, CARD_CROP_EXPORT_H);
                    }
                }
            } else {
                const sx0 = Math.max(0, sx);
                const sy0 = Math.max(0, sy);
                const sx1 = Math.min(iw, sx + sw);
                const sy1 = Math.min(ih, sy + sh);
                if (sx1 > sx0 && sy1 > sy0) {
                    const dx0 = ((sx0 - sx) / sw) * CARD_CROP_EXPORT_W;
                    const dy0 = ((sy0 - sy) / sh) * CARD_CROP_EXPORT_H;
                    const dw = ((sx1 - sx0) / sw) * CARD_CROP_EXPORT_W;
                    const dh = ((sy1 - sy0) / sh) * CARD_CROP_EXPORT_H;
                    ctx.drawImage(s.img, sx0, sy0, sx1 - sx0, sy1 - sy0, dx0, dy0, dw, dh);
                }
            }
            ctx.restore();

            canvas.toBlob((blob) => {
                if (blob && s.onApply) {
                    closeCardImageCropModal();
                    s.onApply(blob);
                }
            }, 'image/webp', CARD_IMAGE_WEBP_QUALITY);
        };
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast('Failed to load image', 'error');
    };
    img.src = url;

    modal.classList.remove('hidden');
}

// --- Card image scaler modal (bulk / max edge) ---
let _cardScalerState = null;

function closeCardImageScalerModal() {
    const modal = document.getElementById('card-image-scaler-modal');
    if (modal) modal.classList.add('hidden');
    _cardScalerState = null;
}

window.closeCardImageScalerModal = closeCardImageScalerModal;

function openCardImageScalerModal(options) {
    const { file, files, onApply } = options || {};
    const single = !!file;
    const fileList = single ? [file] : (files || []);
    if (fileList.length === 0) return;

    const modal = document.getElementById('card-image-scaler-modal');
    const previewWrap = document.getElementById('card-scaler-preview-wrap');
    const previewImg = document.getElementById('card-scaler-preview');
    const multiLabel = document.getElementById('card-scaler-multi-label');
    const maxEdgeInput = document.getElementById('card-scaler-max-edge');
    const maxEdgeValue = document.getElementById('card-scaler-max-edge-value');
    const dimsEl = document.getElementById('card-scaler-dims');
    const applyBtn = document.getElementById('card-scaler-apply-btn');

    if (single) {
        previewWrap.classList.remove('hidden');
        previewImg.classList.remove('hidden');
        multiLabel.classList.add('hidden');
        const url = URL.createObjectURL(file);
        previewImg.src = url;
        previewImg.onload = () => URL.revokeObjectURL(url);
        const img = new Image();
        img.onload = () => {
            dimsEl.textContent = `Original: ${img.naturalWidth} × ${img.naturalHeight} px`;
        };
        img.src = URL.createObjectURL(file);
    } else {
        previewWrap.classList.add('hidden');
        previewImg.classList.add('hidden');
        multiLabel.classList.remove('hidden');
        multiLabel.textContent = `${fileList.length} image(s) — set max edge, then Process & Upload`;
        dimsEl.textContent = '';
    }

    maxEdgeInput.value = CARD_IMAGE_MAX_EDGE_PX;
    maxEdgeValue.textContent = CARD_IMAGE_MAX_EDGE_PX;
    maxEdgeInput.oninput = () => {
        maxEdgeValue.textContent = maxEdgeInput.value;
        if (single && file) {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth, h = img.naturalHeight;
                const maxE = parseInt(maxEdgeInput.value, 10);
                if (w > maxE || h > maxE) {
                    if (w >= h) { h = Math.round((h * maxE) / w); w = maxE; } else { w = Math.round((w * maxE) / h); h = maxE; }
                }
                dimsEl.textContent = `Output: ${w} × ${h} px (WebP)`;
            };
            img.src = URL.createObjectURL(file);
        }
    };
    maxEdgeInput.dispatchEvent(new Event('input'));

    applyBtn.textContent = single ? 'Apply & use' : 'Process & Upload';
    _cardScalerState = { file, files: fileList, onApply, single };
    modal.classList.remove('hidden');

    applyBtn.onclick = async () => {
        const maxEdge = parseInt(document.getElementById('card-scaler-max-edge').value, 10);
        applyBtn.disabled = true;
        try {
            if (_cardScalerState.single && _cardScalerState.file) {
                const blob = await processCardImage(_cardScalerState.file, maxEdge);
                closeCardImageScalerModal();
                if (_cardScalerState.onApply) _cardScalerState.onApply(blob);
            } else {
                const blobs = [];
                for (const f of _cardScalerState.files) {
                    if (f.size > CARD_IMAGE_MAX_BYTES) {
                        showToast(`"${f.name}" is over 8MB — skipped`, 'error');
                        continue;
                    }
                    const blob = await processCardImage(f, maxEdge);
                    blobs.push({ blob, name: f.name.replace(/\.[^/.]+$/, '') + '.webp' });
                }
                closeCardImageScalerModal();
                if (_cardScalerState.onApply && blobs.length) _cardScalerState.onApply(blobs);
            }
        } catch (e) {
            showToast(e.message || 'Processing failed', 'error');
        }
        applyBtn.disabled = false;
    };
}

function openCardImageScalerForCreator() {
    const input = document.getElementById('card-creator-image');
    const file = input && input.files[0];
    if (!file) return;
    if (file.size > CARD_IMAGE_MAX_BYTES) {
        showToast(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 'error');
        return;
    }
    // Re-open crop modal to reposition/zoom
    openCardImageCropModal(file, (blob) => {
        _cardCreatorProcessedBlob = blob;
        const preview = document.getElementById('card-image-preview');
        const placeholder = document.getElementById('card-image-placeholder');
        if (preview) {
            preview.src = URL.createObjectURL(blob);
            preview.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
    });
}

window.openCardImageScalerForCreator = openCardImageScalerForCreator;

// Chart.js global instances
let collectorGrowthChartInstance = null;
let packActivityChartInstance = null;

// Configure Chart.js globals for the Void aesthetic
if (window.Chart) {
    Chart.defaults.color = '#9ca3af'; // text-void-muted
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 10, 12, 0.9)'; // void-bg
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#9ca3af';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

// --- ONBOARDING FLOW ---
window.openOnboarding = () => {
    console.log("[Onboarding] Redirecting to dedicated onboarding page...");
    window.location.href = '/onboarding';
};

window.closeOnboarding = () => {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('seen_onboarding_v1', 'true');
    scrollUnlock();
};

window.selectRole = (role) => {
    console.log("[Onboarding] Selected role:", role);
    window.selectedOnboardingRole = role;
    document.getElementById('onboarding-role').classList.add('hidden');
    document.getElementById('onboarding-platform').classList.remove('hidden');
};

window.backToRoles = () => {
    document.getElementById('onboarding-role').classList.remove('hidden');
    document.getElementById('onboarding-platform').classList.add('hidden');
};

window.selectPlatform = (platform) => {
    if (platform === 'twitch') {
        console.log("[Onboarding] Redirecting to twitch auth with role:", window.selectedOnboardingRole);
        window.location.href = `/auth/twitch?role=${window.selectedOnboardingRole}`;
    }
};

window.selectedOnboardingRole = 'viewer';

// Custom Binders State
let userBinders = [];
let activeBinderId = 'all'; // 'all' or UUID
let isEditingBinder = false;

let routeInfo = {
    view: 'home', // 'home', 'streamer-profile', 'hub', 'dashboard'
    slug: null,
    viewerId: null
};

function parseRoute() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const params = new URLSearchParams(window.location.search);
    const parts = path.split('/').filter(Boolean);

    console.log("[Router] Parsing Path Parts:", parts);

    if (params.get('forceDashboard') === 'true') {
        routeInfo.view = 'dashboard';
        routeInfo.slug = null;
    } else if (parts.length === 0) {
        routeInfo.view = 'home';
        routeInfo.slug = null;
    } else if (parts[0] === 'binder' && parts.length === 2) {
        // /binder/:streamerUsername - view YOUR collection for that creator's cards (clear, simple)
        routeInfo.view = 'binder';
        routeInfo.slug = parts[1];
    } else if (parts[0] === 'hub') {
        if (parts.length === 1 || parts.length === 2) {
            // /hub or /hub/<ID> - hub home (list of creators)
            routeInfo.view = 'hub';
            routeInfo.viewerId = parts.length === 2 ? parts[1] : null;
        } else if (parts.length === 3) {
            // /hub/<ID> - hub for that user (legacy, same as hub home when ID = you)
            routeInfo.view = 'hub';
            routeInfo.viewerId = parts[1];
        } else if (parts.length === 3) {
            // /hub/<ID>/<streamer> - legacy, redirect to clean /binder/<streamer>
            window.location.replace(`/binder/${parts[2]}`);
            return;
        } else {
            routeInfo.view = 'home';
        }
    } else if (parts.length === 1 && parts[0] !== 'obs-overlay') {
        // /codeoce, /lilypadlegends, etc. - skip profile page, go straight to binder
        window.location.replace(`/binder/${parts[0]}`);
        return;
    } else {
        routeInfo.view = 'home';
        routeInfo.slug = null;
    }
    console.log("[Router] Path:", path, "Result:", routeInfo);
}

// --- CUSTOM CONFIRM MODAL LOGIC ---
function showCustomConfirm(options) {
    console.log("Modal Triggered:", options.title);
    const modal = document.getElementById('confirm-modal');
    const title = document.getElementById('confirm-modal-title');
    const message = document.getElementById('confirm-modal-message');
    const icon = document.getElementById('confirm-modal-icon');
    const iconContainer = document.getElementById('confirm-modal-icon-container');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!modal || !confirmBtn || !cancelBtn) {
        console.error("Critical Modal Elements Missing!", { modal, confirmBtn, cancelBtn });
        // Fallback to native for safety
        if (confirm(options.message || "Confirm?")) {
            if (options.onConfirm) options.onConfirm();
        } else {
            if (options.onCancel) options.onCancel();
        }
        return;
    }

    if (title) title.innerText = options.title || "Validate?";
    if (message) message.innerText = options.message || "Submit this command to the network?";

    // Icon Class
    if (icon) {
        icon.className = `fa-solid ${options.icon || 'fa-circle-nodes'}`;
    }
    if (iconContainer) iconContainer.className = `w-16 h-16 ${options.iconBg || 'bg-white/5'} rounded-2xl flex items-center justify-center mx-auto mb-4 border ${options.iconBorder || 'border-white/10'}`;

    if (confirmBtn) {
        confirmBtn.innerText = options.confirmText || "Confirm";
        confirmBtn.className = `flex-[2] py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg ${options.confirmClass || 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20'}`;
    }

    if (modal) modal.classList.remove('hidden');
    scrollLock();

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            console.log("Confirm Clicked");
            if (modal) modal.classList.add('hidden');
            scrollUnlock();
            if (options.onConfirm) options.onConfirm();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (modal) modal.classList.add('hidden');
            scrollUnlock();
            if (options.onCancel) options.onCancel();
        };
    }
}
let binderRearrangeMode = false;


window.copyTradeCode = () => {
    const code = document.getElementById('my-trade-code').innerText;
    if (code && code !== 'LOADING...') {
        navigator.clipboard.writeText(code);
        showToast("Trade code copied!", "success");
    }
};
let shownNotificationIds = new Set(); // Track shown notifications to prevent duplicates
let searchQuery = ''; // Card search query
let rarityFilter = 'all'; // Rarity filter
let totalUniqueCards = 0; // Total unique cards available

const RARITY_RANK = {
    legendary: 5,
    epic: 4,
    rare: 3,
    uncommon: 2,
    common: 1
};

// --- TRADING STATE ---
let myTradeCode = '';
let trades = [];
let selectedMyCards = new Set();
let selectedTheirCards = new Set();
let selectedTradeInCards = new Set(); // For 5-for-1 upgrades
let currentTradeTarget = null;

// --- PACK OPENING STATE ---
let packQueue = [];
let isPackOpening = false;
let currentPackCards = [];
let currentRevealIndex = 0;

// --- SCROLL MANAGEMENT ---
function scrollLock() {
    document.body.style.overflow = 'hidden';
    // Prevent layout shift if possible
    document.body.style.paddingRight = '8px';
}

function scrollUnlock() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-void toast-${type}`;

    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info'
    };

    toast.innerHTML = `
            <i class="fa-solid ${icons[type]} toast-icon"></i>
            <div class="toast-message">${message}</div>
        `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showCardToast(card) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const rarity = (card.rarity || 'Common').toLowerCase();
    toast.className = `toast toast-card toast-rarity-${rarity}`;

    toast.innerHTML = `
            <div class="toast-card-thumb">
                <img src="${card.image_url}" alt="${card.name}">
            </div>
            <div class="toast-card-details">
                <div class="toast-card-rarity">${card.rarity}</div>
                <div class="toast-card-name">${card.name}</div>
            </div>
        `;

    container.appendChild(toast);

    // Play a small sound or trigger celebration for legendary?
    if (rarity === 'legendary') showAchievementCelebration();

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 6000); // 6 seconds for card reveals
}

// --- ACHIEVEMENT CELEBRATION ---
function showAchievementCelebration() {
    // Create confetti effect
    const colors = ['#00f2fe', '#3498db', '#ffffff', '#004e92', '#ffffff'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.opacity = '1';
        confetti.style.zIndex = '10000';
        confetti.style.pointerEvents = 'none';

        document.body.appendChild(confetti);

        const duration = 2000 + Math.random() * 1000;
        const xMovement = (Math.random() - 0.5) * 200;

        confetti.animate([
            { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(100vh) translateX(${xMovement}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => confetti.remove();
    }
}

// --- PACK OPENING LOGIC ---
function queuePackForReveal(cards) {
    console.log("Queuing pack for reveal:", Array.isArray(cards) ? cards.length : 1, "card(s)");
    packQueue.push(Array.isArray(cards) ? cards : [cards]);
    checkPackQueue();
}

function checkPackQueue() {
    if (isPackOpening || packQueue.length === 0) return;
    startPackOpening(packQueue.shift());
}

function startPackOpening(cards) {
    isPackOpening = true;
    currentPackCards = cards;
    currentRevealIndex = -1; // -1 = pack not yet opened

    const modal = document.getElementById('pack-opening-modal');
    const container = document.getElementById('pack-container');
    const foil = document.getElementById('pack-foil');
    const progress = document.getElementById('reveal-progress');
    const closeBtn = document.getElementById('close-pack-btn');
    const slot = document.getElementById('card-reveal-slot');

    // Reset UI
    modal.classList.remove('hidden');
    container.classList.remove('is-open');
    foil.classList.remove('hidden');
    progress.classList.add('hidden');
    closeBtn.classList.add('hidden');
    slot.innerHTML = '';

    // Dynamically size the dots to match the card count
    const dotsContainer = progress.querySelector('.flex.gap-2');
    const count = Math.min(currentPackCards.length, 10);
    dotsContainer.innerHTML = Array(count).fill(0)
        .map(() => '<div class="reveal-dot w-2 h-2 rounded-full bg-white/20"></div>')
        .join('');

    scrollLock();

    // Initial shake to invite a click
    setTimeout(() => {
        container.classList.add('pack-shake');
        setTimeout(() => container.classList.remove('pack-shake'), 800);
    }, 300);
}

window.handlePackClick = function () {
    const container = document.getElementById('pack-container');
    const progress = document.getElementById('reveal-progress');

    if (currentRevealIndex === -1) {
        // First click: RIPPING the pack
        container.classList.add('pack-shake');
        setTimeout(() => {
            container.classList.remove('pack-shake');
            container.classList.add('is-open');
            progress.classList.remove('hidden');
            // Show first card after rip animation
            currentRevealIndex = 0;
            setTimeout(() => revealNextCard(), 800);
        }, 400);
    } else if (currentRevealIndex < currentPackCards.length) {
        revealNextCard();
    }
};

function revealNextCard() {
    if (currentRevealIndex >= currentPackCards.length) return;

    const slot = document.getElementById('card-reveal-slot');
    const card = currentPackCards[currentRevealIndex];
    const rarity = (card.rarity || 'common').toLowerCase();

    // Trigger confetti for epic/legendary
    if (rarity === 'legendary' || rarity === 'epic') {
        showAchievementCelebration();
    }

    const rarityColor = {
        legendary: '#00f2ff', // void-accent
        epic: '#22d3ee',      // cyan-400
        rare: '#60a5fa',      // blue-400
        uncommon: '#94a3b8',   // slate-400
        common: '#64748b'     // slate-500
    }[rarity] || '#64748b';

    slot.innerHTML = `
            <div class="card-reveal h-full w-full relative" style="perspective:800px">
                <img src="${card.image_url}" alt="${card.name}" class="h-full w-full object-cover rounded-2xl shadow-2xl" style="border: 2px solid ${rarityColor}40; box-shadow: 0 0 30px ${rarityColor}30;">
                <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
                    <div class="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5" style="color:${rarityColor}">${card.rarity}</div>
                    <div class="text-sm font-black text-white leading-tight">${card.name}</div>
                </div>
            </div>
        `;

    updateRevealDots(currentRevealIndex);
    currentRevealIndex++;

    if (currentRevealIndex >= currentPackCards.length) {
        // Show close button after last card
        setTimeout(() => {
            document.getElementById('close-pack-btn').classList.remove('hidden');
            document.getElementById('reveal-progress').classList.add('hidden');
        }, 600);
    }
}

function updateRevealDots(activeIndex) {
    const dots = document.querySelectorAll('.reveal-dot');
    dots.forEach((dot, i) => {
        if (i <= activeIndex) {
            dot.classList.remove('bg-white/20');
            dot.classList.add('bg-void-accent');
        } else {
            dot.classList.remove('bg-void-accent');
            dot.classList.add('bg-white/20');
        }
    });
}

window.closePackOpening = function () {
    document.getElementById('pack-opening-modal').classList.add('hidden');
    isPackOpening = false;
    scrollUnlock();
    // Refresh binder with newcards
    fetchUserCollection();
    // Process next pack in queue
    checkPackQueue();
};

// --- LOADING STATES ---
function setLoadingState(elementId, isLoading, emptyMessage = 'No items yet') {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (isLoading) {
        // Show 5 skeleton rows if it's a list
        element.innerHTML = Array(5).fill(0).map(() => `
                <div class="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/5 overflow-hidden">
                    <div class="w-10 h-10 rounded-full skeleton flex-shrink-0"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-3 w-1/2 skeleton"></div>
                        <div class="h-2 w-1/3 skeleton"></div>
                    </div>
                </div>
            `).join('');
    } else {
        element.innerHTML = `<div class="text-center text-xs text-gray-500 py-4">${emptyMessage}</div>`;
    }
}


// Helper: show/hide landing sections via inline style (HTML default is display:none)
// Helper: show/hide landing sections via inline style (HTML default is display:none)
function showLanding() {
    // Show all landing sections first (removes display:none from all of them)
    document.querySelectorAll('.landing-section').forEach(s => s.style.removeProperty('display'));
    // Then explicitly set landing-view to flex AFTER the loop so it's not overwritten
    const landing = document.getElementById('landing-view');
    if (landing) landing.style.display = 'flex';

    const landingToggle = document.getElementById('landing-mode-toggle');
    if (landingToggle) landingToggle.classList.remove('hidden');
}
function hideLanding() {
    document.querySelectorAll('.landing-section').forEach(s => s.style.display = 'none');
    const landing = document.getElementById('landing-view');
    if (landing) landing.style.display = 'none';

    const landingToggle = document.getElementById('landing-mode-toggle');
    if (landingToggle) landingToggle.classList.add('hidden');
}

// --- AUTH & INIT ---
// --- AUTH & INIT ---
async function initializeApp() {
    console.log("[App] initializeApp starting...");

    // 1. Core initialization
    if (typeof applyLandingMode === 'function') {
        applyLandingMode(currentLandingMode);
    }
    initButtons();
    setupDragAndDrop();
    window.scrollTo(0, 0);
    parseRoute();

    // 2. Load common modals immediately
    await loadModals();

    // 3. Pre-load the primary view based on route
    if (routeInfo.view === 'hub') {
        await loadView('hub');
    } else if (routeInfo.view === 'dashboard' || routeInfo.view === 'binder') {
        await loadView('viewer-dashboard');
    } else if (routeInfo.view === 'streamer-profile') {
        await loadView('streamer-profile');
    }

    // 4. Handle initial visibility
    hideLanding();
    ['dashboard-view', 'hub-view', 'streamer-profile-view', 'login-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (routeInfo.view === 'home' || routeInfo.view === 'landing') {
        showLanding();
        const centralNav = document.getElementById('central-nav');
        if (centralNav) { centralNav.classList.add('hidden'); centralNav.classList.remove('flex'); }
    } else if (routeInfo.view === 'hub') {
        const hub = document.getElementById('hub-view');
        if (hub) hub.classList.remove('hidden');
        const centralNav = document.getElementById('central-nav');
        if (centralNav) centralNav.classList.add('hidden');
    } else if (routeInfo.view === 'streamer-profile') {
        const profile = document.getElementById('streamer-profile-view');
        if (profile) profile.classList.remove('hidden');
    } else if (routeInfo.view === 'dashboard' || routeInfo.view === 'binder') {
        const dashboard = document.getElementById('dashboard-view');
        if (dashboard) dashboard.classList.remove('hidden');

        const centralNav = document.getElementById('central-nav');
        if (centralNav) {
            centralNav.classList.remove('hidden');
            centralNav.classList.add('flex');
        }

        // Hide sub-views inside dashboard
        ['collection-view', 'leaderboard-view', 'trading-view', 'creator-dashboard-view', 'admin-view', 'profile-view', 'battle-view'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
        });
    }

    // Build bootstrap URL: hub/home = all streamers (home needs a valid 200 to detect session),
    // binder/dashboard = specific streamer
    const bootstrapUrl = (routeInfo.view === 'hub' || routeInfo.view === 'home')
        ? `${BACKEND_URL}/api/bootstrap?streamer=all`
        : routeInfo.slug
            ? `${BACKEND_URL}/api/bootstrap?streamer=${encodeURIComponent(routeInfo.slug)}`
            : `${BACKEND_URL}/api/bootstrap`;

    // --- SESSION CACHE: serve immediately from cache, refresh in background ---
    const cacheKey = `bootstrap_${bootstrapUrl}`;
    let cached = sessionStorage.getItem(cacheKey);
    // For binder view: don't use cache if streamer doesn't match (prevents wrong binder)
    if (cached && routeInfo.view === 'binder' && routeInfo.slug) {
        try {
            const parsed = JSON.parse(cached);
            const cachedUsername = parsed?.streamer?.username?.toLowerCase();
            const wantSlug = routeInfo.slug.toLowerCase();
            if (cachedUsername !== wantSlug) cached = null; // Wrong streamer, fetch fresh
        } catch { cached = null; }
    }
    let bootstrap = null;
    let freshFetchPromise = null;

    const doFetch = async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(bootstrapUrl, { credentials: 'include' });
                if (res.ok) {
                    // LOG DEBUG HEADERS
                    const supabaseHost = res.headers.get('x-debug-supabase-host');
                    const streamersError = res.headers.get('x-debug-streamers-error');
                    const rawCount = res.headers.get('x-debug-follows-raw-count');
                    const matches = res.headers.get('x-debug-follows-platform-matches');
                    const tokenValid = res.headers.get('x-debug-token-valid');
                    const rawIds = res.headers.get('x-debug-follows-raw-ids');
                    const allStreamers = res.headers.get('x-debug-all-streamers');
                    const streamersDetail = res.headers.get('x-debug-streamers-detail');
                    const matchSource = res.headers.get('x-debug-match-source');
                    const matchDetails = res.headers.get('x-debug-match-details');
                    const favoriteIdsHeader = res.headers.get('x-debug-favorite-ids');

                    if (rawCount !== null) {
                        if (supabaseHost) console.log(`[BOOTSTRAP DEBUG] Supabase host: ${supabaseHost}`);
                        if (streamersError) console.error(`[BOOTSTRAP DEBUG] Streamers query error: ${streamersError}`);
                        console.log(`[BOOTSTRAP DEBUG] Twitch Follows: ${rawCount} raw, ${matches} platform matches. Token valid: ${tokenValid}`);
                        console.log(`[BOOTSTRAP DEBUG] Match Source: ${matchSource}`);
                        if (matchDetails && matchDetails !== 'none') {
                            console.log(`[BOOTSTRAP DEBUG] Match Details: ${matchDetails}`);
                        }
                        if (rawIds && rawIds !== 'none') {
                            console.log(`[BOOTSTRAP DEBUG] Raw IDs from Twitch: ${rawIds}`);
                        }
                        console.log(`[BOOTSTRAP DEBUG] Database Twitch IDs: ${allStreamers ?? 'none'}`);
                        console.log(`[BOOTSTRAP DEBUG] Streamers (username:twitch_id): ${streamersDetail ?? 'none'}`);
                        if (favoriteIdsHeader) {
                            console.log(`[BOOTSTRAP DEBUG] Favorite IDs: ${favoriteIdsHeader}`);
                        }
                    }
                    return await res.json();
                }
            } catch (e) {
                console.error(`Bootstrap attempt ${attempt + 1} failed:`, e);
            }
            if (attempt < 1) await new Promise(r => setTimeout(r, 200));
        }
        return null;
    };

    if (cached) {
        // Serve from cache immediately — fire fresh fetch in background
        try {
            bootstrap = JSON.parse(cached);
            if (bootstrap) {
                bootstrap.isFromCache = true;
                // Set APP_STREAMER from cache immediately so showDashboard routing works
                if (bootstrap.streamer) {
                    APP_STREAMER = bootstrap.streamer;
                    applyBranding(APP_STREAMER);
                }
                if (bootstrap.csrf_token) csrfToken = bootstrap.csrf_token;
            }
        } catch (e) { /* ignore bad cache */ }
        freshFetchPromise = doFetch()
            .then((fresh) => {
                if (fresh) {
                    sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
                    if (fresh.csrf_token) csrfToken = fresh.csrf_token;
                    if (fresh.streamer) {
                        APP_STREAMER = fresh.streamer;
                        applyBranding(APP_STREAMER);
                    }
                }
                return fresh;
            });
    } else {
        // No cache — fire single bootstrap call
        bootstrap = await doFetch();
        if (bootstrap) {
            sessionStorage.setItem(cacheKey, JSON.stringify(bootstrap));
            if (bootstrap.csrf_token) csrfToken = bootstrap.csrf_token;
            if (bootstrap.streamer) {
                APP_STREAMER = bootstrap.streamer;
                applyBranding(APP_STREAMER);
            }
        }
    }

    if (bootstrap && bootstrap.user) {
        // === LOGGED IN ===
        currentUser = {
            twitch_id: bootstrap.user.twitch_id,
            name: bootstrap.user.username,
            avatar: bootstrap.user.avatar_url,
            layout: bootstrap.user.binder_layout,
            theme: bootstrap.user.binder_theme,
            is_creator: bootstrap.user.is_creator,
            streamer: bootstrap.user.streamer,
            onboarding_collector_step: bootstrap.user.onboarding_collector_step,
            is_onboarding_complete: bootstrap.user.is_onboarding_complete
        };

        // Extract CSRF and Streamer if present
        if (bootstrap.csrf_token) csrfToken = bootstrap.csrf_token;
        if (bootstrap.streamer) {
            APP_STREAMER = bootstrap.streamer;
            applyBranding(APP_STREAMER);
        }

        // Redirect unconfigured creators to onboarding
        if (currentUser.is_creator && !currentUser.streamer?.is_active && !window.location.pathname.includes('onboarding') && !bootstrap.isFromCache) {
            console.log("[App] Unconfigured creator detected. Redirecting to onboarding...");
            window.location.href = '/onboarding.html?role=creator';
            return;
        }

        // Redirect unconfigured collectors to onboarding
        if (!currentUser.is_creator && !currentUser.is_onboarding_complete && !window.location.pathname.includes('onboarding') && !bootstrap.isFromCache) {
            console.log("[App] Unconfigured collector detected. Redirecting to onboarding...");
            window.location.href = '/onboarding.html?role=collector';
            return;
        }

        // If creator is visiting their own profile, switch to dashboard early
        if (routeInfo.view === 'streamer-profile' && currentUser.is_creator && currentUser.name.toLowerCase() === routeInfo.slug?.toLowerCase()) {
            routeInfo.view = 'dashboard';
            const profile = document.getElementById('streamer-profile-view');
            if (profile) profile.classList.add('hidden');
        }

        // Re-check unconfigured status after fresh fetch if we skipped it due to cache
        if (bootstrap.isFromCache && freshFetchPromise) {
            freshFetchPromise.then(async (freshBootstrap) => {
                if (freshBootstrap) {
                    if (freshBootstrap.user?.is_creator && !freshBootstrap.user.streamer?.is_active && !window.location.pathname.includes('onboarding')) {
                        console.log("[App] Background fetch confirmed unconfigured creator. Redirecting...");
                        window.location.href = '/onboarding.html?role=creator';
                    } else if (!freshBootstrap.user?.is_creator && !freshBootstrap.user?.is_onboarding_complete && !window.location.pathname.includes('onboarding')) {
                        console.log("[App] Background fetch confirmed unconfigured collector. Redirecting...");
                        window.location.href = '/onboarding.html?role=collector';
                    } else {
                        // Refresh UI with fresh data for a smooth update
                        console.log("[App] Background fetch complete. Refreshing UI snap...");
                        if (currentUser) {
                            currentUser.streamer = freshBootstrap.user.streamer;
                            if (currentUser.streamer) applyBranding(currentUser.streamer);
                        }
                        if (routeInfo.view === 'hub') {
                            renderViewerHub(freshBootstrap.sections || {}, freshBootstrap.favorite_ids || []);
                        } else if (routeInfo.view === 'streamer-profile') {
                            renderStreamerProfile(freshBootstrap);
                        } else if (routeInfo.view === 'dashboard' || routeInfo.view === 'binder') {
                            showDashboard(null, freshBootstrap, true);
                            fetchUserCollection(freshBootstrap.recent_drops);
                        }
                    }
                }
            });
        }

        if (routeInfo.view === 'home') {
            // Logged-in user at / → show landing but swap buttons to "Go to Hub"
            showLanding();

            const dashSlug = 'hub';
            const heroBtn = document.getElementById('hero-login-btn');
            const navBtn = document.getElementById('login-nav-btn');
            if (heroBtn) {
                heroBtn.textContent = 'Go to Hub';
                heroBtn.onclick = (e) => { e.preventDefault(); window.location.href = `/${dashSlug}`; };
            }
            if (navBtn) {
                navBtn.textContent = 'Go to Hub';
                navBtn.onclick = (e) => { e.preventDefault(); window.location.href = `/${dashSlug}`; };
            }
            const centralNav = document.getElementById('central-nav');
            if (centralNav) centralNav.classList.add('hidden');

            const navUser = document.getElementById('nav-user-preview');
            const navNick = document.getElementById('nav-username');
            const navImg = document.getElementById('nav-avatar');
            const navLogout = document.getElementById('nav-logout-btn');
            const navCreator = document.getElementById('nav-creator-btn');

            if (navUser) { navUser.classList.remove('hidden'); navUser.classList.add('flex'); }
            if (navNick) navNick.innerText = currentUser.name;
            if (navImg) navImg.src = currentUser.avatar;

            if (navCreator) {
                const navRole = document.getElementById('nav-user-role');
                if (currentUser.is_creator) {
                    navCreator.classList.remove('hidden');
                    if (navRole) navRole.innerText = "Creator";
                } else {
                    navCreator.classList.add('hidden');
                    if (navRole) navRole.innerText = "Collector";
                }
            }
            return;
        } else if (routeInfo.view === 'hub') {
            // Load Hub
            hideLanding();
            await renderViewerHub(bootstrap.sections || {}, bootstrap.favorite_ids || []);
            return;
        } else if (routeInfo.view === 'streamer-profile') {
            // Load public Streamer Profile
            hideLanding();
            await renderStreamerProfile(bootstrap);
            return;
        }

        // Dashboard or binder view → load full dashboard
        hideLanding();
        const dashboard = document.getElementById('dashboard-view');
        if (dashboard) dashboard.classList.remove('hidden');

        leaderboardData = bootstrap.leaderboard || [];
        achievementsData = bootstrap.achievements || [];
        userBinders = bootstrap.binders || [];

        const initialView = routeInfo.view === 'binder' ? 'collection' : null;
        await showDashboard(initialView, bootstrap);

        fetchUserCollection(bootstrap.recent_drops);
        startPolling();

    } else {
        // === NOT LOGGED IN ===
        if (routeInfo.view === 'dashboard' || routeInfo.view === 'binder') {
            window.location.href = `/auth/twitch?role=viewer`;
            return;
        } else if (routeInfo.view === 'hub') {
            // Logged out Hub - show Discovery Landing or Login Callout
            hideLanding();
            const hub = document.getElementById('hub-view');
            if (hub) hub.classList.remove('hidden');
            const loading = document.getElementById('hub-loading');
            if (loading) loading.classList.add('hidden');
            const sections = document.getElementById('hub-sections-container');
            if (sections) {
                sections.classList.remove('hidden');
                sections.innerHTML = `
                    <div class="col-span-full py-32 flex flex-col items-center text-center space-y-6">
                        <div class="w-20 h-20 rounded-full bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent text-3xl">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div class="space-y-2">
                            <h3 class="text-3xl font-black uppercase italic tracking-tight">Access Restricted</h3>
                            <p class="text-void-muted max-w-md mx-auto">Please initialize your profile to access your collected vaults and discover active creator nodes.</p>
                        </div>
                        <button onclick="window.location.href='/auth/twitch?role=viewer'" 
                                class="saas-button px-12 py-4 rounded-xl shadow-void-accent/20">
                            Initialize Collection
                        </button>
                    </div>
                `;
            }
            return;
        }

        if (routeInfo.view === 'streamer-profile') {
            hideLanding();
            const profile = document.getElementById('streamer-profile-view');
            if (profile) profile.classList.remove('hidden');
            await renderStreamerProfile(bootstrap);
        } else {
            // Home - show landing page
            showLanding();
        }
    }
}

// --- HUB & PROFILE RENDERING ---
async function renderViewerHub(sections, favoriteIds = []) {
    console.log("[App] Rendering Viewer Hub with Sections...");

    const loading = document.getElementById('hub-loading');
    const container = document.getElementById('hub-sections-container');
    if (loading) loading.classList.add('hidden');
    if (container) container.classList.remove('hidden');

    const favIdsSet = new Set(favoriteIds);
    const sectionConfigs = [
        { id: 'favorites', el: document.getElementById('hub-favorites-section'), grid: document.getElementById('hub-favorites-grid') },
        { id: 'followed', el: document.getElementById('hub-followed-section'), grid: document.getElementById('hub-followed-grid') }
    ];

    // --- YOUR HUB (Self-Promotion for Creators) ---
    const selfContainer = document.getElementById('hub-self-container');
    if (selfContainer) {
        if (currentUser && currentUser.is_creator) {
            const s = (currentUser.streamer && currentUser.streamer.username) 
                ? currentUser.streamer 
                : { username: currentUser.name, display_name: currentUser.name, avatar_url: currentUser.avatar_url };
            selfContainer.innerHTML = `
                <div onclick="window.location.href='/binder/${s.username}'" 
                     class="group relative flex items-center gap-4 bg-void-accent/5 border border-void-accent/20 hover:bg-void-accent/10 hover:border-void-accent/40 px-6 py-4 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg shadow-void-accent/5">
                    <div class="relative">
                        <img src="${s.brand_logo_url || s.avatar_url}" class="w-12 h-12 rounded-xl object-cover border border-void-accent/20">
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-void-accent flex items-center justify-center rounded-full border-2 border-void-bg text-[8px] text-void-bg font-black">
                            <i class="fa-solid fa-star"></i>
                        </div>
                    </div>
                    <div class="text-left">
                        <div class="text-[10px] font-black uppercase tracking-widest text-void-accent/80 leading-none mb-1">Authenticated Creator</div>
                        <div class="text-lg font-display font-black text-void-text uppercase italic tracking-tight leading-none">Your Hub <i class="fa-solid fa-arrow-right ml-1 text-xs opacity-40 group-hover:translate-x-1 transition-all"></i></div>
                    </div>
                </div>
            `;
        } else {
            selfContainer.innerHTML = '';
        }
    }

    let totalStreamers = 0;
    sectionConfigs.forEach(conf => {
        const data = sections?.[conf.id] || [];
        totalStreamers += data.length;

        if (conf.el && conf.grid) {
            const emptyEl = document.getElementById(`hub-${conf.id}-empty`);
            if (data.length > 0) {
                conf.el.classList.remove('hidden');
                if (emptyEl) emptyEl.classList.add('hidden');
                conf.grid.classList.remove('hidden');
                conf.grid.innerHTML = data.map(s => renderStreamerCard(s, favIdsSet.has(s.id))).join('');
            } else {
                conf.el.classList.remove('hidden'); // ALWAYS keep these sections visible
                if (emptyEl) emptyEl.classList.remove('hidden');
                conf.grid.classList.add('hidden');
            }
        }
    });

    const emptyState = document.getElementById('hub-empty-state');
    const isCreatorStatus = currentUser && currentUser.is_creator;
    if (totalStreamers === 0 && !isCreatorStatus) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (container) container.classList.add('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (container) container.classList.remove('hidden');
    }
}

function renderStreamerCard(s, isFavorited) {
    const targetUrl = `/binder/${s.username}`;
    const starClass = isFavorited ? 'text-yellow-400 fill-yellow-400' : 'text-void-muted group-hover/star:text-yellow-400/50';

    return `
        <div class="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] hover:border-void-accent/40 hover:bg-white/[0.04] transition-all duration-300">
            <!-- Favorite Toggle -->
            <button onclick="event.stopPropagation(); toggleFavorite('${s.id}')" 
                    class="group/star absolute top-4 right-4 z-30 w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                <i class="fa-solid fa-star ${starClass} transition-colors"></i>
            </button>

            <!-- Click area for navigation -->
            <div onclick="window.location.href='${targetUrl}'" class="cursor-pointer">
                <div class="absolute inset-0 bg-gradient-to-t from-void-bg via-void-bg/50 to-transparent z-10"></div>
                
                <img src="${s.brand_logo_url || s.avatar_url || 'https://via.placeholder.com/300'}" 
                     class="w-full h-48 object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" alt="${s.username}">
                
                <div class="absolute bottom-0 left-0 w-full p-6 z-20">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-2xl font-display font-black text-void-text uppercase italic tracking-tighter shadow-black drop-shadow-lg">${s.brand_name || s.username}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <p class="text-[10px] font-bold text-void-muted uppercase tracking-widest">${s.is_active ? 'Active Node' : 'Archived'}</p>
                                ${s.is_self ? '<span class="px-2 py-0.5 rounded-full bg-void-accent/20 text-void-accent text-[8px] font-black uppercase tracking-tighter">Your Hub</span>' : ''}
                            </div>
                        </div>
                        <div class="w-10 h-10 rounded-xl bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent group-hover:translate-x-1 transition-all">
                            <i class="fa-solid fa-arrow-right"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function toggleFavorite(streamerId) {
    if (!currentUser) {
        showVoidNotification("IDENTITY REQUIRED FOR PERSISTENCE", "error");
        return;
    }

    try {
        const resp = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streamer_id: streamerId })
        });

        const data = await resp.json();
        if (data.success) {
            showVoidNotification(data.favorited ? "NODE PRIORITIZED" : "NODE DEPRIORITIZED", "success");
            // Re-fetch bootstrap to update UI (simplest way to sync state)
            const updated = await fetch('/api/bootstrap?streamer=all').then(r => r.json());
            if (updated.sections) {
                renderViewerHub(updated.sections, updated.favorite_ids);
            }
        }
    } catch (e) {
        console.error("[App] Favorite toggle failed:", e);
    }
}

async function renderStreamerProfile(bootstrap) {
    console.log("[App] Rendering Streamer Profile for:", routeInfo.slug);

    // Resolve streamer context early if not already in bootstrap
    const streamerData = bootstrap?.streamer || null;
    if (streamerData) {
        APP_STREAMER = streamerData;
        applyBranding(APP_STREAMER);
    } else {
        await resolveStreamer();
    }

    if (!APP_STREAMER) {
        document.getElementById('streamer-profile-view').innerHTML = `<div class="text-center py-40 text-2xl font-black text-void-muted uppercase italic">Creator identity missing from network.</div>`;
        return;
    }

    const nameEl = document.getElementById('sp-name');
    const avatarEl = document.getElementById('sp-avatar');
    const badgeEl = document.getElementById('sp-live-badge');
    const dashBtn = document.getElementById('sp-enter-dashboard-btn');

    if (nameEl) nameEl.innerText = APP_STREAMER.brand_name || APP_STREAMER.display_name || APP_STREAMER.username;
    if (avatarEl) avatarEl.src = APP_STREAMER.brand_logo_url || APP_STREAMER.avatar_url;
    if (badgeEl && APP_STREAMER.is_live) badgeEl.classList.remove('hidden');

    if (dashBtn) {
        dashBtn.onclick = () => {
            if (currentUser) {
                window.location.href = `/binder/${APP_STREAMER.username}`;
            } else {
                window.location.href = `/auth/twitch?role=viewer`;
            }
        };
    }
}

async function resolveStreamer() {
    const slug = routeInfo.slug;

    if (!slug) {
        APP_STREAMER = null;
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/streamer/config?streamer=${slug}`);
        if (res.ok) {
            APP_STREAMER = await res.json();
            console.log("Streamer Context Resolved:", APP_STREAMER.username);
        } else {
            console.warn("Failed to resolve streamer context. Invalid slug.");
            APP_STREAMER = null;
        }
    } catch (e) {
        console.error("Streamer resolution error:", e);
    }

    if (APP_STREAMER) {
        applyBranding(APP_STREAMER);
    }
}

function applyBranding(streamer) {
    const settings = streamer.settings || {};
    const root = document.documentElement;

    console.log("Applying Branding for:", streamer.display_name || streamer.username);

    // Support both direct columns (new schema) and nested settings (legacy/frontend expectation)
    const brandColor = settings.binder_color || '#00f2fe';
    const logoUrl = settings.brand_logo_url || streamer.brand_logo_url || streamer.avatar_url;
    const brandName = settings.brand_name || streamer.brand_name || streamer.display_name || streamer.username;

    // 1. Inject CSS Variables
    if (brandColor) {
        root.style.setProperty('--primary-legacy', brandColor);
        // Also update the neon accent if possible
        root.style.setProperty('--void-accent', brandColor);
    }

    // 2. Update Assets
    if (logoUrl) {
        const logos = document.querySelectorAll('.app-logo');
        logos.forEach(img => img.src = logoUrl);
    }

    // 3. Update Meta & Title
    document.title = `${brandName} - StreamCards`;

    // 4. Update UI Strings
    const brandDisplays = document.querySelectorAll('.brand-name-display');
    brandDisplays.forEach(el => el.innerText = brandName);

    // 5. Update Twitch Integration Box
    const summonText = document.getElementById('summon-more-text');
    const summonBtn = document.getElementById('summon-channel-btn');
    if (summonText) {
        summonText.innerHTML = `Subscribe, use Channel Points, or buy packs to summon new frogs live on stream at <span class="text-void-accent font-bold">${brandName}</span>!`;
    }
    if (summonBtn) {
        summonBtn.onclick = () => window.open(`https://twitch.tv/${streamer.username}`, '_blank');
    }
}

async function fetchCSRFToken() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/csrf`, {
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

function populateProfileView() {
    if (!APP_STREAMER) return;
    document.getElementById('profile-streamer-avatar').src = APP_STREAMER.avatar_url;
    document.getElementById('profile-streamer-name').innerText = APP_STREAMER.display_name || APP_STREAMER.username;
}

async function checkCreatorSetupStatus() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/setup-status`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const callout = document.getElementById('cd-setup-callout');
            const statusText = document.getElementById('cd-status-text');

            if (!data.setup_complete) {
                // Show setup callout, but let the user decide when to start
                if (callout) callout.classList.remove('hidden');
                if (statusText) statusText.textContent = 'Setup incomplete – finish your creator setup to go live.';
            } else {
                if (callout) callout.classList.add('hidden');
                if (statusText) statusText.textContent = 'Creator setup complete.';
            }
        }
    } catch (err) {
        console.error("[Creator] Failed to check setup status:", err);
    }
}

let isFetchingStats = false;
async function fetchCreatorStats() {
    if (isFetchingStats) return;
    console.log("[Creator] Fetching Stats...");
    isFetchingStats = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' });
        if (res.ok) {
            const stats = await res.json();
            updateCreatorStatsUI(stats);
        }
    } catch (err) {
        console.error("[Creator] Failed to fetch stats:", err);
    } finally {
        isFetchingStats = false;
    }
}

function updateCreatorStatsUI(stats) {
    const mintedEl = document.getElementById('cd-stat-minted');
    const packsEl = document.getElementById('cd-stat-packs-opened');
    const commEl = document.getElementById('cd-stat-community');

    if (mintedEl) mintedEl.innerText = (stats.total_cards || stats.minted || creatorCards.length).toLocaleString();
    if (commEl) commEl.innerText = (stats.total_collectors || stats.community || 0).toLocaleString();
    if (packsEl) packsEl.innerText = (stats.packs_opened || 0).toLocaleString();
}

// Enhanced dashboard loading with error handling
async function loadOverviewData() {
    const loadingEl = document.getElementById('cd-overview-loading');
    const contentEl = document.getElementById('cd-overview-content');
    const errorEl = document.getElementById('cd-overview-error');

    // Show loading state
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    try {
        // Fetch all overview data in parallel
        const [statsRes, activityRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/analytics/overview?days=7`, { credentials: 'include' })
        ]);

        if (statsRes.ok) {
            const stats = await statsRes.json();
            updateOverviewStats(stats);
        }

        if (activityRes.ok) {
            const activity = await activityRes.json();
            updateRecentActivity(activity);
        }

        // Hide loading, show content
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');

        // Update status text
        const statusText = document.getElementById('cd-status-text');
        if (statusText) statusText.textContent = 'Dashboard loaded successfully';

    } catch (err) {
        console.error("[Creator] Failed to load overview:", err);
        // Show error state
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.add('hidden');
        if (errorEl) {
            errorEl.classList.remove('hidden');
            const errorMsg = document.getElementById('cd-overview-error-message');
            if (errorMsg) errorMsg.textContent = err.message || 'Failed to load dashboard data. Please try again.';
        }
    }
}

function updateOverviewStats(stats) {
    const mintedEl = document.getElementById('cd-stat-minted');
    const commEl = document.getElementById('cd-stat-community');
    const mintedChange = document.getElementById('cd-stat-minted-change');
    const commChange = document.getElementById('cd-stat-community-change');

    if (mintedEl) mintedEl.textContent = (stats.minted || creatorCards.length || 0).toLocaleString();
    if (commEl) commEl.textContent = (stats.community || 0).toLocaleString();

    // Update change indicators
    if (mintedChange && stats.cards_change !== undefined) {
        mintedChange.textContent = `${stats.cards_change >= 0 ? '+' : ''}${stats.cards_change} this week`;
        mintedChange.className = `text-[8px] mt-2 ${stats.cards_change > 0 ? 'text-void-accent' : stats.cards_change < 0 ? 'text-red-500' : 'text-void-muted'}`;
    }
    if (commChange && stats.community_change !== undefined) {
        commChange.textContent = `${stats.community_change >= 0 ? '+' : ''}${stats.community_change} this week`;
        commChange.className = `text-[8px] mt-2 ${stats.community_change > 0 ? 'text-void-accent' : stats.community_change < 0 ? 'text-red-500' : 'text-void-muted'}`;
    }
}

function updateRecentActivity(activity) {
    const activityEl = document.getElementById('cd-recent-activity');
    if (!activityEl) return;

    if (!activity || !activity.recent_events || activity.recent_events.length === 0) {
        activityEl.innerHTML = `
        <div class="text-center py-8 text-void-muted">
            <i class="fa-solid fa-inbox text-2xl mb-2"></i>
            <p class="text-xs">No recent activity</p>
        </div>
    `;
        return;
    }

    activityEl.innerHTML = activity.recent_events.slice(0, 5).map(event => `
    <div class="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
        <div class="w-10 h-10 rounded-lg bg-void-accent/10 flex items-center justify-center text-void-accent">
            <i class="fa-solid ${getActivityIcon(event.type)}"></i>
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-void-text truncate">${event.message || 'Activity'}</div>
            <div class="text-[9px] text-void-muted">${formatTimeAgo(event.timestamp)}</div>
        </div>
    </div>
`).join('');
}

function getActivityIcon(type) {
    const icons = {
        'pack_opened': 'fa-box-open',
        'card_collected': 'fa-cards-blank',
        'new_collector': 'fa-user-plus',
        'milestone': 'fa-trophy',
        'default': 'fa-circle-info'
    };
    return icons[type] || icons.default;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}


async function loadSettingsStatus() {
    // Update integration statuses
    try {
        const [webhookRes, obsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/creator/webhook-status`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/obs-token`, { credentials: 'include' })
        ]);

        // Update Twitch status
        const twitchStatus = document.getElementById('twitch-status');
        if (twitchStatus && webhookRes.ok) {
            const webhook = await webhookRes.json();
            twitchStatus.innerHTML = `
            <div class="w-2 h-2 rounded-full ${webhook.connected ? 'bg-void-accent' : 'bg-red-500'}"></div>
            <span class="text-xs font-bold ${webhook.connected ? 'text-void-accent' : 'text-red-500'}">${webhook.connected ? 'Connected' : 'Disconnected'}</span>
        `;
        }

        // Update OBS status
        const obsStatus = document.getElementById('obs-status');
        if (obsStatus && obsRes.ok) {
            const obs = await obsRes.json();
            obsStatus.innerHTML = `
            <div class="w-2 h-2 rounded-full ${obs.token ? 'bg-void-accent' : 'bg-void-muted'}"></div>
            <span class="text-xs font-bold ${obs.token ? 'text-void-accent' : 'text-void-muted'}">${obs.token ? 'Configured' : 'Not Configured'}</span>
        `;
        }

        // Update account status
        const statsRes = await fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            const activeStatus = document.getElementById('cd-active-status');
            const setupStatus = document.getElementById('cd-setup-status');
            const minCards = document.getElementById('cd-min-cards');

            if (activeStatus) {
                activeStatus.innerHTML = `
                <div class="w-2 h-2 rounded-full ${stats.is_active ? 'bg-void-accent' : 'bg-red-500'}"></div>
                <span class="text-xs font-bold ${stats.is_active ? 'text-void-accent' : 'text-red-500'}">${stats.is_active ? 'Active' : 'Inactive'}</span>
            `;
            }

            if (setupStatus) {
                setupStatus.innerHTML = `
                <div class="w-2 h-2 rounded-full ${stats.setup_complete ? 'bg-void-accent' : 'bg-amber-500'}"></div>
                <span class="text-xs font-bold ${stats.setup_complete ? 'text-void-accent' : 'text-amber-500'}">${stats.setup_complete ? 'Complete' : 'Incomplete'}</span>
            `;
            }

            if (minCards) {
                const cardCount = stats.minted || creatorCards.length || 0;
                minCards.textContent = `${cardCount}/10`;
                minCards.className = `text-xs font-bold ${cardCount >= 10 ? 'text-void-accent' : 'text-red-500'}`;
            }
        }
    } catch (err) {
        console.error("[Creator] Failed to load settings status:", err);
    }
}

function retryLoadDashboard() {
    loadOverviewData();
}

// Debounced search for better performance
let searchTimeout;
function debounceSearch(callback, delay = 300) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(callback, delay);
}

// Settings tab functions
async function deactivateAccount() {
    if (!await showConfirm("⚠️ WARNING: This will deactivate your account and make your cards unavailable to collectors. Are you sure?")) return;
    if (!await showConfirm("FINAL WARNING: This action cannot be easily undone. Continue?")) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ is_active: false })
        });

        if (res.ok) {
            showToast("Account deactivated", "success");
            loadSettingsStatus();
        } else {
            const data = await res.json();
            showToast(data.error || "Failed to deactivate account", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function exportData() {
    showToast("Preparing export...", "loading");

    try {
        const [cardsRes, setsRes, statsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' })
        ]);

        const cards = cardsRes.ok ? await cardsRes.json() : [];
        const sets = setsRes.ok ? await setsRes.json() : [];
        const stats = statsRes.ok ? await statsRes.json() : {};

        const exportData = {
            export_date: new Date().toISOString(),
            stats,
            cards,
            sets
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `streamer-dashboard-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("Export downloaded successfully", "success");
    } catch (err) {
        console.error("Export failed:", err);
        showToast("Failed to export data", "error");
    }
}

let creatorCards = [];

let isFetchingCards = false;
async function fetchCreatorCards() {
    if (isFetchingCards) return;
    console.log("[Creator] Fetching Cards...");
    const grid = document.getElementById('creator-cards-grid');

    // Show loading state ONLY if we don't have cards yet
    if (grid && creatorCards.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full space-y-4">
            ${Array(8).fill(0).map(() => `
                <div class="aspect-[5/7] rounded-xl bg-white/5 animate-pulse border border-white/5"></div>
            `).join('')}
        </div>
    `;
    }

    isFetchingCards = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (res.ok) {
            creatorCards = await res.json();
            renderCreatorCardsGrid();
        } else {
            throw new Error('Failed to fetch cards');
        }
    } catch (err) {
        console.error("[Creator] Failed to fetch cards:", err);
        if (grid && creatorCards.length === 0) {
            grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-4"></i>
                <p class="text-sm font-bold text-void-text mb-2">Failed to load cards</p>
                <p class="text-xs text-void-muted mb-4">${err.message || 'An error occurred'}</p>
                <button onclick="fetchCreatorCards()" class="px-6 py-3 bg-void-accent text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-void-accent-glow transition-all">
                    <i class="fa-solid fa-rotate-right mr-2"></i>Retry
                </button>
            </div>
        `;
        }
    } finally {
        isFetchingCards = false;
    }
}

function renderCreatorCardsGrid() {
    const grid = document.getElementById('creator-cards-grid');
    if (!grid) return;

    // Get filters
    const searchTerm = document.getElementById('card-search-input')?.value.toLowerCase() || '';
    const rarityFilter = document.getElementById('card-filter-rarity')?.value || '';
    const setFilter = document.getElementById('card-filter-set')?.value || '';

    // Filter cards
    let filteredCards = creatorCards.filter(card => {
        const matchesSearch = !searchTerm || card.name?.toLowerCase().includes(searchTerm) || card.description?.toLowerCase().includes(searchTerm);
        const matchesRarity = !rarityFilter || card.rarity?.toLowerCase() === rarityFilter.toLowerCase();
        const matchesSet = !setFilter || card.set_id === setFilter;
        return matchesSearch && matchesRarity && matchesSet;
    });

    if (filteredCards.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-void-muted">
            <i class="fa-solid fa-inbox text-4xl mb-4"></i>
            <p class="text-sm font-bold">${creatorCards.length === 0 ? 'No cards yet' : 'No cards match your filters'}</p>
            <p class="text-xs">${creatorCards.length === 0 ? 'Upload your first card to get started' : 'Try adjusting your search or filters'}</p>
        </div>
    `;
        return;
    }

    // Render with lazy loading and bulk selection support
    grid.innerHTML = filteredCards.map(card => {
        const isSelected = selectedCardIds.has(card.id);
        return `
    <div class="group relative aspect-[5/7] rounded-xl overflow-hidden border-2 ${isSelected ? 'border-void-accent' : 'border-white/5'} hover:border-void-accent/50 transition-all cursor-pointer ${bulkSelectMode ? '' : ''}" 
         onclick="${bulkSelectMode ? `toggleCardSelection('${card.id}')` : `editCard('${card.id}')`}">
        ${bulkSelectMode ? `
            <div class="absolute top-2 left-2 z-10 w-6 h-6 rounded-lg ${isSelected ? 'bg-void-accent' : 'bg-white/20'} flex items-center justify-center border-2 ${isSelected ? 'border-void-accent' : 'border-white/30'}">
                ${isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
            </div>
        ` : ''}
        <img src="${card.image_url || '/pack.png'}" alt="${card.name || 'Card'}" 
            class="w-full h-full object-cover ${isSelected ? 'opacity-75' : ''}" 
            loading="lazy"
            onerror="this.src='/pack.png'">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="absolute bottom-0 left-0 right-0 p-3">
                <div class="text-xs font-black text-white uppercase truncate">${card.name || 'Unnamed Card'}</div>
                <div class="text-[9px] font-black text-void-accent uppercase">${card.rarity || 'common'}</div>
            </div>
        </div>
        ${!bulkSelectMode ? `
            <button onclick="event.stopPropagation(); deleteCard('${card.id}')" 
                class="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>
        ` : ''}
        ${card.set_id ? `
            <div class="absolute ${bulkSelectMode ? 'top-2 right-2' : 'top-2 left-2'} px-2 py-1 bg-void-accent/80 rounded text-[8px] font-black text-white uppercase truncate max-w-[80%]">
                ${allSets.find(s => s.id === card.set_id)?.name || 'Set'}
            </div>
        ` : ''}
    </div>
`;
    }).join('');
}

function switchCreatorDashboardTab(tabName) {
    const tabs = ['overview', 'analytics', 'cards', 'editor', 'settings'];
    tabs.forEach(t => {
        const section = document.getElementById(`cd-section-${t}`);
        const btn = document.getElementById(`cd-tab-${t}`);
        if (section) section.classList.add('hidden');
        if (btn) {
            btn.classList.remove('bg-void-accent', 'text-white', 'shadow-lg', 'shadow-void-accent/20');
            btn.classList.add('text-void-muted', 'hover:text-void-text');
        }
    });

    const activeSection = document.getElementById(`cd-section-${tabName}`);
    const activeBtn = document.getElementById(`cd-tab-${tabName}`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        // Load data when switching tabs
        if (tabName === 'analytics') {
            loadAnalytics();
        } else if (tabName === 'settings') {
            loadSettingsStatus();
        } else if (tabName === 'overview') {
            loadOverviewData();
        } else if (tabName === 'cards') {
            // Switch to "All Cards" sub-tab by default
            switchCardsSubTab('all-cards');
        } else if (tabName === 'editor') {
            renderEditorView();
        }
    }
    if (activeBtn) {
        activeBtn.classList.remove('text-void-muted', 'hover:text-void-text');
        activeBtn.classList.add('bg-void-accent', 'text-white', 'shadow-lg', 'shadow-void-accent/20');
    }
}

// Cards sub-tab switching
function switchCardsSubTab(subTabName) {
    const subTabs = ['all-cards', 'upload', 'sets', 'pack', 'branding', 'card-backs'];
    subTabs.forEach(t => {
        const section = document.getElementById(`cards-subsection-${t}`);
        const btn = document.getElementById(`cards-subtab-${t}`);
        if (section) section.classList.add('hidden');
        if (btn) {
            btn.classList.remove('bg-void-accent', 'text-white', 'shadow-lg', 'shadow-void-accent/20');
            btn.classList.add('text-void-muted', 'hover:text-void-text');
        }
    });

    const activeSection = document.getElementById(`cards-subsection-${subTabName}`);
    const activeBtn = document.getElementById(`cards-subtab-${subTabName}`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        // Load data when switching sub-tabs
        if (subTabName === 'sets') {
            loadSets();
        } else if (subTabName === 'card-backs') {
            loadCardBacks();
        }
    }
    if (activeBtn) {
        activeBtn.classList.remove('text-void-muted', 'hover:text-void-text');
        activeBtn.classList.add('bg-void-accent', 'text-white', 'shadow-lg', 'shadow-void-accent/20');
    }
}

window.switchCardsSubTab = switchCardsSubTab;

// Legacy function for backward compatibility
function switchCreatorTab(tabName) {
    switchCreatorDashboardTab(tabName);
}

async function creatorMintCard() {
    const name = document.getElementById('cd-new-card-name').value;
    const rarity = document.getElementById('cd-new-card-rarity').value;

    if (!name || !rarity) {
        showToast("Please provide a name and rarity", "error");
        return;
    }

    showToast("Forging card...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, rarity }),
            credentials: 'include'
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            document.getElementById('cd-new-card-name').value = '';
            fetchCreatorStats();
        } else {
            showToast(data.error || "Failed to mint card", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function creatorAssemblePack() {
    const name = document.getElementById('cd-new-pack-name').value;
    const cost = document.getElementById('cd-new-pack-cost').value;

    if (!name) {
        showToast("Please provide a pack name", "error");
        return;
    }

    showToast("Assembling pack...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/packs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cost }),
            credentials: 'include'
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            document.getElementById('cd-new-pack-name').value = '';
            document.getElementById('cd-new-pack-cost').value = '';
            fetchCreatorStats();
        } else {
            showToast(data.error || "Failed to assemble pack", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function creatorTriggerDrop() {
    console.log("[Creator] Triggering Live Drop...");
    showToast("Initializing bot connection for live drop...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/drops`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
        } else {
            showToast(data.error || "Failed to trigger drop", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// --- Integrated Editor Functions ---
let editorCurrentSetId = null;
let editorAllCards = [];

async function renderEditorView() {
    const setList = document.getElementById('editor-set-list');
    if (!setList) return;

    setList.innerHTML = `<div class="text-center py-4 text-void-muted text-xs"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading...</div>`;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed');
        const sets = await res.json();

        if (sets.length === 0) {
            setList.innerHTML = `<div class="text-void-muted text-[10px] p-4 bg-white/5 rounded-xl border border-dashed border-white/10 uppercase tracking-widest text-center">No sets found</div>`;
            return;
        }

        setList.innerHTML = sets.map(s => `
            <button onclick="selectEditorSet('${s.id}')" id="editor-set-item-${s.id}" class="w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${editorCurrentSetId === s.id ? 'bg-void-accent/20 border-void-accent/40 text-void-accent' : 'bg-white/5 border-white/5 text-void-muted hover:bg-white/10 hover:border-white/10'}">
                <div class="flex items-center gap-3">
                    <i class="fa-solid ${s.is_active ? 'fa-box-open' : 'fa-box'} ${s.is_active ? 'text-void-accent' : 'text-void-muted'}"></i>
                    <div>
                        <div class="text-[11px] font-black uppercase tracking-tight ${editorCurrentSetId === s.id ? 'text-white' : 'group-hover:text-void-text'}">${s.name || 'Untitled Set'}</div>
                        <div class="text-[9px] font-bold opacity-60">${s.code || 'NO-CODE'}</div>
                    </div>
                </div>
                ${editorCurrentSetId === s.id ? '<i class="fa-solid fa-chevron-right text-xs"></i>' : ''}
            </button>
        `).join('');

        // Expose to window for global access if needed
        window.creatorSets = sets;

        if (!editorCurrentSetId && sets.length > 0) {
            selectEditorSet(sets[0].id);
        } else if (editorCurrentSetId) {
            // Re-select to refresh cards if needed
            selectEditorSet(editorCurrentSetId);
        }
    } catch (e) {
        console.error("[Editor] Error loading sets:", e);
        setList.innerHTML = `<div class="text-center py-4 text-red-400 text-[10px] p-4">Error loading sets</div>`;
    }
}

async function selectEditorSet(setId) {
    editorCurrentSetId = setId;

    // Update Sidebar UI
    const items = document.querySelectorAll('[id^="editor-set-item-"]');
    items.forEach(el => {
        el.classList.remove('bg-void-accent/20', 'border-void-accent/40', 'text-void-accent');
        el.classList.add('bg-white/5', 'border-white/5', 'text-void-muted');
        const chevron = el.querySelector('.fa-chevron-right');
        if (chevron) chevron.remove();

        const title = el.querySelector('.font-black');
        if (title) title.classList.remove('text-white');
    });

    const activeEl = document.getElementById(`editor-set-item-${setId}`);
    if (activeEl) {
        activeEl.classList.add('bg-void-accent/20', 'border-void-accent/40', 'text-void-accent');
        activeEl.classList.remove('bg-white/5', 'border-white/5', 'text-void-muted');
        activeEl.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-chevron-right text-xs"></i>');
        const title = activeEl.querySelector('.font-black');
        if (title) title.classList.add('text-white');
    }

    // Update Banner
    if (window.creatorSets) {
        const set = window.creatorSets.find(s => s.id === setId);
        if (set) {
            document.getElementById('editor-current-set-title').textContent = set.name;
        }
    }

    loadEditorCards();
}

async function loadEditorCards() {
    const grid = document.getElementById('editor-card-grid');
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-full py-12 flex flex-col items-center justify-center text-void-muted gap-4">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-void-accent"></i>
        <div class="text-[10px] font-black uppercase tracking-[0.3em]">Accessing Matrix Data...</div>
    </div>`;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (!res.ok) throw new Error('API Error');
        const cards = await res.json();

        // Filter by set
        editorAllCards = cards.filter(c => c.set_id === editorCurrentSetId);

        document.getElementById('editor-card-count').textContent = `${editorAllCards.length} Cards`;

        renderEditorGrid(editorAllCards);
    } catch (e) {
        console.error("[Editor] Error loading cards:", e);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-500 font-black">CONNECTION FAILURE</div>`;
    }
}

function renderEditorGrid(cards) {
    const grid = document.getElementById('editor-card-grid');
    if (!grid) return;

    if (cards.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
            <i class="fa-solid fa-cards-blank text-4xl text-white/5"></i>
            <div class="text-xs text-void-muted">This set is currently empty.</div>
            <button onclick="openQuickAddCard()" class="text-void-accent font-black text-[10px] uppercase hover:underline">Add Your First Card</button>
        </div>`;
        return;
    }

    grid.innerHTML = cards.map(card => `
        <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden group hover:border-void-accent/40 transition-all flex flex-col">
            <div class="aspect-[5/7] relative overflow-hidden bg-black/40">
                <img src="${card.image_url || '/pack.png'}" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-700">
                <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div class="flex items-center justify-between">
                        <span class="text-[8px] font-black uppercase tracking-widest text-void-accent">${card.rarity}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black text-white"><i class="fa-solid fa-sword mr-1 opacity-60"></i>${card.attack || 0}</span>
                            <span class="text-[10px] font-black text-white"><i class="fa-solid fa-shield mr-1 opacity-60"></i>${card.defense || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-3 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                    <input type="text" value="${card.name}" onchange="updateCardInline('${card.id}', 'name', this.value)" class="w-full bg-transparent text-[11px] font-black uppercase text-white border-none focus:ring-0 p-0 mb-1 truncate">
                    <div class="text-[8px] text-void-muted uppercase font-bold">Protocol ${card.card_number || '---'}</div>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="editCard('${card.id}')" class="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[8px] font-black uppercase transition-all">Edit</button>
                    <button onclick="openLayerEditorForCard('${card.id}')" title="Edit Art (Layer Editor)" class="w-8 h-8 bg-void-accent/10 text-void-accent hover:bg-void-accent hover:text-void-bg rounded-lg flex items-center justify-center transition-all text-[10px]">
                        <i class="fa-solid fa-pen-ruler"></i>
                    </button>
                    <button onclick="deleteCard('${card.id}')" class="w-8 h-8 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all text-[10px]">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function updateCardInline(cardId, field, value) {
    try {
        const payload = { id: cardId, [field]: value };
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        if (res.ok) {
            showToast('Sync Successful', 'success');
            const card = editorAllCards.find(c => c.id === cardId);
            if (card) card[field] = value;
            // Re-apply filters and re-render
            const queryInput = document.getElementById('editor-card-search');
            const rarityInput = document.getElementById('editor-rarity-filter');
            const query = queryInput?.value?.toLowerCase() || '';
            const rarity = rarityInput?.value || '';
            const filtered = editorAllCards.filter(c => {
                const matchesQuery = !query || c.name.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query));
                const matchesRarity = !rarity || c.rarity.toLowerCase() === rarity.toLowerCase();
                return matchesQuery && matchesRarity;
            });
            renderEditorGrid(filtered);
        } else {
            const d = await res.json();
            showToast(d.error || 'Sync Failed', 'error');
        }
    } catch (e) {
        showToast('Connection Error', 'error');
    }
}

window.openQuickAddCard = function () {
    // We leverage the existing card creator modal but set the current set
    const modal = document.getElementById('card-creator-modal');
    if (modal) {
        modal.classList.remove('hidden');
        resetCardCreatorForm();

        // Ensure the dropdown for sets is present and set to current
        if (typeof populateSetDropdowns === 'function') {
            populateSetDropdowns();
        }
        const setDropdown = document.getElementById('card-creator-set');
        if (setDropdown && editorCurrentSetId) {
            setDropdown.value = editorCurrentSetId;
        }
    }
};

// Add filter listener for editor
document.addEventListener('input', e => {
    if (e.target.id === 'editor-card-search' || e.target.id === 'editor-rarity-filter') {
        const queryInput = document.getElementById('editor-card-search');
        const rarityInput = document.getElementById('editor-rarity-filter');
        if (!queryInput || !rarityInput) return;

        const query = queryInput.value.toLowerCase();
        const rarity = rarityInput.value;

        const filtered = editorAllCards.filter(c => {
            const matchesQuery = c.name.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query));
            const matchesRarity = !rarity || c.rarity.toLowerCase() === rarity.toLowerCase();
            return matchesQuery && matchesRarity;
        });

        renderEditorGrid(filtered);
    }
});

// Global exports
window.renderEditorView = renderEditorView;
window.selectEditorSet = selectEditorSet;
window.updateCardInline = updateCardInline;

// ============================================
// NEW CREATOR DASHBOARD FUNCTIONS
// ============================================

// Card Creator Modal
function openCardCreator() {
    const modal = document.getElementById('card-creator-modal');
    if (modal) {
        modal.classList.remove('hidden');
        resetCardCreatorForm();
    }
}

function closeCardCreator() {
    const modal = document.getElementById('card-creator-modal');
    if (modal) modal.classList.add('hidden');
}

// Processed blob from card image scaler (used when saving card)
let _cardCreatorProcessedBlob = null;

function resetCardCreatorForm() {
    document.getElementById('card-creator-name').value = '';
    document.getElementById('card-creator-rarity').value = 'common';
    document.getElementById('card-creator-description').value = '';
    document.getElementById('card-creator-attack').value = '0';
    document.getElementById('card-creator-defense').value = '0';
    // mechanic reset removed
    document.getElementById('card-image-preview').classList.add('hidden');
    document.getElementById('card-image-placeholder').classList.remove('hidden');
    document.getElementById('card-creator-image').value = '';
    const scaleBtn = document.getElementById('card-creator-scale-btn');
    if (scaleBtn) scaleBtn.classList.add('hidden');
    _cardCreatorProcessedBlob = null;

    const title = document.getElementById('card-creator-title');
    if (title) title.innerText = 'Create Card';
    const submitText = document.getElementById('card-creator-submit-text');
    if (submitText) submitText.innerText = 'Create Card';

    updateCardBudget();
}

// Stat Budgeting Logic
function getRarityBudget(rarity) {
    switch (rarity.toLowerCase()) {
        case 'legendary': return 14; // Tightened
        case 'epic': return 12;      // Smoothed
        case 'rare': return 10;      // Smoothed
        case 'uncommon': return 8;    // Balanced
        default: return 6;           // Buffed
    }
}

function updateCardBudget(changedInputId = null) {
    const rarity = document.getElementById('card-creator-rarity').value;
    const atkInput = document.getElementById('card-creator-attack');
    const defInput = document.getElementById('card-creator-defense');
    const budgetDisplay = document.getElementById('card-creator-budget-display');
    const budget = getRarityBudget(rarity);

    let atk = parseInt(atkInput.value) || 0;
    let def = parseInt(defInput.value) || 0;

    // Minimums: Cards must have at least 1 HP to survive entry.
    if (atk < 0) atk = 0;
    if (def < 1) def = 1;

    // Total cannot exceed budget
    let currentTotal = atk + def;
    if (currentTotal > budget) {
        if (changedInputId === 'card-creator-attack') {
            atk = Math.min(atk, budget);
            def = budget - atk;
        } else if (changedInputId === 'card-creator-defense') {
            def = Math.min(def, budget);
            atk = budget - def;
        } else {
            // General re-balance (e.g. rarity changed)
            if (atk > budget) {
                atk = budget;
                def = 0;
            } else {
                def = budget - atk;
            }
        }
    }

    atkInput.value = atk;
    defInput.value = def;

    if (budgetDisplay) {
        budgetDisplay.textContent = `${atk + def} / ${budget} Points`;
        if (atk + def > budget) budgetDisplay.classList.add('text-red-400');
        else budgetDisplay.classList.remove('text-red-400');
    }
}

// Mechanic Population Logic


// Listeners for creator points re-calc
document.getElementById('card-creator-rarity')?.addEventListener('change', () => updateCardBudget());
document.getElementById('card-creator-attack')?.addEventListener('input', () => updateCardBudget('card-creator-attack'));
document.getElementById('card-creator-defense')?.addEventListener('input', () => updateCardBudget('card-creator-defense'));

// Card Image Preview
const cardCreatorImageInput = document.getElementById('card-creator-image');
if (cardCreatorImageInput) {
    cardCreatorImageInput.onchange = (e) => {
        const file = e.target.files[0];
        _cardCreatorProcessedBlob = null;
        if (file) {
            if (file.size > CARD_IMAGE_MAX_BYTES) {
                showToast(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 'error');
                e.target.value = '';
                return;
            }
            // Open crop modal: position + zoom within 5:7 card frame (real-time)
            openCardImageCropModal(file, (blob) => {
                _cardCreatorProcessedBlob = blob;
                const preview = document.getElementById('card-image-preview');
                const placeholder = document.getElementById('card-image-placeholder');
                if (preview) {
                    preview.src = URL.createObjectURL(blob);
                    preview.classList.remove('hidden');
                }
                if (placeholder) placeholder.classList.add('hidden');
                const scaleBtn = document.getElementById('card-creator-scale-btn');
                if (scaleBtn) scaleBtn.classList.remove('hidden');
            });
        } else {
            const scaleBtn = document.getElementById('card-creator-scale-btn');
            if (scaleBtn) scaleBtn.classList.add('hidden');
        }
    };
}

// Save Card
async function saveCard() {
    const name = document.getElementById('card-creator-name').value;
    const rarity = document.getElementById('card-creator-rarity').value;
    const description = document.getElementById('card-creator-description').value;
    const attack = parseInt(document.getElementById('card-creator-attack').value) || 0;
    const defense = parseInt(document.getElementById('card-creator-defense').value) || 0;
    const imageFile = document.getElementById('card-creator-image').files[0];

    if (!name || !rarity) {
        showToast("Please provide a name and rarity", "error");
        return;
    }

    showToast("Creating card...", "loading");

    try {
        let imageUrl = '/pack.png'; // Default placeholder

        // Upload image if provided (use processed blob from scaler or process file to WebP/max edge)
        let blobToUpload = _cardCreatorProcessedBlob;
        if (!blobToUpload && imageFile) {
            try {
                blobToUpload = await processCardImage(imageFile, CARD_IMAGE_MAX_EDGE_PX);
            } catch (e) {
                showToast(e.message || 'Image processing failed', 'error');
                return;
            }
        }
        if (blobToUpload) {
            const formData = new FormData();
            formData.append('file', blobToUpload, 'card.webp');
            const uploadRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.url;
            }
            _cardCreatorProcessedBlob = null;
        } else {
            // If editing without changing the image, keep the existing one
            const previewEl = document.getElementById('card-image-preview');
            if (previewEl && !previewEl.classList.contains('hidden')) {
                imageUrl = previewEl.src;
            }
        }

        // Get set_id if selected
        const setId = document.getElementById('card-creator-set')?.value || null;

        // Get card ID if editing
        const cardId = document.getElementById('card-creator-modal').dataset.cardId || null;

        const payload = {
            name,
            rarity,
            description,
            attack,
            defense,
            image_url: imageUrl,
            set_id: setId
        };
        if (cardId) payload.id = cardId;

        // Create or update card
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        const data = await res.json();
        if (res.ok) {
            showToast("Card created successfully!", "success");
            closeCardCreator();
            fetchCreatorCards();
            fetchCreatorStats();
            if (editorCurrentSetId) loadEditorCards(); // Refresh editor grid
        } else {
            showToast(data.error || "Failed to create card", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Delete Card
async function deleteCard(cardId) {
    if (!await showConfirm('Are you sure you want to delete this card? This action cannot be undone.')) return;

    showToast("Deleting card...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Card deleted successfully", "success");
            fetchCreatorCards();
            fetchCreatorStats();
            loadOverviewData(); // Refresh overview stats
            if (editorCurrentSetId) loadEditorCards(); // Refresh editor grid
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || "Failed to delete card", "error");
        }
    } catch (err) {
        console.error("[Creator] Delete card error:", err);
        showToast("Connection error. Please try again.", "error");
    }
}

// Edit Card
function editCard(cardId) {
    const card = creatorCards.find(c => c.id === cardId) || editorAllCards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('card-creator-name').value = card.name;
    document.getElementById('card-creator-rarity').value = card.rarity;
    document.getElementById('card-creator-description').value = card.description || '';
    document.getElementById('card-creator-attack').value = card.attack || 0;
    document.getElementById('card-creator-defense').value = card.defense || 0;
    // mechanic populate removed

    updateCardBudget();

    const preview = document.getElementById('card-image-preview');
    const placeholder = document.getElementById('card-image-placeholder');
    if (card.image_url) {
        preview.src = card.image_url;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }

    const title = document.getElementById('card-creator-title');
    if (title) title.innerText = 'Edit Card';
    const submitText = document.getElementById('card-creator-submit-text');
    if (submitText) submitText.innerText = 'Save Changes';

    const modal = document.getElementById('card-creator-modal');
    if (modal) modal.classList.remove('hidden');
    document.getElementById('card-creator-modal').dataset.cardId = cardId;
    // Pre-select set in dropdown
    if (typeof populateSetDropdowns === 'function') populateSetDropdowns();
    const setDropdown = document.getElementById('card-creator-set');
    if (setDropdown && card.set_id) setDropdown.value = card.set_id;
}

// Drag & Drop Upload
function setupDragAndDrop() {
    const uploadZone = document.getElementById('card-upload-zone');
    const fileInput = document.getElementById('card-image-upload');

    if (!uploadZone || !fileInput) return;

    uploadZone.onclick = () => fileInput.click();

    uploadZone.ondragover = (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-void-accent', 'bg-void-accent/5');
    };

    uploadZone.ondragleave = () => {
        uploadZone.classList.remove('border-void-accent', 'bg-void-accent/5');
    };

    uploadZone.ondrop = (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-void-accent', 'bg-void-accent/5');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            handleBulkImageUpload(files);
        }
    };

    fileInput.onchange = (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            handleBulkImageUpload(files);
        }
        e.target.value = '';
    };
}

function handleBulkImageUpload(files) {
    const over = files.filter(f => f.size > CARD_IMAGE_MAX_BYTES);
    if (over.length) {
        showToast(`${over.length} file(s) over 8MB — remove or scale them`, 'error');
        return;
    }
    openCardImageScalerModal({
        files,
        onApply: async (blobEntries) => {
            if (!blobEntries || blobEntries.length === 0) return;
            showToast(`Uploading ${blobEntries.length} image(s)...`, 'loading');
            for (const { blob, name } of blobEntries) {
                try {
                    const formData = new FormData();
                    formData.append('file', blob, name);
                    const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                        method: 'POST',
                        headers: { 'X-CSRF-Token': csrfToken },
                        body: formData,
                        credentials: 'include'
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        await fetch(`${BACKEND_URL}/api/creator/cards`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({
                                name: name.replace(/\.webp$/i, ''),
                                rarity: 'common',
                                image_url: uploadData.url
                            }),
                            credentials: 'include'
                        });
                    } else {
                        const err = await uploadRes.json().catch(() => ({}));
                        showToast(err.error || 'Upload failed', 'error');
                    }
                } catch (err) {
                    console.error('Upload error:', err);
                    showToast('Upload error', 'error');
                }
            }
            showToast('Upload complete!', 'success');
            fetchCreatorCards();
            fetchCreatorStats();
        }
    });
}

// Bulk Upload Modal
function openBulkUpload() {
    const modal = document.getElementById('bulk-upload-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeBulkUpload() {
    const modal = document.getElementById('bulk-upload-modal');
    if (modal) modal.classList.add('hidden');
}

// Pack Customization
function updatePackPreview() {
    const preview = document.getElementById('pack-preview');
    // Preview updates are now handled by pack image only
}

function toggleAdvancedPackOptions() {
    const options = document.getElementById('advanced-pack-options');
    const icon = document.getElementById('advanced-options-icon');
    if (options && icon) {
        options.classList.toggle('hidden');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    }
}

// Animation speed slider
const packAnimationSpeed = document.getElementById('pack-animation-speed');
if (packAnimationSpeed) {
    packAnimationSpeed.oninput = (e) => {
        const value = parseFloat(e.target.value).toFixed(1);
        const display = document.getElementById('animation-speed-value');
        if (display) display.textContent = value;
    };
}

// Sound volume slider
const packSoundVolume = document.getElementById('pack-sound-volume');
if (packSoundVolume) {
    packSoundVolume.oninput = (e) => {
        const value = e.target.value;
        const display = document.getElementById('pack-volume-value');
        if (display) display.textContent = value;
    };
}

async function savePackCustomization() {
    const imageFile = document.getElementById('pack-image-upload')?.files[0];
    const soundFile = document.getElementById('pack-sound-upload')?.files[0];
    const animationSpeed = parseFloat(document.getElementById('pack-animation-speed')?.value || '1');
    const soundVolume = parseInt(document.getElementById('pack-sound-volume')?.value || '50');
    const particlesEnabled = document.getElementById('pack-particles-enabled')?.checked || false;
    const openingStyle = document.getElementById('pack-opening-style')?.value || 'standard';

    showToast("Saving pack customization...", "loading");

    try {
        let imageUrl = null;
        let soundUrl = null;

        if (imageFile) {
            const formData = new FormData();
            formData.append('file', imageFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
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

        if (soundFile) {
            const formData = new FormData();
            formData.append('file', soundFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                soundUrl = uploadData.url;
            }
        }

        // Save to backend
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                pack_image_url: imageUrl,
                pack_open_sound_url: soundUrl,
                pack_config: JSON.stringify({
                    animation_speed: animationSpeed,
                    sound_volume: soundVolume,
                    particles_enabled: particlesEnabled,
                    opening_style: openingStyle
                })
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Pack customization saved!", "success");
            if (imageUrl) {
                document.getElementById('pack-preview-image').src = imageUrl;
            }
        } else {
            showToast("Failed to save customization", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function savePackThemePreset() {
    // Pack emoji and colors removed
    const animationSpeed = parseFloat(document.getElementById('pack-animation-speed')?.value || '1');
    const soundVolume = parseInt(document.getElementById('pack-sound-volume')?.value || '50');
    const particlesEnabled = document.getElementById('pack-particles-enabled')?.checked || false;
    const openingStyle = document.getElementById('pack-opening-style')?.value || 'standard';

    const presetName = prompt("Enter a name for this theme preset:");
    if (!presetName) return;

    const preset = {
        name: presetName,
        animationSpeed,
        soundVolume,
        particlesEnabled,
        openingStyle,
        savedAt: new Date().toISOString()
    };

    // Save to localStorage (could be saved to backend later)
    const presets = JSON.parse(localStorage.getItem('packThemePresets') || '[]');
    presets.push(preset);
    localStorage.setItem('packThemePresets', JSON.stringify(presets));

    showToast(`Theme preset "${presetName}" saved!`, "success");
}

function loadPackThemePreset(preset) {
    if (document.getElementById('pack-animation-speed')) document.getElementById('pack-animation-speed').value = preset.animationSpeed;
    if (document.getElementById('pack-sound-volume')) document.getElementById('pack-sound-volume').value = preset.soundVolume;
    if (document.getElementById('pack-particles-enabled')) document.getElementById('pack-particles-enabled').checked = preset.particlesEnabled;
    if (document.getElementById('pack-opening-style')) document.getElementById('pack-opening-style').value = preset.openingStyle;

    updatePackPreview();
    const volumeDisplay = document.getElementById('pack-volume-value');
    if (volumeDisplay) volumeDisplay.textContent = preset.soundVolume;
    const speedDisplay = document.getElementById('animation-speed-value');
    if (speedDisplay) speedDisplay.textContent = parseFloat(preset.animationSpeed).toFixed(1);
}

function resetPackImage() {
    document.getElementById('pack-preview-image').src = '/pack.png';
    document.getElementById('pack-image-upload').value = '';
}

function testPackSound() {
    const soundFile = document.getElementById('pack-sound-upload')?.files[0];
    if (soundFile) {
        const audio = new Audio(URL.createObjectURL(soundFile));
        audio.play();
    }
}

// Pack Manager
function openPackManager() {
    const modal = document.getElementById('pack-manager-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadPacks();
    }
}

function closePackManager() {
    const modal = document.getElementById('pack-manager-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadPacks() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/packs`, { credentials: 'include' });
        if (res.ok) {
            const packs = await res.json();
            renderPacksList(packs);
        }
    } catch (err) {
        console.error('Failed to load packs:', err);
    }
}

function renderPacksList(packs) {
    const packsList = document.getElementById('packs-list');
    if (!packsList) return;

    if (!packs || packs.length === 0) {
        packsList.innerHTML = '<p class="text-xs text-void-muted uppercase tracking-widest font-bold text-center py-4">No packs created yet</p>';
        return;
    }

    packsList.innerHTML = packs.map(pack => `
        <div class="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl group hover:border-void-accent/30 transition-all">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-void-accent/10 flex items-center justify-center text-void-accent">
                    <i class="fa-solid fa-box-open text-xs"></i>
                </div>
                <div>
                    <div class="text-[11px] font-black uppercase text-white">${pack.name}</div>
                    <div class="text-[8px] font-bold text-void-muted uppercase tracking-widest">${pack.code || 'TCG'} • ${pack.is_active ? 'Active' : 'Inactive'}</div>
                </div>
            </div>
            <button onclick="editPack('${pack.id}')" class="opacity-0 group-hover:opacity-100 p-2 text-void-accent hover:text-white transition-all">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
        </div>
    `).join('');
}

async function createPack() {
    const name = document.getElementById('new-pack-name')?.value;
    const cost = parseInt(document.getElementById('new-pack-cost')?.value) || 0;

    if (!name) {
        showToast("Please provide a pack name", "error");
        return;
    }

    showToast(editingPackId ? "Updating pack..." : "Creating pack...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/packs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ id: editingPackId, name, cost }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast(editingPackId ? "Pack updated!" : "Pack created!", "success");
            document.getElementById('new-pack-name').value = '';
            document.getElementById('new-pack-cost').value = '';
            editingPackId = null;
            const btn = document.querySelector('button[onclick="createPack()"]');
            if (btn) btn.textContent = 'Create Pack';
            loadPacks();
        } else {
            showToast("Failed to save pack", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

let editingPackId = null;

function editPack(packId) {
    // In a real app, we'd fetch the pack details or find it in a local cache
    // For now, we'll just toggle the UI to an edit state if we had one
    // But since the current UI only has a 'Create' form, we'll just populate it
    const packsList = document.getElementById('packs-list');
    const packDiv = Array.from(packsList.children).find(div => div.outerHTML.includes(`editPack('${packId}')`));
    if (packDiv) {
        const name = packDiv.querySelector('.text-\\[11px\\]').textContent;
        document.getElementById('new-pack-name').value = name;
        editingPackId = packId;
        // Change button text to indicate update
        const btn = document.querySelector('button[onclick="createPack()"]');
        if (btn) btn.textContent = 'Update Pack';
    }
}

// Twitch Settings
function openTwitchSettings() {
    const modal = document.getElementById('twitch-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadTwitchSettings();
    }
}

function closeTwitchSettings() {
    const modal = document.getElementById('twitch-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadTwitchSettings() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' });
        if (res.ok) {
            const settings = await res.json();
            if (settings.twitch_reward_id) {
                document.getElementById('twitch-reward-id').value = settings.twitch_reward_id;
            }
            if (settings.twitch_battle_reward_id) {
                document.getElementById('twitch-battle-reward-id').value = settings.twitch_battle_reward_id;
            }
        }
    } catch (err) {
        console.error("Failed to load Twitch settings:", err);
    }
}

async function saveTwitchSettings() {
    const rewardId = document.getElementById('twitch-reward-id')?.value;
    const battleRewardId = document.getElementById('twitch-battle-reward-id')?.value;

    showToast("Saving Twitch settings...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                twitch_reward_id: rewardId,
                twitch_battle_reward_id: battleRewardId
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Twitch settings saved!", "success");
            closeTwitchSettings();
        } else {
            showToast("Failed to save settings", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function autoCreateTwitchReward(targetInputId) {
    const inputId = targetInputId || 'twitch-reward-id';
    showToast("Creating Channel Points reward...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/twitch/auto-reward`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                // Defaults; creators can adjust cost/limits later in Twitch dashboard
                title: 'Open a Card Pack',
                cost: 500,
                mode: 'once_per_stream' // safe default: only once per stream (global)
            }),
            credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) {
            const msg = data && data.error ? data.error : 'Failed to auto-create reward';
            showToast(msg, 'error');
            return;
        }

        if (data.reward_id) {
            const input = document.getElementById(inputId);
            if (input) input.value = data.reward_id;
        }

        showToast("Channel Points reward created! You can tweak it in your Twitch dashboard.", "success");
    } catch (err) {
        console.error('Auto reward create failed', err);
        showToast("Could not contact server to create reward", "error");
    }
}

async function createStarterCardFromWizard() {
    showToast('Creating starter card...', 'loading');

    try {
        if (!csrfToken) {
            await fetchCSRFToken();
        }

        const base =
            (currentUser && (currentUser.display_name || currentUser.name || currentUser.username)) ||
            'Streamer';
        const cardName = `${base}'s Starter Card`;

        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                name: cardName,
                rarity: 'rare'
            })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Starter card create failed:', text);
            showToast('Failed to create starter card', 'error');
            return;
        }

        showToast('Starter card created! You can see and edit it in the Cards tab.', 'success');
        updateWizardCardCount();
    } catch (err) {
        console.error('Starter card creation error:', err);
        showToast('Error creating starter card', 'error');
    }
}

// Update stats display
async function updateCreatorStats() {
    const mintedEl = document.getElementById('cd-stat-minted');
    const commEl = document.getElementById('cd-stat-community');
    const statusEl = document.getElementById('cd-status');

    if (mintedEl) mintedEl.textContent = creatorCards.length;
    if (commEl) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' });
            if (res.ok) {
                const stats = await res.json();
                commEl.textContent = stats.community || 0;
            }
        } catch (err) {
            commEl.textContent = '0';
        }
    }
}

// Initialize pack preview updates (removed emoji and color inputs)

// ============================================
// SET MANAGEMENT
// ============================================
let creatorSets = [];
let selectedCardIds = new Set();
let bulkSelectMode = false;

async function loadSets() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' });
        if (res.ok) {
            creatorSets = await res.json();
            renderSetsList();
            populateSetDropdowns();
        }
    } catch (err) {
        console.error("Failed to load sets:", err);
    }
}

function renderSetsList() {
    const list = document.getElementById('sets-list');
    const managerList = document.getElementById('sets-manager-list');

    if (list) {
        if (creatorSets.length === 0) {
            list.innerHTML = `
            <div class="col-span-full text-center py-12 text-void-muted">
                <i class="fa-solid fa-folder-open text-4xl mb-4"></i>
                <p class="text-sm font-bold">No sets yet</p>
                <p class="text-xs">Create your first set to organize your cards</p>
            </div>
        `;
        } else {
            list.innerHTML = creatorSets.map(set => `
            <div class="glass-panel rounded-2xl border border-white/5 p-6 hover:border-void-accent/30 transition-all cursor-pointer group" onclick="editSet('${set.id}')">
                <div class="flex items-center gap-4 mb-3">
                    ${set.icon_url ? `<img src="${set.icon_url}" alt="${set.name}" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 rounded-lg bg-void-accent/20 flex items-center justify-center text-xl"><i class="fa-solid fa-folder"></i></div>'}
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-black text-void-text uppercase truncate">${set.name}</h4>
                        <p class="text-[9px] text-void-muted">${set.code || 'No code'}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-void-muted">${set.total_cards || 0} cards</span>
                    <button onclick="event.stopPropagation(); deleteSet('${set.id}')" 
                        class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
        }
    }

    if (managerList) {
        if (creatorSets.length === 0) {
            managerList.innerHTML = '<p class="text-sm text-void-muted text-center py-8">No sets yet. Create your first set!</p>';
        } else {
            managerList.innerHTML = creatorSets.map(set => `
            <div class="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-void-accent/30 transition-all">
                ${set.icon_url ? `<img src="${set.icon_url}" alt="${set.name}" class="w-10 h-10 rounded object-cover">` : '<div class="w-10 h-10 rounded bg-void-accent/20 flex items-center justify-center text-lg">📁</div>'}
                <div class="flex-1">
                    <div class="text-sm font-black text-void-text">${set.name}</div>
                    <div class="text-[9px] text-void-muted">${set.code} • ${set.total_cards || 0} cards</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editSet('${set.id}')" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                        <i class="fa-solid fa-edit text-xs"></i>
                    </button>
                    <button onclick="deleteSet('${set.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-all">
                        <i class="fa-solid fa-trash text-xs text-red-500"></i>
                    </button>
                </div>
            </div>
        `).join('');
        }
    }
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
        dropdown.innerHTML = '<option value="">No Set</option>';
        if (dropdown.id === 'card-filter-set' || dropdown.id === 'bulk-set-assign') {
            dropdown.innerHTML = '<option value="">All Sets</option>';
        }
        creatorSets.forEach(set => {
            const option = document.createElement('option');
            option.value = set.id;
            option.textContent = `${set.name} (${set.total_cards || 0})`;
            dropdown.appendChild(option);
        });
        if (currentValue) dropdown.value = currentValue;
    });
}

function openSetManager() {
    const modal = document.getElementById('set-manager-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadSets();
        resetSetForm();
    }
}

function closeSetManager() {
    const modal = document.getElementById('set-manager-modal');
    if (modal) modal.classList.add('hidden');
    resetSetForm();
}

function resetSetForm() {
    document.getElementById('set-edit-id').value = '';
    document.getElementById('set-name').value = '';
    document.getElementById('set-code').value = '';
    document.getElementById('set-description').value = '';
    document.getElementById('set-form-title').textContent = 'Create New Set';
    document.getElementById('save-set-btn').innerHTML = '<i class="fa-solid fa-check mr-2"></i>Save Set';
    document.getElementById('cancel-set-btn').classList.add('hidden');
    document.getElementById('set-icon-preview').classList.add('hidden');
    document.getElementById('set-icon-upload').value = '';
}

function editSet(setId) {
    const set = creatorSets.find(s => s.id === setId);
    if (!set) return;

    document.getElementById('set-edit-id').value = set.id;
    document.getElementById('set-name').value = set.name;
    document.getElementById('set-code').value = set.code;
    document.getElementById('set-description').value = set.description || '';
    document.getElementById('set-form-title').textContent = 'Edit Set';
    document.getElementById('save-set-btn').innerHTML = '<i class="fa-solid fa-save mr-2"></i>Update Set';
    document.getElementById('cancel-set-btn').classList.remove('hidden');

    if (set.icon_url) {
        document.getElementById('set-icon-preview-img').src = set.icon_url;
        document.getElementById('set-icon-preview').classList.remove('hidden');
    }

    // Scroll to form
    document.getElementById('set-name').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelSetEdit() {
    resetSetForm();
}

async function saveSet() {
    const setId = document.getElementById('set-edit-id').value;
    const name = document.getElementById('set-name').value;
    const code = document.getElementById('set-code').value;
    const description = document.getElementById('set-description').value;
    const iconFile = document.getElementById('set-icon-upload').files[0];

    if (!name) {
        showToast("Please provide a set name", "error");
        return;
    }

    showToast(setId ? "Updating set..." : "Creating set...", "loading");

    try {
        let iconUrl = null;
        if (iconFile) {
            const formData = new FormData();
            formData.append('file', iconFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                iconUrl = uploadData.url;
            }
        }

        const setData = {
            name,
            code: code || name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10),
            description,
            icon_url: iconUrl
        };

        if (setId) setData.id = setId;

        const res = await fetch(`${BACKEND_URL}/api/creator/sets`, {
            method: setId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(setId ? { ...setData, id: setId } : setData),
            credentials: 'include'
        });

        if (res.ok) {
            showToast(setId ? "Set updated!" : "Set created!", "success");
            loadSets();
            resetSetForm();
        } else {
            const error = await res.json();
            showToast(error.error || "Failed to save set", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function deleteSet(setId) {
    if (!confirm('Are you sure you want to delete this set? Cards will be unassigned but not deleted.')) return;

    showToast("Deleting set...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/sets/${setId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Set deleted", "success");
            loadSets();
        } else {
            showToast("Failed to delete set", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Set icon preview
const setIconUpload = document.getElementById('set-icon-upload');
if (setIconUpload) {
    setIconUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('set-icon-preview');
                const previewImg = document.getElementById('set-icon-preview-img');
                if (preview && previewImg) {
                    previewImg.src = event.target.result;
                    preview.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// ============================================
// BULK OPERATIONS
// ============================================

function toggleBulkSelect() {
    bulkSelectMode = !bulkSelectMode;
    const btn = document.getElementById('bulk-select-btn');
    const toolbar = document.getElementById('bulk-actions-toolbar');

    if (bulkSelectMode) {
        if (btn) btn.classList.add('bg-void-accent', 'text-white');
        if (toolbar) toolbar.classList.remove('hidden');
        renderCreatorCardsGrid();
    } else {
        if (btn) btn.classList.remove('bg-void-accent', 'text-white');
        if (toolbar) toolbar.classList.add('hidden');
        selectedCardIds.clear();
        renderCreatorCardsGrid();
    }
    updateSelectedCount();
}

function clearBulkSelect() {
    selectedCardIds.clear();
    bulkSelectMode = false;
    toggleBulkSelect();
}

function toggleCardSelection(cardId) {
    if (selectedCardIds.has(cardId)) {
        selectedCardIds.delete(cardId);
    } else {
        selectedCardIds.add(cardId);
    }
    updateSelectedCount();
    renderCreatorCardsGrid();
}

function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = selectedCardIds.size;
}

async function bulkAssignSet() {
    const setId = document.getElementById('bulk-set-assign').value;
    if (!setId || selectedCardIds.size === 0) {
        showToast("Please select a set and cards", "error");
        return;
    }

    showToast(`Assigning ${selectedCardIds.size} cards to set...`, "loading");

    try {
        let success = 0;
        let failed = 0;

        for (const cardId of selectedCardIds) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}/assign-set`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ set_id: setId }),
                    credentials: 'include'
                });
                if (res.ok) success++;
                else failed++;
            } catch (err) {
                failed++;
            }
        }

        showToast(`Assigned ${success} cards${failed > 0 ? `, ${failed} failed` : ''}`, success > 0 ? "success" : "error");
        clearBulkSelect();
        fetchCreatorCards();
        loadSets();
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function bulkDeleteCards() {
    if (selectedCardIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCardIds.size} card(s)?`)) return;

    showToast(`Deleting ${selectedCardIds.size} cards...`, "loading");

    try {
        let success = 0;
        let failed = 0;

        for (const cardId of selectedCardIds) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': csrfToken },
                    credentials: 'include'
                });
                if (res.ok) success++;
                else failed++;
            } catch (err) {
                failed++;
            }
        }

        showToast(`Deleted ${success} cards${failed > 0 ? `, ${failed} failed` : ''}`, success > 0 ? "success" : "error");
        clearBulkSelect();
        fetchCreatorCards();
        fetchCreatorStats();
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Update renderCreatorCardsGrid to support bulk selection and filtering
const originalRenderCreatorCardsGrid = renderCreatorCardsGrid;
renderCreatorCardsGrid = function () {
    const grid = document.getElementById('creator-cards-grid');
    if (!grid) return;

    // Get filters
    const searchTerm = document.getElementById('card-search-input')?.value.toLowerCase() || '';
    const rarityFilter = document.getElementById('card-filter-rarity')?.value || '';
    const setFilter = document.getElementById('card-filter-set')?.value || '';

    // Filter cards
    let filteredCards = creatorCards.filter(card => {
        const matchesSearch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
        const matchesRarity = !rarityFilter || card.rarity === rarityFilter;
        const matchesSet = !setFilter || card.set_id === setFilter;
        return matchesSearch && matchesRarity && matchesSet;
    });

    if (filteredCards.length === 0) {
        grid.innerHTML = `
        <div class="col-span-full text-center py-12 text-void-muted">
            <i class="fa-solid fa-inbox text-4xl mb-4"></i>
            <p class="text-sm font-bold">No cards found</p>
            <p class="text-xs">Try adjusting your filters</p>
        </div>
    `;
        return;
    }

    grid.innerHTML = filteredCards.map(card => {
        const isSelected = selectedCardIds.has(card.id);
        return `
    <div class="group relative aspect-[5/7] rounded-xl overflow-hidden border-2 ${isSelected ? 'border-void-accent' : 'border-white/5'} hover:border-void-accent/50 transition-all cursor-pointer" onclick="${bulkSelectMode ? `toggleCardSelection('${card.id}')` : `editCard('${card.id}')`}">
        ${bulkSelectMode ? `
            <div class="absolute top-2 left-2 z-10 w-6 h-6 rounded bg-void-bg border-2 ${isSelected ? 'border-void-accent bg-void-accent' : 'border-white/20'} flex items-center justify-center">
                ${isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
            </div>
        ` : ''}
        <img src="${card.image_url || '/pack.png'}" alt="${card.name}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="absolute bottom-0 left-0 right-0 p-3">
                <div class="text-xs font-black text-white uppercase">${card.name}</div>
                <div class="text-[9px] font-black text-void-accent uppercase">${card.rarity}</div>
                ${card.set_id ? `<div class="text-[8px] text-void-muted mt-1">${creatorSets.find(s => s.id === card.set_id)?.name || 'Set'}</div>` : ''}
            </div>
        </div>
        ${!bulkSelectMode ? `
            <button onclick="event.stopPropagation(); deleteCard('${card.id}')" 
                class="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>
        ` : ''}
    </div>
`}).join('');
};

// Search and filter handlers
const cardSearchInput = document.getElementById('card-search-input');
const cardFilterRarity = document.getElementById('card-filter-rarity');
const cardFilterSet = document.getElementById('card-filter-set');

if (cardSearchInput) {
    cardSearchInput.oninput = () => {
        debounceSearch(() => renderCreatorCardsGrid(), 300);
    };
}
if (cardFilterRarity) {
    cardFilterRarity.onchange = () => renderCreatorCardsGrid();
}
if (cardFilterSet) {
    cardFilterSet.onchange = () => renderCreatorCardsGrid();
}

// Expose functions to window
window.openSetManager = openSetManager;
window.closeSetManager = closeSetManager;
window.saveSet = saveSet;
window.editSet = editSet;
window.deleteSet = deleteSet;
window.cancelSetEdit = cancelSetEdit;
window.toggleBulkSelect = toggleBulkSelect;
window.clearBulkSelect = clearBulkSelect;
window.toggleCardSelection = toggleCardSelection;
window.bulkAssignSet = bulkAssignSet;
window.bulkDeleteCards = bulkDeleteCards;

window.openCardCreator = openCardCreator;
window.closeCardCreator = closeCardCreator;
window.saveCard = saveCard;
window.deleteCreatorCard = deleteCard; // Use different name to avoid conflict with admin
window.deleteCard = deleteCard; // Keep for backward compatibility
window.editCard = editCard;
window.openBulkUpload = openBulkUpload;
window.closeBulkUpload = closeBulkUpload;
window.savePackCustomization = savePackCustomization;
window.resetPackImage = resetPackImage;
window.testPackSound = testPackSound;
window.openPackManager = openPackManager;
window.closePackManager = closePackManager;
window.createPack = createPack;
window.openTwitchSettings = openTwitchSettings;
window.closeTwitchSettings = closeTwitchSettings;
// ============================================
// BRANDING SYSTEM
// ============================================

async function saveBranding() {
    const logoFile = document.getElementById('brand-logo-upload')?.files[0];
    const bannerFile = document.getElementById('brand-banner-upload')?.files[0];
    const font = document.getElementById('brand-font-select')?.value || 'Outfit';
    const tagline = document.getElementById('brand-tagline-input')?.value || '';

    showToast("Saving branding...", "loading");

    try {
        let logoUrl = null;
        let bannerUrl = null;

        if (logoFile) {
            const formData = new FormData();
            formData.append('file', logoFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                logoUrl = uploadData.url;
            }
        }

        if (bannerFile) {
            const formData = new FormData();
            formData.append('file', bannerFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                bannerUrl = uploadData.url;
            }
        }

        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                brand_tagline: tagline,
                brand_logo_url: logoUrl,
                brand_banner_url: bannerUrl
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Branding saved!", "success");
            if (logoUrl) {
                const preview = document.getElementById('brand-logo-preview');
                const previewImg = document.getElementById('brand-logo-preview-img');
                if (preview && previewImg) {
                    previewImg.src = logoUrl;
                    preview.classList.remove('hidden');
                }
            }
            if (bannerUrl) {
                const preview = document.getElementById('brand-banner-preview');
                const previewImg = document.getElementById('brand-banner-preview-img');
                if (preview && previewImg) {
                    previewImg.src = bannerUrl;
                    preview.classList.remove('hidden');
                }
            }
        } else {
            showToast("Failed to save branding", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Brand logo preview
const brandLogoUpload = document.getElementById('brand-logo-upload');
if (brandLogoUpload) {
    brandLogoUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('brand-logo-preview');
                const previewImg = document.getElementById('brand-logo-preview-img');
                if (preview && previewImg) {
                    previewImg.src = event.target.result;
                    preview.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// Brand banner preview
const brandBannerUpload = document.getElementById('brand-banner-upload');
if (brandBannerUpload) {
    brandBannerUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('brand-banner-preview');
                const previewImg = document.getElementById('brand-banner-preview-img');
                if (preview && previewImg) {
                    previewImg.src = event.target.result;
                    preview.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// ============================================
// CARD BACK MANAGEMENT
// ============================================
let cardBacks = [];

function openCardBackManager() {
    const modal = document.getElementById('card-back-manager-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadCardBacks();
    }
}

function closeCardBackManager() {
    const modal = document.getElementById('card-back-manager-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadCardBacks() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/card-backs`, { credentials: 'include' });
        if (res.ok) {
            cardBacks = await res.json();
            renderCardBacks();
        } else {
            // Fallback to single card back from settings
            const settingsRes = await fetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' });
            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                if (settings.card_back_url) {
                    cardBacks = [{ id: 'default', name: 'Default Card Back', image_url: settings.card_back_url, is_default: true }];
                }
                renderCardBacks();
            }
        }
    } catch (err) {
        console.error("Failed to load card backs:", err);
    }
}

function renderCardBacks() {
    const list = document.getElementById('card-backs-list');
    const preview = document.getElementById('card-backs-preview');

    if (list) {
        if (cardBacks.length === 0) {
            list.innerHTML = '<p class="text-sm text-void-muted text-center py-8">No card backs yet</p>';
        } else {
            list.innerHTML = cardBacks.map(back => `
            <div class="flex items-center gap-3 p-3 rounded-lg border ${back.is_default ? 'border-void-accent/50' : 'border-white/5'} hover:border-void-accent/30 transition-all">
                <img src="${back.image_url || back.url}" alt="${back.name}" class="w-16 h-24 rounded object-cover">
                <div class="flex-1">
                    <div class="text-sm font-black text-void-text">${back.name} ${back.is_default ? '<span class="text-void-accent text-xs">(Default)</span>' : ''}</div>
                    <div class="text-[9px] text-void-muted">${back.description || 'Card back'}</div>
                </div>
                <div class="flex gap-2">
                    ${!back.is_default ? `
                        <button onclick="setDefaultCardBack('${back.id}')"
                            class="px-3 py-1.5 bg-void-accent/10 text-void-accent hover:bg-void-accent hover:text-white rounded-lg text-[9px] font-black uppercase transition-all">
                            Set Default
                        </button>
                    ` : ''}
                    <button onclick="deleteCardBack('${back.id}')"
                        class="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        }
    }

    if (preview) {
        preview.innerHTML = cardBacks.slice(0, 2).map(back => `
        <div class="aspect-[5/7] rounded-lg overflow-hidden border-2 ${back.is_default ? 'border-void-accent' : 'border-white/5'}">
            <img src="${back.image_url || back.url}" alt="${back.name}" class="w-full h-full object-cover">
        </div>
    `).join('');
    }
}

async function saveCardBack() {
    const file = document.getElementById('card-back-upload')?.files[0];
    const name = document.getElementById('card-back-name')?.value || 'Card Back';

    if (!file) {
        showToast("Please select an image", "error");
        return;
    }

    showToast("Uploading card back...", "loading");

    try {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(`${BACKEND_URL}/api/admin/upload`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData,
            credentials: 'include'
        });

        if (uploadRes.ok) {
            const uploadData = await uploadRes.json();

            // Save to card backs table
            const res = await fetch(`${BACKEND_URL}/api/creator/card-backs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    name: name,
                    image_url: uploadData.url,
                    is_default: cardBacks.length === 0 // Set as default if it's the first one
                }),
                credentials: 'include'
            });

            if (res.ok) {
                showToast("Card back saved!", "success");
                document.getElementById('card-back-upload').value = '';
                document.getElementById('card-back-name').value = '';
                document.getElementById('card-back-upload-preview').classList.add('hidden');
                loadCardBacks();
            } else {
                const error = await res.json();
                showToast(error.error || "Failed to save card back", "error");
            }
        } else {
            showToast("Upload failed", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function setDefaultCardBack(backId) {
    const res = await fetch(`${BACKEND_URL}/api/creator/card-backs/${backId}/set-default`, {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
    });

    if (res.ok) {
        showToast("Default card back updated!", "success");
        loadCardBacks();
    } else {
        const error = await res.json();
        showToast(error.error || "Failed to update default", "error");
    }
}

async function deleteCardBack(backId) {
    const back = cardBacks.find(b => b.id === backId);
    if (back && back.is_default) {
        showToast("Cannot delete default card back. Set another as default first.", "error");
        return;
    }

    if (!confirm('Are you sure you want to delete this card back?')) return;

    showToast("Deleting card back...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/card-backs/${backId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Card back deleted", "success");
            loadCardBacks();
        } else {
            const error = await res.json();
            showToast(error.error || "Failed to delete card back", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Card back upload preview
const cardBackUpload = document.getElementById('card-back-upload');
if (cardBackUpload) {
    cardBackUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('card-back-upload-preview');
                const previewImg = document.getElementById('card-back-upload-preview-img');
                if (preview && previewImg) {
                    previewImg.src = event.target.result;
                    preview.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// Expose functions
window.toggleAdvancedPackOptions = toggleAdvancedPackOptions;
window.savePackThemePreset = savePackThemePreset;
window.loadPackThemePreset = loadPackThemePreset;
window.saveBranding = saveBranding;
window.openCardBackManager = openCardBackManager;
window.closeCardBackManager = closeCardBackManager;
window.saveCardBack = saveCardBack;
window.setDefaultCardBack = setDefaultCardBack;
window.deleteCardBack = deleteCardBack;

// ============================================
// ANALYTICS SYSTEM
// ============================================

let analyticsData = {
    overview: null,
    cards: null,
    collectors: null,
    packs: null
};

async function loadAnalytics() {
    const timeRange = document.getElementById('analytics-time-range')?.value || '30';

    showToast("Loading analytics...", "loading");

    try {
        // Load all analytics data
        const [overviewRes, cardsRes, collectorsRes, packsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/creator/analytics/overview?days=${timeRange}`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/analytics/cards?days=${timeRange}`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/analytics/collectors?days=${timeRange}`, { credentials: 'include' }),
            fetch(`${BACKEND_URL}/api/creator/analytics/packs?days=${timeRange}`, { credentials: 'include' })
        ]);

        if (overviewRes.ok) analyticsData.overview = await overviewRes.json();
        if (cardsRes.ok) analyticsData.cards = await cardsRes.json();
        if (collectorsRes.ok) analyticsData.collectors = await collectorsRes.json();
        if (packsRes.ok) analyticsData.packs = await packsRes.json();

        renderAnalytics();
    } catch (err) {
        console.error("Failed to load analytics:", err);
        showToast("Failed to load analytics", "error");
    }
}

function renderAnalytics() {
    renderOverviewStats();
    renderCardPerformance();
    renderCollectorLeaderboard();
    renderCharts();
}

function renderOverviewStats() {
    if (!analyticsData.overview) return;

    const data = analyticsData.overview;

    // Update stat displays
    const mintedEl = document.getElementById('cd-stat-minted');
    const communityEl = document.getElementById('cd-stat-community');
    const packsEl = document.getElementById('cd-stat-packs-opened');

    if (mintedEl) mintedEl.textContent = (data.total_cards || 0).toLocaleString();
    if (communityEl) communityEl.textContent = (data.total_collectors || 0).toLocaleString();
    if (packsEl) packsEl.textContent = (data.total_packs_opened || 0).toLocaleString();

    // Update change indicators
    const mintedChange = document.getElementById('cd-stat-minted-change');
    const communityChange = document.getElementById('cd-stat-community-change');
    const packsChange = document.getElementById('cd-stat-packs-change');

    if (mintedChange && data.cards_change) {
        mintedChange.textContent = `${data.cards_change > 0 ? '+' : ''}${data.cards_change} this period`;
        mintedChange.className = `text-[8px] mt-2 ${data.cards_change > 0 ? 'text-void-accent' : 'text-void-muted'}`;
    }
    if (communityChange && data.collectors_change) {
        communityChange.textContent = `${data.collectors_change > 0 ? '+' : ''}${data.collectors_change} this period`;
        communityChange.className = `text-[8px] mt-2 ${data.collectors_change > 0 ? 'text-void-accent' : 'text-void-muted'}`;
    }
    if (packsChange && data.packs_change) {
        packsChange.textContent = `${data.packs_change > 0 ? '+' : ''}${data.packs_change} this period`;
        packsChange.className = `text-[8px] mt-2 ${data.packs_change > 0 ? 'text-void-accent' : 'text-void-muted'}`;
    }
}

function renderCardPerformance() {
    if (!analyticsData.cards) return;

    const data = analyticsData.cards;
    const topCollected = document.getElementById('top-collected-cards');
    const rarest = document.getElementById('rarest-cards');

    if (topCollected && data.most_collected) {
        topCollected.innerHTML = data.most_collected.slice(0, 5).map((card, idx) => `
        <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            <div class="w-8 h-8 rounded bg-void-accent/20 flex items-center justify-center text-xs font-black">${idx + 1}</div>
            <img src="${card.image_url || '/pack.png'}" alt="${card.name}" class="w-12 h-16 rounded object-cover">
            <div class="flex-1">
                <div class="text-sm font-black text-void-text">${card.name}</div>
                <div class="text-[9px] text-void-muted">${card.collection_count || 0} collected</div>
            </div>
        </div>
    `).join('');
    }

    if (rarest && data.rarest) {
        rarest.innerHTML = data.rarest.slice(0, 5).map((card, idx) => `
        <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            <div class="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-xs font-black">${idx + 1}</div>
            <img src="${card.image_url || '/pack.png'}" alt="${card.name}" class="w-12 h-16 rounded object-cover">
            <div class="flex-1">
                <div class="text-sm font-black text-void-text">${card.name}</div>
                <div class="text-[9px] text-void-muted">${card.collection_count || 0} collected</div>
            </div>
        </div>
    `).join('');
    }
}

function renderCollectorLeaderboard() {
    if (!analyticsData.collectors) return;

    const data = analyticsData.collectors;
    const leaderboard = document.getElementById('collector-leaderboard');

    if (leaderboard && data.top_collectors) {
        leaderboard.innerHTML = data.top_collectors.map((collector, idx) => `
        <div class="flex items-center gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-void-accent/20 to-void-bg flex items-center justify-center text-lg font-black text-void-accent">
                ${idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
            </div>
            <div class="flex-1">
                <div class="text-sm font-black text-void-text">${collector.username || 'Unknown'}</div>
                <div class="text-[9px] text-void-muted">${collector.total_cards || 0} cards • ${collector.unique_cards || 0} unique</div>
            </div>
            <div class="text-right">
                <div class="text-sm font-black text-void-accent">${collector.total_cards || 0}</div>
                <div class="text-[9px] text-void-muted">Total</div>
            </div>
        </div>
    `).join('');
    }
}

function renderCharts() {
    // Simple chart rendering (can be enhanced with Chart.js later)
    if (analyticsData.overview && analyticsData.overview.growth_data) {
        renderCollectorGrowthChart(analyticsData.overview.growth_data);
    }
    if (analyticsData.packs && analyticsData.packs.activity_data) {
        renderPackActivityChart(analyticsData.packs.activity_data);
    }
    if (analyticsData.cards && analyticsData.cards.community_discovery) {
        renderCommunityDiscovery(analyticsData.cards.community_discovery);
    }
}

function renderCollectorGrowthChart(data) {
    const canvas = document.getElementById('collector-growth-chart');
    if (!canvas || !data) return;

    // Destroy existing chart if it exists
    if (collectorGrowthChartInstance) {
        collectorGrowthChartInstance.destroy();
    }

    const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const values = data.map(d => d.count);

    const ctx = canvas.getContext('2d');
    collectorGrowthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Collectors',
                data: values,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderPackActivityChart(data) {
    const canvas = document.getElementById('pack-activity-chart');
    if (!canvas || !data) return;

    // Destroy existing chart if it exists
    if (packActivityChartInstance) {
        packActivityChartInstance.destroy();
    }

    const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const values = data.map(d => d.count);

    const ctx = canvas.getContext('2d');
    packActivityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Packs Opened',
                data: values,
                backgroundColor: '#00f2fe',
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(0, 242, 254, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderCommunityDiscovery(data) {
    const container = document.getElementById('community-discovery-stats');
    if (!container || !data) return;

    const colors = {
        common: 'bg-gray-500',
        rare: 'bg-blue-500',
        epic: 'bg-purple-500',
        legendary: 'bg-amber-500'
    };

    let html = '';
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];

    rarityOrder.forEach(rarity => {
        if (!data[rarity] || data[rarity].total === 0) return;

        const stat = data[rarity];
        const pct = Math.round((stat.found / stat.total) * 100);
        const color = colors[rarity] || 'bg-gray-500';

        html += `
            <div>
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                    <span class="text-void-muted">${rarity}</span>
                    <span class="text-void-text">${stat.found} / ${stat.total} Discovered (${pct}%)</span>
                </div>
                <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${color} rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    });

    if (!html) {
        html = '<div class="text-xs text-void-muted text-center py-4 italic">No cards minted yet.</div>';
    }

    container.innerHTML = html;
}

// Time range change handler
const analyticsTimeRange = document.getElementById('analytics-time-range');
if (analyticsTimeRange) {
    analyticsTimeRange.onchange = () => loadAnalytics();
}

// Expose functions
window.switchCreatorDashboardTab = switchCreatorDashboardTab;
window.loadAnalytics = loadAnalytics;

// ============================================
// TWITCH INTEGRATION ENHANCEMENTS
// ============================================

async function validateRewardId(inputId) {
    const rewardId = document.getElementById(inputId)?.value;
    if (!rewardId) {
        showToast("Please enter a reward ID", "error");
        return;
    }

    showToast("Validating reward ID...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/validate-reward?reward_id=${rewardId}`, {
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            if (data.valid) {
                showToast("Reward ID is valid!", "success");
                document.getElementById(inputId).classList.add('border-void-accent');
            } else {
                showToast(data.error || "Invalid reward ID", "error");
                document.getElementById(inputId).classList.add('border-red-500');
            }
        } else {
            showToast("Validation failed", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function refreshWebhookStatus() {
    const indicator = document.getElementById('webhook-status-indicator');
    if (indicator) {
        indicator.innerHTML = '<div class="w-2 h-2 rounded-full bg-void-muted animate-pulse"></div><span class="text-xs text-void-muted">Checking...</span>';
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/webhook-status`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (indicator) {
                const status = data.status || 'unknown';
                const color = status === 'active' ? 'bg-void-accent' : status === 'error' ? 'bg-red-500' : 'bg-void-muted';
                indicator.innerHTML = `
                <div class="w-2 h-2 rounded-full ${color}"></div>
                <span class="text-xs ${status === 'active' ? 'text-void-accent' : status === 'error' ? 'text-red-500' : 'text-void-muted'}">${status.toUpperCase()}</span>
            `;
            }
        }
    } catch (err) {
        if (indicator) {
            indicator.innerHTML = '<div class="w-2 h-2 rounded-full bg-red-500"></div><span class="text-xs text-red-500">ERROR</span>';
        }
    }
}

async function testWebhook() {
    showToast("Sending test webhook...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/test-webhook`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Test webhook sent!", "success");
            setTimeout(() => refreshWebhookLogs(), 1000);
        } else {
            showToast("Test webhook failed", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function refreshWebhookLogs() {
    const logContainer = document.getElementById('webhook-event-log');
    if (!logContainer) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/webhook-events`, { credentials: 'include' });
        if (res.ok) {
            const events = await res.json();
            if (events.length === 0) {
                logContainer.innerHTML = `
                <div class="text-center py-8 text-void-muted">
                    <i class="fa-solid fa-inbox text-2xl mb-2"></i>
                    <p class="text-xs">No events yet</p>
                </div>
            `;
            } else {
                logContainer.innerHTML = events.slice(0, 20).map(event => `
                <div class="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                    <div class="w-2 h-2 rounded-full ${event.status === 'success' ? 'bg-void-accent' : 'bg-red-500'}"></div>
                    <div class="flex-1">
                        <div class="text-xs font-black text-void-text">${event.type || 'Unknown'}</div>
                        <div class="text-[9px] text-void-muted">${new Date(event.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="text-[9px] text-void-muted">${event.status || 'unknown'}</div>
                </div>
            `).join('');
            }
        }
    } catch (err) {
        console.error("Failed to load webhook logs:", err);
    }
}

// Load webhook status and logs when Twitch settings modal opens
const originalOpenTwitchSettings = openTwitchSettings;
openTwitchSettings = function () {
    originalOpenTwitchSettings();
    refreshWebhookStatus();
    refreshWebhookLogs();
};

// ============================================
// STREAMELEMENTS INTEGRATION
// ============================================

function openStreamElementsSettings() {
    const modal = document.getElementById('streamelements-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadStreamElementsSettings();
    }
}

function closeStreamElementsSettings() {
    const modal = document.getElementById('streamelements-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadStreamElementsSettings() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' });
        if (res.ok) {
            const settings = await res.json();
            // Settings are encrypted, so we can't display them
            // Just load the UI state
        }
    } catch (err) {
        console.error("Failed to load StreamElements settings:", err);
    }
}

async function saveStreamElementsSettings() {
    const jwt = document.getElementById('streamelements-jwt')?.value;
    const channelId = document.getElementById('streamelements-channel-id')?.value;
    const commandCollection = document.getElementById('se-command-collection')?.checked || false;
    const commandPack = document.getElementById('se-command-pack')?.checked || false;
    const commandStats = document.getElementById('se-command-stats')?.checked || false;

    showToast("Saving StreamElements settings...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                streamelements_jwt_encrypted: jwt,
                streamelements_channel_id: channelId,
                streamelements_commands: {
                    collection: commandCollection,
                    pack: commandPack,
                    stats: commandStats
                }
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("StreamElements settings saved!", "success");
            closeStreamElementsSettings();
        } else {
            showToast("Failed to save settings", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// ============================================
// OBS INTEGRATION
// ============================================

function openOBSIntegration() {
    const modal = document.getElementById('obs-integration-modal');
    if (modal) {
        modal.classList.remove('hidden');
        updateOBSUrl();
    }
}

function closeOBSIntegration() {
    const modal = document.getElementById('obs-integration-modal');
    if (modal) modal.classList.add('hidden');
}

async function updateOBSUrl() {
    const urlInput = document.getElementById('obs-browser-source-url');
    if (!urlInput) {
        console.error("OBS URL input not found");
        return;
    }

    // Fetch creator info to get streamer username
    try {
        const creatorRes = await fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' });
        if (!creatorRes.ok) {
            showToast("Failed to get creator info", "error");
            urlInput.value = "Error: Not authenticated as creator";
            return;
        }

        const creatorData = await creatorRes.json();
        const streamerName = creatorData.username || currentUser?.name || 'streamer';

        // Fetch or generate overlay token
        let token = localStorage.getItem(`obs_token_${streamerName}`);

        if (!token) {
            const tokenRes = await fetch(`${BACKEND_URL}/api/creator/obs-token`, { credentials: 'include' });
            if (!tokenRes.ok) {
                const errorData = await tokenRes.json().catch(() => ({}));
                console.error("Token fetch error:", errorData);
                showToast(errorData.error || "Failed to get overlay token", "error");
                urlInput.value = "Error: Could not generate token";
                return;
            }
            const tokenData = await tokenRes.json();
            token = tokenData.token;
            if (token) {
                localStorage.setItem(`obs_token_${streamerName}`, token);
            } else {
                showToast("Token was empty", "error");
                urlInput.value = "Error: Invalid token response";
                return;
            }
        }

        if (!token) {
            urlInput.value = "Error: No token available";
            return;
        }

        // Simplified URL - only streamer and token (width/height/position set in OBS)
        const overlayUrl = `${window.location.origin}/obs-overlay?streamer=${encodeURIComponent(streamerName)}&token=${encodeURIComponent(token)}`;

        urlInput.value = overlayUrl;

        // Update preview with dimensions from settings
        const width = document.getElementById('obs-width')?.value || '1920';
        const height = document.getElementById('obs-height')?.value || '1080';
        const preview = document.getElementById('obs-preview-iframe');
        if (preview) {
            preview.src = `${overlayUrl}&width=${width}&height=${height}`;
        }
    } catch (err) {
        console.error("Failed to update OBS URL:", err);
        showToast("Failed to generate overlay URL: " + err.message, "error");
        if (urlInput) {
            urlInput.value = "Error: " + err.message;
        }
    }
}

async function regenerateOBSToken() {
    if (!confirm('Regenerating the token will invalidate your current OBS overlay URL. You will need to update it in OBS. Continue?')) return;

    showToast("Regenerating token...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/obs-token/regenerate`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            const streamerName = currentUser?.name || 'streamer';
            localStorage.setItem(`obs_token_${streamerName}`, data.token);
            showToast("Token regenerated! Update your OBS URL.", "success");
            updateOBSUrl();
        } else {
            showToast("Failed to regenerate token", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function copyOBSUrl() {
    const urlInput = document.getElementById('obs-browser-source-url');
    if (!urlInput || !urlInput.value || urlInput.value.startsWith('Error:')) {
        showToast("No URL to copy. Please wait for the URL to generate.", "error");
        return;
    }

    try {
        // Use modern Clipboard API
        await navigator.clipboard.writeText(urlInput.value);
        showToast("URL copied to clipboard!", "success");
    } catch (err) {
        // Fallback for older browsers
        try {
            urlInput.select();
            urlInput.setSelectionRange(0, 99999); // For mobile devices
            document.execCommand('copy');
            showToast("URL copied to clipboard!", "success");
        } catch (fallbackErr) {
            console.error("Failed to copy:", fallbackErr);
            showToast("Failed to copy URL. Please copy manually.", "error");
        }
    }
}

// OBS settings change handlers
const obsWidth = document.getElementById('obs-width');
const obsHeight = document.getElementById('obs-height');
const obsPosition = document.getElementById('obs-position');
const obsAnimationSpeed = document.getElementById('obs-animation-speed');

if (obsWidth) obsWidth.oninput = updateOBSUrl;
if (obsHeight) obsHeight.oninput = updateOBSUrl;
if (obsPosition) obsPosition.onchange = updateOBSUrl;
if (obsAnimationSpeed) {
    obsAnimationSpeed.oninput = (e) => {
        const value = parseFloat(e.target.value).toFixed(1);
        const display = document.getElementById('obs-speed-value');
        if (display) display.textContent = value;
    };
}

// ============================================
// AUTOMATION FEATURES
// ============================================

function openAutomationSettings() {
    const modal = document.getElementById('automation-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadAutomationSettings();
    }
}

function closeAutomationSettings() {
    const modal = document.getElementById('automation-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadAutomationSettings() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/automation`, { credentials: 'include' });
        if (res.ok) {
            const settings = await res.json();
            if (settings.scheduled_drops_enabled) {
                document.getElementById('scheduled-drops-enabled').checked = true;
            }
            if (settings.milestone_rewards_enabled) {
                document.getElementById('milestone-rewards-enabled').checked = true;
            }
            if (settings.chat_command_enabled) {
                document.getElementById('chat-command-enabled').checked = true;
            }
            if (settings.chat_command) {
                document.getElementById('chat-command-trigger').value = settings.chat_command;
            }
            renderScheduledDrops(settings.scheduled_drops || []);
        }
    } catch (err) {
        console.error("Failed to load automation settings:", err);
    }
}

function renderScheduledDrops(drops) {
    const container = document.getElementById('scheduled-drops-list');
    if (!container) return;

    if (drops.length === 0) {
        container.innerHTML = '<p class="text-xs text-void-muted text-center py-4">No scheduled drops</p>';
    } else {
        container.innerHTML = drops.map((drop, idx) => `
        <div class="flex items-center gap-3 p-3 bg-void-bg rounded-lg">
            <div class="flex-1">
                <div class="text-sm font-black text-void-text">${drop.time || 'Not set'}</div>
                <div class="text-[9px] text-void-muted">${drop.frequency || 'Once'}</div>
            </div>
            <button onclick="deleteScheduledDrop(${idx})"
                class="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
    }
}

function addScheduledDrop() {
    const time = prompt("Enter time (HH:MM format, 24-hour):");
    if (!time) return;

    const frequency = prompt("Frequency (daily/weekly/once):", "daily");
    if (!frequency) return;

    showToast("Adding scheduled drop...", "loading");

    // This would be saved to backend
    showToast("Scheduled drop added!", "success");
    loadAutomationSettings();
}

function deleteScheduledDrop(index) {
    if (!confirm('Delete this scheduled drop?')) return;
    showToast("Deleting scheduled drop...", "loading");
    // This would be deleted from backend
    showToast("Scheduled drop deleted", "success");
    loadAutomationSettings();
}

async function saveMilestoneReward() {
    const followers = parseInt(document.getElementById('milestone-followers')?.value || '100');

    showToast("Saving milestone reward...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/automation/milestone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ followers }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Milestone reward saved!", "success");
        } else {
            showToast("Failed to save milestone", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function saveAutomationSettings() {
    const scheduledEnabled = document.getElementById('scheduled-drops-enabled')?.checked || false;
    const milestoneEnabled = document.getElementById('milestone-rewards-enabled')?.checked || false;
    const chatCommandEnabled = document.getElementById('chat-command-enabled')?.checked || false;
    const chatCommand = document.getElementById('chat-command-trigger')?.value || '!drop';

    showToast("Saving automation settings...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/automation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                scheduled_drops_enabled: scheduledEnabled,
                milestone_rewards_enabled: milestoneEnabled,
                chat_command_enabled: chatCommandEnabled,
                chat_command: chatCommand
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Automation settings saved!", "success");
            closeAutomationSettings();
        } else {
            showToast("Failed to save settings", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// Expose functions
window.validateRewardId = validateRewardId;
window.refreshWebhookStatus = refreshWebhookStatus;
window.testWebhook = testWebhook;
window.refreshWebhookLogs = refreshWebhookLogs;
window.openStreamElementsSettings = openStreamElementsSettings;
window.closeStreamElementsSettings = closeStreamElementsSettings;
window.saveStreamElementsSettings = saveStreamElementsSettings;
window.openOBSIntegration = openOBSIntegration;
window.closeOBSIntegration = closeOBSIntegration;
window.copyOBSUrl = copyOBSUrl;
window.openAutomationSettings = openAutomationSettings;
window.closeAutomationSettings = closeAutomationSettings;
window.addScheduledDrop = addScheduledDrop;
window.deleteScheduledDrop = deleteScheduledDrop;
window.saveMilestoneReward = saveMilestoneReward;
window.saveAutomationSettings = saveAutomationSettings;

window.saveTwitchSettings = saveTwitchSettings;

window.switchCreatorTab = switchCreatorTab;
window.creatorMintCard = creatorMintCard;
window.creatorAssemblePack = creatorAssemblePack;
window.creatorTriggerDrop = creatorTriggerDrop;

// ============================================
// SETUP WIZARD
// ============================================
let setupWizardCurrentStep = 1;
let setupWizardData = {
    identity: {
        collectionName: '',
        tagline: ''
    },
    twitch: { rewardId: '', battleRewardId: '' },
    // Rarity config still gets saved with good defaults, even though it's not a dedicated step anymore
    rarity: { common: 70, rare: 20, epic: 8, legendary: 2 },
    // Local-only list, not auto-created on the backend anymore (cards are managed from the dashboard)
    cards: []
};

function openSetupWizard() {
    const modal = document.getElementById('setup-wizard-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setupWizardCurrentStep = 1;
        updateSetupWizardStep();
        updateWizardLivePreview(); // Initial preview
    }
}



function closeSetupWizard() {
    const modal = document.getElementById('setup-wizard-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function updateSetupWizardStep() {
    // Hide all steps (4 steps)
    for (let i = 1; i <= 4; i++) {
        const stepContent = document.getElementById(`setup-step-${i}-content`);
        const stepBar = document.getElementById(`setup-step-${i}`);
        if (stepContent) stepContent.classList.add('hidden');
        if (stepBar) {
            if (i <= setupWizardCurrentStep) {
                stepBar.classList.remove('bg-white/5');
                stepBar.classList.add('bg-void-accent');
            } else {
                stepBar.classList.remove('bg-void-accent');
                stepBar.classList.add('bg-white/5');
            }
        }
    }

    // Show current step
    const currentStepContent = document.getElementById(`setup-step-${setupWizardCurrentStep}-content`);
    if (currentStepContent) currentStepContent.classList.remove('hidden');

    // Update step label
    const stepLabel = document.getElementById('setup-step-label');
    if (stepLabel) stepLabel.innerText = `Step ${setupWizardCurrentStep} of 4`;

    // Update navigation buttons
    const prevBtn = document.getElementById('setup-prev-btn');
    const nextBtn = document.getElementById('setup-next-btn');
    const completeBtn = document.getElementById('setup-complete-btn');

    if (prevBtn) {
        if (setupWizardCurrentStep === 1) {
            prevBtn.classList.add('hidden');
        } else {
            prevBtn.classList.remove('hidden');
        }
    }

    if (nextBtn && completeBtn) {
        if (setupWizardCurrentStep === 4) {
            nextBtn.classList.add('hidden');
            completeBtn.classList.remove('hidden');
            populateReviewChecklist();
        } else {
            nextBtn.classList.remove('hidden');
            completeBtn.classList.add('hidden');
        }
    }

    // Load step data if available
    loadSetupWizardStepData();
}

function setupWizardNext() {
    if (validateSetupWizardStep()) {
        saveSetupWizardStepData();
        if (setupWizardCurrentStep < 4) {
            setupWizardCurrentStep++;
            updateSetupWizardStep();
        }
    }
}

function setupWizardPrevious() {
    if (setupWizardCurrentStep > 1) {
        saveSetupWizardStepData();
        setupWizardCurrentStep--;
        updateSetupWizardStep();
    }
}

function validateSetupWizardStep() {
    switch (setupWizardCurrentStep) {
        case 1: { // Collection Identity
            const nameInput = document.getElementById('setup-collection-name');
            const rawName = nameInput?.value || '';
            const name = rawName.trim();

            if (!name) {
                showToast('Please enter a collection name', 'error');
                return false;
            }
            if (name.length < 3) {
                showToast('Collection name should be at least 3 characters', 'error');
                return false;
            }
            if (name.length > 50) {
                showToast('Collection name must be 50 characters or less', 'error');
                return false;
            }

            return true;
        }

        case 2: { // Twitch
            const rewardId = document.getElementById('setup-twitch-reward-id')?.value;
            if (!rewardId || rewardId.trim() === '') {
                // Allow skipping here; Twitch can be configured later in the dashboard.
                showToast('You can connect Twitch later from the dashboard. For now we will skip the reward ID.', 'info');
            }
            return true;
        }

        case 3: // Add Cards (optional) – no blocking validation
            return true;

        case 4: // Review & Activate – no additional validation
            return true;

        default:
            return true;
    }
}

function saveSetupWizardStepData() {
    switch (setupWizardCurrentStep) {
        case 1: { // Collection Identity
            const nameInput = document.getElementById('setup-collection-name');
            const taglineInput = document.getElementById('setup-collection-tagline');
            const primaryColor = document.getElementById('setup-brand-color-primary');
            const secondaryColor = document.getElementById('setup-brand-color-secondary');

            setupWizardData.identity = {
                collectionName: (nameInput?.value || '').trim(),
                tagline: (taglineInput?.value || '').trim(),
                primary_color: primaryColor?.value || '#00f2fe',
                secondary_color: secondaryColor?.value || '#00d4e0'
            };
            break;
        }

        case 2: // Twitch
            setupWizardData.twitch = {
                rewardId: document.getElementById('setup-twitch-reward-id')?.value || '',
                battleRewardId: document.getElementById('setup-twitch-battle-reward-id')?.value || ''
            };
            break;

        case 3: { // Add Cards / Genesis
            // Store genesis card names for processing at the end
            setupWizardData.genesis = [
                { name: document.getElementById('setup-genesis-1-name')?.value || 'Genesis Common', rarity: 'common' },
                { name: document.getElementById('setup-genesis-2-name')?.value || 'Genesis Rare', rarity: 'rare' },
                { name: document.getElementById('setup-genesis-3-name')?.value || 'Genesis Legendary', rarity: 'legendary' }
            ];
            break;
        }
        case 4: // Review – nothing to save
            break;
    }
}

function loadSetupWizardStepData() {
    switch (setupWizardCurrentStep) {
        case 1: { // Collection Identity
            const nameInput = document.getElementById('setup-collection-name');
            const taglineInput = document.getElementById('setup-collection-tagline');

            // If we already have data in memory, use that
            if (setupWizardData.identity.collectionName && nameInput) {
                nameInput.value = setupWizardData.identity.collectionName;
            } else if (nameInput && !nameInput.value) {
                // Default: "{username}'s Collection"
                const base =
                    (window.currentUser && (window.currentUser.display_name || window.currentUser.username)) ||
                    'My Collection';
                nameInput.value = `${base}'s Collection`;
            }

            if (setupWizardData.identity.tagline && taglineInput) {
                taglineInput.value = setupWizardData.identity.tagline;
            }

            break;
        }

        case 2: // Twitch
            if (setupWizardData.twitch.rewardId) {
                const rewardId = document.getElementById('setup-twitch-reward-id');
                if (rewardId) rewardId.value = setupWizardData.twitch.rewardId;
            }
            if (setupWizardData.twitch.battleRewardId) {
                const battleRewardId = document.getElementById('setup-twitch-battle-reward-id');
                if (battleRewardId) battleRewardId.value = setupWizardData.twitch.battleRewardId;
            }
            break;

        case 3: // Add Cards – refresh card count summary
            updateWizardCardCount();
            break;

        case 4: // Review – populate checklist and OBS URL
            populateReviewChecklist();
            updateWizardOBSUrl();
            break;
    }
}

function updateRarityDisplay() {
    const common = parseInt(document.getElementById('setup-rarity-common')?.value || '0');
    const rare = parseInt(document.getElementById('setup-rarity-rare')?.value || '0');
    const epic = parseInt(document.getElementById('setup-rarity-epic')?.value || '0');
    const legendary = parseInt(document.getElementById('setup-rarity-legendary')?.value || '0');

    document.getElementById('setup-rarity-common-value').innerText = common + '%';
    document.getElementById('setup-rarity-rare-value').innerText = rare + '%';
    document.getElementById('setup-rarity-epic-value').innerText = epic + '%';
    document.getElementById('setup-rarity-legendary-value').innerText = legendary + '%';

    const total = common + rare + epic + legendary;
    const totalEl = document.getElementById('setup-rarity-total');
    if (totalEl) {
        totalEl.innerText = `Total: ${total}%`;
        totalEl.className = total === 100 ? 'text-xs text-void-accent text-center' : 'text-xs text-red-500 text-center';
    }
}

function addSetupCard() {
    const name = document.getElementById('setup-card-name')?.value;
    const rarity = document.getElementById('setup-card-rarity')?.value;

    if (!name || name.trim() === '') {
        showToast('Please enter a card name', 'error');
        return;
    }

    setupWizardData.cards.push({ name: name.trim(), rarity });
    document.getElementById('setup-card-name').value = '';
    updateSetupCardsList();
    showToast('Card added', 'success');
}

function updateSetupCardsList() {
    const list = document.getElementById('setup-cards-list');
    const count = document.getElementById('setup-cards-count');

    if (count) {
        count.innerText = `${setupWizardData.cards.length} / 10`;
        count.className = setupWizardData.cards.length >= 10
            ? 'text-2xl font-black text-void-accent'
            : 'text-2xl font-black text-void-accent';
    }

    if (list) {
        if (setupWizardData.cards.length === 0) {
            list.innerHTML = '<p class="text-xs text-void-muted text-center py-4">No cards added yet</p>';
        } else {
            list.innerHTML = setupWizardData.cards.map((card, idx) => `
            <div class="flex items-center justify-between p-3 bg-void-bg rounded-lg border border-white/5">
                <div class="flex items-center gap-3">
                    <span class="text-lg">${getRarityEmoji(card.rarity)}</span>
                    <span class="text-sm font-bold text-void-text">${card.name}</span>
                    <span class="text-[9px] font-black text-void-muted uppercase">${card.rarity}</span>
                </div>
                <button onclick="removeSetupCard(${idx})" class="text-red-500 hover:text-red-400">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        `).join('');
        }
    }
}

function removeSetupCard(index) {
    setupWizardData.cards.splice(index, 1);
    updateSetupCardsList();
}

function getRarityEmoji(rarity) {
    const emojis = {
        common: '⚪',
        rare: '🔵',
        epic: '🟣',
        legendary: '🟡'
    };
    return emojis[rarity] || '⚪';
}

async function populateReviewChecklist() {
    const checklist = document.getElementById('setup-review-checklist');
    if (!checklist) return;

    // Fetch current card count
    let cardCount = 0;
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            cardCount = data.cards?.length || 0;
        }
    } catch (err) {
        console.error('Failed to fetch card count:', err);
    }

    const items = [
        {
            label: 'Twitch Integration',
            complete: !!setupWizardData.twitch.rewardId,
            details: setupWizardData.twitch.rewardId ? `Reward ID: ${setupWizardData.twitch.rewardId}` : 'Not configured'
        },
        {
            label: 'Rarity Configuration',
            complete: true,
            details: `Common: ${setupWizardData.rarity.common}%, Rare: ${setupWizardData.rarity.rare}%, Epic: ${setupWizardData.rarity.epic}%, Legendary: ${setupWizardData.rarity.legendary}%`
        },
        {
            label: 'Cards Ready',
            complete: cardCount > 0,
            details: cardCount > 0
                ? `${cardCount} cards uploaded (more cards give viewers variety)`
                : 'No cards yet – you can still go live and add cards later'
        }
    ];

    checklist.innerHTML = items.map(item => `
    <div class="flex items-center gap-4 p-4 bg-void-bg rounded-xl border ${item.complete ? 'border-void-accent/20' : 'border-amber-500/20'}">
        <div class="w-8 h-8 rounded-lg ${item.complete ? 'bg-void-accent/20' : 'bg-amber-500/20'} flex items-center justify-center">
            <i class="fa-solid ${item.complete ? 'fa-check' : 'fa-exclamation-triangle'} text-${item.complete ? 'void-accent' : 'amber'}-500"></i>
        </div>
        <div class="flex-1">
            <div class="text-sm font-black text-void-text uppercase">${item.label}</div>
            <div class="text-xs text-void-muted">${item.details}</div>
        </div>
    </div>
`).join('');
}

async function updateWizardCardCount() {
    const countEl = document.getElementById('setup-current-card-count');
    if (!countEl) return;

    countEl.innerText = '...';
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            const count = data.cards?.length || 0;
            countEl.innerText = String(count);
        } else {
            countEl.innerText = '--';
        }
    } catch (err) {
        console.error('Failed to load wizard card count', err);
        countEl.innerText = '--';
    }
}

function updateWizardLivePreview() {
    const name = document.getElementById('setup-collection-name')?.value || 'Collection Name';
    const primary = document.getElementById('setup-brand-color-primary')?.value || '#00f2ff';
    const secondary = document.getElementById('setup-brand-color-secondary')?.value || '#001a2c';

    // Update the card preview element
    const preview = document.querySelector('.wizard-card-preview');
    if (preview) {
        preview.style.setProperty('--card-glow', primary);
        preview.style.setProperty('--card-bg', secondary);

        const titleEl = preview.querySelector('.preview-title');
        if (titleEl) titleEl.innerText = name;
    }
}

async function previewGenesisImage(index) {
    const input = document.getElementById(`setup-genesis-${index}-file`);
    const preview = document.getElementById(`setup-genesis-${index}-preview`);
    const icon = document.getElementById(`setup-genesis-${index}-icon`);
    if (!input || !preview || !input.files[0]) return;

    const file = input.files[0];
    if (file.size > CARD_IMAGE_MAX_BYTES) {
        showToast(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 'error');
        input.value = '';
        return;
    }

    // 1. Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        if (icon) icon.classList.add('hidden');
    };
    reader.readAsDataURL(file);

    // 2. Process (resize max 2000px, WebP, strip metadata) then upload
    try {
        const blob = await processCardImage(file, CARD_IMAGE_MAX_EDGE_PX);
        const formData = new FormData();
        formData.append('file', blob, 'genesis.webp');

        const res = await fetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData,
            credentials: 'include'
        });

        if (res.ok) {
            const data = await res.json();
            preview.src = data.url;
            console.log(`[Wizard] Genesis ${index} uploaded:`, data.url);
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Upload failed', 'error');
        }
    } catch (e) {
        console.error(`[Wizard] Upload error:`, e);
        showToast(e.message || 'Image processing failed', 'error');
    }
}

function copyWizardOBSUrl() {
    const input = document.getElementById('setup-obs-url');
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    showToast('OBS URL copied to clipboard!', 'success');
}

function createStarterCardFromWizard() {
    updateWizardCardCount();
}

async function updateWizardOBSUrl() {
    const urlInput = document.getElementById('setup-obs-url');
    if (!urlInput) return;

    urlInput.value = 'Generating overlay URL...';

    try {
        const creatorRes = await fetch(`${BACKEND_URL}/api/creator/stats`, { credentials: 'include' });
        if (!creatorRes.ok) {
            urlInput.value = 'Error: Not authenticated as creator';
            return;
        }

        const creatorData = await creatorRes.json();
        const streamerName = creatorData.username || (currentUser && (currentUser.name || currentUser.username)) || 'streamer';

        // Fetch or generate overlay token
        let token = localStorage.getItem(`obs_token_${streamerName}`);

        if (!token) {
            const tokenRes = await fetch(`${BACKEND_URL}/api/creator/obs-token`, { credentials: 'include' });
            if (!tokenRes.ok) {
                const errorData = await tokenRes.json().catch(() => ({}));
                console.error('[Wizard OBS] Token fetch error:', errorData);
                urlInput.value = 'Error: Could not generate token';
                return;
            }
            const tokenData = await tokenRes.json();
            token = tokenData.token;
            if (token) {
                localStorage.setItem(`obs_token_${streamerName}`, token);
            } else {
                urlInput.value = 'Error: Invalid token response';
                return;
            }
        }

        if (!token) {
            urlInput.value = 'Error: No token available';
            return;
        }

        const overlayUrl = `${window.location.origin}/obs-overlay?streamer=${encodeURIComponent(streamerName)}&token=${encodeURIComponent(token)}`;
        urlInput.value = overlayUrl;
    } catch (err) {
        console.error('[Wizard OBS] Failed to update OBS URL:', err);
        urlInput.value = 'Error: ' + (err && err.message ? err.message : 'Failed to generate URL');
    }
}

async function setupWizardComplete() {
    saveSetupWizardStepData();

    if (!validateSetupWizardStep()) return;

    showToast('Finalizing your onboarding...', 'loading');

    try {
        if (!csrfToken) await fetchCSRFToken();

        // Prepare the unified onboarding payload
        const payload = {
            identity: {
                collectionName: document.getElementById('setup-collection-name')?.value || setupWizardData.identity.collectionName,
                tagline: document.getElementById('setup-collection-tagline')?.value || setupWizardData.identity.tagline,
                primary_color: document.getElementById('setup-brand-color-primary')?.value || '#00f2ff',
                secondary_color: document.getElementById('setup-brand-color-secondary')?.value || '#001a2c'
            },
            twitch: {
                rewardId: setupWizardData.twitch.rewardId,
                battleRewardId: setupWizardData.twitch.battleRewardId
            },
            genesis: [
                { rarity: 'common', name: document.getElementById('setup-genesis-1-name')?.value || 'Starter Common', image_url: document.getElementById('setup-genesis-1-preview')?.src || '/pack.png' },
                { rarity: 'rare', name: document.getElementById('setup-genesis-2-name')?.value || 'Starter Rare', image_url: document.getElementById('setup-genesis-2-preview')?.src || '/pack.png' },
                { rarity: 'legendary', name: document.getElementById('setup-genesis-3-name')?.value || 'Starter Legendary', image_url: document.getElementById('setup-genesis-3-preview')?.src || '/pack.png' }
            ]
        };

        // Filter out cards if they don't have images (use defaults or skip)
        payload.genesis = payload.genesis.map(c => ({
            ...c,
            image_url: c.image_url.startsWith('data:') ? '/pack.png' : c.image_url // Fallback if upload failed
        }));

        const res = await fetch(`${BACKEND_URL}/api/creator/onboarding/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Onboarding failed');
        }

        showToast('Onboarding complete! Your Genesis collection is ready.', 'success');
        closeSetupWizard();

        // Reload to show the new creator dashboard state
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        console.error('[Setup Wizard] Error:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function toggleIdentityAdvanced() {
    const container = document.getElementById('setup-identity-advanced');
    const icon = document.getElementById('setup-identity-advanced-icon');
    if (!container || !icon) return;
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
        container.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        container.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function useDefaultCollectionIdentity() {
    const nameInput = document.getElementById('setup-collection-name');
    const taglineInput = document.getElementById('setup-collection-tagline');

    const base =
        (window.currentUser && (window.currentUser.display_name || window.currentUser.username)) ||
        'My Collection';
    if (nameInput) {
        nameInput.value = `${base}'s Collection`;
    }
    if (taglineInput && !taglineInput.value) {
        taglineInput.placeholder = "e.g., Collect cards while watching the stream";
    }

    // Persist to wizard state and advance
    saveSetupWizardStepData();
    setupWizardNext();
}

function openCardsManagerFromWizard() {
    try {
        closeSetupWizard();
        if (typeof switchCreatorDashboardTab === 'function') {
            switchCreatorDashboardTab('cards');
        }
        if (typeof switchCreatorCardsSubTab === 'function') {
            switchCreatorCardsSubTab('upload');
        }
    } catch (e) {
        console.error('Failed to open cards manager from wizard', e);
    }
}

function skipCardsInWizard() {
    showToast('You can add cards later from the Cards tab.', 'info');
    setupWizardNext();
}

function openEmojiPicker(target) {
    // Simple emoji picker - in production, use a library like emoji-picker-element
    const emoji = prompt('Enter an emoji (or paste one):');
    if (emoji) {
        const input = document.getElementById(`setup-${target}`);
        const display = document.getElementById(`setup-${target}-display`);
        if (input) input.value = emoji;
        if (display) display.innerText = emoji;
    }
}

function processSetupCSV() {
    const fileInput = document.getElementById('setup-csv-upload');
    if (!fileInput || !fileInput.files[0]) {
        showToast('Please select a CSV file', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const [name, rarity] = lines[i].split(',').map(s => s.trim());
            if (name && rarity) {
                setupWizardData.cards.push({ name, rarity: rarity.toLowerCase() });
            }
        }

        updateSetupCardsList();
        showToast(`Imported ${setupWizardData.cards.length} cards from CSV`, 'success');
    };
    reader.readAsText(file);
}

function downloadCSVTemplate() {
    const csv = 'Card Name,Rarity\nExample Card 1,common\nExample Card 2,rare\nExample Card 3,epic\nExample Card 4,legendary';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'card-template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function openEmojiPicker(target) {
    // Simple emoji picker - in production, use a library like emoji-picker-element
    const emoji = prompt('Enter an emoji (or paste one):');
    if (emoji) {
        const input = document.getElementById(`setup-${target}`);
        const display = document.getElementById(`setup-${target}-display`);
        if (input) input.value = emoji;
        if (display) display.innerText = emoji;
    }
}

function processSetupCSV() {
    const fileInput = document.getElementById('setup-csv-upload');
    if (!fileInput || !fileInput.files[0]) {
        showToast('Please select a CSV file', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const [name, rarity] = lines[i].split(',').map(s => s.trim());
            if (name && rarity) {
                setupWizardData.cards.push({ name, rarity: rarity.toLowerCase() });
            }
        }

        updateSetupCardsList();
        showToast(`Imported ${setupWizardData.cards.length} cards from CSV`, 'success');
    };
    reader.readAsText(file);
}

function downloadCSVTemplate() {
    const csv = 'Card Name,Rarity\nExample Card 1,common\nExample Card 2,rare\nExample Card 3,epic\nExample Card 4,legendary';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'card-template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

window.openSetupWizard = openSetupWizard;
window.closeSetupWizard = closeSetupWizard;
window.setupWizardNext = setupWizardNext;
window.setupWizardPrevious = setupWizardPrevious;
window.setupWizardComplete = setupWizardComplete;
window.toggleIdentityAdvanced = toggleIdentityAdvanced;
window.useDefaultCollectionIdentity = useDefaultCollectionIdentity;
window.openCardsManagerFromWizard = openCardsManagerFromWizard;
window.skipCardsInWizard = skipCardsInWizard;
window.createStarterCardFromWizard = createStarterCardFromWizard;
window.removeSetupCard = removeSetupCard;

// --- CREATOR HUB & MULTI-STREAMER LOGIC ---
window.renderCreatorHub = function (streamers) {
    const list = document.getElementById('creator-streamer-list');
    if (!list) return;

    if (!streamers || streamers.length === 0) {
        list.innerHTML = `<div class="text-[9px] text-void-muted uppercase font-bold px-2 py-4 italic opacit-40">No other creators active</div>`;
        return;
    }

    list.innerHTML = streamers.map(s => {
        const isActive = APP_STREAMER && APP_STREAMER.username === s.username;
        const logo = s.brand_logo_url || s.avatar_url;
        const name = s.brand_name || s.display_name || s.username;

        return `
            <div onclick="switchStreamer('${s.username}')" 
                class="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all border border-transparent ${isActive ? 'bg-void-accent/10 border-void-accent/20' : 'hover:bg-white/5 hover:border-white/10'} group mb-1">
                <div class="w-6 h-6 rounded-md overflow-hidden border border-white/10 flex-shrink-0">
                    <img src="${logo}" class="w-full h-full object-cover" alt="${name}">
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[9px] font-black uppercase tracking-wider text-void-text truncate group-hover:text-void-accent transition-colors leading-tight">${name}</div>
                    <div class="text-[7px] font-bold uppercase tracking-widest text-void-muted/60 flex items-center gap-1.5 mt-0.5">
                        <span class="w-1 h-1 rounded-full bg-void-accent animate-pulse"></span>LIVE
                    </div>
                </div>
                ${isActive ? '<i class="fa-solid fa-chevron-right text-[8px] text-void-accent opacity-60"></i>' : ''}
            </div>
        `;
    }).join('');
};

window.switchStreamer = function (slug) {
    if (APP_STREAMER && APP_STREAMER.username === slug) return;

    showToast(`Loading creator: ${slug}...`, 'info');

    // Update URL without full refresh if possible, otherwise just redirect
    const newPath = `/${slug}`;
    if (window.history.pushState) {
        window.history.pushState({ path: newPath }, '', newPath);
        // Re-initialize app with new streamer context
        initializeApp();
    } else {
        window.location.href = newPath;
    }
};

window.toggleGlobalView = function () {
    const isGlobal = window.activeStreamerFilter === 'all';
    window.activeStreamerFilter = isGlobal ? null : 'all';

    const btn = document.getElementById('global-view-toggle');
    const indicator = document.getElementById('page-indicator');

    if (window.activeStreamerFilter === 'all') {
        btn.classList.add('text-void-accent', 'border-void-accent/40', 'bg-void-accent/5');
        btn.classList.remove('text-void-muted');
        if (indicator) indicator.innerText = 'Global Archive';
        showToast('Viewing aggregated collection across all streamers', 'info');
    } else {
        btn.classList.remove('text-void-accent', 'border-void-accent/40', 'bg-void-accent/5');
        btn.classList.add('text-void-muted');
        const streamerName = APP_STREAMER ? (APP_STREAMER.brand_name || APP_STREAMER.display_name) : 'Home';
        if (indicator) indicator.innerText = `${streamerName} Repository`;
    }

    currentPage = 1;
    fetchUserCollection();
};
window.openEmojiPicker = openEmojiPicker;
window.processSetupCSV = processSetupCSV;
window.downloadCSVTemplate = downloadCSVTemplate;
window.previewGenesisImage = previewGenesisImage;
window.copyWizardOBSUrl = copyWizardOBSUrl;
window.autoCreateTwitchReward = autoCreateTwitchReward;

async function showDashboard(initialView = null, bootstrapData = null, isSnap = false) {
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.style.display = 'none';
    const landing = document.getElementById('landing-view');
    if (landing) {
        landing.classList.add('hidden');
        landing.classList.remove('flex');
    }
    // Hide all landing page sections (like "How It Works")
    const landingSections = document.querySelectorAll('.landing-section');
    landingSections.forEach(section => {
        section.classList.add('hidden');
    });
    const dash = document.getElementById('dashboard-view');
    if (dash) {
        dash.classList.remove('hidden');
        dash.classList.add('block');
        // Ensure proper layout
        dash.style.display = 'block';
    }

    // Explicitly hide all landing sections
    landingSections.forEach(section => {
        section.classList.add('hidden');
    });

    // Hide auth/login views
    const dashLoginView = document.getElementById('login-view');
    if (dashLoginView) dashLoginView.classList.add('hidden');
    // Unified Navbar user data
    const navNick = document.getElementById('nav-username');
    const navImg = document.getElementById('nav-avatar');
    const navUser = document.getElementById('nav-user-preview');
    const loginBtn = document.getElementById('login-nav-btn');

    if (navNick) navNick.innerText = currentUser.name;
    if (navImg) navImg.src = currentUser.avatar;
    if (navUser) {
        navUser.classList.remove('hidden');
        navUser.classList.add('flex');
    }
    if (loginBtn) loginBtn.classList.add('hidden');

    // Populate stats from bootstrap if available
    if (bootstrapData && bootstrapData.stats) {
        const stats = bootstrapData.stats;
        const totalEl = document.getElementById('stat-total');
        const legendaryEl = document.getElementById('stat-legendary');
        const totalAvailEl = document.getElementById('stat-total-available');
        if (totalEl) totalEl.innerText = stats.total;
        if (legendaryEl) legendaryEl.innerText = stats.legendary;
        if (totalAvailEl) totalAvailEl.innerText = stats.total_available;
        totalUniqueCards = stats.total_available;
    }

    // Auto-onboarding for new users
    if (!localStorage.getItem('seen_onboarding_v1')) {
        console.log("[Auth] New user detected, triggering onboarding...");
        if (typeof openOnboarding === 'function') openOnboarding();
    }

    if (bootstrapData && bootstrapData.creator_cards) {
        creatorCards = bootstrapData.creator_cards;
        renderCreatorCardsGrid();
    }
    if (bootstrapData && bootstrapData.creator_stats) {
        updateCreatorStatsUI(bootstrapData.creator_stats);
    }

    // Show creator dashboard button in Navbar
    if (currentUser.is_creator) {
        const navCreatorBtn = document.getElementById('nav-creator-btn');
        if (navCreatorBtn) navCreatorBtn.classList.remove('hidden');

        // Check if creator needs setup
        checkCreatorSetupStatus();

        // Load creator dashboard data ONLY if we don't have it yet and not a snap refresh
        if (!isSnap) {
            if (creatorCards.length === 0) fetchCreatorCards();
            // Stats are now mostly bundled, but let's ensure we have them
            fetchCreatorStats();
            loadSets();
        }

        // Load overview data if on overview tab
        if (routeInfo.view === 'dashboard' || !routeInfo.view) {
            loadOverviewData();
        }
    }

    // --- ROUTING LOGIC ---
    // /binder/:streamer always shows collection for that streamer.
    // /hub/:id/:streamer (legacy) same as binder.
    // Creator-dashboard only when at dashboard with NO slug (your own context).
    const viewingOwnStreamer = routeInfo.slug && currentUser.name && routeInfo.slug.toLowerCase() === currentUser.name.toLowerCase();
    const isCreator = currentUser.is_creator;

    if (initialView) {
        switchView(initialView);
        if (initialView === 'creator-dashboard' && !isSnap) {
            switchCreatorDashboardTab('overview');
            loadOverviewData();
        }
    } else if (routeInfo.view === 'binder' && APP_STREAMER) {
        // /binder/codeoce - always show collection for that streamer
        switchView('collection');
        window.activeStreamerFilter = null; // Use APP_STREAMER from bootstrap
        const pageInd = document.getElementById('page-indicator');
        if (pageInd) pageInd.innerText = `${APP_STREAMER.brand_name || APP_STREAMER.username} Binder`;
        if (!bootstrapData) {
            fetchUserCollection();
            fetchUserBinders();
        } else {
            fetchUserCollection(bootstrapData.recent_drops);
        }
    } else if (routeInfo.view === 'dashboard' && viewingOwnStreamer && isCreator) {
        switchView('creator-dashboard');
        if (!isSnap) {
            switchCreatorDashboardTab('overview');
            loadOverviewData();
        }
    } else if (routeInfo.view === 'dashboard' && routeInfo.slug && APP_STREAMER) {
        switchView('collection');
        window.activeStreamerFilter = null;
        if (!bootstrapData) {
            fetchUserCollection();
            fetchUserBinders();
        } else {
            fetchUserCollection(bootstrapData.recent_drops);
        }
    } else if (routeInfo.view === 'battle') {
        switchView('battle');
    } else if (routeInfo.view === 'profile' && APP_STREAMER) {
        populateProfileView();
        switchView('profile');
    } else {
        // Default View
        if (APP_STREAMER) {
            populateProfileView();
            switchView('profile');
        } else if (currentUser.is_creator && !isSnap) {
            switchView('creator-dashboard');
            switchCreatorDashboardTab('overview');
            loadOverviewData();
        } else {
            // No context, no specific route, just show generic dashboard for now
            switchView('collection');
            if (!bootstrapData) {
                fetchUserCollection();
                fetchUserBinders();
            }
        }
    }

    // If bootstrapData exists, we already have leaderboard/achievements in globals
    if (bootstrapData) {
        if (bootstrapData.recent_drops) {
            // Partial render of cards if provided
            userCollection = bootstrapData.recent_drops.map(item => ({
                id: item.card_id,
                instanceId: item.user_card_id,
                name: item.name,
                rarity: item.rarity,
                image_url: item.image_url,
                type: item.type,
                set_name: item.set_name || 'Ageless',
                created_at: item.created_at,
                // Battle Stats
                attack: item.attack || 0,
                defense: item.defense || 0,
                max_hp: item.max_hp || 0,
                current_hp: item.current_hp || 0,
                mechanic_name: item.mechanic_name,
                mechanic_display_name: item.mechanic_display_name,
                mechanic_icon: item.mechanic_icon,
                mechanic_description: item.mechanic_description,
                is_dead: item.is_dead || false
            }));
        }

        renderLeaderboard();
        achievementsData = bootstrapData.achievements || [];
        renderAchievements();
        renderBinderList();
        if (bootstrapData.active_streamers) {
            renderCreatorHub(bootstrapData.active_streamers);
        }
        renderRecentDrops?.();
        renderPrizedPossession?.();
    } else {
        await fetchLeaderboard();
        await fetchAchievements();
        fetchUserCollection();
    }

    startPolling();
}

/**
 * Initialize Event Listeners for action buttons
 */
function initButtons() {
    console.log("[Buttons] initButtons triggered");
    const heroLogin = document.getElementById('hero-login-btn');
    console.log("[Buttons] Hero Button Found:", !!heroLogin);
    if (heroLogin) {
        heroLogin.onclick = (e) => {
            e.preventDefault();
            console.log("[Buttons] Hero Get Started clicked");
            window.openOnboarding();
        };
    }

    const navLogin = document.getElementById('login-nav-btn');
    console.log("[Buttons] Nav Button Found:", !!navLogin);
    if (navLogin) {
        navLogin.onclick = (e) => {
            e.preventDefault();
            console.log("[Buttons] Nav Get Started clicked");
            window.openOnboarding();
        };
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            try {
                await fetch(`${BACKEND_URL}/api/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (e) {
                console.error('Logout failed', e);
            } finally {
                localStorage.removeItem('user');
                window.location.reload();
            }
        };
    }
}



// --- ADMIN LOGIC ---
let adminAuthenticated = false;
let adminUsersData = []; // Store users for searching
// Check admin session on load
async function checkAdminSession() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/admin/check`, {
            credentials: 'include'
        });
        const data = await res.json();
        adminAuthenticated = data.authenticated;
    } catch (e) {
        console.error('Admin check failed:', e);
    }
}
// Moved to initViewerDashboardEvents

function showAdminLogin() {
    document.getElementById('admin-login-modal').classList.remove('hidden');
    document.getElementById('admin-username').focus();
    const adminLoginModal = document.getElementById('admin-login-modal');
    if (adminLoginModal) adminLoginModal.classList.remove('hidden');
    const adminUsername = document.getElementById('admin-username');
    if (adminUsername) adminUsername.focus();
}

const adminLoginCancel = document.getElementById('admin-login-cancel');
if (adminLoginCancel) {
    adminLoginCancel.onclick = () => {
        const modal = document.getElementById('admin-login-modal');
        if (modal) modal.classList.add('hidden');
        scrollUnlock();
        const adminLoginForm = document.getElementById('admin-login-form');
        if (adminLoginForm) adminLoginForm.reset();
        const adminLoginError = document.getElementById('admin-login-error');
        if (adminLoginError) adminLoginError.classList.add('hidden');
    };
}

const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    adminLoginForm.onsubmit = async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById('admin-username');
        const username = usernameInput ? usernameInput.value : '';
        const passwordInput = document.getElementById('admin-password');
        const password = passwordInput ? passwordInput.value : '';
        const errorDiv = document.getElementById('admin-login-error');

        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                adminAuthenticated = true;
                const adminLoginModal = document.getElementById('admin-login-modal');
                if (adminLoginModal) adminLoginModal.classList.add('hidden');
                scrollUnlock();
                const adminLoginForm = document.getElementById('admin-login-form');
                if (adminLoginForm) adminLoginForm.reset();
                if (errorDiv) errorDiv.classList.add('hidden');
                // Start Loading Data
                await loadSets();
                await Promise.all([
                    loadCollection(),
                    loadLeaderboard(),
                    loadAdminStats(),
                    loadTradeInbox(),
                    loadMyTradeCode()
                ]);

                // Auto-show onboarding if never seen
                if (!localStorage.getItem('seen_onboarding_v1')) {
                    setTimeout(showHowToPlay, 1000);
                }
                switchView('admin');

                // Show global panels for codeOCE upon login
                const adminStatsPanel = document.getElementById('admin-stats-panel');
                if (adminStatsPanel) adminStatsPanel.classList.remove('hidden');
                const adminUsersPanel = document.getElementById('admin-users-panel');
                if (adminUsersPanel) adminUsersPanel.classList.remove('hidden');
                const adminGrantPanel = document.getElementById('admin-grant-panel');
                if (adminGrantPanel) adminGrantPanel.classList.remove('hidden');
                const adminUploadPanel = document.getElementById('admin-upload-panel');
                if (adminUploadPanel) adminUploadPanel.classList.remove('hidden');
                const adminBulkPanel = document.getElementById('admin-bulk-panel');
                if (adminBulkPanel) adminBulkPanel.classList.remove('hidden');
                const adminConfigPanel = document.getElementById('admin-config-panel');
                if (adminConfigPanel) adminConfigPanel.classList.remove('hidden');

                loadAdminUsers();
                loadAdminConfig();
                loadAdminCards();
                loadAdminStats();
                loadAdminUsers();
                loadAdminCards();
                loadAdminConfig();
            } else {
                const error = await res.json();
                if (errorDiv) {
                    errorDiv.textContent = error.error || 'Invalid credentials';
                    errorDiv.classList.remove('hidden');
                }
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.textContent = 'Connection error. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        }
    };
}

const exitAdmin = document.getElementById('exit-admin');
if (exitAdmin) {
    exitAdmin.onclick = async () => {
        try {
            await fetch(`${BACKEND_URL}/api/admin/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.error('Logout failed:', e);
        }
        adminAuthenticated = false;
        switchView('collection');
    };
}

// --- SYSTEM LOGS ---
let adminLogsData = [];

async function loadSystemLogs() {
    const body = document.getElementById('logs-table-body');
    const empty = document.getElementById('logs-empty-state');
    const searchInput = document.getElementById('log-search');
    const search = searchInput ? searchInput.value : '';
    const categoryFilter = document.getElementById('log-category-filter');
    const category = categoryFilter ? categoryFilter.value : '';

    if (body) body.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading logs...</td></tr>';
    if (empty) empty.classList.add('hidden');

    try {
        const params = new URLSearchParams({ search, category });
        const res = await fetch(`${BACKEND_URL}/api/admin/audit?${params.toString()}`, {
            credentials: 'include'
        });

        if (!res.ok) throw new Error("Auth required");
        adminLogsData = await res.json();
        renderSystemLogs();
    } catch (e) {
        if (body) body.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-red-400">Access Denied or Connection Error</td></tr>';
    }
}

function renderSystemLogs() {
    const body = document.getElementById('logs-table-body');
    const empty = document.getElementById('logs-empty-state');

    if (adminLogsData.length === 0) {
        if (body) body.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (body) {
        body.innerHTML = adminLogsData.map(log => {
            const time = new Date(log.created_at).toLocaleTimeString();
            const date = new Date(log.created_at).toLocaleDateString();

            let levelClass = 'text-gray-400';
            if (log.level === 'warn') levelClass = 'text-amber-400';
            if (log.level === 'error') levelClass = 'text-red-400';
            if (log.level === 'info') levelClass = 'text-void-accent/40';

            return `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="px-4 py-3 font-mono text-[10px] text-gray-500">
                        ${date}<br>${time}
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${levelClass} bg-white/5">
                            ${log.level}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-xs font-bold text-gray-300">
                            ${log.category}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <div class="text-sm text-white">${log.message}</div>
                        ${log.metadata && Object.keys(log.metadata).length > 0 ? `<div class="text-[10px] text-gray-500 mt-1 font-mono">${JSON.stringify(log.metadata)}</div>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Moved to initViewerDashboardEvents

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Moved to initCreatorDashboardEvents

// --- SET MANAGEMENT ---
let allSets = [];

async function loadSets() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/sets`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error("Failed to load sets");
        allSets = await res.json();
        renderSetsList();
        populateSetDropdown();
    } catch (e) {
        console.error("Load sets error:", e);
        showToast("Failed to load sets", "error");
    }
}

function renderSetsList() {
    const containers = [
        document.getElementById('sets-list'),
        document.getElementById('sets-manager-list')
    ];

    const html = allSets.length === 0
        ? '<div class="col-span-full text-center text-void-muted py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">No sets created yet</div>'
        : allSets.map(set => `
            <div class="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 hover:border-void-accent/30 transition-all group">
                <div class="flex items-center gap-4">
                    ${set.icon_url ? `<img src="${set.icon_url}" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 rounded-lg bg-void-accent/10 flex items-center justify-center text-void-accent"><i class="fa-solid fa-layer-group"></i></div>'}
                    <div>
                        <div class="font-black text-void-text uppercase tracking-tight">${set.name}</div>
                        <div class="text-[10px] text-void-muted font-bold">${set.code || 'NO CODE'} • ${set.release_date || 'No date'}</div>
                        ${set.description ? `<div class="text-[10px] text-void-muted mt-1 opacity-70 italic">${set.description}</div>` : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editSet('${set.id}')" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-void-accent/20 hover:text-void-accent flex items-center justify-center transition-all">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteSet('${set.id}')" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-all">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');

    containers.forEach(container => {
        if (container) container.innerHTML = html;
    });
}

function populateSetDropdown() {
    const dropdowns = [
        document.getElementById('ac-set-dropdown'),
        document.getElementById('card-creator-set'),
        document.getElementById('bulk-upload-set')
    ];

    const html = '<option value="">No Set</option>' +
        allSets.map(set => `<option value="${set.id}">${set.name}</option>`).join('');

    dropdowns.forEach(dropdown => {
        if (dropdown) {
            const currentValue = dropdown.value;
            dropdown.innerHTML = html;
            if (currentValue) dropdown.value = currentValue;
        }
    });
}



// --- ONBOARDING LOGIC ---
let currentOnboardingSlide = 0;
const totalOnboardingSlides = 4;

function showHowToPlay() {
    currentOnboardingSlide = 0;
    updateOnboardingUI();
    const onboardingModal = document.getElementById('onboarding-modal');
    if (onboardingModal) onboardingModal.classList.remove('hidden');
}

function updateOnboardingUI() {
    const slides = document.querySelectorAll('.onboarding-slide');
    slides.forEach((s, i) => {
        s.classList.toggle('hidden', i !== currentOnboardingSlide);
        s.classList.toggle('block', i === currentOnboardingSlide);
    });

    // Update Progress Bar
    const progress = ((currentOnboardingSlide + 1) / totalOnboardingSlides) * 100;
    const onboardingProgress = document.getElementById('onboarding-progress');
    if (onboardingProgress) onboardingProgress.style.width = `${progress}%`;

    // Update Buttons
    const onboardingPrev = document.getElementById('onboarding-prev');
    if (onboardingPrev) onboardingPrev.classList.toggle('hidden', currentOnboardingSlide === 0);

    const nextBtn = document.getElementById('onboarding-next');
    if (nextBtn) {
        if (currentOnboardingSlide === totalOnboardingSlides - 1) {
            nextBtn.innerHTML = 'Got it! <i class="fa-solid fa-check ml-2"></i>';
        } else {
            nextBtn.innerHTML = 'Next Step <i class="fa-solid fa-chevron-right ml-2"></i>';
        }
        nextBtn.classList.add('bg-void-accent');
        nextBtn.classList.remove('bg-emerald-600');
    }
}

// Handled in initViewerDashboardEvents

// Moved to initModalEvents

// Handled in initCreatorDashboardEvents

window.resetSetForm = () => {
    const createSetForm = document.getElementById('create-set-form');
    if (createSetForm) createSetForm.reset();
    const setIdInput = document.getElementById('set-id');
    if (setIdInput) setIdInput.disabled = false;
    const setFormTitle = document.getElementById('set-form-title');
    if (setFormTitle) setFormTitle.innerText = "Create New Set";
    const setSubmitBtn = document.getElementById('set-submit-btn');
    if (setSubmitBtn) setSubmitBtn.innerHTML = '<i class="fa-solid fa-plus mr-2"></i>Create Set';
    const cancelSetEditBtn = document.getElementById('cancel-set-edit');
    if (cancelSetEditBtn) cancelSetEditBtn.classList.add('hidden');
};

// Handled in initCreatorDashboardEvents

window.editSet = (id) => {
    const set = allSets.find(s => s.id === id);
    if (!set) return;

    const setIdInput = document.getElementById('set-id');
    if (setIdInput) {
        setIdInput.value = set.id;
        setIdInput.disabled = true; // Prevent ID change during edit
    }
    const setNameInput = document.getElementById('set-name');
    if (setNameInput) setNameInput.value = set.name;
    const setCodeInput = document.getElementById('set-code');
    if (setCodeInput) setCodeInput.value = set.code || '';
    const setReleaseDateInput = document.getElementById('set-release-date');
    if (setReleaseDateInput) setReleaseDateInput.value = set.release_date || '';
    const setTotalCardsInput = document.getElementById('set-total-cards');
    if (setTotalCardsInput) setTotalCardsInput.value = set.total_cards || 0;
    const setIconUrlInput = document.getElementById('set-icon-url');
    if (setIconUrlInput) setIconUrlInput.value = set.icon_url || '';
    const setDescriptionInput = document.getElementById('set-description');
    if (setDescriptionInput) setDescriptionInput.value = set.description || '';

    const setFormTitle = document.getElementById('set-form-title');
    if (setFormTitle) setFormTitle.innerText = `Editing Set: ${set.name}`;
    const setSubmitBtn = document.getElementById('set-submit-btn');
    if (setSubmitBtn) setSubmitBtn.innerHTML = '<i class="fa-solid fa-save mr-2"></i>Save Changes';
    const cancelSetEditBtn = document.getElementById('cancel-set-edit');
    if (cancelSetEditBtn) cancelSetEditBtn.classList.remove('hidden');

    const createSetForm = document.getElementById('create-set-form');
    if (createSetForm) createSetForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteSet = async (setId) => {
    if (!await showConfirm("Delete this set? Cards using this set will need to be reassigned.")) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/admin/sets/${setId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Set deleted", "success");
            loadSets();
        } else {
            const error = await res.json();
            showToast(`Failed: ${error.error}`, "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
};

// --- SKELETON LOADING ---
function showSkeletonCards() {
    const grid = document.getElementById('binder-grid');
    if (grid) {
        grid.innerHTML = Array(12).fill(0).map(() => `
            <div class="binder-slot">
                <div class="skeleton-card"></div>
            </div>
        `).join('');
    }
}

// --- PER-SET PROGRESS ---
let activeSetFilter = 'all';

async function loadSetProgress() {
    const dropdown = document.getElementById('set-progress-dropdown');
    const focusedCard = document.getElementById('focused-set-card');
    const selector = document.getElementById('set-selector');

    // Try to fetch sets if not already loaded
    if (!allSets || allSets.length === 0) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/sets`, {
                credentials: 'include'
            });
            if (res.ok) {
                allSets = await res.json();
            }
        } catch (e) {
            console.error("Failed to load sets for progress:", e);
        }
    }

    if (!allSets || allSets.length === 0) {
        if (dropdown) dropdown.innerHTML = '<option value="all">No sets found</option>';
        if (focusedCard) focusedCard.classList.add('hidden');
        if (selector) selector.innerHTML = '';
        return;
    }

    // Group user's cards by set (using unique card IDs)
    const userCardsBySet = {};
    const uniqueOwnedCards = Array.from(new Set(userCollection.map(c => c.id)));

    uniqueOwnedCards.forEach(cardId => {
        const card = userCollection.find(c => c.id === cardId);
        if (card) {
            const setName = card.set_name || 'Ageless';
            userCardsBySet[setName] = (userCardsBySet[setName] || 0) + 1;
        }
    });

    // Calculate progress per set
    const progress = allSets.map(set => {
        const owned = userCardsBySet[set.name] || 0;
        const total = set.total_cards || owned || 1;
        const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;
        return { set, owned, total, percentage };
    });

    try {
        // 1. Update Sidebar Dropdown
        if (dropdown) {
            const currentVal = activeSetFilter;
            let dropdownHtml = '<option value="all">All Sets</option>';
            dropdownHtml += progress.map(p => `
                    <option value="${p.set.name}" ${currentVal === p.set.name ? 'selected' : ''}>
                        ${p.set.name} (${p.percentage}%)
                    </option>
                `).join('');
            dropdown.innerHTML = dropdownHtml;
            dropdown.value = activeSetFilter; // Force correct value
        }

        // 2. Update Focused Card / Summary Area
        if (focusedCard) {
            if (activeSetFilter === 'all') {
                focusedCard.classList.remove('hidden');

                // Calculate global stats
                const totalOwned = uniqueOwnedCards.length;
                const totalPossible = totalUniqueCards || 1;
                const globalPercent = Math.round((totalOwned / totalPossible) * 100);

                // Update Sidebar Vitals
                const globalBar = document.getElementById('stat-progress-bar');
                const globalVal = document.getElementById('stat-progress-val');
                const globalStatTotal = document.getElementById('stat-total');

                if (globalBar) globalBar.style.width = `${globalPercent}%`;
                if (globalVal) globalVal.innerText = `${globalPercent}%`;
                if (globalStatTotal) globalStatTotal.innerText = totalOwned;

                focusedCard.innerHTML = `
                        <div class="mb-4">
                            <div class="text-[10px] text-void-accent font-bold uppercase tracking-widest mb-3">Overall Progress</div>
                            <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                ${progress.map(p => `
                                    <div>
                                        <div class="flex justify-between items-center mb-1.5">
                                            <span class="text-[10px] font-bold text-gray-300 truncate mr-2">${p.set.name}</span>
                                            <span class="text-[10px] font-bold text-void-accent">${p.owned}/${p.total}</span>
                                        </div>
                                        <div class="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                                            <div class="bg-void-accent h-full rounded-full shadow-[0_0_5px_rgba(var(--void-accent-rgb),0.5)]" style="width: ${p.percentage}%"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
            } else {
                const p = progress.find(item => item.set.name === activeSetFilter);
                if (p) {
                    focusedCard.classList.remove('hidden');
                    focusedCard.innerHTML = `
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <div class="text-[10px] text-void-accent/40 font-bold uppercase tracking-wider mb-0.5">Focusing On</div>
                                    <div class="text-white font-bold leading-tight">${p.set.name}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-white font-bold">${p.owned}/${p.total}</div>
                                    <div class="text-[10px] text-gray-500">Collected</div>
                                </div>
                            </div>
                            <div class="progress-bg mb-2">
                                <div class="progress-fill" style="width: ${p.percentage}%"></div>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-gray-400">${p.total - p.owned} remaining</span>
                                <span class="text-xs font-black text-void-accent/40">${p.percentage}%</span>
                            </div>
                        `;
                } else {
                    focusedCard.classList.add('hidden');
                }
            }
        }

        // 3. Render Top Selector Chips (Legacy support / sync)
        if (selector) {
            const allActive = activeSetFilter === 'all';
            let selectorHtml = `
                    <div class="set-chip ${allActive ? 'active' : ''}" onclick="filterBySet('all')">
                        <div class="text-xs font-bold">All Sets</div>
                        <div class="text-[10px] text-gray-500">${totalUniqueCards} Cards</div>
                    </div>
                `;

            selectorHtml += progress.map(p => `
                    <div class="set-chip ${activeSetFilter === p.set.name ? 'active' : ''}" onclick="filterBySet('${p.set.name}')">
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold truncate">${p.set.name}</div>
                            <div class="set-chip-progress mt-1">
                                <div class="set-chip-progress-fill" style="width: ${p.percentage}%"></div>
                            </div>
                        </div>
                        <div class="text-[10px] font-bold text-gray-400">${p.percentage}%</div>
                    </div>
                `).join('');

            selector.innerHTML = selectorHtml;

            // Auto-scroll to active chip
            const activeChip = selector.querySelector('.set-chip.active');
            if (activeChip) {
                activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    } catch (err) {
        console.error("Set progress calculation error:", err);
    }
}

window.filterBySet = (setName) => {
    activeSetFilter = setName;

    // Sync all filters
    const setFilter = document.getElementById('set-filter');
    if (setFilter) setFilter.value = setName;

    const sidebarDropdown = document.getElementById('set-progress-dropdown');
    if (sidebarDropdown) sidebarDropdown.value = setName;

    currentPage = 1;
    loadSetProgress(); // Refresh visual highlights and card
    renderBinder();
};

// --- ACHIEVEMENTS SYSTEM ---

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;

    if (!achievementsData || achievementsData.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 opacity-40">
                <div class="text-3xl mb-2">🏆</div>
                <div class="text-[10px] uppercase font-black tracking-widest">No achievements discovered</div>
            </div>
        `;
        return;
    }

    const syncBtnHtml = `
        <div class="mb-4 flex justify-between items-center px-1">
            <div class="text-[9px] font-black text-void-muted uppercase tracking-widest">Your Progress</div>
        </div>
    `;

    const achievementsHtml = achievementsData.map(ach => `
        <div class="flex items-start gap-4 p-4 rounded-xl border ${ach.unlocked ? 'border-void-accent/30 bg-void-accent/5' : 'border-white/5 bg-white/[0.02]'} transition-all mb-3 last:mb-0">
            <div class="w-10 h-10 shrink-0 rounded-lg ${ach.unlocked ? 'bg-void-accent/20 text-void-accent shadow-[0_0_10px_rgba(var(--void-accent-rgb),0.3)]' : 'bg-white/5 text-void-muted'} flex items-center justify-center text-lg">
                <span class="achievement-icon">${ach.icon || '🏆'}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] font-black uppercase tracking-widest ${ach.unlocked ? 'text-white' : 'text-void-muted'} truncate">${ach.name}</div>
                <div class="text-[9px] text-void-muted mt-1 leading-relaxed">${ach.description}</div>
            </div>
            ${ach.unlocked ? '<div class="shrink-0 text-void-accent"><i class="fa-solid fa-circle-check"></i></div>' : ''}
        </div>
    `).join('');

    list.innerHTML = syncBtnHtml + achievementsHtml;
}

// --- BULK CSV UPLOAD ---
// Handled in initCreatorDashboardEvents

// --- ADMIN CONFIG LOGIC ---
async function loadAdminConfig() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/admin/config`, {
            credentials: 'include'
        });
        if (!res.ok) return;

        const configs = await res.json();

        // Rarity Weights
        const rarity = configs.find(c => c.id === 'rarity_weights')?.data;
        if (rarity) {
            const cfgRarityCommon = document.getElementById('cfg-rarity-common');
            if (cfgRarityCommon) cfgRarityCommon.value = rarity.common;
            const cfgRarityRare = document.getElementById('cfg-rarity-rare');
            if (cfgRarityRare) cfgRarityRare.value = rarity.rare;
            const cfgRarityEpic = document.getElementById('cfg-rarity-epic');
            if (cfgRarityEpic) cfgRarityEpic.value = rarity.epic;
            const cfgRarityLegendary = document.getElementById('cfg-rarity-legendary');
            if (cfgRarityLegendary) cfgRarityLegendary.value = rarity.legendary;
        }

        // Gifting Rules
        const gifting = configs.find(c => c.id === 'gifting_rules')?.data;
        if (gifting) {
            const cfgGiftPerSub = document.getElementById('cfg-gift-per-sub');
            if (cfgGiftPerSub) cfgGiftPerSub.value = gifting.cards_per_sub;
            const cfgGiftBonus = document.getElementById('cfg-gift-bonus');
            if (cfgGiftBonus) cfgGiftBonus.value = gifting.bonus_per_5;
        }

        // Visuals
        const visuals = configs.find(c => c.id === 'visuals')?.data;
        if (visuals) {
            const cfgGlobalBack = document.getElementById('cfg-global-back');
            if (cfgGlobalBack) cfgGlobalBack.value = visuals.global_card_back_url || '';
        }

        updateRarityTotal();
    } catch (err) {
        console.error("Failed to load admin config:", err);
    }
}

function updateRarityTotal() {
    const commonInput = document.getElementById('cfg-rarity-common');
    const common = commonInput ? parseInt(commonInput.value) || 0 : 0;
    const rareInput = document.getElementById('cfg-rarity-rare');
    const rare = rareInput ? parseInt(rareInput.value) || 0 : 0;
    const epicInput = document.getElementById('cfg-rarity-epic');
    const epic = epicInput ? parseInt(epicInput.value) || 0 : 0;
    const legendaryInput = document.getElementById('cfg-rarity-legendary');
    const legendary = legendaryInput ? parseInt(legendaryInput.value) || 0 : 0;
    const total = common + rare + epic + legendary;

    const display = document.getElementById('rarity-total');
    if (display) {
        display.textContent = `${total}%`;
        display.className = `text-xs font-bold ${total === 100 ? 'text-void-accent/40' : 'text-red-400'}`;
    }
}

// Handled in initCreatorDashboardEvents

// Handled in initCreatorDashboardEvents

// File upload for global card back
// Handled in initCreatorDashboardEvents

async function refreshAdminPanel() {
    console.log("[Admin] Refreshing Matrix data...");
    await Promise.allSettled([
        loadAdminStats(),
        loadAdminUsers(),
        loadAdminCards()
    ]);
}

window.refreshAdminPanel = refreshAdminPanel;

async function loadAdminStats() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error("Auth Failed");
        const stats = await res.json();

        document.getElementById('admin-stat-users').innerText = stats.total_users;
        document.getElementById('admin-stat-cards').innerText = stats.total_cards;
        document.getElementById('admin-stat-unique').innerText = stats.unique_cards;
        document.getElementById('admin-stat-legendary').innerText = stats.legendary_count;
    } catch (e) {
        console.error('Failed to load admin stats:', e);
    }
}

async function loadAdminUsers() {
    const list = document.getElementById('user-mod-list');
    list.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">Loading...</div>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error("Auth Failed");
        adminUsersData = await res.json();
        renderAdminUsers();
    } catch (e) {
        list.innerHTML = `<div class="text-red-400 text-xs">Access Denied</div>`;
    }
}

function renderAdminUsers() {
    const list = document.getElementById('user-mod-list');
    const search = document.getElementById('admin-user-search').value.toLowerCase();

    const filtered = adminUsersData.filter(u => u.username.toLowerCase().includes(search));

    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center text-xs text-void-muted py-4">No users found.</div>`;
        return;
    }

    list.innerHTML = filtered.map(u => `
            <div class="flex justify-between items-center bg-void-text/5 p-3 rounded-2xl border border-white/5">
                <div class="flex items-center gap-3">
                    <img src="${u.avatar_url}" class="w-8 h-8 rounded-full border border-white/10">
                    <span class="text-xs font-bold text-void-text uppercase tracking-tight">${u.username}</span>
                </div>
                <button onclick="wipeUser('${u.twitch_id}')" class="text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all">WIPE</button>
            </div>
        `).join('');
}

// Add search listener
// Handled in initCreatorDashboardEvents

async function loadAdminCards() {
    const list = document.getElementById('card-list');
    list.innerHTML = '<div class="text-xs text-gray-500">Loading...</div>';
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            credentials: 'include'
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Auth Failed");
        }
        const cards = await res.json();
        list.innerHTML = cards.map(c => `
                <div class="flex justify-between items-center bg-void-text/5 p-3 rounded-2xl border border-white/5 text-[10px]">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <img src="${c.image_url}" class="w-10 h-10 rounded-lg object-cover border border-white/10">
                        <div class="min-w-0">
                            <div class="font-bold text-void-text truncate uppercase tracking-tight">${c.name}</div>
                            <div class="text-[9px] text-void-muted uppercase tracking-widest font-black mt-0.5">${c.id.slice(0, 8)} · ${c.rarity}</div>
                        </div>
                    </div>
                    <button onclick="deleteCard('${c.id}')" class="text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all ml-2">DEL</button>
                </div>
            `).join('');
    } catch (e) {
        console.error("Load Admin Cards Error:", e);
        list.innerHTML = `<div class="text-red-400 text-xs text-center p-4">
                Access Denied<br>
                <span class="text-[10px] text-gray-400">${e.message}</span>
            </div>`;
        showToast(`Failed to load cards: ${e.message}`, "error");
    }
}

// --- CONFIRMATION UTIL ---
function showConfirm(message) {
    return new Promise((resolve) => {
        showCustomConfirm({
            title: "Admin Action",
            message: message,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

window.wipeUser = async (targetId) => {
    if (!await showConfirm("This will delete ALL cards for this user. This cannot be undone.")) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/users?target_id=${targetId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'include'
    });
    if (res.ok) {
        showToast("User wiped successfully", "success");
        loadAdminUsers();
    } else {
        showToast("Failed to wipe user", "error");
    }
};

window.deleteAdminCard = async (cardId) => {
    if (!await showConfirm(`Delete card ${cardId} from the database?`)) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/cards?card_id=${cardId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'include'
    });
    if (res.ok) {
        showToast("Card deleted", "success");
        loadAdminCards();
    } else {
        showToast("Failed to delete card", "error");
    }
};

// Grant Card Form
const grantCardForm = document.getElementById('grant-card-form');
if (grantCardForm) {
    grantCardForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            username: document.getElementById('grant-username').value,
            card_id: document.getElementById('grant-card-id').value,
            quantity: parseInt(document.getElementById('grant-quantity').value)
        };

        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/grant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Granted ${data.count} card(s) to ${payload.username}`, "success");
                e.target.reset();
            } else {
                const errorData = await res.json();
                showToast(`Failed: ${errorData.error || 'Unknown error'}`, "error");
            }
        } catch (err) {
            showToast("Connection error", "error");
        }
    };
}

// Bulk Actions - Moved to initModalEvents to support dynamic loading

// --- DATA (VIA BACKEND) ---

async function fetchUserCollection(initialData = null) {
    try {
        const filterParam = window.activeStreamerFilter || (APP_STREAMER ? APP_STREAMER.username : null);
        if (!filterParam) {
            // No streamer context — clear skeleton and bail
            const grid = document.getElementById('binder-grid');
            if (grid) grid.innerHTML = '';
            return;
        }

        // If we don't have initial data, show skeletons
        if (!initialData) {
            showSkeletonCards();
        }
        const resCards = await fetch(`${BACKEND_URL}/api/collection?streamer=${filterParam}`, {
            credentials: 'include'
        });
        if (resCards.ok) {
            const data = await resCards.json();

            userCollection = data.map(item => ({
                id: item.card_id,
                instanceId: item.user_card_id,
                name: item.name,
                rarity: item.rarity,
                image_url: item.image_url,
                type: item.type,
                set_name: item.set_name || 'Ageless', // Default if missing
                created_at: item.created_at,
                // Battle Stats
                attack: item.attack || 0,
                defense: item.defense || 0,
                max_hp: item.max_hp || 0,
                current_hp: item.current_hp || 0,
                mechanic_name: item.mechanic_name,
                mechanic_display_name: item.mechanic_display_name,
                mechanic_icon: item.mechanic_icon,
                mechanic_description: item.mechanic_description,
                genesis_mechanic_name: item.genesis_mechanic_name,
                genesis_mechanic_display_name: item.genesis_mechanic_display_name,
                genesis_mechanic_icon: item.genesis_mechanic_icon,
                genesis_mechanic_description: item.genesis_mechanic_description,
                is_dead: item.is_dead || false
            }));

            if (userCollection.length > 0) lastCardId = userCollection[0].instanceId;

            stackCards(); // Process stacks
            renderBinderList(); // Update "All Cards" count
            updateSetFilter(); // New: Populate filter
            renderBinder();
            renderRecentDrops();
            renderPrizedPossession();
            loadSetProgress(); // NEW: Load per-set progress
            renderAchievements(); // Populate mock achievements
        } else if (!initialData) {
            console.error("API Error", await resCards.text());
        }

        // Fetch Stats (only if not already provided)
        if (!initialData) {
            const filterParam = window.activeStreamerFilter || (APP_STREAMER ? APP_STREAMER.username : null);
            if (!filterParam) return;
            const resStats = await fetch(`${BACKEND_URL}/api/stats?streamer=${filterParam}`, {
                credentials: 'include'
            });
            if (resStats.ok) {
                const stats = await resStats.json();
                const totalEl = document.getElementById('stat-total');
                const legendaryEl = document.getElementById('stat-legendary');
                if (totalEl) totalEl.innerText = stats.total;
                if (legendaryEl) legendaryEl.innerText = stats.legendary;
            }

            // Fetch total unique cards available
            const resCount = await fetch(`${BACKEND_URL}/api/cards/count`, {
                credentials: 'include'
            });
            if (resCount.ok) {
                const countData = await resCount.json();
                const totalAvailEl = document.getElementById('stat-total-available');
                if (totalAvailEl) totalAvailEl.innerText = countData.count;
                totalUniqueCards = countData.count;
                updateCollectionProgress();
            }
        }
        // Always try to load set progress
        loadSetProgress();
    } catch (err) {
        console.error("Fetch error:", err);
        loadSetProgress();
    }
}

// --- POLLING FOR REAL-TIME UPDATES ---
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    // Poll at a reasonable interval to avoid hammering the backend (15s)
    pollingInterval = setInterval(async () => {
        // 1. Fetch Notifications
        try {
            // Poll silently
            const res = await fetch(`${BACKEND_URL}/api/notifications`, {
                credentials: 'include'
            });

            if (res.status === 429) {
                // Back off on rate limit responses
                console.warn('[Notifications] Rate limited (429). Slowing down polling.');
                return;
            }

            if (res.ok) {
                const notifications = await res.json();
                // Filter out already-shown notifications
                const newNotifications = notifications.filter(n => !shownNotificationIds.has(n.id));

                if (newNotifications.length > 0) {
                    if (currentUser?.role === 'admin') console.log('New notifications:', newNotifications.length);

                    // Show toast for each NEW notification
                    newNotifications.forEach(n => {
                        const type = n.type === 'achievement_unlock' ? 'success' : 'info';
                        showToast(n.message, type);

                        // If it's a card drop, show a toast notification
                        if (n.type === 'card_drop' && n.data) {
                            showCardToast(n.data);
                        }
                        // Mark as shown immediately to prevent duplicates
                        shownNotificationIds.add(n.id);

                        // Trigger celebration for achievements
                        if (n.type === 'achievement_unlock') {
                            showAchievementCelebration();
                        }

                        // Refresh trades if trade-related
                        if (n.type.startsWith('trade_')) {
                            fetchTrades();
                        }
                    });

                    // Mark them as read (Delete from DB) - AWAIT this
                    const notificationIds = newNotifications.map(n => n.id);
                    try {
                        const deleteRes = await fetch(`${BACKEND_URL}/api/notifications`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({ ids: notificationIds })
                        });

                        if (deleteRes.ok) {
                            if (currentUser?.role === 'admin') console.log('Successfully deleted notifications');
                        } else {
                            console.error('Failed to delete notifications:', deleteRes.status, await deleteRes.text());
                        }
                    } catch (deleteError) {
                        console.error('Error marking notifications as read:', deleteError);
                    }

                    // Refresh data since something changed
                    await fetchUserCollection();

                    // Also refresh achievements list if needed
                    const achRes = await fetch(`${BACKEND_URL}/api/achievements`, { credentials: 'include' });
                    if (achRes.ok) {
                        achievementsData = await achRes.json();
                        renderAchievements();
                    }
                }
            } else {
                // Only log errors if not 401 (session expired)
                if (res.status !== 401) console.error("Notification polling failed:", res.status);
            }
        } catch (e) {
            // Silent fail
        }

        // Still do a silent refresh of collection occasionally just in case
        // But mainly rely on notifications for triggers
    }, 15000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}


// --- LEADERBOARD ---
async function fetchLeaderboard() {
    if (document.getElementById('leaderboard-list')) {
        setLoadingState('leaderboard-list', true);
    }
    try {
        const res = await fetch(`${BACKEND_URL}/api/leaderboard`);
        if (res.ok) {
            leaderboardData = await res.json();
            renderLeaderboard();
        } else {
            showToast('Failed to load leaderboard', 'error');
            setLoadingState('leaderboard-list', false, 'Failed to load leaderboard');
        }
    } catch (err) {
        console.error("Leaderboard fetch error:", err);
        showToast('Error loading leaderboard', 'error');
        setLoadingState('leaderboard-list', false, 'Error loading leaderboard');
    }
}

// --- ACHIEVEMENTS ---
let achievementsData = [];

async function fetchAchievements() {
    if (document.getElementById('achievements-list')) {
        setLoadingState('achievements-list', true);
    }
    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/achievements${streamerParam}`, { credentials: 'include' });
        if (res.ok) {
            achievementsData = await res.json();
            renderAchievements();
        } else {
            setLoadingState('achievements-list', false, 'Failed to load achievements');
        }
    } catch (err) {
        console.error("Achievements fetch error:", err);
        setLoadingState('achievements-list', false, 'Error loading achievements');
    }
}

// --- BATTLES LEADERBOARD ---
async function fetchBattlesLeaderboard() {
    setLoadingState('battles-leaderboard-list', true);
    try {
        const res = await fetch(`${BACKEND_URL}/api/public/battle/stats_all`);
        if (res.ok) {
            battlesData = await res.json();
            renderBattlesLeaderboard();
        } else {
            showToast('Failed to load battle rankings', 'error');
            setLoadingState('battles-leaderboard-list', false, 'Failed to load battle rankings');
        }
    } catch (err) {
        console.error("Battle Leaderboard fetch error:", err);
        showToast('Error loading battle rankings', 'error');
        setLoadingState('battles-leaderboard-list', false, 'Error loading battle rankings');
    }
}

// Consolidated renderAchievements moved to top section

function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');

    if (leaderboardData.length === 0) {
        list.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-3">📊</div>
                    <div class="text-gray-400 text-sm">No collectors yet!</div>
                    <div class="text-gray-600 text-xs mt-1">Be the first to start collecting cards</div>
                </div>
            `;
        return;
    }

    list.innerHTML = leaderboardData.map((user, index) => {
        const isCurrentUser = currentUser && user.twitch_id === currentUser.uid;
        const rankColors = ['text-void-accent', 'text-void-text', 'text-void-muted'];
        const rankColor = rankColors[index] || 'text-void-muted';
        const rankIcon = ['🥇', '🥈', '🥉'][index] || `#${index + 1}`;

        return `
                <div class="p-6 rounded-[2.5rem] bg-void-bg border border-white/5 void-shadow flex items-center gap-6 ${isCurrentUser ? 'ring-2 ring-void-accent/20' : ''}">
                    <div class="w-12 text-center flex-shrink-0">
                        <div class="text-2xl font-bold ${rankColor} italic">${rankIcon}</div>
                    </div>
                    
                    <div class="relative flex-shrink-0">
                        <img src="${user.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username}`}" 
                             class="w-16 h-16 rounded-[1.5rem] border-2 border-void-bg void-shadow">
                        ${isCurrentUser ? '<div class="absolute -top-1 -right-1 w-5 h-5 bg-void-accent rounded-full border-2 border-void-bg flex items-center justify-center"><i class="fa-solid fa-user text-[8px] text-void-bg"></i></div>' : ''}
                    </div>
 
                    <div class="flex-1 min-w-0 pr-6 border-r border-white/5">
                        <div class="text-[10px] font-black text-void-muted uppercase tracking-[0.2em] mb-1">Collector</div>
                        <div class="font-bold text-void-text truncate text-xl uppercase italic">
                            ${user.username}
                            ${isCurrentUser ? '<span class="ml-2 text-[8px] bg-void-accent text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">YOU</span>' : ''}
                        </div>
                    </div>
 
                    <div class="flex gap-8 text-center">
                        <div class="flex flex-col">
                            <span class="text-[9px] text-void-muted font-black uppercase tracking-[0.2em]">Inventory</span>
                            <span class="text-void-text font-bold text-2xl leading-tight italic">${user.total_cards}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] text-void-accent/60 font-black uppercase tracking-[0.2em]">Mythic</span>
                            <span class="text-void-accent font-bold text-2xl leading-tight italic">${user.legendary_count || 0}</span>
                        </div>
                    </div>
                </div>
            `;
    }).join('');
}

function renderBattlesLeaderboard() {
    const list = document.getElementById('battles-leaderboard-list');

    if (battlesData.length === 0) {
        list.innerHTML = `
                <div class="p-12 text-center flex flex-col items-center justify-center space-y-4 bg-white/[0.02] border border-white/5 border-dashed rounded-[2.5rem]">
                    <div class="w-16 h-16 rounded-full bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent text-3xl mb-2">
                        <i class="fa-solid fa-khanda"></i>
                    </div>
                    <h3 class="text-xl font-black uppercase text-void-text tracking-widest italic">No Battles Fought</h3>
                    <p class="text-void-muted text-xs">Be the first to challenge a rival and climb the ranks!</p>
                </div>
            `;
        return;
    }

    list.innerHTML = battlesData.map((user, index) => {
        const isCurrentUser = currentUser && user.twitch_id === currentUser.uid;
        const rankColors = ['text-void-accent', 'text-void-text', 'text-void-muted'];
        const rankColor = rankColors[index] || 'text-void-muted';
        const rankIcon = ['⚔️', '🥈', '🥉'][index] || `#${index + 1}`;

        return `
                <div class="p-6 rounded-[2.5rem] bg-void-bg border border-white/5 void-shadow flex items-center gap-6 ${isCurrentUser ? 'ring-2 ring-void-accent/20' : ''}">
                    <div class="w-12 text-center flex-shrink-0">
                        <div class="text-2xl font-bold ${rankColor} italic">${rankIcon}</div>
                    </div>
                    
                    <div class="relative flex-shrink-0">
                        <img src="${user.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username}`}" 
                             class="w-16 h-16 rounded-[1.5rem] border-2 border-void-bg void-shadow">
                        ${isCurrentUser ? '<div class="absolute -top-1 -right-1 w-5 h-5 bg-void-accent rounded-full border-2 border-void-bg flex items-center justify-center"><i class="fa-solid fa-user text-[8px] text-void-bg"></i></div>' : ''}
                    </div>

                    <div class="flex-1 min-w-0 pr-6 border-r border-white/5">
                        <div class="text-[10px] font-black text-void-muted uppercase tracking-[0.2em] mb-1">Combatant</div>
                        <div class="font-bold text-void-text truncate text-xl uppercase italic">
                            ${user.username}
                            ${isCurrentUser ? '<span class="ml-2 text-[8px] bg-void-accent text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">YOU</span>' : ''}
                        </div>
                    </div>

                    <div class="flex gap-8 text-center">
                        <div class="flex flex-col">
                            <span class="text-[9px] text-void-muted font-black uppercase tracking-[0.2em]">Victory</span>
                            <span class="text-void-accent font-bold text-2xl leading-tight italic">${user.wins}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[9px] text-void-muted font-black uppercase tracking-[0.2em]">Defeat</span>
                            <span class="text-void-text font-bold text-2xl leading-tight italic opacity-40">${user.losses || 0}</span>
                        </div>
                    </div>
                </div>
            `;
    }).join('');
}

// --- TAB SWITCHING ---
// --- NAVIGATION ---
// --- NAVIGATION ---
async function switchView(viewName) {
    const views = ['collection', 'leaderboard', 'trading', 'admin', 'profile', 'creator-dashboard', 'battle'];

    // --- DYNAMIC LOADING: Special Subviews ---
    if (viewName === 'creator-dashboard' && !document.getElementById('creator-dashboard-view')) {
        await loadView('creator-dashboard');
    }

    // Ensure dashboard view is visible when switching to any dashboard subview
    const dashboardView = document.getElementById('dashboard-view');
    if (views.includes(viewName) && dashboardView) {
        dashboardView.classList.remove('hidden');
        dashboardView.style.display = 'block';
    }

    // Hide all main views (dashboard subviews)
    views.forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    // Hide/Show landing based on view
    if (viewName === 'landing') {
        showLanding();
    } else {
        hideLanding();
    }

    // Show selected view
    const target = document.getElementById(`${viewName}-view`);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update global navbar navigation items (System Style)
    // Update global navbar navigation items (Premium Style)
    const navMapping = {
        'collection': 'nav-collection-btn',
        'leaderboard': 'nav-archive-btn',
        'trading': 'nav-exchange-btn',
        'battle': 'nav-battle-btn-top',
        'creator-dashboard': 'nav-creator-btn'
    };

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('text-void-muted');
    });

    const activeNavId = navMapping[viewName];
    if (activeNavId) {
        const activeTab = document.getElementById(activeNavId);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.classList.remove('text-void-muted');
        }
    }

    // Refresh specific view data as needed
    if (viewName === 'collection') renderBinder();
    if (viewName === 'leaderboard') renderLeaderboard();
    if (viewName === 'trading') renderTradingHub();
    if (viewName === 'creator-dashboard') loadOverviewData();
    if (viewName === 'admin') refreshAdminPanel();
    if (viewName === 'profile') populateProfileView();

    // Trigger state sync if needed
    if (bootstrapData) {
        updateOverviewStats(bootstrapData.stats);
    }

    // Initialize Battle View if needed
    if (viewName === 'battle') {
        renderBattleDashboard();
    }

    // Toggle to collector (player) view from creator dashboard
    function switchToCollectorView() {
        switchView('collection');
    }

    window.switchToCollectorView = switchToCollectorView;

    // --- SUB-TAB SWITCHING ---
    function switchLeaderboardSubTab(tabName) {
        const tabs = ['collection', 'battles'];
        tabs.forEach(t => {
            const section = document.getElementById(`ldb-${t}-section`);
            if (section) section.classList.add('hidden');
            const btn = document.getElementById(`subtab-ldb-${t}`);
            if (btn) btn.className = "flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-all border-b-2 border-transparent text-gray-500 hover:text-gray-300";
        });

        const targetSection = document.getElementById(`ldb-${tabName}-section`);
        if (targetSection) targetSection.classList.remove('hidden');
        const activeBtn = document.getElementById(`subtab-ldb-${tabName}`);

        if (activeBtn) {
            if (tabName === 'collection') {
                activeBtn.className = "flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-all border-b-2 border-void-accent text-white";
                fetchLeaderboard();
            } else if (tabName === 'battles') {
                activeBtn.className = "flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-all border-b-2 border-red-500 text-white";
                fetchBattlesLeaderboard();
            }
        }
    }
}

// Update Active Tab UI on Initialization
const navCollectionBtn = document.getElementById('nav-collection-btn');
if (navCollectionBtn) navCollectionBtn.onclick = () => switchView('collection');

const navArchiveBtn = document.getElementById('nav-archive-btn');
if (navArchiveBtn) navArchiveBtn.onclick = () => switchView('leaderboard');

const navExchangeBtn = document.getElementById('nav-exchange-btn');
if (navExchangeBtn) navExchangeBtn.onclick = () => switchView('trading');

const navBattleBtn = document.getElementById('nav-battle-btn-top');
if (navBattleBtn) navBattleBtn.onclick = () => switchView('battle');

const navCreatorBtn = document.getElementById('nav-creator-btn');
if (navCreatorBtn) navCreatorBtn.onclick = () => { window.location.href = '/dashboard'; };

async function renderBattleDashboard() {
    const arenaEl = document.getElementById('battle-arena-streamer');
    if (arenaEl) arenaEl.textContent = APP_STREAMER ? APP_STREAMER.username : 'GLOBAL';
    if (typeof loadCollections === 'function') loadCollections();
}
fetchCreatorCards();
switchCreatorTab('overview');


// --- CUSTOM BINDERS LOGIC ---
async function fetchUserBinders() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/binders`, { credentials: 'include' });
        if (res.ok) {
            userBinders = await res.json();
            renderBinderList();
            // If we have an active binder that's not 'all', check if it still exists
            if (activeBinderId !== 'all' && !userBinders.find(b => b.id === activeBinderId)) {
                switchBinder('all');
            }
        }
    } catch (err) {
        console.error("Failed to fetch binders:", err);
    }
}

function renderBinderList() {
    const list = document.getElementById('binder-list');
    if (!list) return;

    console.log("Rendering Binder List. Count:", userBinders.length);

    // Keep the "All Cards" item
    const allItem = `
            <div class="binder-page-item ${activeBinderId === 'all' ? 'active' : ''}" onclick="switchBinder('all')">
                <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-black text-void-text uppercase tracking-widest truncate group-hover:translate-x-1 transition-transform">All Cards</div>
                    <div class="text-[9px] text-void-muted uppercase font-bold mt-0.5">${uniqueCards.length} items</div>
                </div>
                <div class="w-1.5 h-1.5 rounded-full ${activeBinderId === 'all' ? 'bg-void-accent shadow-[0_0_8px_rgba(var(--void-accent-rgb),0.6)]' : 'bg-white/10'} transition-all"></div>
            </div>
        `;

    const customItems = userBinders.map(binder => {
        const count = binder.user_binder_cards?.length || 0;
        return `
                                <div onclick="switchBinder('${binder.id}')" class="binder-page-item group ${activeBinderId === binder.id ? 'active' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-black text-void-text uppercase tracking-widest truncate group-hover:translate-x-1 transition-transform">${binder.name}</div>
                    <div class="text-[9px] text-void-muted uppercase font-bold mt-0.5">${count} items</div>
                </div>
                <div class="w-2 h-2 rounded-full ${activeBinderId === binder.id ? 'bg-void-accent' : 'bg-void-text/10'} group-hover:scale-125 transition-all"></div>
            </div>
        `;
    }).join('');

    list.innerHTML = allItem + customItems;

    // Re-initialize Sidebar Sortable
    initBinderSortable();
}

function toggleBinderRearrange() {
    if (activeBinderId === 'all') return;
    binderRearrangeMode = !binderRearrangeMode;

    const btn = document.getElementById('rearrange-binders-btn');
    const list = document.getElementById('binder-list');

    if (binderRearrangeMode) {
        btn.classList.add('bg-blue-500', 'text-white');
        btn.classList.remove('bg-blue-500/5', 'text-blue-400');
    } else {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-blue-500/5', 'text-blue-400');
    }

    if (binderSortable) {
        binderSortable.option("disabled", !binderRearrangeMode);
    }
}

function toggleBinderEdit() {
    // If we are currently editing, we always want to be able to stop
    // But we only want to START editing if we are in a custom binder
    if (!isEditingBinder && activeBinderId === 'all') return;

    isEditingBinder = !isEditingBinder;

    const btn = document.getElementById('edit-binder-btn');
    const grid = document.getElementById('binder-grid');
    const editActions = document.getElementById('binder-edit-actions');

    if (isEditingBinder) {
        btn.classList.add('bg-void-accent', 'text-white');
        btn.classList.remove('bg-void-accent/10', 'text-void-accent/40');
        btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> DONE';
        grid.classList.add('rearrange-active');
        if (editActions) editActions.classList.remove('hidden');
    } else {
        btn.classList.remove('bg-void-accent', 'text-white');
        btn.classList.add('bg-void-accent/10', 'text-void-accent/40');
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square mr-2"></i> EDIT BINDER';
        grid.classList.remove('rearrange-active');
        if (editActions) editActions.classList.add('hidden');
    }

    if (cardSortable) {
        cardSortable.option("disabled", !isEditingBinder);
    }
}

async function renameActiveBinder() {
    if (activeBinderId === 'all') return;
    const currentBinder = userBinders.find(b => b.id === activeBinderId);
    if (!currentBinder) return;

    document.getElementById('rename-binder-input').value = currentBinder.name;
    showRenameBinderModal();
}

function showRenameBinderModal() {
    document.getElementById('rename-binder-modal').classList.remove('hidden');
    document.getElementById('rename-binder-input').focus();
}

function hideRenameBinderModal() {
    document.getElementById('rename-binder-modal').classList.add('hidden');
}

async function confirmRenameBinder() {
    const newName = document.getElementById('rename-binder-input').value.trim();
    if (!newName) return showToast("Name required", "error");

    const currentBinder = userBinders.find(b => b.id === activeBinderId);
    if (newName === currentBinder?.name) return hideRenameBinderModal();

    try {
        const res = await fetch(`${BACKEND_URL}/api/binders`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ id: activeBinderId, name: newName }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Binder renamed!", "success");
            hideRenameBinderModal();
            await fetchUserBinders();
            renderBinder();
        } else {
            const err = await res.json();
            showToast(err.error || "Failed to rename", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

let binderSortable = null;
function initBinderSortable() {
    const list = document.getElementById('binder-list');
    if (!list) return;

    if (binderSortable) binderSortable.destroy();

    binderSortable = new Sortable(list, {
        animation: 150,
        disabled: !isEditingBinder,
        draggable: '.binder-page-item:not([onclick*="switchBinder(\'all\')"])', // Don't allow dragging "All Cards"
        onEnd: async () => {
            const items = Array.from(list.querySelectorAll('.binder-page-item[onclick*="switchBinder(\'"]'));
            // Filter out "all"
            const customItems = items.filter(el => !el.getAttribute('onclick').includes("'all'"));

            const order = customItems.map((el, index) => {
                const match = el.getAttribute('onclick').match(/'([^']+)'/);
                return { id: match[1], sort_order: index };
            });

            try {
                await fetch(`${BACKEND_URL}/api/binders/sort`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ order }),
                    credentials: 'include'
                });
                // Update local userBinders state to reflect new order
                userBinders.sort((a, b) => {
                    const oa = order.find(x => x.id === a.id)?.sort_order ?? 999;
                    const ob = order.find(x => x.id === b.id)?.sort_order ?? 999;
                    return oa - ob;
                });
            } catch (err) {
                console.error("Failed to save binder order:", err);
            }
        }
    });
}

let cardSortable = null;
function initCardSortable() {
    const grid = document.getElementById('binder-grid');
    if (!grid) return;

    if (cardSortable) cardSortable.destroy();

    cardSortable = new Sortable(grid, {
        animation: 200,
        swap: true, // Enable swap plugin
        swapThreshold: 0.65,
        disabled: !isEditingBinder,
        draggable: '.binder-slot',
        onEnd: async (evt) => {
            if (activeBinderId === 'all') return;

            const slots = Array.from(grid.querySelectorAll('.binder-slot'));
            const updates = [];

            slots.forEach((slot, index) => {
                const cardEl = slot.querySelector('.binder-card');
                const newSlotIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;

                // Update slot index dataset
                slot.dataset.slotIndex = newSlotIndex;

                if (cardEl) {
                    const instanceId = cardEl.dataset.instanceId;
                    updates.push({ user_card_id: instanceId, sort_order: newSlotIndex });
                }
            });

            if (updates.length > 0) {
                try {
                    await fetch(`${BACKEND_URL}/api/binders/cards/sort`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({ binder_id: activeBinderId, order: updates }),
                        credentials: 'include'
                    });

                    // Update local state for immediate feedback
                    const b = userBinders.find(x => x.id === activeBinderId);
                    if (b) {
                        updates.forEach(upd => {
                            const c = b.user_binder_cards.find(x => x.user_card_id === upd.user_card_id);
                            if (c) c.sort_order = upd.sort_order;
                        });
                    }
                } catch (err) {
                    console.error("Failed to save card order:", err);
                }
            }
        }
    });
}

async function removeCardFromBinder(instanceId) {
    if (activeBinderId === 'all') return;

    showCustomConfirm({
        title: "Remove Card",
        message: "Are you sure you want to remove this card from the binder?",
        confirmText: "Remove",
        confirmClass: "bg-red-600 text-white hover:bg-red-500 shadow-red-500/20",
        icon: "fa-trash-can",
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
        iconBorder: "border-red-500/20",
        onConfirm: async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/binders/cards?binder_id=${activeBinderId}&user_card_id=${instanceId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-Token': csrfToken
                    },
                    credentials: 'include'
                });

                if (res.ok) {
                    showToast("Card removed!", "success");
                    await fetchUserBinders();
                    renderBinder();
                } else {
                    const err = await res.json();
                    showToast(err.error || "Failed to remove card", "error");
                }
            } catch (err) {
                showToast("Connection error", "error");
            }
        }
    });
}

async function shareBinderPage() {
    const grid = document.getElementById('binder-grid');
    if (!grid) return;

    showToast("Preparing image generation...", "info");

    try {
        // FORCE crossorigin on all images recursively
        const allImages = grid.querySelectorAll('img');
        allImages.forEach(img => {
            const currentSrc = img.src;
            if (currentSrc && !currentSrc.startsWith('data:')) {
                img.crossOrigin = "anonymous";
                // Reset src to trigger CORS check if needed
                img.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
            }
        });

        // Wait a bit for images to reload with CORS if needed
        await new Promise(r => setTimeout(r, 600));

        const shareFooter = document.getElementById('binder-share-footer');
        const shareBrandingText = document.getElementById('share-branding-text');
        const currentBinder = userBinders.find(b => b.id === activeBinderId);
        const binderName = activeBinderId === 'all' ? 'Collector Edition' : (currentBinder ? currentBinder.name : 'card Binder');
        const userName = currentUser ? currentUser.name : 'Anonymous';

        if (shareBrandingText) {
            shareBrandingText.innerText = `${userName}'s ${binderName}`;
        }

        const captureTarget = document.getElementById('binder-view');
        captureTarget.classList.add('sharing-mode');

        const canvas = await html2canvas(captureTarget, {
            backgroundColor: '#0a0f0d',
            scale: 2,
            logging: true,
            useCORS: true,
            allowTaint: false,
            onclone: (clonedDoc) => {
                const clonedTarget = clonedDoc.getElementById('binder-view');
                if (clonedTarget) {
                    clonedTarget.classList.add('sharing-mode');
                    // Ensure the clone also has CORS set
                    const clonedImgs = clonedTarget.querySelectorAll('img');
                    clonedImgs.forEach(img => img.crossOrigin = "anonymous");
                }
            }
        });

        captureTarget.classList.remove('sharing-mode');

        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl === "data:,") throw new Error("Canvas generated an empty image. Check console for CORS errors.");

        const previewContainer = document.getElementById('share-preview-container');
        previewContainer.innerHTML = `<img src="${dataUrl}" class="max-h-[50vh] max-w-full object-contain shadow-2xl border border-white/10 rounded-xl">`;

        const downloadBtn = document.getElementById('download-share-btn');
        downloadBtn.href = dataUrl;
        downloadBtn.download = `lilypad-binder-${activeBinderId}-${currentPage}.png`;

        document.getElementById('share-modal').classList.remove('hidden');
        scrollLock();
        showToast("Image ready!", "success");
    } catch (err) {
        grid.classList.remove('sharing-mode');
        console.error("CAPTURE ERROR:", err);
        alert("SHARE FAILED: " + err.message + "\n\nCommon fixes:\n1. RELOAD the page\n2. Disable 'Incognito' mode\n3. Check if card set images are loading.");
        showToast("Sharing failed", "error");
    }
}

function hideShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
    scrollUnlock();
}

function showCreateBinderModal() {
    document.getElementById('create-binder-modal').classList.remove('hidden');
    document.getElementById('new-binder-name').focus();
    scrollLock();
}

function hideCreateBinderModal() {
    document.getElementById('create-binder-modal').classList.add('hidden');
    document.getElementById('new-binder-name').value = '';
    scrollUnlock();
}

async function submitCreateBinder() {
    const name = document.getElementById('new-binder-name').value.trim();
    if (!name) {
        showToast("Please enter a binder name", "error");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/binders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ name }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Binder created successfully!", "success");
            hideCreateBinderModal();
            await fetchUserBinders();
        } else {
            const err = await res.json();
            showToast(err.error || "Failed to create binder", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

async function deleteBinder(id) {
    showCustomConfirm({
        title: "Delete Binder",
        message: "Are you sure you want to delete this binder? Cards won't be deleted, only removed from this category.",
        confirmText: "Delete Binder",
        confirmClass: "bg-red-600 text-white hover:bg-red-500 shadow-red-500/20",
        icon: "fa-trash-can",
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
        iconBorder: "border-red-500/20",
        onConfirm: async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/binders?id=${id}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': csrfToken },
                    credentials: 'include'
                });

                if (res.ok) {
                    showToast("Binder deleted", "success");
                    await fetchUserBinders();
                } else {
                    showToast("Failed to delete binder", "error");
                }
            } catch (err) {
                showToast("Connection error", "error");
            }
        }
    });
}

// Bulk Actions - Selected Cards Delete handled in initModalEvents()

function switchBinder(id) {
    activeBinderId = id;
    currentPage = 1;

    const isCustomBinder = id !== 'all';
    const actionArea = document.getElementById('binder-actions-area');
    const filterRow = document.getElementById('binder-filter-row');
    const setSelector = document.getElementById('set-selector');

    if (isCustomBinder) {
        // Show binder controls, hide filters
        if (actionArea) actionArea.classList.remove('hidden');
        if (filterRow) filterRow.classList.add('hidden');
        if (setSelector) setSelector.classList.add('hidden');
        const binder = userBinders.find(b => b.id === activeBinderId);
        document.getElementById('page-indicator').innerText = binder?.name || "Custom Binder";

        // Ensure edit actions are hidden if not editing
        const editActions = document.getElementById('binder-edit-actions');
        if (editActions && !isEditingBinder) editActions.classList.add('hidden');
        const editBtn = document.getElementById('edit-binder-btn');
        if (editBtn) editBtn.classList.remove('hidden');
    } else {
        // Hide binder controls, show filters
        if (actionArea) actionArea.classList.add('hidden');
        if (filterRow) filterRow.classList.remove('hidden');
        if (setSelector) setSelector.classList.remove('hidden');
        document.getElementById('page-indicator').innerText = "All Cards";
        const editBtn = document.getElementById('edit-binder-btn');
        if (editBtn) editBtn.classList.add('hidden');
    }

    // Reset edit mode when switching binders
    if (isEditingBinder) toggleBinderEdit();

    console.log(`Switching to binder: ${id}`);

    renderBinderList();
    renderBinder();
}



// --- ADD CARDS TO BINDER MODAL LOGIC ---
let modalSelectedCardIds = new Set();
let modalSearchQuery = '';
let modalRarityFilter = 'all';

let inlineTargetSlot = null;
function showAddCardsToBinderModal(slotIdx = null) {
    if (activeBinderId === 'all') return;
    inlineTargetSlot = slotIdx;
    modalSelectedCardIds.clear();
    modalSearchQuery = '';
    modalRarityFilter = 'all';

    document.getElementById('modal-card-search').value = '';
    document.getElementById('modal-rarity-filter').value = 'all';

    updateModalSelectionCount();
    renderModalCardGrid();

    document.getElementById('add-cards-to-binder-modal').classList.remove('hidden');
    scrollLock();
}

function hideAddCardsToBinderModal() {
    document.getElementById('add-cards-to-binder-modal').classList.add('hidden');
    scrollUnlock();
}

function updateModalSelectionCount() {
    const btn = document.getElementById('confirm-add-cards-btn');
    btn.innerText = `Add Selected (${modalSelectedCardIds.size})`;
    btn.disabled = modalSelectedCardIds.size === 0;
    btn.onclick = modalSelectedCardIds.size > 0 ? confirmAddCards : null;
    btn.className = `flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${modalSelectedCardIds.size > 0 ? 'bg-void-accent text-void-bg hover:opacity-90 shadow-void-accent/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`;
}

function renderModalCardGrid() {
    const grid = document.getElementById('modal-card-grid');
    if (!grid) return;

    // Get cards NOT in the current binder
    const activeBinder = userBinders.find(b => b.id === activeBinderId);
    const cardsInBinder = new Set(activeBinder?.user_binder_cards?.map(c => c.user_card_id) || []);

    // We show INDIVIDUAL instances in the modal (so they can pick specific ones if they want, 
    // or just show unique ones? The user said "add binders from the add binders button", 
    // usually you'd select from your collection. Let's stack them for easier picking.)

    let displayCards = userCollection.filter(c => !cardsInBinder.has(c.instanceId));

    if (modalSearchQuery) {
        displayCards = displayCards.filter(c => c.name.toLowerCase().includes(modalSearchQuery.toLowerCase()));
    }
    if (modalRarityFilter !== 'all') {
        displayCards = displayCards.filter(c => c.rarity === modalRarityFilter);
    }

    grid.innerHTML = displayCards.map(card => {
        const isSelected = modalSelectedCardIds.has(card.instanceId);
        return `
                <div onclick="toggleModalCardSelection('${card.instanceId}')" class="relative group cursor-pointer aspect-[5/7] rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-void-accent ring-2 ring-void-accent/50' : 'border-white/5 hover:border-white/20'}">
                    <img src="${card.image_url}" class="w-full h-full object-cover ${isSelected ? '' : 'opacity-80 group-hover:opacity-100'}">
                    ${isSelected ? '<div class="absolute inset-0 bg-void-accent/20 flex items-center justify-center"><i class="fa-solid fa-circle-check text-white text-2xl drop-shadow-lg"></i></div>' : ''}
                    <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <div class="text-[8px] font-bold text-white truncate">${card.name}</div>
                    </div>
                </div>
            `;
    }).join('');
}

function toggleModalCardSelection(instanceId) {
    if (modalSelectedCardIds.has(instanceId)) {
        modalSelectedCardIds.delete(instanceId);
    } else {
        modalSelectedCardIds.add(instanceId);
    }
    updateModalSelectionCount();
    renderModalCardGrid();
}

const modalCardSearch = document.getElementById('modal-card-search');
if (modalCardSearch) {
    modalCardSearch.addEventListener('input', (e) => {
        modalSearchQuery = e.target.value;
        renderModalCardGrid();
    });
}

const modalRarityFilterEl = document.getElementById('modal-rarity-filter');
if (modalRarityFilterEl) {
    modalRarityFilterEl.addEventListener('change', (e) => {
        modalRarityFilter = e.target.value;
        renderModalCardGrid();
    });
}

async function confirmAddCards() {
    if (modalSelectedCardIds.size === 0) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/binders/cards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                binder_id: activeBinderId,
                user_card_ids: Array.from(modalSelectedCardIds),
                start_slot: inlineTargetSlot
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showToast(`Added ${modalSelectedCardIds.size} cards to binder`, "success");
            hideAddCardsToBinderModal();
            await fetchUserBinders();
            renderBinder();
        } else {
            const err = await res.json();
            showToast(err.error || "Failed to add cards", "error");
        }
    } catch (err) {
        showToast("Connection error", "error");
    }
}

// --- RENDER HELPERS ---
function stackCards() {
    const cardMap = new Map();
    userCollection.forEach(card => {
        if (cardMap.has(card.id)) {
            cardMap.get(card.id).count++;
        } else {
            cardMap.set(card.id, { ...card, count: 1 });
        }
    });

    uniqueCards = Array.from(cardMap.values());
}

// --- FILTER LOGIC ---
function updateSetFilter() {
    const filterInfo = document.getElementById('set-filter');
    if (!filterInfo) return;

    // Get all unique sets from collection
    const sets = new Set(uniqueCards.map(c => c.set_name));

    // Save current selection to restore if possible
    const current = filterInfo.value;

    let html = '<option value="all">All Sets</option>';
    [...sets].sort().forEach(set => {
        html += `<option value="${set}">${set}</option>`;
    });

    filterInfo.innerHTML = html;

    // Restore or default to 'all'
    if (sets.has(current)) {
        filterInfo.value = current;
    } else {
        filterInfo.value = 'all';
    }

    filterInfo.onchange = (e) => filterBySet(e.target.value);
}

function renderBinder() {
    const grid = document.getElementById('binder-grid');
    grid.innerHTML = '';

    const isCustomBinder = activeBinderId !== 'all';
    let filteredCards = uniqueCards;

    if (isCustomBinder) {
        const activeBinder = userBinders.find(p => p.id === activeBinderId);
        if (activeBinder) {
            const pageCardMap = new Map(); // instanceId -> sort_order
            activeBinder.user_binder_cards.forEach(c => {
                pageCardMap.set(c.user_card_id, c.sort_order || 0);
            });

            // Filter userCollection to only those in the binder
            const binderInstances = userCollection.filter(c => pageCardMap.has(c.instanceId));

            // Use these instances as the basis for the grid
            const cardMap = new Map();
            binderInstances.forEach(card => {
                const slotIdx = pageCardMap.get(card.instanceId);
                // DO NOT STACK in custom binders - just put the instance in its slot
                cardMap.set(slotIdx, card);
            });

            const totalSlots = ITEMS_PER_PAGE;
            const startSlot = (currentPage - 1) * ITEMS_PER_PAGE;

            document.getElementById('page-indicator').innerText = `${activeBinder.name} - PAGE ${currentPage}`;

            // Always show 9 slots for custom binders
            for (let i = 0; i < totalSlots; i++) {
                const slotIdx = startSlot + i;
                const card = cardMap.get(slotIdx);
                const div = document.createElement('div');
                div.className = 'binder-slot relative aspect-[5/7] w-full bg-white/[0.02] rounded-2xl border border-white/5 border-dashed';
                div.dataset.slotIndex = slotIdx;

                if (card) {
                    renderCardInSlot(div, card);
                } else {
                    // Inline add button for custom binders
                    div.innerHTML = `
                            <div class="absolute inset-0 flex flex-col items-center justify-center relative group/slot">
                                <div class="text-white/5 select-none transition-opacity"><i class="fa-solid fa-layer-group text-3xl"></i></div>
                                <button onclick="showAddCardsToBinderModal(${slotIdx})" 
                                    class="empty-slot-overlay absolute inset-0 flex flex-col items-center justify-center bg-void-accent/5 hover:bg-void-accent/10 border border-void-accent/0 hover:border-void-accent/20 rounded-2xl transition-all">
                                    <div class="w-10 h-10 rounded-full bg-void-accent/20 text-void-accent/40 flex items-center justify-center mb-2 shadow-lg shadow-void-accent/10">
                                        <i class="fa-solid fa-plus"></i>
                                    </div>
                                    <span class="text-[10px] font-black text-void-accent/40 uppercase tracking-widest">Add Card</span>
                                </button>
                            </div>
                        `;
                }
                grid.appendChild(div);
            }

            // Custom binders have infinite pages for now, or we can bound them
            document.getElementById('prev-page-btn').disabled = currentPage === 1;
            document.getElementById('next-page-btn').disabled = false; // Always allow next for building
        }
    } else {
        // "All Cards" view - normal reflowing
        if (searchQuery) {
            filteredCards = filteredCards.filter(card =>
                card.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (rarityFilter !== 'all') {
            filteredCards = filteredCards.filter(card =>
                card.rarity === rarityFilter
            );
        }

        if (activeSetFilter !== 'all') {
            filteredCards = filteredCards.filter(card =>
                card.set_name === activeSetFilter
            );
        }

        const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        document.getElementById('page-indicator').innerText = `All Cards - PAGE ${currentPage}`;

        document.getElementById('prev-page-btn').disabled = currentPage === 1;
        document.getElementById('next-page-btn').disabled = currentPage === totalPages;

        if (filteredCards.length === 0) {
            grid.innerHTML = `
                    <div class="col-span-full py-20 text-center flex flex-col items-center justify-center space-y-4">
                        <div class="w-20 h-20 rounded-full bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent text-3xl mb-2">
                            <i class="fa-solid fa-ghost"></i>
                        </div>
                        <h3 class="text-xl font-black uppercase text-void-text tracking-widest">No Cards Found</h3>
                        <p class="text-void-muted text-xs">There are no cards matching your current filters in this binder.</p>
                    </div>
                `;
            document.getElementById('page-indicator').innerText = `All Cards`;
            document.getElementById('prev-page-btn').disabled = true;
            document.getElementById('next-page-btn').disabled = true;
        } else {
            for (let i = 0; i < ITEMS_PER_PAGE; i++) {
                const card = filteredCards[start + i];
                const div = document.createElement('div');
                div.className = 'binder-slot relative aspect-[5/7] w-full';

                if (card) {
                    renderCardInSlot(div, card);
                } else {
                    div.innerHTML = `<div class="absolute inset-0 flex items-center justify-center bg-void-bg/20 rounded-md border border-white/5 border-dashed"><i class="fa-solid fa-layer-group text-3xl text-white/5 select-none"></i></div>`;
                }
                grid.appendChild(div);
            }
        }
    }

    // Attach glare effects after DOM is ready
    requestAnimationFrame(initGlareCards);
    // Initialize Sortable for the grid if in custom binder
    if (isCustomBinder) {
        initCardSortable();
    }
}

function renderCardInSlot(container, card) {
    container.classList.add('is-occupied');
    const rarityClass = `rarity-${card.rarity.toLowerCase()}`;
    const countBadge = (card.count && card.count > 1) ? `<div class="absolute top-3 right-3 bg-void-bg/90 backdrop-blur-md text-void-text text-[10px] font-black px-2 py-0.5 rounded-full border border-white/10 z-20 shadow-sm transition-transform group-hover:scale-110">×${card.count}</div>` : '';
    const isGlare = card.rarity === 'Epic' || card.rarity === 'Legendary';

    const removeBtn = (isEditingBinder && activeBinderId !== 'all') ? `<button onclick="removeCardFromBinder('${card.instanceId}')" class="delete-btn absolute top-3 left-3 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center z-30 transition-all shadow-lg hover:bg-black group-hover:scale-110"><i class="fa-solid fa-xmark text-[12px]"></i></button>` : '';

    let mechanicBadge = '';
    if (card.mechanic_icon || card.genesis_mechanic_icon) {
        mechanicBadge = `<div class="absolute top-3 left-3 flex gap-1 z-20">`;
        if (card.genesis_mechanic_icon) {
            mechanicBadge += `<div class="w-7 h-7 bg-void-accent/20 backdrop-blur-md rounded-full flex items-center justify-center text-[12px] border border-void-accent/40 shadow-sm" title="Genesis: ${card.genesis_mechanic_name}">${card.genesis_mechanic_icon}</div>`;
        }
        if (card.mechanic_icon) {
            mechanicBadge += `<div class="w-7 h-7 bg-void-bg/80 backdrop-blur-md rounded-full flex items-center justify-center text-[12px] border border-white/10 shadow-sm" title="${card.mechanic_name}">${card.mechanic_icon}</div>`;
        }
        mechanicBadge += `</div>`;
    }

    // Global Streamer Origin Badge
    const isGlobalView = window.activeStreamerFilter === 'all';
    const creatorName = card.brand_name || card.streamer_username || 'Unknown';
    const originBadge = isGlobalView ? `<div class="absolute top-3 left-1/2 -translate-x-1/2 bg-void-bg/95 backdrop-blur-md border border-white/10 rounded-full py-1 px-3 z-20 flex items-center justify-center gap-1.5 shadow-xl shrink-0 whitespace-nowrap"><i class="fa-solid fa-satellite-dish text-[7px] text-void-accent animate-pulse"></i><span class="text-[7px] font-black uppercase tracking-[0.2em] text-white/90">${creatorName}</span></div>` : '';

    const statsBadge = `<div class="flex gap-1.5 w-full mt-1.5">
        <div class="flex-1 bg-void-bg/90 backdrop-blur-md px-1.5 py-1 rounded border border-white/10 flex items-center justify-center gap-1 shadow-sm">
            <span class="text-[9px] font-black text-white/50">⚔</span>
            <span class="text-[10px] font-black text-void-text">${card.attack}</span>
        </div>
        <div class="flex-1 bg-void-bg/90 backdrop-blur-md px-1.5 py-1 rounded border border-white/10 flex items-center justify-center gap-1 shadow-sm">
            <span class="text-[9px] font-black text-rose-500">❤</span>
            <span class="text-[10px] font-black text-void-text">${card.defense}</span>
        </div>
    </div>`;

    // Use placeholder when missing; escape " in URL so attribute doesn't break; no crossorigin so Cloudflare/R2 images load
    const rawUrl = (card.image_url && card.image_url.trim()) ? String(card.image_url) : '/pack.png';
    const imgSrc = rawUrl.replace(/"/g, '%22');

    container.innerHTML = `
            <div class="binder-card group cursor-pointer ${rarityClass}${isGlare ? ' glare-card' : ''}" 
                data-instance-id="${card.instanceId}" 
                onclick="if(!isEditingBinder) showCardDetail('${card.instanceId}')">
                ${removeBtn}
                ${mechanicBadge}
                <img src="${imgSrc}" class="absolute inset-0 w-full h-full object-cover z-0 transition-all duration-1000 group-hover:scale-115" onerror="this.onerror=null;this.src='/pack.png';">
                ${isGlare ? '<div class="glare-overlay"></div>' : ''}
                ${countBadge}
                ${originBadge}
                <div class="binder-card-overlay absolute inset-0 z-[1] flex flex-col justify-end pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div class="binder-card-overlay-gradient"></div>
                    <div class="relative z-10 p-3 flex flex-col justify-end">
                        <div class="card-name text-[11px] font-black text-void-text truncate uppercase tracking-tight mb-2" style="text-shadow: 0 1px 3px rgba(0,0,0,0.9);">
                            ${card.name}
                        </div>
                        ${statsBadge}
                    </div>
                </div>
            </div>`;
}

// --- CARD DETAIL MODAL LOGIC ---
function showCardDetail(instanceId) {
    console.log("Showing card detail for:", instanceId);
    const card = userCollection.find(c => c.instanceId === instanceId) || uniqueCards.find(c => c.id === instanceId);
    if (!card) {
        console.error("Card not found:", instanceId);
        return;
    }

    const modal = document.getElementById('card-detail-modal');
    const img = document.getElementById('card-detail-image');
    const name = document.getElementById('card-detail-name');
    const rarity = document.getElementById('card-detail-rarity');
    const set = document.getElementById('card-detail-set');
    const count = document.getElementById('card-detail-count');
    const id = document.getElementById('card-detail-id');
    const glare = document.getElementById('card-detail-glare');

    img.src = card.image_url || '/pack.png';
    img.onerror = function () { this.onerror = null; this.src = '/pack.png'; };
    name.innerText = card.name;
    rarity.innerText = card.rarity;
    const rarityColor = getRarityColor(card.rarity);
    rarity.innerText = card.rarity;
    rarity.className = `text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-${rarityColor}`;
    set.innerText = card.set_name;
    count.innerText = card.count || 1;

    // New Fields
    const numEl = document.getElementById('card-detail-number');
    const descEl = document.getElementById('card-detail-description');
    const atkEl = document.getElementById('card-detail-attack');
    const defEl = document.getElementById('card-detail-defense');

    if (numEl) numEl.innerText = card.card_number || '--';
    descEl.innerText = card.description || 'No description available for this card.';
    atkEl.innerText = card.attack || 0;
    defEl.innerText = card.defense || 0;

    // Mechanic Logic
    const mechanicContainer = document.getElementById('card-detail-mechanic-container');
    if (mechanicContainer) {
        if (card.mechanic_name) {
            mechanicContainer.classList.remove('hidden');
            document.getElementById('card-detail-mechanic-icon').innerText = card.mechanic_icon || '⚙️';
            document.getElementById('card-detail-mechanic-name').innerText = card.mechanic_display_name || card.mechanic_name;
            document.getElementById('card-detail-mechanic-desc').innerText = card.mechanic_description || 'Special effect active.';
        } else {
            mechanicContainer.classList.add('hidden');
        }
    }

    const genesisContainer = document.getElementById('card-detail-genesis-mechanic-container');
    if (genesisContainer) {
        if (card.genesis_mechanic_name) {
            genesisContainer.classList.remove('hidden');
            document.getElementById('card-detail-genesis-mechanic-icon').innerText = card.genesis_mechanic_icon || '✨';
            document.getElementById('card-detail-genesis-mechanic-name').innerText = card.genesis_mechanic_display_name || card.genesis_mechanic_name;
            document.getElementById('card-detail-genesis-mechanic-desc').innerText = card.genesis_mechanic_description || 'Genesis trait active.';
        } else {
            genesisContainer.classList.add('hidden');
        }
    }

    // Show glare if Epic/Legendary
    if (card.rarity === 'Epic' || card.rarity === 'Legendary') {
        glare.classList.remove('hidden');
    } else {
        glare.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    scrollLock();
}

function hideCardDetail() {
    document.getElementById('card-detail-modal').classList.add('hidden');
    scrollUnlock();
}

function initGlareCards() { /* shimmer is pure CSS — no JS needed */ }

function renderRecentDrops() {
    const list = document.getElementById('recent-drops-list');
    const recentCards = userCollection.slice(0, 3);
    if (recentCards.length > 0) {
        list.innerHTML = recentCards.map(c => `
                <div class="p-3 rounded-2xl bg-void-bg border border-white/5 void-shadow flex items-center gap-4 group cursor-pointer hover:border-void-accent/20 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-void-text/5 bg-cover bg-center flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform" style="background-image:url('${c.image_url}')"></div>
                    <div class="min-w-0">
                        <div class="text-[10px] font-black text-void-muted uppercase tracking-[0.2em] mb-0.5">${c.rarity}</div>
                        <div class="text-xs font-bold text-void-text truncate uppercase italic">${c.name}</div>
                    </div>
                </div>
            `).join('');
    } else {
        list.innerHTML = '<div class="text-center text-[10px] text-void-muted font-black uppercase tracking-widest py-8">Quiet in the pond...</div>';
    }
}

function renderPrizedPossession() {
    const container = document.getElementById('prized-possesion');
    if (!container) return;

    if (userCollection.length === 0) {
        container.innerHTML = '<div class="text-center text-[10px] text-void-muted font-black uppercase tracking-widest py-8">The vault is empty.</div>';
        return;
    }

    const prizedCard = userCollection.reduce((best, card) => {
        if (!best) return card;
        const bestRank = RARITY_RANK[best.rarity?.toLowerCase()] || 0;
        const cardRank = RARITY_RANK[card.rarity?.toLowerCase()] || 0;
        if (cardRank > bestRank) return card;
        if (cardRank === bestRank) {
            return new Date(card.created_at) > new Date(best.created_at) ? card : best;
        }
        return best;
    }, null);

    if (prizedCard) {
        const rarityColor = getRarityColor(prizedCard.rarity);
        container.innerHTML = `
                <div class="p-4 rounded-[2rem] bg-void-bg border-2 border-void-accent void-shadow flex items-center gap-5 group cursor-pointer">
                    <div class="w-16 h-16 rounded-2xl bg-void-text/5 bg-cover bg-center flex-shrink-0 border border-white/10 group-hover:rotate-3 transition-transform" style="background-image:url('${prizedCard.image_url}')"></div>
                    <div class="min-w-0">
                        <div class="text-[10px] font-black text-void-accent uppercase tracking-[0.2em] mb-1">${prizedCard.rarity} Highlight</div>
                        <div class="text-lg font-black text-void-text truncate uppercase italic leading-none">${prizedCard.name}</div>
                    </div>
                </div>
            `;
    }
}

function getRarityColor(rarity) {
    if (!rarity) return 'void-muted';
    const r = rarity.toLowerCase();
    if (r === 'legendary') return 'void-accent';
    if (r === 'epic') return 'cyan-400';
    if (r === 'rare') return 'blue-400';
    return 'void-muted';
}

const nextPageBtn = document.getElementById('next-page-btn');
if (nextPageBtn) {
    nextPageBtn.onclick = () => {
        currentPage++;
        fetchUserCollection();
    };
}

const prevPageBtn = document.getElementById('prev-page-btn');
if (prevPageBtn) {
    prevPageBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchUserCollection();
        }
    };
}

// Search and Filter Event Listeners
const cardSearch = document.getElementById('card-search');
if (cardSearch) {
    cardSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1;
        renderBinder();
    });
}

const rarityFilterEl = document.getElementById('rarity-filter');
if (rarityFilterEl) {
    rarityFilterEl.addEventListener('change', (e) => {
        rarityFilter = e.target.value;
        currentPage = 1;
        renderBinder();
    });
}

const streamerFilterEl = document.getElementById('streamer-filter');
if (streamerFilterEl) {
    streamerFilterEl.addEventListener('change', (e) => {
        const val = e.target.value;
        window.activeStreamerFilter = val === 'current' ? (APP_STREAMER ? APP_STREAMER.username : null) : val;
        currentPage = 1;
        fetchUserCollection();
    });
}



// --- TRADING LOGIC ---
async function fetchTradeCode() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/trade/code`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            myTradeCode = data.trade_code;
            document.getElementById('my-trade-code').innerText = myTradeCode;
        }
    } catch (e) {
        console.error("Failed to fetch trade code:", e);
    }
}


async function fetchTrades() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/trades`, { credentials: 'include' });
        if (res.ok) {
            trades = await res.json();
            renderTrades();
        }
    } catch (e) {
        console.error("Failed to fetch trades:", e);
    }
}

// --- TRADE-IN LOGIC ---
function renderTradeInGrid() {
    const grid = document.getElementById('trade-in-grid');
    if (!grid) return;

    if (userCollection.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-500">Your collection is empty.</div>';
        return;
    }

    // Sort by rarity then name
    const sorted = [...userCollection].sort((a, b) => {
        const rarityA = (a.rarity || 'Common').toLowerCase();
        const rarityB = (b.rarity || 'Common').toLowerCase();
        const rA = RARITY_RANK[rarityA] || 1;
        const rB = RARITY_RANK[rarityB] || 1;
        if (rA !== rB) return rB - rA;
        return a.name.localeCompare(b.name);
    });

    grid.innerHTML = sorted.map(card => {
        const isSelected = selectedTradeInCards.has(card.instanceId);
        const rarity = card.rarity.toLowerCase();

        return `
        <div class="relative group cursor-pointer" onclick="toggleTradeInCard('${card.instanceId}')">
            <div class="card-aspect-ratio rounded-2xl overflow-hidden border-2 transition-all ${isSelected ? 'border-void-accent scale-95 void-shadow' : 'border-white/10 hover:border-white/30'}">
                <img src="${card.image_url}" class="w-full h-full object-cover ${isSelected ? '' : 'opacity-80 group-hover:opacity-100'}">
                <div class="absolute inset-0 bg-gradient-to-t from-void-bg/60 via-transparent to-transparent opacity-60"></div>
            </div>
            ${isSelected ? `
                <div class="absolute -top-2 -right-2 w-7 h-7 bg-void-accent rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg z-10 border-2 border-void-bg">
                    <i class="fa-solid fa-check"></i>
                </div>
            ` : ''}
        </div>
    `;
    }).join('');

    updateTradeInSummary();
}

function toggleTradeInCard(cardInstanceId) {
    if (selectedTradeInCards.has(cardInstanceId)) {
        selectedTradeInCards.delete(cardInstanceId);
    } else {
        if (selectedTradeInCards.size >= 5) {
            showToast('You can only select 5 cards for a trade-in!', 'warn');
            return;
        }

        // Check if selection is legal (same rarity)
        if (selectedTradeInCards.size > 0) {
            const firstId = Array.from(selectedTradeInCards)[0];
            const firstCard = userCollection.find(c => c.instanceId === firstId);
            const newCard = userCollection.find(c => c.instanceId === cardInstanceId);

            if (firstCard.rarity !== newCard.rarity) {
                showToast('All 5 cards must be the same rarity!', 'warn');
                return;
            }
        }

        selectedTradeInCards.add(cardInstanceId);
    }
    renderTradeInGrid();
}

function updateTradeInSummary() {
    const countEl = document.getElementById('trade-in-count');
    const banner = document.getElementById('trade-in-rarity-banner');
    const targetLabel = document.getElementById('target-rarity-label');
    const fromPill = document.getElementById('from-rarity-pill');
    const toPill = document.getElementById('to-rarity-pill');
    const btn = document.getElementById('process-trade-in-btn');

    const size = selectedTradeInCards.size;
    countEl.textContent = size;

    if (size === 5) {
        const sampleId = Array.from(selectedTradeInCards)[0];
        const sample = userCollection.find(c => c.instanceId === sampleId);
        const rarity = sample.rarity;

        const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary'];
        const idx = rarityOrder.indexOf(rarity);

        if (idx !== -1 && idx < rarityOrder.length - 1) {
            const nextRarity = rarityOrder[idx + 1];

            banner.classList.remove('hidden');
            targetLabel.textContent = nextRarity;
            fromPill.textContent = rarity.toUpperCase();
            toPill.textContent = nextRarity.toUpperCase();
            btn.disabled = false;
        } else {
            banner.classList.add('hidden');
            fromPill.textContent = rarity.toUpperCase();
            toPill.textContent = 'MAX';
            btn.disabled = true;
            if (idx === rarityOrder.length - 1) {
                showToast('Legendary cards cannot be upgraded further!', 'info');
            }
        }
    } else {
        banner.classList.add('hidden');
        fromPill.textContent = '???';
        toPill.textContent = '???';
        btn.disabled = true;
    }
}

const clearTradeInBtn = document.getElementById('clear-trade-in');
if (clearTradeInBtn) {
    clearTradeInBtn.onclick = () => {
        selectedTradeInCards.clear();
        renderTradeInGrid();
    };
}

const processTradeInBtn = document.getElementById('process-trade-in-btn');
if (processTradeInBtn) {
    processTradeInBtn.onclick = async () => {
        if (selectedTradeInCards.size < 5) return showToast("Synthesis requires 5 identical entities", "error");

        showToast("Initiating Synthesis...", "loading");
        try {
            const res = await fetch(`${BACKEND_URL}/api/trade/trade-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ user_card_ids: Array.from(selectedTradeInCards) }),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                showToast("Synthesis Complete!", "success");
                showCardToast(data.new_card);
                selectedTradeInCards.clear();
                fetchUserCollection();
                renderTradeInGrid();
            } else {
                const error = await res.json();
                showToast(error.error || "Synthesis Failed", "error");
            }
        } catch (err) {
            showToast("Connection Error", "error");
        }
    };
}

// --- TRADING SUB-TABS ---
function switchTradingSubTab(tab) {
    const inboxBtn = document.getElementById('subtab-inbox');
    const upgradeBtn = document.getElementById('subtab-upgrade');
    const inboxSec = document.getElementById('inbox-section');
    const upgradeSec = document.getElementById('upgrade-section');

    const active = 'border-void-accent text-void-text';
    const inactive = 'border-transparent text-void-muted hover:text-void-text';

    if (tab === 'inbox') {
        inboxBtn.className = `flex-1 py-4 text-xs font-black tracking-widest uppercase transition-all border-b-2 ${active}`;
        upgradeBtn.className = `flex-1 py-4 text-xs font-black tracking-widest uppercase transition-all border-b-2 ${inactive}`;
        inboxSec.classList.remove('hidden');
        upgradeSec.classList.add('hidden');
    } else {
        inboxBtn.className = `flex-1 py-4 text-xs font-black tracking-widest uppercase transition-all border-b-2 ${inactive}`;
        upgradeBtn.className = `flex-1 py-4 text-xs font-black tracking-widest uppercase transition-all border-b-2 ${active}`;
        inboxSec.classList.add('hidden');
        upgradeSec.classList.remove('hidden');
        renderTradeInGrid();
    }
}

const inboxSubTab = document.getElementById('subtab-inbox');
if (inboxSubTab) inboxSubTab.onclick = () => switchTradingSubTab('inbox');

const upgradeSubTab = document.getElementById('subtab-upgrade');
if (upgradeSubTab) upgradeSubTab.onclick = () => switchTradingSubTab('upgrade');

function renderTrades() {
    const list = document.getElementById('trade-list');
    if (trades.length === 0) {
        list.innerHTML = `
            <div class="p-16 text-center flex flex-col items-center justify-center space-y-4 bg-white/[0.02] border border-white/5 border-dashed rounded-[3rem]">
                <div class="w-20 h-20 rounded-full bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent text-3xl mb-2 hover:rotate-12 transition-transform">
                    <i class="fa-solid fa-handshake-angle"></i>
                </div>
                <h3 class="text-xl font-black uppercase text-void-text tracking-widest italic">No Active Trades</h3>
                <p class="text-void-muted text-xs">Initiate a trade from the 'All Cards' binder view, or check back later for offers.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = trades.map(trade => {
        const isSender = String(trade.sender_id) === String(currentUser.twitch_id);
        const isReceiver = String(trade.receiver_id) === String(currentUser.twitch_id);
        const otherParty = isSender ? trade.receiver : trade.sender;

        const statusInfo = {
            pending: { color: 'text-amber-400', label: 'Initial Offer' },
            offered: { color: 'text-purple-400', label: 'Offer Received' },
            accepted: { color: 'text-void-accent/40', label: 'Completed' },
            rejected: { color: 'text-red-400', label: 'Rejected' },
            cancelled: { color: 'text-gray-400', label: 'Withdrawn' }
        }[trade.status] || { color: 'text-gray-400', label: trade.status };

        const myItems = trade.items.filter(i => String(i.owner_id) === String(currentUser.twitch_id));
        const theirItems = trade.items.filter(i => String(i.owner_id) !== String(currentUser.twitch_id));

        return `
                <div class="p-8 rounded-[3rem] bg-void-bg border border-white/5 void-shadow flex flex-col gap-8 relative overflow-hidden group mb-6">
                    <div class="absolute -right-20 -top-20 w-60 h-60 bg-void-accent/5 blur-[100px] rounded-full group-hover:bg-void-accent/10 transition-all"></div>
                    
                    <div class="flex justify-between items-start relative z-10">
                        <div class="flex items-center gap-5">
                            <div class="relative">
                                <img src="${otherParty.avatar_url}" class="w-14 h-14 rounded-[1.2rem] border-2 border-void-bg void-shadow">
                                <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-void-accent border-2 border-void-bg ${trade.status === 'accepted' ? '' : 'hidden'}"></div>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[9px] font-black text-void-muted uppercase tracking-[0.2em] mb-1">
                                    ${isSender ? 'To' : 'From'}
                                </div>
                                <div class="text-void-text font-black text-xl italic uppercase tracking-tight">${otherParty.username}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[9px] font-black text-void-muted uppercase tracking-[0.2em] mb-1">Trade Status</div>
                            <div class="text-[10px] font-black ${statusInfo.color} uppercase tracking-[0.15em] px-4 py-1.5 bg-void-text/5 rounded-full border border-white/5">
                                ${statusInfo.label}
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-y border-white/5 relative z-10">
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="text-[9px] text-void-muted font-black uppercase tracking-widest">Relinquishing</div>
                                <div class="h-px flex-1 bg-void-text/5 mx-4"></div>
                            </div>
                            <div class="flex flex-wrap gap-4">
                                ${myItems.map(i => `
                                    <div class="relative group/card w-20 h-28">
                                        <div class="absolute inset-0 bg-void-accent/20 blur-xl rounded-2xl opacity-0 group-hover/card:opacity-100 transition-all"></div>
                                        <img src="${i.card.image_url || i.card.card_data?.image_url}" 
                                             class="w-full h-full object-cover rounded-xl border-2 border-void-bg void-shadow relative z-10"
                                             title="${i.card.name}">
                                    </div>
                                `).join('') || '<div class="text-[9px] text-void-muted font-black italic uppercase py-4 opacity-40">Scanning Inventory...</div>'}
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="text-[9px] text-void-muted font-black uppercase tracking-widest">Acquiring</div>
                                <div class="h-px flex-1 bg-void-text/5 mx-4"></div>
                            </div>
                            <div class="flex flex-wrap gap-4">
                                ${theirItems.map(i => `
                                    <div class="relative group/card w-20 h-28">
                                        <div class="absolute inset-0 bg-void-accent/10 blur-xl rounded-2xl opacity-0 group-hover/card:opacity-100 transition-all"></div>
                                        <img src="${i.card.image_url || i.card.card_data?.image_url}" 
                                             class="w-full h-full object-cover rounded-xl border-2 border-void-bg void-shadow relative z-10"
                                             title="${i.card.name}">
                                    </div>
                                `).join('') || '<div class="text-[9px] text-void-muted font-black italic uppercase py-4 opacity-40">Awaiting Offer</div>'}
                            </div>
                        </div>
                    </div>

                    ${trade.status === 'pending' ? `
                        <div class="flex gap-4 relative z-10">
                            ${isReceiver ? `
                                <button onclick="prepareTradeReply('${trade.id}', '${trade.sender.username}')" 
                                        class="flex-1 bg-void-accent text-white py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] transition-all void-shadow uppercase hover:scale-[1.02]">
                                    COUNTER OFFER
                                </button>
                                <button onclick="respondToTrade('${trade.id}', 'reject')" 
                                        class="px-8 bg-void-text/5 hover:bg-red-500/10 py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] text-void-muted hover:text-red-500 transition-all border border-white/10 uppercase">
                                    REJECT
                                </button>
                            ` : `
                                <div class="flex-1 text-center py-4 bg-white/[0.03] rounded-[1.5rem] text-[10px] font-black text-void-muted uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                                    <div class="w-1.5 h-1.5 rounded-full bg-void-accent animate-pulse"></div>
                                    Awaiting Delivery
                                </div>
                                <button onclick="respondToTrade('${trade.id}', 'cancel')" 
                                        class="px-8 bg-void-text/5 hover:bg-void-text/10 py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] text-void-muted transition-all border border-white/10 uppercase">
                                    CANCEL
                                </button>
                            `}
                        </div>
                    ` : ''
            }

                    ${trade.status === 'offered' ? `
                        <div class="flex gap-4 relative z-10">
                            ${isSender ? `
                                <button onclick="respondToTrade('${trade.id}', 'accept')" 
                                        class="flex-1 bg-void-accent text-white py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] transition-all void-shadow uppercase hover:scale-[1.02]">
                                    CONFIRM TRADE
                                </button>
                                <button onclick="respondToTrade('${trade.id}', 'cancel')" 
                                        class="px-8 bg-void-text/5 hover:bg-void-text/10 py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] text-void-muted transition-all border border-white/10 uppercase">
                                    CANCEL
                                </button>
                            ` : `
                                <div class="flex-1 text-center py-4 bg-white/[0.03] rounded-[1.5rem] text-[10px] font-black text-void-muted uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                                    <div class="w-1.5 h-1.5 rounded-full bg-void-accent animate-pulse"></div>
                                    Awaiting Confirmation
                                </div>
                                <button onclick="respondToTrade('${trade.id}', 'reject')" 
                                        class="px-8 bg-void-text/5 hover:bg-red-500/10 py-4 rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] text-void-muted hover:text-red-500 transition-all border border-white/10 uppercase">
                                    REJECT
                                </button>
                            `}
                        </div>
                    ` : ''
            }
                </div>
`;
    }).join('');
}

function copyTradeCode() {
    const el = document.getElementById('my-trade-code');
    if (!el) return;
    const code = el.innerText;
    if (!code || code === 'LOADING...') return;
    navigator.clipboard.writeText(code);
    showToast("Trade code copied to clipboard!", "success");
}

async function respondToTrade(tradeId, action) {
    console.log(`Responding to trade ${tradeId} with ${action} `);
    try {
        const res = await fetch(`${BACKEND_URL} /api/trade / respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ trade_id: tradeId, action }),
            credentials: 'include'
        });

        if (res.ok) {
            console.log(`Trade ${action} success`);
            showToast(`Trade ${action}ed successfully!`, "success");
            fetchTrades();
            fetchUserCollection();
        } else {
            const err = await res.json();
            console.error("Trade respond error:", err);
            showToast(err.error || "Action failed", "error");
        }
    } catch (e) {
        console.error("Trade respond network error:", e);
        showToast("Connection error", "error");
    }
}

const startTradeBtn = document.getElementById('start-trade-btn');
if (startTradeBtn) {
    startTradeBtn.onclick = async () => {
        const codeInput = document.getElementById('target-trade-code');
        if (!codeInput) return;
        const code = codeInput.value.trim().toUpperCase();
        if (!code) {
            showToast("Please enter a trade code", "error");
            return;
        }
        if (code === myTradeCode) {
            showToast("You cannot trade with yourself", "error");
            return;
        }

        try {
            const res = await fetch(`${BACKEND_URL}/api/public/collection/${code}`, { credentials: 'include' });
            if (!res.ok) {
                showToast("Invalid trade code or user has no cards", "error");
                return;
            }
            const targetPublicCollection = await res.json();
            openTradeBuilder(code, targetPublicCollection);
        } catch (e) {
            showToast("Could not find user", "error");
        }
    };
}

let tradeBuilderMode = 'init';
let currentTradeId = null;

window.prepareTradeReply = (tradeId, senderName) => {
    currentTradeId = tradeId;
    tradeBuilderMode = 'reply';
    // Find the trade to get the context (what A offered)
    const trade = trades.find(t => String(t.id) === String(tradeId));
    const offeredItems = trade ? trade.items.filter(i => String(i.owner_id) !== String(currentUser.twitch_id)).map(i => ({
        ...i.card,
        user_card_id: i.user_card_id
    })) : [];

    openTradeBuilder(senderName, offeredItems, true);
};

function openTradeBuilder(targetCode, targetCards, isReply = false) {
    currentTradeTarget = { code: targetCode, cards: targetCards };
    tradeBuilderMode = isReply ? 'reply' : 'init';
    selectedMyCards.clear();
    selectedTheirCards.clear();

    const mySection = document.getElementById('trade-builder-my-section');
    const theirSection = document.getElementById('trade-builder-their-section');
    const modalTitle = document.getElementById('trade-builder-target-info');
    const sendBtn = document.getElementById('send-trade-offer-btn');

    const myHeader = mySection.querySelector('h3');
    const theirHeader = theirSection.querySelector('h3');

    if (tradeBuilderMode === 'init') {
        modalTitle.innerText = `Proposing trade to: ${targetCode} `;
        myHeader.innerText = "YOUR OFFER";
        theirHeader.innerText = "THEIR COLLECTION";
        mySection.classList.remove('hidden');
        theirSection.classList.add('hidden'); // In Step 1, A only chooses their card
        sendBtn.innerText = 'SEND TRADE INITIATION';
    } else {
        modalTitle.innerText = `Countering trade from: ${targetCode} `;
        myHeader.innerText = "YOUR COUNTER-OFFER";
        theirHeader.innerText = "THEIR INCOMING OFFER";
        mySection.classList.remove('hidden');
        theirSection.classList.remove('hidden'); // In Step 2, B sees what they are getting
        sendBtn.innerText = 'SEND COUNTER OFFER';
    }

    document.getElementById('trade-builder-modal').classList.remove('hidden');
    scrollLock();

    const myCardsGrid = document.getElementById('trade-builder-my-cards');
    myCardsGrid.innerHTML = userCollection.map(card => `
< div class="trade-slot cursor-pointer border border-white/5 rounded-lg p-1 transition-all hover:bg-white/5"
onclick = "toggleTradeSelection(this, 'my', '${card.instanceId}')" >
<img src="${card.image_url}" crossorigin="anonymous" class="w-full h-24 object-cover rounded shadow-lg">
    <div class="text-[8px] text-gray-500 truncate mt-1">${card.name}</div>
</div>
`).join('');

    const theirCardsGrid = document.getElementById('trade-builder-their-cards');
    theirCardsGrid.innerHTML = targetCards.map(card => `
< div class="trade-slot cursor-pointer border border-white/5 rounded-lg p-1 transition-all hover:bg-white/5"
onclick = "toggleTradeSelection(this, 'their', '${card.user_card_id || card.id}')" >
<img src="${card.image_url}" class="w-full h-24 object-cover rounded shadow-lg">
    <div class="text-[8px] text-gray-500 truncate mt-1">${card.name}</div>
</div>
`).join('');

    updateTradeOfferCounts();
}

function toggleTradeSelection(el, side, cardInstanceId) {
    const set = side === 'my' ? selectedMyCards : selectedTheirCards;
    if (set.has(cardInstanceId)) {
        set.delete(cardInstanceId);
        el.classList.remove('ring-2', 'ring-void-accent/40', 'bg-void-accent/10');
    } else {
        set.add(cardInstanceId);
        el.classList.add('ring-2', 'ring-void-accent/40', 'bg-void-accent/10');
    }
    updateTradeOfferCounts();
}

function updateTradeOfferCounts() {
    document.getElementById('my-offer-count').innerText = `${selectedMyCards.size} CARDS SELECTED`;
    document.getElementById('their-offer-count').innerText = `${selectedTheirCards.size} CARDS SELECTED`;
}

const sendTradeBtn = document.getElementById('send-trade-offer-btn');
if (sendTradeBtn) {
    sendTradeBtn.onclick = async () => {
        if (selectedMyCards.size === 0) {
            showToast("You must select at least one card to offer", "error");
            return;
        }

        const isReply = tradeBuilderMode === 'reply';
        const endpoint = isReply ? '/api/trade/offer-reply' : '/api/trade/offer';

        const payload = isReply ? {
            trade_id: currentTradeId,
            receiver_items: Array.from(selectedMyCards)
        } : {
            target_code: currentTradeTarget.code,
            sender_items: Array.from(selectedMyCards)
        };

        try {
            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (res.ok) {
                showToast(isReply ? "Counter offer sent!" : "Trade initiation sent!", "success");
                const modal = document.getElementById('trade-builder-modal');
                if (modal) modal.classList.add('hidden');
                scrollUnlock();
                fetchTrades();
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to process trade", "error");
            }
        } catch (e) {
            showToast("Connection error", "error");
        }
    };
}

const closeTradeBuilder = () => {
    document.getElementById('trade-builder-modal').classList.add('hidden');
    scrollUnlock();
};
const closeTradeBtn = document.getElementById('close-trade-builder');
if (closeTradeBtn) closeTradeBtn.onclick = closeTradeBuilder;

const cancelTradeBtn = document.getElementById('cancel-trade-builder');
if (cancelTradeBtn) cancelTradeBtn.onclick = closeTradeBuilder;


// ============================================================
// ⚔️ BATTLE SYSTEM — Frontend Logic
// ============================================================

// --- State ---
const battleDeckSlots = { 1: null, 2: null, 3: null }; // { user_card_id, card }
let pickerTargetSlot = null;
let allPickerCards = [];  // full collection used for card picker filtering

// The switchView system now natively supports 'battle'

// ---- Init Battle View ----
async function initBattleView() {
    const streamerLabel = document.getElementById('battle-arena-streamer');
    if (APP_STREAMER && streamerLabel) {
        streamerLabel.textContent = (APP_STREAMER.brand_name || APP_STREAMER.username);
    }

    // Load current deck from server
    await loadCurrentDeck();
    // Load saved decks in background
    loadSavedDecks();
}

// ---- Load Current Deck ----
async function loadCurrentDeck() {
    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/deck${streamerParam}`, { credentials: 'include' });
        if (!res.ok) return;
        const { deck } = await res.json();
        if (!deck) return;

        // Restore slots from server data
        const slotMap = { 1: deck.slot_1, 2: deck.slot_2, 3: deck.slot_3 };
        for (const [slot, uc] of Object.entries(slotMap)) {
            if (uc) {
                battleDeckSlots[slot] = {
                    user_card_id: uc.id,
                    card: {
                        name: uc.card?.name || 'Unknown',
                        image_url: uc.card?.image_url || '',
                        rarity: uc.card?.rarity || 'Common',
                        attack: uc.attack || 0,
                        defense: uc.defense || 0,
                        mechanic_name: uc.mechanic?.display_name || null,
                        mechanic_icon: uc.mechanic?.icon || '',
                    }
                };
                renderDeckSlot(parseInt(slot));
            }
        }
    } catch (e) {
        console.error('[Battle] loadCurrentDeck error:', e);
    }
}

// ---- Render a single deck slot ----
function renderDeckSlot(slot) {
    const el = document.getElementById(`deck-slot-${slot}`);
    if (!el) return;
    const data = battleDeckSlots[slot];

    if (!data) {
        el.innerHTML = `
            <i class="fa-solid fa-plus text-white/20 text-2xl group-hover:text-void-accent/50 transition-colors"></i>
            <span class="text-[9px] font-bold text-white/20 group-hover:text-void-accent/50 mt-2 transition-colors">Pick Card</span>
        `;
        el.className = 'battle-deck-card-slot aspect-[5/7] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-void-accent/40 hover:bg-void-accent/5 transition-all group relative';
        return;
    }

    const { card } = data;
    const rarityColors = { legendary: '#fbbf24', epic: '#a855f7', rare: '#3b82f6', common: '#94a3b8' };
    const borderColor = rarityColors[(card.rarity || 'common').toLowerCase()] || '#94a3b8';
    const mechanicBadge = card.mechanic_icon ? `
        <div class="absolute top-1 right-1 text-base leading-none" title="${card.mechanic_name || ''}">${card.mechanic_icon}</div>
    ` : '';

    el.className = 'battle-deck-card-slot aspect-[5/7] rounded-2xl overflow-hidden relative cursor-pointer transition-all hover:scale-105 border border-white/5 shadow-2xl';
    el.innerHTML = `
        <img src="${card.image_url || ''}" class="absolute inset-0 w-full h-full object-cover" onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(card.name)}'">
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
        ${mechanicBadge}
        <div class="absolute bottom-0 left-0 right-0 p-3 space-y-1.5 z-10">
            <div class="text-[10px] font-black text-void-text uppercase italic tracking-tighter truncate">${card.name}</div>
            <div class="flex gap-2">
                <div class="flex items-center gap-1.5 bg-blue-500/90 px-2 py-0.5 rounded-md text-[9px] font-black text-white shadow-lg border border-white/10">
                    <i class="fa-solid fa-bolt-lightning text-[7px]"></i> ${card.attack}
                </div>
                <div class="flex items-center gap-1.5 bg-red-500/90 px-2 py-0.5 rounded-md text-[9px] font-black text-white shadow-lg border border-white/10">
                    <i class="fa-solid fa-shield-halved text-[7px]"></i> ${card.defense}
                </div>
            </div>
        </div>
        <button onclick="event.stopPropagation(); clearDeckSlot(${slot})"
            class="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500 flex items-center justify-center text-white text-[10px] transition-all border border-white/10 backdrop-blur-md group-hover:scale-110">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    el.onclick = () => openCardPicker(slot);
}

function clearDeckSlot(slot) {
    battleDeckSlots[slot] = null;
    renderDeckSlot(slot);
}

// ---- Card Picker Modal ----
window.openCardPicker = async function (slot) {
    pickerTargetSlot = slot;
    const modal = document.getElementById('card-picker-modal');
    const slotLabel = document.getElementById('card-picker-slot-label');
    const searchInput = document.getElementById('card-picker-search');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    if (slotLabel) slotLabel.textContent = slot;
    if (searchInput) searchInput.value = '';
    scrollLock();

    // Load cards if not yet loaded
    if (allPickerCards.length === 0) {
        await loadPickerCards();
    } else {
        renderPickerGrid(allPickerCards);
    }
};

window.closeCardPicker = function () {
    const modal = document.getElementById('card-picker-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    scrollUnlock();
};

async function loadPickerCards() {
    const grid = document.getElementById('card-picker-grid');
    if (!grid) return;
    grid.innerHTML = `<div class="col-span-full text-center py-8 text-void-muted text-sm"><i class="fa-solid fa-spinner animate-spin text-2xl mb-3 block"></i>Loading...</div>`;

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/collection${streamerParam}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load collection');
        const data = await res.json();

        // Map to standard internal format
        allPickerCards = data.map(item => ({
            instanceId: item.user_card_id,
            name: item.name,
            rarity: item.rarity,
            image_url: item.image_url,
            type: item.type,
            attack: item.attack || 0,
            defense: item.defense || 0,
            mechanic_name: item.mechanic_name,
            mechanic_display_name: item.mechanic_display_name,
            mechanic_icon: item.mechanic_icon,
            mechanic_description: item.mechanic_description
        }));

        renderPickerGrid(allPickerCards);
    } catch (e) {
        // Fallback to the in-memory collection
        allPickerCards = userCollection || [];
        if (allPickerCards.length > 0) {
            renderPickerGrid(allPickerCards);
        } else {
            grid.innerHTML = `<div class="col-span-full text-center py-8 text-void-muted text-sm">No cards found. Go earn some packs!</div>`;
        }
    }
}

window.filterPickerCards = function (query) {
    const filtered = query
        ? allPickerCards.filter(c => {
            const name = (c.name || c.cards?.name || '').toLowerCase();
            const rarity = (c.rarity || c.cards?.rarity || '').toLowerCase();
            return name.includes(query.toLowerCase()) || rarity.includes(query.toLowerCase());
        })
        : allPickerCards;
    renderPickerGrid(filtered);
};

function renderPickerGrid(cards) {
    const grid = document.getElementById('card-picker-grid');
    if (!grid) return;

    if (!cards || cards.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-void-muted text-sm">No cards match your search.</div>`;
        return;
    }

    const rarityColors = { legendary: '#fbbf24', epic: '#a855f7', rare: '#3b82f6', common: '#94a3b8', uncommon: '#94a3b8' };

    grid.innerHTML = cards.map(c => {
        // PRIORITIZE instance UUID for identity (mapped as instanceId or user_card_id)
        const instanceId = c.instanceId || c.user_card_id || c.id;

        const name = c.name || (c.cards && c.cards.name) || 'Unknown';
        const imageUrl = c.image_url || (c.cards && c.cards.image_url) || '';
        const rarity = (c.rarity || (c.cards && c.cards.rarity) || 'Common').toLowerCase();

        // Battle Stats (pull from raw or nested join)
        const attack = c.attack !== undefined ? c.attack : (c.cards && c.cards.attack) || 0;
        const defense = c.defense !== undefined ? c.defense : (c.cards && c.cards.defense) || 0;
        const mechanicIcon = c.mechanic_icon || (c.mechanics && c.mechanics.icon) || '';
        const mechanicName = c.mechanic_name || (c.mechanics && c.mechanics.display_name) || '';

        const rarityColors = { legendary: '#fbbf24', epic: '#a855f7', rare: '#3b82f6', common: '#94a3b8', uncommon: '#94a3b8' };
        const borderColor = rarityColors[rarity] || '#94a3b8';

        // Check if THIS EXACT INSTANCE is already in a slot
        const inSlot = Object.values(battleDeckSlots).find(s => s?.user_card_id === instanceId);
        const inSlotClass = inSlot ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105 hover:ring-2 ring-void-accent';

        return `
            <div class="relative aspect-[5/7] rounded-xl overflow-hidden transition-all ${inSlotClass}"
                onclick="${inSlot ? '' : `selectPickerCard('${instanceId}', '${name.replace(/'/g, "\\'")}', '${imageUrl}', '${rarity}', ${attack}, ${defense}, '${mechanicIcon}', '${mechanicName}')`}"
                title="${name}${inSlot ? ' (already in deck)' : ''}">
                <img src="${imageUrl}" class="absolute inset-0 w-full h-full object-cover"
                    onerror="this.src='https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(name)}'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                ${mechanicIcon ? `<div class="absolute top-2 right-2 flex items-center justify-center p-1 bg-void-bg/80 backdrop-blur-md rounded-lg text-xs leading-none border border-white/5 z-10" title="${mechanicName}">${mechanicIcon}</div>` : ''}
                <div class="absolute bottom-0 left-0 right-0 p-3 space-y-1.5 z-10">
                    <div class="text-[9px] font-black text-white uppercase italic tracking-tight truncate">${name}</div>
                    <div class="flex gap-1.5">
                        <div class="flex items-center gap-1 bg-blue-500/80 px-1.5 py-0.5 rounded text-[8px] font-black text-white shadow-sm">
                            <i class="fa-solid fa-bolt-lightning text-[6px]"></i> ${attack}
                        </div>
                        <div class="flex items-center gap-1 bg-red-500/80 px-1.5 py-0.5 rounded text-[8px] font-black text-white shadow-sm">
                            <i class="fa-solid fa-shield-halved text-[6px]"></i> ${defense}
                        </div>
                    </div>
                </div>
                ${inSlot ? `<div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/80 bg-black/60 backdrop-blur-[2px] z-20 uppercase italic tracking-widest">In Deck</div>` : ''}
            </div>
        `;
    }).join('');
}

window.selectPickerCard = function (id, name, imageUrl, rarity, attack, defense, mechanicIcon, mechanicName) {
    if (!pickerTargetSlot) return;
    battleDeckSlots[pickerTargetSlot] = {
        user_card_id: id,
        card: { name, image_url: imageUrl, rarity, attack, defense, mechanic_icon: mechanicIcon, mechanic_name: mechanicName }
    };
    renderDeckSlot(pickerTargetSlot);
    closeCardPicker();
    saveBattleDeck(); // Auto-saveactive deck when a card is swapped
};

// ---- Save Deck ----
window.saveBattleDeck = async function () {
    console.log('[Battle] saveBattleDeck called. Slots:', battleDeckSlots);
    const btn = document.getElementById('battle-save-deck-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const slots = {
        slot_1: battleDeckSlots[1]?.user_card_id || null,
        slot_2: battleDeckSlots[2]?.user_card_id || null,
        slot_3: battleDeckSlots[3]?.user_card_id || null,
    };

    const filled = Object.values(slots).filter(Boolean).length;
    if (filled === 0) {
        console.warn('[Battle] Empty deck, not saving.');
        showToast('Pick at least 1 card for your deck!', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Save Deck'; }
        return;
    }

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        console.log('[Battle] Fetching POST /api/battle/deck', slots);
        const res = await fetch(`${BACKEND_URL}/api/battle/deck${streamerParam}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(slots),
        });
        const data = await res.json();
        console.log('[Battle] Save response:', res.status, data);
        if (res.ok) {
            showToast('⚔️ Battle deck saved!', 'success');
        } else {
            showToast(data.error || 'Failed to save deck', 'error');
        }
    } catch (e) {
        console.error('[Battle] Network error saving deck:', e);
        showToast('Network error saving deck', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Deck'; }
    }
};

// ---- Saved Decks ----
window.loadSavedDecks = async function () {
    const list = document.getElementById('saved-decks-list');
    if (!list) return;
    list.innerHTML = `<div class="text-center py-4 text-void-muted text-xs"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading...</div>`;

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/saved-decks${streamerParam}`);
        if (!res.ok) throw new Error('Failed');
        const { decks } = await res.json();

        if (!decks || decks.length === 0) {
            list.innerHTML = `<div class="text-center text-xs text-void-muted py-8 flex flex-col items-center my-auto">
                <i class="fa-solid fa-layer-group text-3xl text-white/10 mb-4"></i>
                <span>No saved decks yet.</span>
                <span class="mt-1">Build one and click + to save it!</span>
            </div>`;
            return;
        }

        list.innerHTML = decks.map(d => {
            const hasS1 = !!d.slot_1;
            const hasS2 = !!d.slot_2;
            const hasS3 = !!d.slot_3;
            const isActive = d.is_active;

            return `
                <div class="flex flex-col gap-2 p-4 rounded-xl bg-white/5 border ${isActive ? 'border-void-accent/60 bg-void-accent/5' : 'border-white/5'} hover:border-void-accent/40 transition-all group relative overflow-hidden">
                    ${isActive ? `<div class="absolute -right-12 -top-12 w-24 h-24 bg-void-accent/10 blur-2xl rounded-full"></div>` : ''}
                    <div class="flex items-center justify-between mb-2 z-10">
                        <div class="flex items-center gap-2">
                            <div class="text-sm font-black uppercase tracking-tight text-white">${d.name}</div>
                            ${isActive ? `<span class="px-1.5 py-0.5 rounded bg-void-accent/20 text-void-accent text-[8px] font-black uppercase tracking-widest border border-void-accent/30">Active</span>` : ''}
                        </div>
                        <div class="flex gap-2">
                            ${!isActive ? `<button onclick="activateSavedDeck('${d.id}')" title="Set as Active" class="w-8 h-8 rounded-lg bg-void-accent/20 text-void-accent/60 hover:bg-void-accent hover:text-white transition-colors flex items-center justify-center text-xs">
                                <i class="fa-solid fa-play"></i>
                            </button>` : ''}
                            <button onclick="loadDeckIntoActive('${d.id}')" title="Preview / Edit" class="w-8 h-8 rounded-lg bg-white/10 text-white/40 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center text-xs">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button onclick="deleteSavedDeck('${d.id}', '${d.name.replace(/'/g, "\\'")}')" title="Delete Deck" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-xs">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    
                <div class="grid grid-cols-3 gap-2 z-10">
                    <!-- Tiny preview slots -->
                    <div class="aspect-[5/7] rounded-md overflow-hidden bg-black/40 border border-white/5 relative">
                        ${hasS1 ? `<img src="${d.slot_1.card.image_url}" class="absolute inset-0 w-full h-full object-cover">` : ''}
                    </div>
                    <div class="aspect-[5/7] rounded-md overflow-hidden bg-black/40 border border-white/5 relative">
                        ${hasS2 ? `<img src="${d.slot_2.card.image_url}" class="absolute inset-0 w-full h-full object-cover">` : ''}
                    </div>
                    <div class="aspect-[5/7] rounded-md overflow-hidden bg-black/40 border border-white/5 relative">
                        ${hasS3 ? `<img src="${d.slot_3.card.image_url}" class="absolute inset-0 w-full h-full object-cover">` : ''}
                    </div>
                </div>
                </div>
            `;
        }).join('');

        window.currentSavedDecks = decks;
    } catch (e) {
        list.innerHTML = `<div class="text-center text-xs text-red-400 py-4 hidden">Failed to load saved decks</div>`;
    }
};

window.showSaveDeckModal = function () {
    console.log('[Battle] showSaveDeckModal called. Slots:', battleDeckSlots);
    const slots = {
        slot_1: battleDeckSlots[1]?.user_card_id || null,
        slot_2: battleDeckSlots[2]?.user_card_id || null,
        slot_3: battleDeckSlots[3]?.user_card_id || null,
    };
    const filled = Object.values(slots).filter(Boolean).length;
    if (filled === 0) {
        console.warn('[Battle] Deck is empty, cannot open save modal.');
        showToast('Your active deck is empty!', 'error');
        return;
    }

    const modal = document.getElementById('save-deck-modal');
    if (!modal) {
        console.error('[Battle] CRITICAL: save-deck-modal element not found!');
        showToast('UI Error: Modal not found', 'error');
        return;
    }

    document.getElementById('save-deck-name-input').value = '';
    modal.classList.remove('hidden');
    console.log('[Battle] Modal should now be visible.');
};

window.closeSaveDeckModal = function () {
    document.getElementById('save-deck-modal').classList.add('hidden');
};

window.submitSaveDeckModal = async function () {
    const nameInput = document.getElementById('save-deck-name-input');
    const name = nameInput.value.trim();
    if (!name) {
        showToast('Please enter a name for your deck.', 'error');
        return;
    }

    const slots = {
        slot_1: battleDeckSlots[1]?.user_card_id || null,
        slot_2: battleDeckSlots[2]?.user_card_id || null,
        slot_3: battleDeckSlots[3]?.user_card_id || null,
    };

    // Auto-save the active deck before saving as a named deck
    await saveBattleDeck();

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/saved-decks${streamerParam}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ name, ...slots }),
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Deck saved successfully!', 'success');
            closeSaveDeckModal();
            loadSavedDecks();
        } else {
            showToast(data.error || 'Failed to save deck', 'error');
        }
    } catch (e) {
        showToast('Network error saving deck', 'error');
    }
};

window.deleteSavedDeck = async function (id, name) {
    if (!confirm(`Are you sure you want to delete deck "${name}"?`)) return;

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/saved-decks${streamerParam}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ action: 'delete', id }),
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Deck deleted', 'info');
            loadSavedDecks();
        } else {
            showToast(data.error || 'Failed to delete deck', 'error');
        }
    } catch (e) {
        showToast('Network error deleting deck', 'error');
    }
};

window.loadDeckIntoActive = async function (id) {
    if (!window.currentSavedDecks) return;
    const deck = window.currentSavedDecks.find(d => d.id === id);
    if (!deck) return;

    battleDeckSlots[1] = deck.slot_1 ? { user_card_id: deck.slot_1_card_id, card: mapNestedStatFields(deck.slot_1) } : null;
    battleDeckSlots[2] = deck.slot_2 ? { user_card_id: deck.slot_2_card_id, card: mapNestedStatFields(deck.slot_2) } : null;
    battleDeckSlots[3] = deck.slot_3 ? { user_card_id: deck.slot_3_card_id, card: mapNestedStatFields(deck.slot_3) } : null;

    renderDeckSlot(1);
    renderDeckSlot(2);
    renderDeckSlot(3);

    await saveBattleDeck(); // auto-save the newly loaded active deck
};

window.activateSavedDeck = async function (id) {
    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/saved-decks/activate${streamerParam}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ id }),
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Deck activated!', 'success');
            // Also load it into UI
            await loadDeckIntoActive(id);
            await loadSavedDecks();
        } else {
            showToast(data.error || 'Failed to activate deck', 'error');
        }
    } catch (e) {
        showToast('Network error activating deck', 'error');
    }
};

window.initiateTestBattle = async function () {
    console.log('[Battle] initiateTestBattle called');
    const btn = document.getElementById('battle-test-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Starting...'; }

    try {
        const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
        const res = await fetch(`${BACKEND_URL}/api/battle/initiate${streamerParam}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': csrfToken }
        });
        const data = await res.json();
        console.log('[Battle] Initiate response:', res.status, data);

        if (res.ok) {
            showToast('⚔️ test battle initiated! check your arena overlay.', 'success');
            // Option: Open arena in new tab for testing convenience
            const arenaUrl = `${window.location.protocol}//${window.location.host}/arena.html${streamerParam}`;
            if (confirm('Battle initiated! Want to open the Arena Overlay to watch?')) {
                window.open(arenaUrl, '_blank');
            }
        } else {
            showToast(data.error || 'Failed to start battle', 'error');
        }
    } catch (e) {
        console.error('[Battle] Network error during initiate:', e);
        showToast('Network error starting battle', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Test Battle'; }
    }
};

window.copyArenaLink = function () {
    const streamerParam = APP_STREAMER ? `?streamer=${APP_STREAMER.username}` : '';
    const arenaUrl = `${window.location.protocol}//${window.location.host}/arena.html${streamerParam}`;

    navigator.clipboard.writeText(arenaUrl).then(() => {
        showToast('🔗 Arena link copied to clipboard!', 'info');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy link', 'error');
    });
};

function mapNestedStatFields(dbCard) {
    return {
        name: dbCard.card?.name || 'Unknown',
        image_url: dbCard.card?.image_url || '',
        rarity: dbCard.card?.rarity || 'common',
        attack: dbCard.attack || 0,
        defense: dbCard.defense || 0,
        mechanic_icon: dbCard.mechanic?.icon || '',
        mechanic_name: dbCard.mechanic?.display_name || ''
    };
}

// Global Init
// ================================================================
//  CARD LAYER EDITOR  (Fabric.js-based drag-and-drop layer editor)
// ================================================================
const LAYER_EDITOR_W = 500;
const LAYER_EDITOR_H = 700;

const LAYER_STICKERS = [
    '😀', '😎', '🔥', '💎', '⚡', '🌟', '🎮', '🃏', '⚔️', '🛡️', '🎯', '💫',
    '🌈', '🏆', '👑', '🐉', '🦋', '🌸', '💜', '🚀', '🎉', '🦊', '🌙', '❄️',
    '💥', '👾', '🎸', '🦁', '🐺', '🐸'
];

let _layerFabric = null;
let _layerEditorCardId = null;
let _layerEditorOnSave = null;
let _layerHistory = [];
let _layerHistoryIdx = -1;
let _layerHistoryPaused = false;
let _layerSortable = null;
let _layerCurrentTool = 'select';
let _layerTextClickHandler = null;

// ── Open / Close ──────────────────────────────────────────────
function openCardLayerEditor(cardId, cardName, imageUrl, onSave) {
    _layerEditorCardId = cardId;
    _layerEditorOnSave = onSave;
    const title = document.getElementById('layer-editor-title');
    if (title) title.textContent = cardName || 'Card Editor';
    const el = document.getElementById('card-layer-editor');
    if (!el) return;
    el.classList.remove('hidden');
    // Hide navbar so editor has full screen
    const nav = document.getElementById('app-navbar');
    if (nav) nav.classList.add('hidden');
    scrollLock();
    _initLayerFabric(imageUrl);
    _initLayerEditorEvents();
}

function closeCardLayerEditor() {
    const el = document.getElementById('card-layer-editor');
    if (el) el.classList.add('hidden');
    // Restore navbar
    const nav = document.getElementById('app-navbar');
    if (nav) nav.classList.remove('hidden');
    scrollUnlock();
    if (_layerFabric) { _layerFabric.dispose(); _layerFabric = null; }
    if (_layerSortable) { _layerSortable.destroy(); _layerSortable = null; }
    _layerHistory = [];
    _layerHistoryIdx = -1;
    _layerCurrentTool = 'select';
    _layerTextClickHandler = null;
    const sp = document.getElementById('layer-editor-sticker-picker');
    if (sp) sp.classList.add('hidden');
}

// ── Init Fabric Canvas ────────────────────────────────────────
function _initLayerFabric(bgImageUrl) {
    if (_layerFabric) { _layerFabric.dispose(); _layerFabric = null; }
    // fabric needs the canvas element fresh
    const canvasEl = document.getElementById('layer-editor-canvas');
    if (!canvasEl) return;

    _layerFabric = new fabric.Canvas('layer-editor-canvas', {
        width: LAYER_EDITOR_W,
        height: LAYER_EDITOR_H,
        backgroundColor: '#1a1025',
        preserveObjectStacking: true,
        selection: true,
    });

    // Scale canvas display to fit smaller screens
    const area = document.getElementById('layer-editor-canvas-area');
    if (area) {
        const maxH = area.clientHeight - 48;
        const maxW = area.clientWidth - 48;
        const scale = Math.min(1, maxW / LAYER_EDITOR_W, maxH / LAYER_EDITOR_H);
        _layerFabric.setZoom(scale);
        _layerFabric.setWidth(LAYER_EDITOR_W * scale);
        _layerFabric.setHeight(LAYER_EDITOR_H * scale);
    }

    _layerFabric.on('selection:created', _onLESelect);
    _layerFabric.on('selection:updated', _onLESelect);
    _layerFabric.on('selection:cleared', _onLEDeselect);
    _layerFabric.on('object:modified', () => { _lePushHistory(); _renderLayerList(); });
    _layerFabric.on('path:created', (e) => {
        if (e.path) e.path.data = { layerName: 'Drawing', layerType: 'path' };
        _lePushHistory();
        _renderLayerList();
    });

    if (bgImageUrl) {
        // Load via HTMLImageElement first to handle CORS-cached images correctly
        const htmlImg = new Image();
        htmlImg.crossOrigin = 'anonymous';
        htmlImg.onload = () => {
            if (!_layerFabric) return;
            const fabricImg = new fabric.Image(htmlImg);
            const scale = Math.max(LAYER_EDITOR_W / htmlImg.naturalWidth, LAYER_EDITOR_H / htmlImg.naturalHeight);
            fabricImg.set({
                left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2,
                originX: 'center', originY: 'center',
                scaleX: scale, scaleY: scale,
            });
            fabricImg.data = { layerName: 'Background', layerType: 'image' };
            _layerFabric.add(fabricImg);
            _layerFabric.sendToBack(fabricImg);
            _layerFabric.renderAll();
            _lePushHistory();
            _renderLayerList();
        };
        htmlImg.onerror = () => {
            // Fallback: try without crossOrigin (works for same-origin or non-CORS images)
            const htmlImg2 = new Image();
            htmlImg2.onload = () => {
                if (!_layerFabric) return;
                const fabricImg = new fabric.Image(htmlImg2);
                const scale = Math.max(LAYER_EDITOR_W / htmlImg2.naturalWidth, LAYER_EDITOR_H / htmlImg2.naturalHeight);
                fabricImg.set({ left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
                fabricImg.data = { layerName: 'Background', layerType: 'image' };
                _layerFabric.add(fabricImg);
                _layerFabric.sendToBack(fabricImg);
                _layerFabric.renderAll();
                _lePushHistory();
                _renderLayerList();
            };
            htmlImg2.onerror = () => { _lePushHistory(); _renderLayerList(); };
            htmlImg2.src = bgImageUrl;
        };
        // Add cache-bust only if needed to force CORS re-fetch
        htmlImg.src = bgImageUrl.includes('?') ? bgImageUrl : bgImageUrl + '?cb=' + Date.now();
    } else {
        _lePushHistory();
        _renderLayerList();
    }

    setLayerEditorTool('select');
}

// ── One-time event wiring (re-called each open) ───────────────
function _initLayerEditorEvents() {
    // Image file input
    const imgInput = document.getElementById('layer-editor-image-input');
    if (imgInput) {
        imgInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file || !_layerFabric) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                fabric.Image.fromURL(evt.target.result, (img) => {
                    if (!img || !_layerFabric) return;
                    const scale = Math.min((LAYER_EDITOR_W * 0.85) / img.width, (LAYER_EDITOR_H * 0.85) / img.height, 1);
                    img.set({ left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
                    img.data = { layerName: 'Image', layerType: 'image' };
                    _layerFabric.add(img);
                    _layerFabric.setActiveObject(img);
                    _layerFabric.renderAll();
                    _lePushHistory();
                    _renderLayerList();
                });
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        };
    }

    // Build sticker grid
    const stickerGrid = document.getElementById('layer-editor-sticker-grid');
    if (stickerGrid) {
        stickerGrid.innerHTML = LAYER_STICKERS.map(s =>
            `<button onclick="layerEditorAddSticker('${s}')" title="${s}"
                class="w-9 h-9 text-xl hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">${s}</button>`
        ).join('');
    }

    // Keyboard shortcuts
    const keyHandler = (e) => {
        if (!document.getElementById('card-layer-editor') || document.getElementById('card-layer-editor').classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.key === 'Delete' || e.key === 'Backspace') layerEditorDeleteSelected();
        if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undoLayerEditor(); }
        if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redoLayerEditor(); }
        if (e.key === 'v' || e.key === 'V') setLayerEditorTool('select');
        if (e.key === 't' || e.key === 'T') setLayerEditorTool('text');
        if (e.key === 'd' || e.key === 'D') setLayerEditorTool('draw');
    };
    document.addEventListener('keydown', keyHandler);
    // Remove on close (stored on element)
    const el = document.getElementById('card-layer-editor');
    if (el._leKeyHandler) document.removeEventListener('keydown', el._leKeyHandler);
    el._leKeyHandler = keyHandler;
}

// ── Tool Management ───────────────────────────────────────────
window.setLayerEditorTool = function (tool) {
    _layerCurrentTool = tool;
    const c = _layerFabric;
    if (!c) return;

    // Update toolbar highlight
    document.querySelectorAll('.layer-editor-tool-btn').forEach(b => b.classList.remove('le-active'));
    const btn = document.getElementById(`layer-tool-${tool}`);
    if (btn) btn.classList.add('le-active');

    // Remove previous text-click handler
    if (_layerTextClickHandler) {
        c.off('mouse:down', _layerTextClickHandler);
        _layerTextClickHandler = null;
    }

    c.isDrawingMode = false;
    c.selection = (tool === 'select');
    c.defaultCursor = tool === 'text' ? 'text' : 'default';

    c.forEachObject(obj => {
        obj.selectable = (tool === 'select');
        obj.evented = (tool !== 'draw');
    });

    if (tool === 'draw') {
        c.isDrawingMode = true;
        if (!c.freeDrawingBrush) c.freeDrawingBrush = new fabric.PencilBrush(c);
        c.freeDrawingBrush.color = '#ffffff';
        c.freeDrawingBrush.width = 6;
        // Show brush props
        document.getElementById('layer-editor-props-content').innerHTML = _leBrushPropsHTML();
    }

    if (tool === 'text') {
        _layerTextClickHandler = (opt) => {
            if (opt.target) return;
            const p = c.getPointer(opt.e);
            const t = new fabric.IText('Edit me', {
                left: p.x, top: p.y,
                fontFamily: 'Arial', fontSize: 40,
                fill: '#ffffff', stroke: '#000000', strokeWidth: 1,
                fontWeight: 'bold',
            });
            t.data = { layerName: 'Text', layerType: 'text' };
            c.add(t);
            c.setActiveObject(t);
            c.renderAll();
            t.enterEditing();
            t.selectAll();
            setLayerEditorTool('select');
            _lePushHistory();
            _renderLayerList();
        };
        c.on('mouse:down', _layerTextClickHandler);
    }

    c.renderAll();
};

// ── Add shapes / images / stickers ───────────────────────────
window.layerEditorAddImage = function () {
    const input = document.getElementById('layer-editor-image-input');
    if (input) input.click();
};

window.layerEditorAddShape = function (type) {
    if (!_layerFabric) return;
    let shape;
    const cx = LAYER_EDITOR_W / 2, cy = LAYER_EDITOR_H / 2;
    if (type === 'rect') {
        shape = new fabric.Rect({ left: cx - 80, top: cy - 60, width: 160, height: 120, fill: 'rgba(100,50,200,0.5)', stroke: '#a855f7', strokeWidth: 2, rx: 8, ry: 8 });
        shape.data = { layerName: 'Rectangle', layerType: 'rect' };
    } else {
        shape = new fabric.Circle({ left: cx - 60, top: cy - 60, radius: 60, fill: 'rgba(100,50,200,0.5)', stroke: '#a855f7', strokeWidth: 2 });
        shape.data = { layerName: 'Circle', layerType: 'circle' };
    }
    _layerFabric.add(shape);
    _layerFabric.setActiveObject(shape);
    _layerFabric.renderAll();
    _lePushHistory();
    _renderLayerList();
    setLayerEditorTool('select');
};

window.layerEditorAddSticker = function (emoji) {
    if (!_layerFabric) return;
    const t = new fabric.Text(emoji, { left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', fontSize: 80 });
    t.data = { layerName: emoji + ' Sticker', layerType: 'sticker' };
    _layerFabric.add(t);
    _layerFabric.setActiveObject(t);
    _layerFabric.renderAll();
    _lePushHistory();
    _renderLayerList();
    document.getElementById('layer-editor-sticker-picker').classList.add('hidden');
    setLayerEditorTool('select');
};

window.toggleLayerEditorStickerPicker = function () {
    document.getElementById('layer-editor-sticker-picker').classList.toggle('hidden');
};

window.layerEditorDeleteSelected = function () {
    const c = _layerFabric;
    if (!c) return;
    const objs = c.getActiveObjects();
    if (!objs.length) return;
    c.discardActiveObject();
    objs.forEach(o => c.remove(o));
    c.renderAll();
    _lePushHistory();
    _renderLayerList();
};

// ── History ───────────────────────────────────────────────────
function _lePushHistory() {
    if (_layerHistoryPaused || !_layerFabric) return;
    const json = JSON.stringify(_layerFabric.toJSON(['data']));
    _layerHistory.splice(_layerHistoryIdx + 1);
    _layerHistory.push(json);
    if (_layerHistory.length > 60) _layerHistory.shift();
    else _layerHistoryIdx++;
}

window.undoLayerEditor = function () {
    if (_layerHistoryIdx <= 0 || !_layerFabric) return;
    _layerHistoryIdx--;
    _layerHistoryPaused = true;
    _layerFabric.loadFromJSON(_layerHistory[_layerHistoryIdx], () => {
        _layerFabric.renderAll();
        _layerHistoryPaused = false;
        _renderLayerList();
    });
};

window.redoLayerEditor = function () {
    if (_layerHistoryIdx >= _layerHistory.length - 1 || !_layerFabric) return;
    _layerHistoryIdx++;
    _layerHistoryPaused = true;
    _layerFabric.loadFromJSON(_layerHistory[_layerHistoryIdx], () => {
        _layerFabric.renderAll();
        _layerHistoryPaused = false;
        _renderLayerList();
    });
};

// ── Layer List ────────────────────────────────────────────────
function _renderLayerList() {
    const list = document.getElementById('layer-editor-layer-list');
    if (!list || !_layerFabric) return;
    const objects = [..._layerFabric.getObjects()].reverse(); // top first
    if (objects.length === 0) {
        list.innerHTML = '<div class="text-white/20 text-[10px] px-2 py-1">No layers yet</div>';
        return;
    }
    const activeObjs = _layerFabric.getActiveObjects();
    const typeIcon = (t) => ({ text: 'fa-t', sticker: 'fa-face-smile', rect: 'fa-square', circle: 'fa-circle', path: 'fa-pen-nib', image: 'fa-image' })[t] || 'fa-layer-group';

    list.innerHTML = objects.map((obj, i) => {
        const fabricIdx = objects.length - 1 - i;
        const name = obj.data?.layerName || `Layer ${i + 1}`;
        const type = obj.data?.layerType || obj.type || '';
        const isSelected = activeObjs.includes(obj);
        const isHidden = !obj.visible;
        return `<div class="le-layer-row${isSelected ? ' le-selected' : ''}" onclick="_leSelectLayer(${fabricIdx})" data-le-idx="${fabricIdx}">
            <i class="fa-solid fa-grip-dots-vertical le-drag-handle"></i>
            <i class="fa-solid ${typeIcon(type)} text-[8px] opacity-50 shrink-0"></i>
            <span class="flex-1 truncate">${name}</span>
            <button class="le-vis-btn" onclick="event.stopPropagation();_leToggleVis(${fabricIdx})">
                <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
        </div>`;
    }).join('');

    // Drag-to-reorder
    if (_layerSortable) _layerSortable.destroy();
    _layerSortable = Sortable.create(list, {
        animation: 120,
        handle: '.le-drag-handle',
        onEnd: (evt) => {
            if (!_layerFabric) return;
            const total = _layerFabric.getObjects().length;
            const oldFabricIdx = total - 1 - evt.oldIndex;
            const newFabricIdx = total - 1 - evt.newIndex;
            const obj = _layerFabric.getObjects()[oldFabricIdx];
            if (obj) {
                _layerFabric.moveTo(obj, newFabricIdx);
                _layerFabric.renderAll();
                _lePushHistory();
                _renderLayerList();
            }
        }
    });
}

window._leSelectLayer = function (fabricIdx) {
    if (!_layerFabric) return;
    const objs = _layerFabric.getObjects();
    if (fabricIdx >= 0 && fabricIdx < objs.length) {
        _layerFabric.setActiveObject(objs[fabricIdx]);
        _layerFabric.renderAll();
        _renderPropsPanel(objs[fabricIdx]);
        _renderLayerList();
    }
};

window._leToggleVis = function (fabricIdx) {
    if (!_layerFabric) return;
    const obj = _layerFabric.getObjects()[fabricIdx];
    if (obj) { obj.visible = !obj.visible; _layerFabric.renderAll(); _renderLayerList(); }
};

// ── Selection Callbacks ───────────────────────────────────────
function _onLESelect() {
    _renderLayerList();
    const obj = _layerFabric?.getActiveObject();
    if (obj) _renderPropsPanel(obj);
}
function _onLEDeselect() {
    _renderLayerList();
    const p = document.getElementById('layer-editor-props-content');
    if (p) p.innerHTML = '<div class="text-white/30">Select a layer</div>';
}

// ── Properties Panel ──────────────────────────────────────────
function _renderPropsPanel(obj) {
    const panel = document.getElementById('layer-editor-props-content');
    if (!panel || !obj) return;
    const type = obj.data?.layerType || obj.type || '';
    let html = '';

    // Opacity — universal
    html += `<div class="le-prop-row">
        <label class="le-prop-label">Opacity ${Math.round((obj.opacity ?? 1) * 100)}%</label>
        <input type="range" min="0" max="100" value="${Math.round((obj.opacity ?? 1) * 100)}"
            oninput="this.previousElementSibling.textContent='Opacity '+this.value+'%'; _leSetProp('opacity', this.value/100)">
    </div>`;

    if (type === 'text' || type === 'sticker' || obj.type === 'i-text' || obj.type === 'text') {
        html += `<div class="le-prop-row">
            <label class="le-prop-label">Font Size</label>
            <input type="number" min="6" max="300" value="${obj.fontSize || 36}" oninput="_leSetProp('fontSize', parseInt(this.value)||12)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Fill Color</label>
            <input type="color" value="${_leColorHex(obj.fill, '#ffffff')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('fill', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Color</label>
            <input type="color" value="${_leColorHex(obj.stroke, '#000000')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('stroke', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Width</label>
            <input type="range" min="0" max="20" value="${obj.strokeWidth ?? 1}" oninput="_leSetProp('strokeWidth', parseInt(this.value))">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Font</label>
            <select onchange="_leSetProp('fontFamily', this.value)">
                ${['Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Palatino', 'Garamond', 'Comic Sans MS'].map(f =>
            `<option value="${f}" ${(obj.fontFamily || 'Arial') === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
        </div>
        <div class="le-prop-btn-row">
            <button class="${obj.fontWeight === 'bold' ? 'le-active-prop' : ''}" onclick="_leToggleProp('fontWeight','bold','normal');this.classList.toggle('le-active-prop')"><b>B</b></button>
            <button class="${obj.fontStyle === 'italic' ? 'le-active-prop' : ''}" onclick="_leToggleProp('fontStyle','italic','normal');this.classList.toggle('le-active-prop')"><i>I</i></button>
            <button class="${obj.underline ? 'le-active-prop' : ''}" onclick="_leToggleProp('underline',true,false);this.classList.toggle('le-active-prop')"><u>U</u></button>
        </div>`;
    }

    if (type === 'rect' || type === 'circle' || obj.type === 'rect' || obj.type === 'circle') {
        html += `<div class="le-prop-row">
            <label class="le-prop-label">Fill Color</label>
            <input type="color" value="${_leColorHex(obj.fill, '#6432c8')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('fill', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Color</label>
            <input type="color" value="${_leColorHex(obj.stroke, '#a855f7')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('stroke', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Width</label>
            <input type="range" min="0" max="30" value="${obj.strokeWidth ?? 2}" oninput="_leSetProp('strokeWidth', parseInt(this.value))">
        </div>`;
    }

    if (type === 'path' || obj.type === 'path') {
        html += `<div class="le-prop-row">
            <label class="le-prop-label">Stroke Color</label>
            <input type="color" value="${_leColorHex(obj.stroke, '#ffffff')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('stroke', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Width</label>
            <input type="range" min="1" max="60" value="${obj.strokeWidth ?? 6}" oninput="_leSetProp('strokeWidth', parseInt(this.value))">
        </div>`;
    }

    if (type === 'image' || obj.type === 'image') {
        html += `<div class="le-prop-btn-row">
            <button onclick="_leFlip('X')">↔ Flip H</button>
            <button onclick="_leFlip('Y')">↕ Flip V</button>
        </div>`;
    }

    panel.innerHTML = html || '<div class="text-white/30">No editable properties</div>';
}

function _leBrushPropsHTML() {
    const brush = _layerFabric?.freeDrawingBrush;
    return `<div class="le-prop-row">
        <label class="le-prop-label">Brush Color</label>
        <input type="color" value="${brush?.color || '#ffffff'}" style="width:100%;height:32px;border-radius:8px"
            oninput="if(_layerFabric&&_layerFabric.freeDrawingBrush)_layerFabric.freeDrawingBrush.color=this.value">
    </div>
    <div class="le-prop-row">
        <label class="le-prop-label">Brush Size</label>
        <input type="range" min="1" max="80" value="${brush?.width || 6}"
            oninput="if(_layerFabric&&_layerFabric.freeDrawingBrush)_layerFabric.freeDrawingBrush.width=parseInt(this.value)">
    </div>
    <div class="le-prop-row">
        <label class="le-prop-label">Eraser Mode</label>
        <div class="le-prop-btn-row">
            <button onclick="_leSetBrushMode('pencil')" class="le-active-prop">Pencil</button>
            <button onclick="_leSetBrushMode('eraser')">Eraser</button>
        </div>
    </div>`;
}

window._leSetBrushMode = function (mode) {
    if (!_layerFabric) return;
    if (mode === 'eraser') {
        _layerFabric.freeDrawingBrush.color = _layerFabric.backgroundColor || '#1a1025';
    } else {
        _layerFabric.freeDrawingBrush.color = '#ffffff';
    }
    document.querySelectorAll('.le-prop-btn-row button').forEach(b => b.classList.remove('le-active-prop'));
    event?.target?.classList?.add('le-active-prop');
};

// ── Prop helpers ──────────────────────────────────────────────
window._leSetProp = function (prop, value) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    _layerFabric.renderAll();
};

window._leToggleProp = function (prop, onVal, offVal) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(prop, obj[prop] === onVal ? offVal : onVal);
    _layerFabric.renderAll();
};

window._leFlip = function (axis) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(axis === 'X' ? 'flipX' : 'flipY', !obj[axis === 'X' ? 'flipX' : 'flipY']);
    _layerFabric.renderAll();
    _lePushHistory();
};

function _leColorHex(color, fallback) {
    if (!color || typeof color !== 'string') return fallback;
    if (color.startsWith('#') && (color.length === 4 || color.length === 7)) return color;
    return fallback;
}

// ── Save ──────────────────────────────────────────────────────
window.saveLayerEditor = async function () {
    if (!_layerFabric) return;
    const btn = document.getElementById('layer-editor-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
        // Temporarily reset zoom for full-res export
        const currentZoom = _layerFabric.getZoom();
        _layerFabric.setZoom(1);
        _layerFabric.setWidth(LAYER_EDITOR_W);
        _layerFabric.setHeight(LAYER_EDITOR_H);
        _layerFabric.renderAll();

        const dataUrl = _layerFabric.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 });

        // Restore zoom
        _layerFabric.setZoom(currentZoom);
        const area = document.getElementById('layer-editor-canvas-area');
        if (area) {
            const maxH = area.clientHeight - 48, maxW = area.clientWidth - 48;
            const scale = Math.min(1, maxW / LAYER_EDITOR_W, maxH / LAYER_EDITOR_H);
            _layerFabric.setWidth(LAYER_EDITOR_W * scale);
            _layerFabric.setHeight(LAYER_EDITOR_H * scale);
        }
        _layerFabric.renderAll();

        const fetchRes = await fetch(dataUrl);
        const blob = await fetchRes.blob();

        if (_layerEditorOnSave) await _layerEditorOnSave(blob);
        closeCardLayerEditor();
    } catch (err) {
        console.error('[LayerEditor] Save failed:', err);
        showToast('Export failed', 'error');
        if (btn) { btn.textContent = 'Save Card Art'; btn.disabled = false; }
    }
};

// Helper: upload blob and patch card image_url
async function _leUploadAndPatchCard(cardId, blob) {
    showToast('Uploading art…', 'loading');
    const formData = new FormData();
    formData.append('file', blob, 'card-art.jpg');
    const uploadRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: formData,
        credentials: 'include'
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const { url } = await uploadRes.json();

    const patchRes = await fetch(`${BACKEND_URL}/api/creator/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ id: cardId, image_url: url }),
        credentials: 'include'
    });
    if (!patchRes.ok) throw new Error('Patch failed');
    showToast('Card art saved!', 'success');
    if (editorCurrentSetId) loadEditorCards();
}

// ── Open from editor grid ─────────────────────────────────────
window.openLayerEditorForCard = function (cardId) {
    const card = editorAllCards.find(c => c.id === cardId);
    if (!card) return;
    openCardLayerEditor(cardId, card.name, card.image_url || null, async (blob) => {
        await _leUploadAndPatchCard(cardId, blob);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
