/**
 * layer-editor.js
 * Card Layer Editor + Editor Catalog
 * Depends on: BACKEND_URL, csrfToken, escapeHTML, showToast (all provided by app.js / dashboard.js)
 */

/* ─── Dynamic-script helpers (no-op when already defined by app.js) ─────── */

if (typeof loadScriptOnce === 'undefined') {
    window.loadScriptOnce = function loadScriptOnce(src) {
        return new Promise((resolve, reject) => {
            const scripts = document.querySelectorAll('script[data-dynamic-src]');
            for (const s of scripts) {
                if (s.getAttribute('data-dynamic-src') === src) {
                    if (s.getAttribute('data-loaded') === '1') { resolve(); return; }
                    s.addEventListener('load', () => resolve(), { once: true });
                    s.addEventListener('error', () => reject(new Error('Load failed: ' + src)), { once: true });
                    return;
                }
            }
            const el = document.createElement('script');
            el.src = src; el.async = true;
            el.setAttribute('data-dynamic-src', src);
            el.onload = () => { el.setAttribute('data-loaded', '1'); resolve(); };
            el.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(el);
        });
    };
}

if (typeof ensureSortableLoaded === 'undefined') {
    window.ensureSortableLoaded = async function () {
        if (typeof Sortable !== 'undefined') return;
        await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js');
    };
}

if (typeof ensureFabricLoaded === 'undefined') {
    window.ensureFabricLoaded = async function () {
        if (typeof fabric !== 'undefined') return;
        await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js');
    };
}

if (typeof scrollLock === 'undefined') {
    window.scrollLock = function () { document.body.style.overflow = 'hidden'; document.body.style.paddingRight = '8px'; };
    window.scrollUnlock = function () { document.body.style.overflow = ''; document.body.style.paddingRight = ''; };
}

/* ─── Editor Catalog ──────────────────────────────────────────────────────── */

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
        setList.innerHTML = sets.map(s => {
            const eid = escapeHTML(s.id);
            return `<button onclick="selectEditorSet('${eid}')" id="editor-set-item-${eid}"
                class="w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${editorCurrentSetId === s.id ? 'bg-void-accent/20 border-void-accent/40 text-void-accent' : 'bg-white/5 border-white/5 text-void-muted hover:bg-white/10 hover:border-white/10'}">
                <div class="flex items-center gap-3">
                    <i class="fa-solid ${s.is_active ? 'fa-box-open' : 'fa-box'} ${s.is_active ? 'text-void-accent' : 'text-void-muted'}"></i>
                    <div>
                        <div class="text-[11px] font-black uppercase tracking-tight ${editorCurrentSetId === s.id ? 'text-white' : 'group-hover:text-void-text'}">${escapeHTML(s.name || 'Untitled Set')}</div>
                        <div class="text-[9px] font-bold opacity-60">${escapeHTML(s.code || 'NO-CODE')}</div>
                    </div>
                </div>
                ${editorCurrentSetId === s.id ? '<i class="fa-solid fa-chevron-right text-xs"></i>' : ''}
            </button>`;
        }).join('');

        window._editorSets = sets;
        if (!editorCurrentSetId && sets.length > 0) {
            selectEditorSet(sets[0].id);
        } else if (editorCurrentSetId) {
            selectEditorSet(editorCurrentSetId);
        }
    } catch (e) {
        console.error('[Editor] Error loading sets:', e);
        setList.innerHTML = `<div class="text-center py-4 text-red-400 text-[10px] p-4">Error loading sets</div>`;
    }
}

function selectEditorSet(setId) {
    editorCurrentSetId = setId;
    document.querySelectorAll('[id^="editor-set-item-"]').forEach(el => {
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
    if (window._editorSets) {
        const set = window._editorSets.find(s => s.id === setId);
        if (set) {
            const t = document.getElementById('editor-current-set-title');
            if (t) t.textContent = set.name;
        }
    }
    loadEditorCards();
}

async function loadEditorCards() {
    const grid = document.getElementById('editor-card-grid');
    if (!grid) return;
    grid.innerHTML = `<div class="col-span-full py-12 flex flex-col items-center justify-center text-void-muted gap-4">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-void-accent"></i>
        <div class="text-[10px] font-black uppercase tracking-[0.3em]">Loading Cards...</div>
    </div>`;
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (!res.ok) throw new Error('API Error');
        const cards = await res.json();
        editorAllCards = cards.filter(c => c.set_id === editorCurrentSetId);
        const cc = document.getElementById('editor-card-count');
        if (cc) cc.textContent = `${editorAllCards.length} Cards`;
        renderEditorGrid(editorAllCards);
    } catch (e) {
        console.error('[Editor] Error loading cards:', e);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-500 font-black">Failed to load cards</div>`;
    }
}

function renderEditorGrid(cards) {
    const grid = document.getElementById('editor-card-grid');
    if (!grid) return;
    if (cards.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center space-y-4">
            <i class="fa-solid fa-inbox text-4xl text-white/5"></i>
            <div class="text-xs text-void-muted">This set is empty.</div>
        </div>`;
        return;
    }
    grid.innerHTML = cards.map(card => {
        const eid = escapeHTML(card.id);
        return `
        <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden group hover:border-void-accent/40 transition-all flex flex-col">
            <div class="aspect-[5/7] relative overflow-hidden bg-black/40">
                <img src="${escapeHTML(card.image_url || '')}" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" loading="lazy">
                <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div class="flex items-center justify-between">
                        <span class="text-[8px] font-black uppercase tracking-widest text-void-accent">${escapeHTML(card.rarity)}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black text-white"><i class="fa-solid fa-sword mr-1 opacity-60"></i>${parseInt(card.attack || 0)}</span>
                            <span class="text-[10px] font-black text-white"><i class="fa-solid fa-shield mr-1 opacity-60"></i>${parseInt(card.defense || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-3 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                    <div class="text-[11px] font-black uppercase text-white truncate mb-1">${escapeHTML(card.name || 'Unnamed')}</div>
                    <div class="text-[8px] text-void-muted uppercase font-bold">#${escapeHTML(card.card_number || '---')}</div>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="openLayerEditorForCard('${eid}')" title="Edit Art (Layer Editor)"
                        class="flex-1 py-2 bg-void-accent/10 text-void-accent hover:bg-void-accent hover:text-void-bg rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-pen-ruler"></i> Edit Art
                    </button>
                    ${card.foil_mask_url ? '<span title="Has foil mask" class="text-yellow-300 text-xs">✨</span>' : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ─── Layer Editor constants & state ─────────────────────────────────────── */

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

/* ─── Open / Close ───────────────────────────────────────────────────────── */

async function openCardLayerEditor(cardId, cardName, imageUrl, onSave, layerData) {
    _layerEditorCardId = cardId;
    _layerEditorOnSave = onSave;
    const title = document.getElementById('layer-editor-title');
    if (title) title.textContent = cardName || 'Card Editor';
    const el = document.getElementById('card-layer-editor');
    if (!el) { console.warn('[LayerEditor] #card-layer-editor not found in DOM'); return; }
    el.classList.remove('hidden');
    const nav = document.getElementById('app-navbar');
    if (nav) nav.classList.add('hidden');
    scrollLock();
    await ensureFabricLoaded();
    await ensureSortableLoaded();
    if (layerData) {
        await _initLayerFabricFromJson(layerData);
    } else {
        _initLayerFabric(imageUrl);
    }
    _initLayerEditorEvents();
}

function closeCardLayerEditor() {
    const el = document.getElementById('card-layer-editor');
    if (el) el.classList.add('hidden');
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

/* ─── Fabric init ────────────────────────────────────────────────────────── */

/**
 * Load an image URL through the img-proxy so it's served from the same
 * origin. This prevents the canvas from being "tainted" by cross-origin
 * pixels, which would block toDataURL() on save.
 */
async function _leLoadSafeImage(url) {
    // data: and blob: URLs are already same-origin — use directly
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }
    try {
        const proxyUrl = `/api/img-proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { credentials: 'include', cache: 'no-cache' });
        if (!res.ok) throw new Error('proxy failed');
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
            img.src = objectUrl;
        });
    } catch {
        // Fallback: direct load with crossOrigin (may still taint if server doesn't send CORS)
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url + (url.includes('?') ? '' : '?nocache=' + Date.now());
        });
    }
}

function _initLayerFabric(bgImageUrl) {
    if (_layerFabric) { _layerFabric.dispose(); _layerFabric = null; }
    const canvasEl = document.getElementById('layer-editor-canvas');
    if (!canvasEl) return;
    _layerFabric = new fabric.Canvas('layer-editor-canvas', {
        width: LAYER_EDITOR_W, height: LAYER_EDITOR_H,
        backgroundColor: '#1a1025', preserveObjectStacking: true, selection: true,
    });
    const area = document.getElementById('layer-editor-canvas-area');
    if (area) {
        const maxH = area.clientHeight - 48, maxW = area.clientWidth - 48;
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
        _lePushHistory(); _renderLayerList();
    });
    if (bgImageUrl) {
        _leLoadSafeImage(bgImageUrl).then(htmlImg => {
            if (!htmlImg || !_layerFabric) { _lePushHistory(); _renderLayerList(); return; }
            const fabricImg = new fabric.Image(htmlImg);
            const scale = Math.max(LAYER_EDITOR_W / htmlImg.naturalWidth, LAYER_EDITOR_H / htmlImg.naturalHeight);
            fabricImg.set({ left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
            // Store original CDN URL so _leExportLayerJson can write it back to JSON
            fabricImg.data = { layerName: 'Background', layerType: 'image', originalUrl: bgImageUrl };
            _layerFabric.add(fabricImg);
            _layerFabric.sendToBack(fabricImg);
            _layerFabric.renderAll();
            _lePushHistory(); _renderLayerList();
        });
    } else {
        _lePushHistory(); _renderLayerList();
    }
    setLayerEditorTool('select');
}

/**
 * Restore a Fabric canvas from previously saved layer JSON.
 * CDN image URLs are swapped for proxy URLs so the canvas stays clean.
 */
async function _initLayerFabricFromJson(layerDataJson) {
    if (_layerFabric) { _layerFabric.dispose(); _layerFabric = null; }
    const canvasEl = document.getElementById('layer-editor-canvas');
    if (!canvasEl) return;

    let json;
    try { json = typeof layerDataJson === 'string' ? JSON.parse(layerDataJson) : layerDataJson; }
    catch { _initLayerFabric(null); return; }

    // Replace external CDN URLs with proxy URLs before loading so Fabric
    // loads them from the same origin — canvas stays untainted.
    const proxied = JSON.parse(JSON.stringify(json));
    (proxied.objects || []).forEach(obj => {
        if (obj.type === 'image' && obj.src && !obj.src.startsWith('data:') && !obj.src.startsWith('blob:') && !obj.src.startsWith('/')) {
            // Keep originalUrl in data so we can write it back on export
            if (!obj.data) obj.data = {};
            if (!obj.data.originalUrl) obj.data.originalUrl = obj.src;
            obj.src = `/api/img-proxy?url=${encodeURIComponent(obj.src)}`;
        }
    });

    _layerFabric = new fabric.Canvas('layer-editor-canvas', {
        width: LAYER_EDITOR_W, height: LAYER_EDITOR_H,
        backgroundColor: proxied.background || '#1a1025',
        preserveObjectStacking: true, selection: true,
    });

    const area = document.getElementById('layer-editor-canvas-area');
    if (area) {
        const maxH = area.clientHeight - 48, maxW = area.clientWidth - 48;
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
        _lePushHistory(); _renderLayerList();
    });

    await new Promise(resolve => {
        _layerFabric.loadFromJSON(proxied, () => {
            _layerFabric.renderAll();
            resolve();
        });
    });

    setLayerEditorTool('select');
    _lePushHistory();
    _renderLayerList();
}

/**
 * Serialize the current canvas to JSON for storage.
 * Proxy URLs are replaced back with the original CDN URL stored in data.originalUrl,
 * so the JSON is portable and re-loadable.
 */
function _leExportLayerJson() {
    if (!_layerFabric) return null;
    const json = _layerFabric.toJSON(['data']);
    (json.objects || []).forEach(obj => {
        if (obj.type === 'image') {
            // Swap proxy or blob: src back to the real CDN URL
            if (obj.data?.originalUrl) {
                obj.src = obj.data.originalUrl;
            }
        }
    });
    return JSON.stringify(json);
}

function _initLayerEditorEvents() {
    const imgInput = document.getElementById('layer-editor-image-input');
    if (imgInput) {
        imgInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || !_layerFabric) return;
            e.target.value = '';

            // Upload immediately to R2 so the JSON stores a CDN URL (not a base64 blob)
            showToast('Uploading image…', 'loading');
            let imgUrl = null;
            try {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch(`${BACKEND_URL}/api/creator/upload`, {
                    method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd, credentials: 'include'
                });
                if (res.ok) { const d = await res.json(); imgUrl = d.url; }
            } catch { /* fall through to local data URL */ }

            if (imgUrl) {
                const safeImg = await _leLoadSafeImage(imgUrl);
                if (!safeImg || !_layerFabric) return;
                const fabricImg = new fabric.Image(safeImg);
                const scale = Math.min((LAYER_EDITOR_W * 0.85) / safeImg.naturalWidth, (LAYER_EDITOR_H * 0.85) / safeImg.naturalHeight, 1);
                fabricImg.set({ left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
                fabricImg.data = { layerName: file.name || 'Image', layerType: 'image', originalUrl: imgUrl };
                _layerFabric.add(fabricImg); _layerFabric.setActiveObject(fabricImg); _layerFabric.renderAll();
                _lePushHistory(); _renderLayerList();
            } else {
                // Fallback: local data URL (won't survive a re-open, but better than nothing)
                const reader = new FileReader();
                reader.onload = (evt) => {
                    fabric.Image.fromURL(evt.target.result, (img) => {
                        if (!img || !_layerFabric) return;
                        const scale = Math.min((LAYER_EDITOR_W * 0.85) / img.width, (LAYER_EDITOR_H * 0.85) / img.height, 1);
                        img.set({ left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
                        img.data = { layerName: file.name || 'Image', layerType: 'image' };
                        _layerFabric.add(img); _layerFabric.setActiveObject(img); _layerFabric.renderAll();
                        _lePushHistory(); _renderLayerList();
                    });
                };
                reader.readAsDataURL(file);
            }
        };
    }
    const stickerGrid = document.getElementById('layer-editor-sticker-grid');
    if (stickerGrid) {
        stickerGrid.innerHTML = LAYER_STICKERS.map(s =>
            `<button onclick="layerEditorAddSticker('${s}')" title="${s}"
                class="w-9 h-9 text-xl hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">${s}</button>`
        ).join('');
    }
    const keyHandler = (e) => {
        const el = document.getElementById('card-layer-editor');
        if (!el || el.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.key === 'Delete' || e.key === 'Backspace') layerEditorDeleteSelected();
        if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undoLayerEditor(); }
        if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redoLayerEditor(); }
        if (e.key === 'v' || e.key === 'V') setLayerEditorTool('select');
        if (e.key === 't' || e.key === 'T') setLayerEditorTool('text');
        if (e.key === 'd' || e.key === 'D') setLayerEditorTool('draw');
    };
    document.addEventListener('keydown', keyHandler);
    const el = document.getElementById('card-layer-editor');
    if (el) {
        if (el._leKeyHandler) document.removeEventListener('keydown', el._leKeyHandler);
        el._leKeyHandler = keyHandler;
    }
}

/* ─── Tools ──────────────────────────────────────────────────────────────── */

window.setLayerEditorTool = function (tool) {
    _layerCurrentTool = tool;
    const c = _layerFabric;
    if (!c) return;
    document.querySelectorAll('.layer-editor-tool-btn').forEach(b => b.classList.remove('le-active'));
    const btn = document.getElementById(`layer-tool-${tool}`);
    if (btn) btn.classList.add('le-active');
    if (_layerTextClickHandler) { c.off('mouse:down', _layerTextClickHandler); _layerTextClickHandler = null; }
    c.isDrawingMode = false;
    c.selection = (tool === 'select');
    c.defaultCursor = tool === 'text' ? 'text' : 'default';
    c.forEachObject(obj => { obj.selectable = (tool === 'select'); obj.evented = (tool !== 'draw'); });
    if (tool === 'draw') {
        c.isDrawingMode = true;
        if (!c.freeDrawingBrush) c.freeDrawingBrush = new fabric.PencilBrush(c);
        c.freeDrawingBrush.color = '#ffffff';
        c.freeDrawingBrush.width = 6;
        const propsEl = document.getElementById('layer-editor-props-content');
        if (propsEl) propsEl.innerHTML = _leBrushPropsHTML();
    }
    if (tool === 'text') {
        _layerTextClickHandler = (opt) => {
            if (opt.target) return;
            const p = c.getPointer(opt.e);
            const t = new fabric.IText('Edit me', { left: p.x, top: p.y, fontFamily: 'Arial', fontSize: 40, fill: '#ffffff', stroke: '#000000', strokeWidth: 1, fontWeight: 'bold' });
            t.data = { layerName: 'Text', layerType: 'text' };
            c.add(t); c.setActiveObject(t); c.renderAll();
            t.enterEditing(); t.selectAll();
            setLayerEditorTool('select');
            _lePushHistory(); _renderLayerList();
        };
        c.on('mouse:down', _layerTextClickHandler);
    }
    c.renderAll();
};

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
    _layerFabric.add(shape); _layerFabric.setActiveObject(shape); _layerFabric.renderAll();
    _lePushHistory(); _renderLayerList();
    setLayerEditorTool('select');
};

window.layerEditorAddSticker = function (emoji) {
    if (!_layerFabric) return;
    const t = new fabric.Text(emoji, { left: LAYER_EDITOR_W / 2, top: LAYER_EDITOR_H / 2, originX: 'center', originY: 'center', fontSize: 80 });
    t.data = { layerName: emoji + ' Sticker', layerType: 'sticker' };
    _layerFabric.add(t); _layerFabric.setActiveObject(t); _layerFabric.renderAll();
    _lePushHistory(); _renderLayerList();
    const sp = document.getElementById('layer-editor-sticker-picker');
    if (sp) sp.classList.add('hidden');
    setLayerEditorTool('select');
};

window.toggleLayerEditorStickerPicker = function () {
    const sp = document.getElementById('layer-editor-sticker-picker');
    if (sp) sp.classList.toggle('hidden');
};

window.layerEditorDeleteSelected = function () {
    const c = _layerFabric;
    if (!c) return;
    const objs = c.getActiveObjects();
    if (!objs.length) return;
    c.discardActiveObject();
    objs.forEach(o => c.remove(o));
    c.renderAll();
    _lePushHistory(); _renderLayerList();
};

/* ─── History ────────────────────────────────────────────────────────────── */

function _lePushHistory() {
    if (_layerHistoryPaused || !_layerFabric) return;
    const json = JSON.stringify(_layerFabric.toJSON(['data']));
    _layerHistory.splice(_layerHistoryIdx + 1);
    _layerHistory.push(json);
    if (_layerHistory.length > 60) _layerHistory.shift(); else _layerHistoryIdx++;
}

window.undoLayerEditor = function () {
    if (_layerHistoryIdx <= 0 || !_layerFabric) return;
    _layerHistoryIdx--;
    _layerHistoryPaused = true;
    _layerFabric.loadFromJSON(_layerHistory[_layerHistoryIdx], () => { _layerFabric.renderAll(); _layerHistoryPaused = false; _renderLayerList(); });
};

window.redoLayerEditor = function () {
    if (_layerHistoryIdx >= _layerHistory.length - 1 || !_layerFabric) return;
    _layerHistoryIdx++;
    _layerHistoryPaused = true;
    _layerFabric.loadFromJSON(_layerHistory[_layerHistoryIdx], () => { _layerFabric.renderAll(); _layerHistoryPaused = false; _renderLayerList(); });
};

/* ─── Layer list ─────────────────────────────────────────────────────────── */

function _renderLayerList() { void _renderLayerListAsync(); }

async function _renderLayerListAsync() {
    await ensureSortableLoaded();
    const list = document.getElementById('layer-editor-layer-list');
    if (!list || !_layerFabric) return;
    const objects = [..._layerFabric.getObjects()].reverse();
    if (objects.length === 0) { list.innerHTML = '<div class="text-white/20 text-[10px] px-2 py-1">No layers yet</div>'; return; }
    const activeObjs = _layerFabric.getActiveObjects();
    const typeIcon = (t) => ({ text: 'fa-t', sticker: 'fa-face-smile', rect: 'fa-square', circle: 'fa-circle', path: 'fa-pen-nib', image: 'fa-image' })[t] || 'fa-layer-group';
    list.innerHTML = objects.map((obj, i) => {
        const fabricIdx = objects.length - 1 - i;
        const name = obj.data?.layerName || `Layer ${i + 1}`;
        const type = obj.data?.layerType || obj.type || '';
        const isSelected = activeObjs.includes(obj);
        const isHidden = !obj.visible;
        const isShiny = !!obj.data?.shiny;
        return `<div class="le-layer-row${isSelected ? ' le-selected' : ''}" onclick="_leSelectLayer(${fabricIdx})" data-le-idx="${fabricIdx}">
            <i class="fa-solid fa-grip-dots-vertical le-drag-handle"></i>
            <i class="fa-solid ${typeIcon(type)} text-[8px] opacity-50 shrink-0"></i>
            <span class="flex-1 truncate">${name}</span>
            <button title="${isShiny ? 'Remove shine' : 'Add shine to this layer'}" class="le-vis-btn${isShiny ? ' text-yellow-300' : ' opacity-40'}" onclick="event.stopPropagation();_leToggleShiny(${fabricIdx})">✨</button>
            <button class="le-vis-btn" onclick="event.stopPropagation();_leToggleVis(${fabricIdx})"><i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
        </div>`;
    }).join('');
    if (_layerSortable) _layerSortable.destroy();
    _layerSortable = Sortable.create(list, {
        animation: 120, handle: '.le-drag-handle',
        onEnd: (evt) => {
            if (!_layerFabric) return;
            const total = _layerFabric.getObjects().length;
            const oldFabricIdx = total - 1 - evt.oldIndex;
            const newFabricIdx = total - 1 - evt.newIndex;
            const obj = _layerFabric.getObjects()[oldFabricIdx];
            if (obj) { _layerFabric.moveTo(obj, newFabricIdx); _layerFabric.renderAll(); _lePushHistory(); _renderLayerList(); }
        }
    });
}

window._leSelectLayer = function (fabricIdx) {
    if (!_layerFabric) return;
    const objs = _layerFabric.getObjects();
    if (fabricIdx >= 0 && fabricIdx < objs.length) {
        _layerFabric.setActiveObject(objs[fabricIdx]); _layerFabric.renderAll();
        _renderPropsPanel(objs[fabricIdx]); _renderLayerList();
    }
};

window._leToggleVis = function (fabricIdx) {
    if (!_layerFabric) return;
    const obj = _layerFabric.getObjects()[fabricIdx];
    if (obj) { obj.visible = !obj.visible; _layerFabric.renderAll(); _renderLayerList(); }
};

window._leToggleShiny = function (fabricIdx) {
    if (!_layerFabric) return;
    const obj = _layerFabric.getObjects()[fabricIdx];
    if (!obj) return;
    if (!obj.data) obj.data = {};
    obj.data.shiny = !obj.data.shiny;
    _lePushHistory(); _renderLayerList();
};

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

/* ─── Properties panel ───────────────────────────────────────────────────── */

function _renderPropsPanel(obj) {
    const panel = document.getElementById('layer-editor-props-content');
    if (!panel || !obj) return;
    const type = obj.data?.layerType || obj.type || '';
    let html = '';
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
                ${['Arial','Georgia','Impact','Courier New','Verdana','Trebuchet MS','Times New Roman','Palatino','Garamond','Comic Sans MS'].map(f =>
                    `<option value="${f}" ${(obj.fontFamily||'Arial')===f?'selected':''}>${f}</option>`).join('')}
            </select>
        </div>
        <div class="le-prop-btn-row">
            <button class="${obj.fontWeight==='bold'?'le-active-prop':''}" onclick="_leToggleProp('fontWeight','bold','normal');this.classList.toggle('le-active-prop')"><b>B</b></button>
            <button class="${obj.fontStyle==='italic'?'le-active-prop':''}" onclick="_leToggleProp('fontStyle','italic','normal');this.classList.toggle('le-active-prop')"><i>I</i></button>
            <button class="${obj.underline?'le-active-prop':''}" onclick="_leToggleProp('underline',true,false);this.classList.toggle('le-active-prop')"><u>U</u></button>
        </div>`;
    }
    if (type === 'rect' || type === 'circle' || obj.type === 'rect' || obj.type === 'circle') {
        html += `<div class="le-prop-row">
            <label class="le-prop-label">Fill Color</label>
            <input type="color" value="${_leColorHex(obj.fill,'#6432c8')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('fill', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Color</label>
            <input type="color" value="${_leColorHex(obj.stroke,'#a855f7')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('stroke', this.value)">
        </div>
        <div class="le-prop-row">
            <label class="le-prop-label">Stroke Width</label>
            <input type="range" min="0" max="30" value="${obj.strokeWidth ?? 2}" oninput="_leSetProp('strokeWidth', parseInt(this.value))">
        </div>`;
    }
    if (type === 'path' || obj.type === 'path') {
        html += `<div class="le-prop-row">
            <label class="le-prop-label">Stroke Color</label>
            <input type="color" value="${_leColorHex(obj.stroke,'#ffffff')}" style="width:100%;height:32px;border-radius:8px" oninput="_leSetProp('stroke', this.value)">
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
    _layerFabric.freeDrawingBrush.color = mode === 'eraser' ? (_layerFabric.backgroundColor || '#1a1025') : '#ffffff';
    document.querySelectorAll('.le-prop-btn-row button').forEach(b => b.classList.remove('le-active-prop'));
    event?.target?.classList?.add('le-active-prop');
};

window._leSetProp = function (prop, value) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value); _layerFabric.renderAll();
};

window._leToggleProp = function (prop, onVal, offVal) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(prop, obj[prop] === onVal ? offVal : onVal); _layerFabric.renderAll();
};

window._leFlip = function (axis) {
    const obj = _layerFabric?.getActiveObject();
    if (!obj) return;
    obj.set(axis === 'X' ? 'flipX' : 'flipY', !obj[axis === 'X' ? 'flipX' : 'flipY']);
    _layerFabric.renderAll(); _lePushHistory();
};

function _leColorHex(color, fallback) {
    if (!color || typeof color !== 'string') return fallback;
    if (color.startsWith('#') && (color.length === 4 || color.length === 7)) return color;
    return fallback;
}

/* ─── Foil mask export ───────────────────────────────────────────────────── */

/**
 * Build a pixel-precise greyscale foil mask.
 * Hides every non-shiny layer, renders only shiny layers,
 * then converts each pixel's alpha → brightness so the shader
 * knows exactly which pixels get shine.
 * Must be called while the canvas is at 1:1 zoom (full res).
 */
function _buildFoilMaskBlob() {
    if (!_layerFabric) return null;
    const objects = _layerFabric.getObjects();
    const shinyLayers = objects.filter(o => o.data?.shiny && o.visible !== false);
    if (shinyLayers.length === 0) return null;

    // Snapshot visibility, then hide every non-shiny layer
    const saved = objects.map(o => o.visible);
    objects.forEach(o => { o.visible = !!(o.data?.shiny && o.visible !== false); });
    _layerFabric.renderAll();

    // Export shiny-only render as PNG (preserves alpha)
    const shinyDataUrl = _layerFabric.toDataURL({ format: 'png', multiplier: 1 });

    // Restore original visibility
    objects.forEach((o, i) => { o.visible = saved[i]; });
    _layerFabric.renderAll();

    // Convert the shiny-only render: alpha channel → white, no-alpha → black
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width = LAYER_EDITOR_W;
            offscreen.height = LAYER_EDITOR_H;
            const ctx = offscreen.getContext('2d');

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, LAYER_EDITOR_W, LAYER_EDITOR_H);
            ctx.drawImage(img, 0, 0, LAYER_EDITOR_W, LAYER_EDITOR_H);

            // Replace every pixel: brightness = alpha of drawn pixel
            const id = ctx.getImageData(0, 0, LAYER_EDITOR_W, LAYER_EDITOR_H);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const a = d[i + 3];
                d[i] = a;       // R = alpha
                d[i + 1] = a;   // G = alpha
                d[i + 2] = a;   // B = alpha
                d[i + 3] = 255; // fully opaque
            }
            ctx.putImageData(id, 0, 0);
            offscreen.toBlob(resolve, 'image/png');
        };
        img.src = shinyDataUrl;
    });
}

/* ─── Save ───────────────────────────────────────────────────────────────── */

window.saveLayerEditor = async function () {
    if (!_layerFabric) return;
    const btn = document.getElementById('layer-editor-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
        const currentZoom = _layerFabric.getZoom();
        _layerFabric.setZoom(1);
        _layerFabric.setWidth(LAYER_EDITOR_W); _layerFabric.setHeight(LAYER_EDITOR_H);
        _layerFabric.renderAll();

        // Export flat JPEG for display + foil mask + layer JSON for re-editing
        const dataUrl = _layerFabric.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 });
        const maskBlob = await _buildFoilMaskBlob();
        const layerJson = _leExportLayerJson();

        _layerFabric.setZoom(currentZoom);
        const area = document.getElementById('layer-editor-canvas-area');
        if (area) {
            const maxH = area.clientHeight - 48, maxW = area.clientWidth - 48;
            const scale = Math.min(1, maxW / LAYER_EDITOR_W, maxH / LAYER_EDITOR_H);
            _layerFabric.setWidth(LAYER_EDITOR_W * scale); _layerFabric.setHeight(LAYER_EDITOR_H * scale);
        }
        _layerFabric.renderAll();

        const blob = await (await fetch(dataUrl)).blob();
        if (_layerEditorOnSave) await _layerEditorOnSave(blob, maskBlob, layerJson);
        closeCardLayerEditor();
    } catch (err) {
        console.error('[LayerEditor] Save failed:', err);
        showToast(err.message || 'Save failed', 'error');
        if (btn) { btn.textContent = 'Save Card Art'; btn.disabled = false; }
    }
};

async function _leUploadAndPatchCard(cardId, blob, maskBlob, layerJson) {
    showToast('Uploading art…', 'loading');
    const formData = new FormData();
    formData.append('file', blob, 'card-art.jpg');
    const uploadRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
        method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: formData, credentials: 'include'
    });
    if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
    }
    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.url;
    if (!imageUrl) throw new Error('Upload response missing URL');

    let foilMaskUrl = null;
    if (maskBlob) {
        const maskForm = new FormData();
        maskForm.append('file', maskBlob, 'foil-mask.png');
        const maskRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: maskForm, credentials: 'include'
        });
        if (maskRes.ok) { const { url } = await maskRes.json(); foilMaskUrl = url; }
    }

    const patchBody = { id: cardId, image_url: imageUrl };
    if (foilMaskUrl !== null) patchBody.foil_mask_url = foilMaskUrl;
    if (layerJson) patchBody.layer_data = layerJson;
    const patchRes = await fetch(`${BACKEND_URL}/api/creator/cards`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(patchBody), credentials: 'include'
    });
    if (!patchRes.ok) {
        const errData = await patchRes.json().catch(() => ({}));
        throw new Error(errData.error || `Save failed (${patchRes.status})`);
    }
    showToast('Card art saved!', 'success');
    if (editorCurrentSetId) loadEditorCards();
}

window.openLayerEditorForCard = async function (cardId) {
    const card = editorAllCards.find(c => c.id === cardId);
    if (!card) return;
    // Pass existing layer_data so the editor can restore layers for further editing
    await openCardLayerEditor(cardId, card.name, card.image_url || null, async (blob, maskBlob, layerJson) => {
        await _leUploadAndPatchCard(cardId, blob, maskBlob, layerJson);
    }, card.layer_data || null);
};

/* ─── Export catalog functions for dashboard use ─────────────────────────── */

window.renderEditorView = renderEditorView;
window.selectEditorSet = selectEditorSet;
window.loadEditorCards = loadEditorCards;
window.closeCardLayerEditor = closeCardLayerEditor;
