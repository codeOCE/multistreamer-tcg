

const BACKEND_URL = window.location.origin === 'http://localhost:3000' || window.location.origin === 'http://127.0.0.1:3000'
    ? 'http://localhost:8787'
    : '';

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
            e.target.src = '/pack.png'; // Main card fallback
        }
    }
}, true); // useCapture = true is strictly required for 'error' events which don't bubble

let currentUser = null;
let creatorCards = [];
let creatorStats = {};
let csrfToken = null;

let collectorGrowthChartInstance = null;
let packActivityChartInstance = null;
let analyticsData = {
    overview: null,
    cards: null,
    collectors: null,
    packs: null
};

let creatorSets = [];
let selectedCardIds = new Set();
let bulkSelectMode = false;
let cardToEdit = null;


async function initDashboard() {
    await fetchCSRFToken();
    await bootstrapDashboard();

    setupEventListeners();

    switchTab('branding');
}

function setupEventListeners() {
    const battleToggle = document.getElementById('battle-global-toggle');
    const tradingToggle = document.getElementById('trading-global-toggle');
    const colorPicker = document.getElementById('brand-color');
    const packArtUpload = document.getElementById('pack-art-placeholder');

    if (battleToggle) {
        battleToggle.checked = currentUser.streamer?.battles_enabled ?? true;
        battleToggle.onchange = (e) => saveSettings({ battles_enabled: e.target.checked });
    }
    if (tradingToggle) {
        tradingToggle.checked = currentUser.streamer?.trading_enabled ?? true;
        tradingToggle.onchange = (e) => saveSettings({ trading_enabled: e.target.checked });
    }
    if (colorPicker) {
        colorPicker.oninput = (e) => {
            document.getElementById('brand-color-hex').textContent = e.target.value.toUpperCase();
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
        userSearch.oninput = (e) => {
            debounce(() => fetchUserList(e.target.value), 500)();
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
}
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

    loadTabData(tabId);
}


function loadTabData(tabId) {
    switch (tabId) {
        case 'branding':
            populateBranding();
            break;
        case 'battle':
            fetchCardsForGrid('battle-card-grid');
            break;
        case 'trading':
            fetchCardsForGrid('trading-card-grid');
            break;
        case 'overlay':
            populateOverlaySettings();
            break;
        case 'admin':
            fetchAdminLogs();
            fetchUserList();
            break;
        case 'events':
            checkActiveEvent();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'cards':
            loadSets();
            switchSubTab('cards', 'all');
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
        const res = await fetch(`${BACKEND_URL}/api/bootstrap`, { credentials: 'include' });
        if (!res.ok) throw new Error("Initialization failed");

        const data = await res.json();
        if (!data.user || !data.user.is_creator) {
            console.warn("[Dashboard] Unauthorized attempt. Redirecting...");
            window.location.href = '/';
            return;
        }

        currentUser = {
            name: data.user.username || (data.user.streamer && data.user.streamer.username) || (data.user.streamer && data.user.streamer.brand_name) || 'Creator',
            avatar: data.user.avatar_url,
            is_creator: data.user.is_creator,
            streamer: data.user.streamer || {}
        };

        const navUsername = currentUser.name;
        const navAvatar = document.getElementById('nav-avatar');
        if (navUsername) navUsername.textContent = currentUser.name;
        if (navAvatar) {
            navAvatar.src = currentUser.avatar || '/default-avatar.png';
            navAvatar.onerror = () => navAvatar.src = '/default-avatar.png';
        }

        creatorStats = data.stats || {};
        populateBranding();
        populateOverlaySettings();
        checkActiveEvent();

    } catch (err) {
        showToast("System error during initialization", "error");
    }
}


async function fetchCSRFToken() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/csrf`, { credentials: 'include' });
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

    const name = s.brand_name;
    const tagline = s.brand_tagline || 'No tagline set';
    const color = s.binder_color || s.brand_color_primary || '#00f2fe';

    if (document.getElementById('read-brand-name')) document.getElementById('read-brand-name').textContent = name;
    if (document.getElementById('read-brand-tagline')) document.getElementById('read-brand-tagline').textContent = tagline;
    if (document.getElementById('read-brand-color-preview')) document.getElementById('read-brand-color-preview').style.backgroundColor = color;
    if (document.getElementById('read-brand-color-hex')) document.getElementById('read-brand-color-hex').textContent = color.toUpperCase();

    if (document.getElementById('nav-username')) document.getElementById('nav-username').textContent = name;

    if (document.getElementById('brand-name')) document.getElementById('brand-name').value = s.brand_name || '';
    if (document.getElementById('brand-tagline')) document.getElementById('brand-tagline').value = s.brand_tagline || '';
    if (document.getElementById('brand-color')) {
        document.getElementById('brand-color').value = color;
        document.getElementById('brand-color-hex').textContent = color.toUpperCase();
    }

    if (s.pack_image_url && document.getElementById('pack-art-preview')) {
        document.getElementById('pack-art-preview').src = s.pack_image_url;
        document.getElementById('pack-art-preview').classList.remove('hidden');
        document.getElementById('pack-art-placeholder').classList.add('hidden');
    }
}

function toggleBrandingEdit() {
    const readMode = document.getElementById('branding-read-mode');
    const editMode = document.getElementById('branding-edit-mode');
    const editBtn = document.getElementById('edit-branding-btn');

    if (readMode && editMode) {
        const isEditing = !editMode.classList.contains('hidden');
        if (isEditing) {
            editMode.classList.add('hidden');
            readMode.classList.remove('hidden');
            if (editBtn) editBtn.innerHTML = '<i class="fa-solid fa-pencil text-sm"></i>';
        } else {
            editMode.classList.remove('hidden');
            readMode.classList.add('hidden');
            if (editBtn) editBtn.innerHTML = '<i class="fa-solid fa-eye text-sm"></i>';
        }
    }
}

function confirmResetPackArt() {
    showConfirmModal(
        'Reset Pack Art',
        'Reset your pack art back to the default image? Your custom art will be removed.',
        () => {
            const preview = document.getElementById('pack-art-preview');
            preview.src = '/pack.png';
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

        const res = await fetch(`${BACKEND_URL}/api/creator/upload`, {
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

async function saveBranding() {
    const brand_name = document.getElementById('brand-name').value;
    const brand_tagline = document.getElementById('brand-tagline').value;
    const binder_color = document.getElementById('brand-color').value;

    showToast("Saving branding...", "loading");
    const ok = await saveSettings({ brand_name, brand_tagline, binder_color });
    if (ok) {
        showToast("Branding saved", "success");
        populateBranding();
        toggleBrandingEdit(); // Close edit mode on success
    } else {
        showToast("Failed to save branding", "error");
    }
}

async function saveSettings(payload) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
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

    grid.innerHTML = `<div class="col-span-full py-12 text-center text-void-muted uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading Cards...</div>`;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
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
                <div class="card-select-item ${isSelected ? 'selected' : ''}" onclick="${bulkSelectMode ? `toggleCardSelection('${card.id}')` : `editCard('${card.id}')`}">
                    ${bulkSelectMode ? `<div class="card-select-check"></div>` : ''}
                    <div class="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-2xl">
                        <img src="${card.image_url || '/pack.png'}" class="w-full h-full object-cover transition-all duration-500 hover:scale-105">
                    </div>
                    <div class="p-4 bg-white/5 flex flex-col gap-2">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="text-[11px] font-black text-white uppercase truncate">${card.name}</div>
                                <div class="text-[8px] font-bold text-void-accent/50 uppercase tracking-widest">${card.rarity}</div>
                            </div>
                            ${!bulkSelectMode ? `
                                <button onclick="event.stopPropagation(); deleteCard('${card.id}')" class="text-red-500/30 hover:text-red-500 transition-colors">
                                    <i class="fa-solid fa-trash-can text-[10px]"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="h-px bg-white/5 w-full"></div>
                        <div class="flex justify-between items-center text-[7px] font-black text-void-muted uppercase">
                            <span>ATK: ${card.attack || 0}</span>
                            <span>DEF: ${card.defense || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    const field = gridId === 'battle-card-grid' ? 'is_battle_eligible' : 'is_trading_eligible';
    grid.innerHTML = cards.map(card => `
        <div class="card-select-item ${card[field] ? 'selected' : ''}" onclick="toggleCardEligibility('${card.id}', '${field}', this)">
            <div class="card-select-check"></div>
            <div class="aspect-[2/3] w-full flex items-center justify-center">
                <img src="${card.image_url || '/pack.png'}" class="w-full h-full object-cover ${card[field] ? '' : 'grayscale opacity-50'} transition-all duration-500">
            </div>
            <div class="p-3 bg-white/5">
                <div class="text-[9px] font-black text-white uppercase truncate">${card.name}</div>
                <div class="text-[7px] font-bold text-void-accent uppercase mt-1 tracking-widest">${card.rarity}</div>
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
        const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
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


async function fetchAdminLogs() {
    const container = document.getElementById('admin-activity-logs');
    if (!container) return;

    const searchQuery = document.getElementById('log-search')?.value || "";
    const category = document.getElementById('log-category-filter')?.value || "all";

    container.innerHTML = `<div class="p-8 text-center text-void-muted uppercase tracking-widest text-[9px]"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading Activity Feed...</div>`;

    try {
        const url = new URL(`${BACKEND_URL}/api/creator/analytics/overview`);
        url.searchParams.set('days', '7');
        const res = await fetch(url.toString(), { credentials: 'include' });

        if (res.ok) {
            const data = await res.json();


            const events = [
                { type: 'grant', level: 'INFO', message: 'Manually granted 1 x Neon Dragon to codeOCE', details: '{"card_id":"c_001","target_username":"codeOCE"}', timestamp: new Date() },
                { type: 'grant', level: 'INFO', message: 'User codeOCE traded in 5 Commons for a Rare: Cyber Knight', details: '{"user_id":"96085876"}', timestamp: new Date(Date.now() - 300000) },
                { type: 'system', level: 'INFO', message: '[Stripe] Checkout session created for codeOCE', details: '{"session_id":"cs_live_..."}', timestamp: new Date(Date.now() - 86400000) }
            ];

            const filtered = events.filter(ev => {
                const matchesCategory = category === 'all' || ev.type === category;
                const matchesSearch = !searchQuery ||
                    ev.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ev.type.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
            });

            if (filtered.length === 0) {
                container.innerHTML = `<div class="p-8 text-center text-void-muted uppercase text-[9px]">No matching activity found</div>`;
                return;
            }

            container.innerHTML = filtered.map(event => `
                <div class="log-row">
                    <div class="col-span-2 text-[10px] text-void-muted flex flex-col">
                        <span>${new Date(event.timestamp).toLocaleDateString()}</span>
                        <span class="opacity-50">${new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="col-span-2">
                        <span class="badge-info">${event.level}</span>
                    </div>
                    <div class="col-span-2">
                        <span class="text-[10px] font-black text-white italic">${event.type}</span>
                    </div>
                    <div class="col-span-6">
                        <div class="text-[11px] font-bold text-white">${event.message}</div>
                        <div class="text-[9px] text-void-muted font-mono mt-0.5 truncate opacity-60">${event.details}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 text-center text-red-500 uppercase text-[9px]">Failed to load activity</div>`;
    }
}

async function fetchUserList(query = "") {
    const container = document.getElementById('admin-user-list');
    if (!container) return;

    container.innerHTML = `<div class="py-8 text-center text-void-muted uppercase tracking-widest text-[9px]"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading members...</div>`;

    try {
        const url = new URL(`${BACKEND_URL}/api/creator/analytics/collectors`);
        url.searchParams.set('days', '30');
        if (query) url.searchParams.set('search', query);

        const res = await fetch(url.toString(), { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            let users = data.top_collectors || [];

            if (users.length === 0) {
                container.innerHTML = `<div class="p-8 text-center text-void-muted uppercase text-[9px]">No members found</div>`;
                return;
            }

            container.innerHTML = users.map(u => `
                <div class="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-void-accent/30 transition-all">
                    <div class="flex items-center gap-4">
                        ${u.avatar_url
                    ? `<img src="${u.avatar_url}" class="w-10 h-10 rounded-xl border border-white/10 object-cover" onerror="this.outerHTML='<div class=\'w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20\'><i class=\'fa-solid fa-user text-xs\'></i></div>'">`
                    : `<div class="w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20"><i class="fa-solid fa-user text-xs"></i></div>`
                }
                        <div>
                            <div class="text-[11px] font-black text-white uppercase">${u.username}</div>
                            <div class="text-[9px] text-void-muted uppercase mt-1">Cards: ${u.total_cards} | Unique: ${u.unique_cards}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-lg text-[8px] font-black uppercase transition-all" onclick="openUserGrant('${u.username}', '${u.twitch_id}')">
                            Grant
                        </button>
                        <button class="px-3 py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 rounded-lg text-[8px] font-black uppercase transition-all" onclick="toggleUserBlock('${u.twitch_id}', true)">
                            Block
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 text-center text-red-500 uppercase text-[9px]">Failed to load members</div>`;
    }
}


async function loadAnalytics() {
    const timeRange = document.getElementById('analytics-time-range')?.value || '30';

    // Clear previous explicit data state
    analyticsData = {};
    renderAnalytics(); // Initial paint with placeholders/empty 

    const fetchEndpoint = (endpoint, key) => {
        fetch(`${BACKEND_URL}/api/creator/analytics/${endpoint}?days=${timeRange}`, { credentials: 'include' })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Network error');
            })
            .then(data => {
                analyticsData[key] = data;
                renderAnalytics();
            })
            .catch(err => console.error(`Failed to load ${key} analytics:`, err));
    };

    fetchEndpoint('overview', 'overview');
    fetchEndpoint('packs', 'packs');
    fetchEndpoint('cards', 'cards');
    fetchEndpoint('collectors', 'collectors');
}

function renderAnalytics() {
    if (analyticsData.overview && analyticsData.overview.growth_data) {
        renderCollectorGrowthChart(analyticsData.overview.growth_data);
    }
    if (analyticsData.packs && analyticsData.packs.activity_data) {
        renderPackActivityChart(analyticsData.packs.activity_data);
    }
    if (analyticsData.cards) {
        renderCardPerformance();
        if (analyticsData.cards.community_discovery) {
            renderCommunityDiscovery(analyticsData.cards.community_discovery);
        }
    }
    renderCollectorLeaderboard();
}

function renderCardPerformance() {
    const data = analyticsData.cards;
    const topCollected = document.getElementById('top-collected-cards');
    const rarest = document.getElementById('rarest-cards');

    if (topCollected && data.most_collected) {
        topCollected.innerHTML = data.most_collected.slice(0, 5).map((card, idx) => `
            <div class="performance-item">
                <div class="performance-rank">${idx + 1}</div>
                <img src="${card.image_url || '/pack.png'}" class="w-10 h-14 rounded border border-white/10 object-cover">
                <div class="flex-1">
                    <div class="text-[11px] font-black text-white uppercase">${card.name}</div>
                    <div class="text-[9px] text-void-accent uppercase mt-0.5">${card.collection_count || 0} Collected</div>
                </div>
            </div>
        `).join('');
    }

    if (rarest && data.rarest) {
        rarest.innerHTML = data.rarest.slice(0, 5).map((card, idx) => `
            <div class="performance-item hover:border-purple-500/30">
                <div class="performance-rank bg-purple-500/10 text-purple-400">${idx + 1}</div>
                <img src="${card.image_url || '/pack.png'}" class="w-10 h-14 rounded border border-white/10 object-cover">
                <div class="flex-1">
                    <div class="text-[11px] font-black text-white uppercase">${card.name}</div>
                    <div class="text-[9px] text-purple-400 uppercase mt-0.5">${card.collection_count || 0} Collected</div>
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

function renderCollectorGrowthChart(data) {
    const canvas = document.getElementById('collector-growth-chart');
    if (!canvas || !data) return;

    if (collectorGrowthChartInstance) collectorGrowthChartInstance.destroy();

    const labels = data.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = data.map(d => d.count);

    collectorGrowthChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Collectors',
                data: values,
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.05)',
                borderWidth: 2,
                pointBackgroundColor: '#00f2fe',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true },
                x: { grid: { display: false }, ticks: { font: { size: 8 }, color: 'rgba(255,255,255,0.3)' } }
            }
        }
    });
}

function renderPackActivityChart(data) {
    const canvas = document.getElementById('pack-activity-chart');
    if (!canvas || !data) return;

    if (packActivityChartInstance) packActivityChartInstance.destroy();

    const labels = data.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = data.map(d => d.count);

    packActivityChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Packs',
                data: values,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                hoverBackgroundColor: '#00f2fe',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true },
                x: { grid: { display: false }, ticks: { font: { size: 8 }, color: 'rgba(255,255,255,0.3)' } }
            }
        }
    });
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
        window.lastLoadingToast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => window.lastLoadingToast.remove(), 500);
        window.lastLoadingToast = null;
    }

    const toast = document.createElement('div');
    toast.className = `px-6 py-3 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-500 translate-y-20 opacity-0 flex items-center gap-3`;

    if (type === 'error') toast.className += " bg-red-500/10 border-red-500/20 text-red-500";
    else if (type === 'success') toast.className += " bg-void-accent/10 border-void-accent/20 text-void-accent";
    else if (type === 'loading') toast.className += " bg-white/5 border-white/10 text-white";
    else toast.className += " bg-white/5 border-white/10 text-white";

    toast.innerHTML = `
        ${type === 'loading' ? '<i class="fa-solid fa-spinner animate-spin text-xs"></i>' : ''}
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
        const res = await fetch(`${BACKEND_URL}/api/creator/events`, {
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
        const res = await fetch(`${BACKEND_URL}/api/creator/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const streamer = await res.json();

        const evRes = await fetch(`${BACKEND_URL}/api/creator/events/active`, { credentials: 'include' });
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
    let allUsers = [];
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
                        <i class="fa-solid fa-times text-lg"></i>
                    </button>
                </div>

                <div class="space-y-6">
                    <!-- Recipient Section -->
                    <div class="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <div class="text-[9px] font-black uppercase text-void-accent tracking-widest mb-4 flex justify-between">
                            <span>Recipient</span>
                            ${isGeneric ? '<span class="opacity-50">Search for a member</span>' : ''}
                        </div>
                        ${isGeneric ? `
                            <div class="relative group">
                                <i class="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-void-accent transition-colors"></i>
                                <input type="text" id="grant-user-search" placeholder="Search by username..." 
                                    class="w-full bg-void-bg/50 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:border-void-accent focus:ring-1 focus:ring-void-accent outline-none transition-all">
                            </div>
                            <select id="grant-recipient-select" class="w-full bg-void-bg/50 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold focus:border-void-accent transition-all appearance-none cursor-pointer mt-3">
                                <option value="">Loading members...</option>
                            </select>
                        ` : `
                            <div class="flex items-center gap-4">
                                <div class="w-14 h-14 rounded-2xl bg-void-accent/10 border border-void-accent/20 flex items-center justify-center text-void-accent shadow-inner">
                                    <i class="fa-solid fa-user-shield text-xl"></i>
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
                            <i class="fa-solid fa-filter absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-void-accent transition-colors"></i>
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
    const userSelect = document.getElementById('grant-recipient-select');
    const cardSearch = document.getElementById('card-search');
    const userSearch = document.getElementById('grant-user-search');

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

    const populateUsers = (filter = '') => {
        if (!userSelect) return;
        let filtered = allUsers.filter(u =>
            u.username.toLowerCase().includes(filter.toLowerCase()) ||
            String(u.twitch_id).includes(filter)
        );

        userSelect.innerHTML = '<option value="">-- SELECT SUBJECT --</option>' +
            filtered.map(u => `<option value="${u.twitch_id}">${u.username} (${u.total_cards} CARDS)</option>`).join('');
    };

    populateCards();

    cardSearch.oninput = (e) => populateCards(e.target.value);
    if (userSearch) {
        userSearch.oninput = (e) => populateUsers(e.target.value);
    }

    document.getElementById('execute-grant-btn').onclick = () => {
        let targetTwitchId = twitchId;
        let targetUsername = username;

        if (isGeneric) {
            targetTwitchId = userSelect.value;
            const selectedOpt = userSelect.options[userSelect.selectedIndex];
            targetUsername = selectedOpt ? selectedOpt.text.split(' (')[0] : '';
            if (!targetTwitchId) return showToast("Please select a recipient", "error");
        }

        const selection = cardSelect.value;
        if (!selection) return showToast("Please select a card", "error");

        const isSilent = document.getElementById('grant-silent').checked;

        if (selection.startsWith('random')) {
            const parts = selection.split(':');
            executeGrant(targetTwitchId, targetUsername, 'random', parts[1] || null, isSilent);
        } else {
            executeGrant(targetTwitchId, targetUsername, selection, null, isSilent);
        }
    };

    if (isGeneric) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/creator/analytics/collectors?days=90`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                allUsers = data.top_collectors || [];
                populateUsers();
            }
        } catch (e) {
            userSelect.innerHTML = '<option value="">Failed to load members</option>';
        }
    }
}

async function executeGrant(twitchId, username, cardId, randomRarity = null, isSilent = false) {
    showToast("Granting card...", "loading");

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/grant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                twitch_id: twitchId,
                username: username,
                card_id: cardId,
                random_rarity: randomRarity,
                is_silent: isSilent
            })
        });

        if (res.ok) {
            showToast("Card granted successfully", "success");
            closeGrantModal();
            fetchUserList();
            fetchAdminLogs();
        } else {
            const data = await res.json();
            showToast(data.error || "Failed to grant card", "error");
        }
    } catch (err) {
        showToast("Connection error: " + err.message, "error");
    }
}

async function fetchUserList() {
    const container = document.getElementById('admin-user-list');
    if (!container) return;

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/analytics/collectors?days=90`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const users = data.top_collectors || [];

            container.innerHTML = users.map(u => {
                const avatarHtml = u.avatar_url ?
                    `<img src="${u.avatar_url}" class="w-10 h-10 rounded-xl border border-white/10 object-cover" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20\\'><i class=\\'fa-solid fa-user text-xs\\'></i></div>'">` :
                    `<div class="w-10 h-10 rounded-xl bg-void-accent/10 flex items-center justify-center text-void-accent border border-void-accent/20"><i class="fa-solid fa-user text-xs"></i></div>`;
                return `
                <div class="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-void-accent/30 transition-all">
                    <div class="flex items-center gap-4">
                        ${avatarHtml}
                        <div>
                            <div class="text-[11px] font-black text-white uppercase">${u.username}</div>
                            <div class="text-[9px] text-void-muted uppercase mt-1">Cards: ${u.total_cards} | Unique: ${u.unique_cards}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-lg text-[8px] font-black uppercase transition-all" onclick="openUserGrant('${u.username}', '${u.twitch_id}')">
                            Grant
                        </button>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 text-center text-red-500 uppercase text-[9px]">Failed to load members</div>`;
    }
}

async function fetchAdminLogs() {
    const container = document.getElementById('admin-activity-logs');
    if (!container) return;

    const search = document.getElementById('log-search')?.value || '';
    const category = document.getElementById('log-category-filter')?.value || 'all';

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/events?search=${search}&category=${category}`, { credentials: 'include' });
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
        container.innerHTML = `<div class="p-8 text-center text-void-muted uppercase text-[10px] italic tracking-widest">No activity recorded</div>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const levelClass = log.level === 'error' ? 'text-red-500' : (log.level === 'warn' ? 'text-amber-500' : 'text-void-accent');

        return `
            <div class="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-colors items-center">
                <div class="col-span-2 text-[9px] font-mono text-void-muted">${time}</div>
                <div class="col-span-2">
                    <span class="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${levelClass} bg-current/10">${log.level || 'INFO'}</span>
                </div>
                <div class="col-span-2 text-[9px] font-black uppercase text-white/40 tracking-widest">${log.category || 'SYSTEM'}</div>
                <div class="col-span-6 text-[10px] font-bold text-white/80 leading-relaxed truncate">${log.message}</div>
            </div>
        `;
    }).join('');
}

async function fetchAllCreatorCards() {
    if (creatorCards && creatorCards.length > 0) return creatorCards;
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
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

async function toggleUserBlock(twitchId, isBlocked) {
    if (!confirm(`Are you sure you want to ${isBlocked ? 'BLOCK' : 'UNBLOCK'} this user? they will no longer be able to earn cards.`)) return;

    showToast("Updating member status...", "loading");

    setTimeout(() => {
        showToast(`Member ${isBlocked ? 'Blocked' : 'Unblocked'}`, "success");
        fetchUserList();
    }, 1000);
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

function logout() {
    window.location.href = '/auth/logout';
}



async function loadSets() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' });
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
                    <i class="fa-solid fa-folder-open text-2xl"></i>
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
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-black text-white uppercase truncate">${set.name}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <div class="text-[9px] text-void-accent font-bold uppercase tracking-widest">${set.total_cards || 0} Units</div>
                        ${set.is_active !== false ? `<span class="text-[7px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">ACTIVE</span>` : `<span class="text-[7px] font-black uppercase tracking-widest text-void-muted bg-white/5 px-1.5 py-0.5 rounded">INACTIVE</span>`}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); deleteSet('${set.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 p-2">
                    <i class="fa-solid fa-trash-can"></i>
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
}

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
}

async function saveSet() {
    const name = document.getElementById('set-name-input').value;
    const description = document.getElementById('set-description-input').value;
    const setId = document.getElementById('set-edit-id').value;
    const isActive = document.getElementById('set-is-active')?.checked ?? true;

    if (!name) return showToast("Set name required", "error");

    showToast("Saving set...", "loading");

    try {
        const url = setId ? `${BACKEND_URL}/api/creator/sets/${setId}` : `${BACKEND_URL}/api/creator/sets`;
        const res = await fetch(url, {
            method: setId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ id: setId || undefined, name, description, is_active: isActive }),
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
                const res = await fetch(`${BACKEND_URL}/api/creator/sets/${setId}`, {
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
            const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}/assign-set`, {
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
                    const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
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
        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, { credentials: 'include' });
        if (res.ok) {
            const settings = await res.json();
            if (settings.pack_image_url) {
                document.getElementById('pack-preview-image').src = settings.pack_image_url;
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

        const res = await fetch(`${BACKEND_URL}/api/creator/settings`, {
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


window.openSetManager = () => {
    document.getElementById('set-manager-modal')?.classList.remove('hidden');
    resetSetForm();
};
window.closeSetManager = () => document.getElementById('set-manager-modal')?.classList.add('hidden');
window.openCardCreator = () => {
    document.getElementById('card-creator-modal')?.classList.remove('hidden');
    document.getElementById('card-form-title').textContent = 'New Card';
    document.getElementById('card-edit-id').value = '';
    document.getElementById('card-creator-name').value = '';
    document.getElementById('card-creator-rarity').value = 'common';
    document.getElementById('card-creator-description').value = '';
    document.getElementById('card-creator-attack').value = '0';
    document.getElementById('card-creator-defense').value = '0';
    document.getElementById('card-creator-set').value = '';
    document.getElementById('card-image-preview').classList.add('hidden');
    document.getElementById('card-image-placeholder').classList.remove('hidden');
};
window.closeCardCreator = () => document.getElementById('card-creator-modal')?.classList.add('hidden');


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
    document.getElementById('pack-preview-image').src = '/pack.png';
    document.getElementById('pack-image-upload').value = '';
};


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
        } else if (cardId) {

            const preview = document.getElementById('card-image-preview');
            if (preview && !preview.classList.contains('hidden')) imageUrl = preview.src;
        }

        const payload = {
            id: cardId || undefined,
            name,
            rarity,
            description,
            attack,
            defense,
            set_id: setId || null,
            image_url: imageUrl || '/pack.png',
            is_battle_eligible: isBattleable,
            is_trading_eligible: isTradable
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
        const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrfToken },
            credentials: 'include'
        });

        if (res.ok) {
            showToast("Card deleted", "success");
            fetchCardsForGrid('creator-cards-grid');
        } else {
            showToast("Failed to delete card", "error");
        }
    } catch (err) {
        showToast("Something went wrong", "error");
    }
}

function editCard(cardId) {
    const card = creatorCards.find(c => c.id === cardId);
    if (!card) return;

    openCardCreator();
    document.getElementById('card-edit-id').value = card.id;
    document.getElementById('card-creator-name').value = card.name;
    document.getElementById('card-creator-rarity').value = card.rarity;
    document.getElementById('card-creator-description').value = card.description || '';
    document.getElementById('card-creator-attack').value = card.attack || 0;
    document.getElementById('card-creator-defense').value = card.defense || 0;
    document.getElementById('card-creator-set').value = card.set_id || '';
    const battleToggle = document.getElementById('card-creator-battleable');
    if (battleToggle) battleToggle.checked = card.is_battle_eligible !== false;
    const tradeToggle = document.getElementById('card-creator-tradable');
    if (tradeToggle) tradeToggle.checked = card.is_trading_eligible !== false;

    const preview = document.getElementById('card-image-preview');
    const placeholder = document.getElementById('card-image-placeholder');
    if (card.image_url) {
        preview.src = card.image_url;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }

    document.getElementById('card-form-title').textContent = 'Edit Card';
}


async function fetchCardBacks() {
    const grid = document.getElementById('card-backs-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-12 text-center text-void-muted uppercase text-[9px]"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading card backs...</div>';

    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/card-backs`, { credentials: 'include' });
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
            const uploadRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': csrfToken },
                body: formData,
                credentials: 'include'
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                const res = await fetch(`${BACKEND_URL}/api/creator/cards`, {
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
window.toggleBrandingEdit = toggleBrandingEdit;
window.fetchAdminLogs = fetchAdminLogs;
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
    initDashboard();
    setupCardFilters();
    setupBulkUpload();
});
