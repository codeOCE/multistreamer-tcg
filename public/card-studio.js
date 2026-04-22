/**
 * card-studio.js — Unified Card Creation Studio
 * Depends on inline utilities in card-studio.html (BACKEND_URL, showToast, escapeHTML, loadScriptOnce, ensureSortableLoaded)
 */

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CS_W = 500, CS_H = 700;

const CS_GOOGLE_FONTS = [
    { name: 'Bebas Neue',       category: 'Display'      },
    { name: 'Rajdhani',         category: 'Display'      },
    { name: 'Teko',             category: 'Display'      },
    { name: 'Anton',            category: 'Display'      },
    { name: 'Orbitron',         category: 'Sci-Fi'       },
    { name: 'Exo 2',            category: 'Sci-Fi'       },
    { name: 'Audiowide',        category: 'Sci-Fi'       },
    { name: 'Cinzel',           category: 'Fantasy'      },
    { name: 'Uncial Antiqua',   category: 'Fantasy'      },
    { name: 'IM Fell English',  category: 'Fantasy'      },
    { name: 'Press Start 2P',   category: 'Gaming'       },
    { name: 'VT323',            category: 'Gaming'       },
    { name: 'Boogaloo',         category: 'Gaming'       },
    { name: 'Space Grotesk',    category: 'Sans-Serif'   },
    { name: 'Outfit',           category: 'Sans-Serif'   },
    { name: 'Inter',            category: 'Sans-Serif'   },
    { name: 'Nunito',           category: 'Sans-Serif'   },
    { name: 'Playfair Display', category: 'Serif'        },
    { name: 'Merriweather',     category: 'Serif'        },
    { name: 'Lora',             category: 'Serif'        },
    { name: 'Pacifico',         category: 'Handwriting'  },
    { name: 'Dancing Script',   category: 'Handwriting'  },
    { name: 'Caveat',           category: 'Handwriting'  },
    { name: 'Roboto Mono',      category: 'Monospace'    },
    { name: 'Fira Code',        category: 'Monospace'    },
    { name: 'JetBrains Mono',   category: 'Monospace'    },
];

/* ─── Shape Catalog ─────────────────────────────────────────────────────── */
function _csPoly(cx, cy, outerR, n, innerR) {
    const pts = [], step = (2 * Math.PI) / n, start = -Math.PI / 2;
    for (let i = 0; i < n; i++) {
        const a = start + i * step;
        const r = (innerR !== undefined && i % 2 === 1) ? innerR : outerR;
        pts.push({ x: +(cx + r * Math.cos(a)).toFixed(1), y: +(cy + r * Math.sin(a)).toFixed(1) });
    }
    return pts;
}

function _csSvgIcon(id) {
    const s = 'stroke="currentColor" stroke-width="1.5" fill="none"';
    const pts = (n, r, ir) => _csPoly(15, 15, r, n, ir).map(p => `${p.x},${p.y}`).join(' ');
    switch (id) {
        case 'rect':        return `<rect x="3" y="3" width="24" height="24" ${s}/>`;
        case 'circle':      return `<circle cx="15" cy="15" r="12" ${s}/>`;
        case 'roundrect':   return `<rect x="3" y="6" width="24" height="18" rx="5" ${s}/>`;
        case 'triangle':    return `<polygon points="15,3 27,27 3,27" ${s}/>`;
        case 'diamond':     return `<polygon points="15,2 28,15 15,28 2,15" ${s}/>`;
        case 'rtriangle':   return `<polygon points="3,3 27,27 3,27" ${s}/>`;
        case 'pentagon':    return `<polygon points="${pts(5,12)}" ${s}/>`;
        case 'star5':       return `<polygon points="${pts(10,13,5)}" ${s}/>`;
        case 'starburst':   return `<polygon points="${pts(16,13,9)}" ${s}/>`;
        case 'star6':       return `<polygon points="${pts(12,13,6)}" ${s}/>`;
        case 'arrow':       return `<path d="M2,11 L18,11 L18,5 L28,15 L18,25 L18,19 L2,19 Z" ${s}/>`;
        case 'doublearrow': return `<path d="M2,15 L8,7 L8,12 L22,12 L22,7 L28,15 L22,23 L22,18 L8,18 L8,23 Z" ${s}/>`;
        case 'heart':       return `<path d="M15,25 C5,18 1,12 3,7 Q6,1 11,3 Q13,4 15,8 Q17,4 19,3 Q24,1 27,7 C29,12 25,18 15,25 Z" ${s}/>`;
        case 'cloud':       return `<path d="M8,22 Q2,22 2,16 Q2,10 8,10 Q8,4 14,3 Q19,0 23,4 Q27,2 28,8 Q30,10 28,16 Q28,22 22,21 Z" ${s}/>`;
        case 'moon':        return `<path d="M20,5 A11,11,0,1,0,20,25 A7,10,0,1,1,20,5 Z" ${s}/>`;
        case 'speech':      return `<path d="M3,3 L27,3 Q27,3 27,7 L27,19 Q27,22 24,22 L14,22 L9,27 L10,22 L6,22 Q3,22 3,19 L3,7 Z" ${s}/>`;
        case 'droplet':     return `<path d="M15,2 C10,8 3,14 3,19 A12,11,0,0,0,27,19 C27,14 20,8 15,2 Z" ${s}/>`;
        case 'plus':        return `<path d="M12,3 L18,3 L18,12 L27,12 L27,18 L18,18 L18,27 L12,27 L12,18 L3,18 L3,12 L12,12 Z" ${s}/>`;
        case 'hexagon':     return `<polygon points="${pts(6,12)}" ${s}/>`;
        case 'line':        return `<line x1="3" y1="15" x2="27" y2="15" ${s}/>`;
        default:            return `<rect x="3" y="3" width="24" height="24" ${s}/>`;
    }
}

const _CS_SHAPE_CATALOG = [
    { id: 'rect',        label: 'Rectangle',    drag: true  },
    { id: 'circle',      label: 'Circle',        drag: true  },
    { id: 'roundrect',   label: 'Round Rect',    drag: false },
    { id: 'triangle',    label: 'Triangle',      drag: true  },
    { id: 'diamond',     label: 'Diamond',       drag: false },
    { id: 'rtriangle',   label: 'Rt. Triangle',  drag: false },
    { id: 'pentagon',    label: 'Pentagon',      drag: false },
    { id: 'star5',       label: 'Star',          drag: false },
    { id: 'starburst',   label: 'Starburst',     drag: false },
    { id: 'star6',       label: '6-pt Star',     drag: false },
    { id: 'arrow',       label: 'Arrow',         drag: false },
    { id: 'doublearrow', label: 'Double Arrow',  drag: false },
    { id: 'heart',       label: 'Heart',         drag: false },
    { id: 'cloud',       label: 'Cloud',         drag: false },
    { id: 'moon',        label: 'Crescent',      drag: false },
    { id: 'speech',      label: 'Speech Bubble', drag: false },
    { id: 'droplet',     label: 'Droplet',       drag: false },
    { id: 'plus',        label: 'Plus',          drag: false },
    { id: 'hexagon',     label: 'Hexagon',       drag: false },
    { id: 'line',        label: 'Line',          drag: true  },
];

/* ─── State ─────────────────────────────────────────────────────────────── */
let _csCanvas = null;
let _csHistory = [], _csHistoryIdx = -1, _csHistoryPaused = false;
let _csHasUnsavedChanges = false;
let _csTool = 'select';
let _csLastTool = 'select';
let _csTextClickHandler = null;
let _csHandlers = {};          // canvas event refs for hand tool
let _csCsrfToken = null;
let _csSets = [], _csTemplates = [], _csMechanics = [];
let _csPreviewTraitIdx = 0;
const _csTraitImgCache = new Map(); // URL → HTMLImageElement, persists for session
let _csTraitRenderData = null;      // data snapshot drawn by _csDrawTraitOverlay each frame
let _csLibImages = [];
let _csCanvasBgTransparent = true;
let _csZoom = 1.0;
let _csGridVisible = false;
let _csSnapEnabled = true;
let _csGridSize = 10;
let _csTraitOverlayVisible = false;
let _csLoadedFonts = new Set(['Space Grotesk', 'Outfit']); // pre-loaded via HTML
let _csPendingLayer = null; // virtual layer waiting for first stroke
let _csLayerSortable = null;
let _csBrushColor   = '#00f2fe';
let _csBrushSize    = 6;
let _csBrushOpacity = 1.0;
let _csBrushMode    = 'pencil'; // 'pencil' | 'dodge' | 'burn' | 'blur'
let _csPaintBrushHistoryT = null;
let _csPaintEditMode      = false;  // true while individual stroke editing is active
let _csPaintEditGroupData = null;   // saved metadata of the group being edited
let _csEraserPaintTarget  = null;   // selected paint layer when erasing vector strokes
const _csExpandedGroups   = new Set(); // fabric indices of expanded group layers

// Lasso
let _csLassoPts     = [];       // [{x,y}] screen-space polygon points
let _csLassoActive  = false;

// Measure
let _csMeasureStart = null;     // {x, y} canvas coords
let _csMeasureActive = false;

// Slice
let _csSliceRect    = null;     // {left, top, width, height} canvas coords
let _csSliceOrigin  = null;
let _csSliceActive  = false;

// Pivot
let _csPivotActive  = false;

// Focus Mode
let _csFocusMode    = false;
let _csFocusOpacities = new Map(); // objId → original opacity

/* ─── Script loading ─────────────────────────────────────────────────────── */
async function _csEnsureFabric() {
    if (typeof fabric === 'undefined') {
        await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js');
    }
    if (typeof fabric !== 'undefined') _csApplyFabricDefaults();
}

function _csApplyFabricDefaults() {
    if (typeof fabric === 'undefined') return;
    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: '#00f2fe',
        cornerStyle: 'circle',
        cornerSize: 8,
        borderColor: '#00f2fe',
        borderDashArray: [3, 3],
        padding: 4,
        selectionBackgroundColor: 'transparent',
    });
}

/* ─── Safe image loader (avoids canvas taint) ───────────────────────────── */
async function _csLoadSafeImage(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return new Promise(resolve => {
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
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
            img.src = objectUrl;
        });
    } catch {
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url + (url.includes('?') ? '' : '?nocache=' + Date.now());
        });
    }
}

function _csColorHex(color, fallback) {
    if (!color || typeof color !== 'string') return fallback;
    if (color.startsWith('#') && (color.length === 4 || color.length === 7)) return color;
    return fallback;
}

/* ─── CSRF refresh ───────────────────────────────────────────────────────── */
async function _csRefreshCsrf() {
    try {
        const r = await fetch(`${BACKEND_URL}/api/csrf`, { credentials: 'include' });
        if (r.ok) { const d = await r.json(); if (d.token) _csCsrfToken = d.token; }
    } catch {}
}

/* ─── Stat field math evaluator ──────────────────────────────────────────── */
function _csEvalStat(expr) {
    const s = String(expr).replace(/[^0-9+\-*/.() ]/g, '').trim();
    if (!s) return 0;
    try {
        const v = Function('"use strict"; return (' + s + ')')();
        if (typeof v !== 'number' || !isFinite(v)) return 0;
        return Math.max(0, Math.min(9999, Math.round(v)));
    } catch { return 0; }
}

window.csCommitStat = function(el) {
    el.value = _csEvalStat(el.value);
};

/* ─── Bootstrap ──────────────────────────────────────────────────────────── */
async function initStudio() {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('id');

    // Auth + CSRF
    try {
        const res = await fetch(`${BACKEND_URL}/api/v2/bootstrap?lite=1`, { credentials: 'include' });
        if (!res.ok) { window.location.href = '/dashboard.html'; return; }
        const data = await res.json();
        if (!data.user || !data.user.is_creator) { 
            window.location.href = '/dashboard.html'; 
            return; 
        }
        _csCsrfToken = data.csrf_token || null;
    } catch {
        window.location.href = '/dashboard.html';
        return;
    }

    // Kick off font preload immediately — runs in background while data loads
    _csPreloadAllFonts();

    // Parallel data loads
    const [sets, templates, mechanics] = await Promise.all([
        fetch(`${BACKEND_URL}/api/creator/sets`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BACKEND_URL}/api/creator/templates`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BACKEND_URL}/api/mechanics`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    _csSets = sets;
    _csTemplates = templates;
    _csMechanics = Array.isArray(mechanics) ? mechanics : (mechanics.mechanics || []);

    _csPopulateSetDropdown();
    _csPopulateTemplateDropdown();
    _csPopulateZoneTemplateSel();
    _csPopulateZoneFontSelects();
    _csRenderFontList('');
    _csRefreshLibrary();
    // Populate frame swapper after templates are loaded
    requestAnimationFrame(_csRenderFrameGrid);

    // Load Fabric + Sortable
    await _csEnsureFabric();
    await ensureSortableLoaded();

    // Load existing card if editing
    let existingCard = null;
    if (cardId) {
        try {
            const r = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
            if (r.ok) {
                const cards = await r.json();
                existingCard = cards.find(c => c.id === cardId) || null;
            }
        } catch {}
        if (existingCard) _csPopulateForm(existingCard);
    }

    if (existingCard?.layer_data) {
        await _csInitFromJson(existingCard.layer_data);
    } else {
        _csInitCanvas(existingCard?.image_url || null);
    }

    _csWireDropZone();
    document.addEventListener('keydown', _csKeyHandler);
    document.addEventListener('keyup', _csKeyOffHandler);
    document.addEventListener('paste', _csPasteHandler);

    const _csResizeObs = new ResizeObserver(() => { if (_csCanvas) _csScaleCanvas(); });
    const _csArea = document.getElementById('cs-canvas-area');
    if (_csArea) _csResizeObs.observe(_csArea);
    window.addEventListener('resize', () => { if (_csCanvas) _csScaleCanvas(); });

    document.getElementById('cs-loading').classList.add('hidden');
    document.getElementById('cs-layout').classList.remove('hidden');
    requestAnimationFrame(() => { if (_csCanvas) _csScaleCanvas(); });
    // Upgrade all static color inputs to void picker
    requestAnimationFrame(() => _csUpgradeColorInputs(document.getElementById('cs-left')));

    // Session Recovery check
    setTimeout(_csCheckSessionRecovery, 1000);
    // Local auto-save every 60s
    setInterval(_csAutoSaveToLocal, 60000);
    // Server draft sync every 2 minutes
    setInterval(_csAutoSaveDraft, 120000);

    window.addEventListener('beforeunload', e => {
        if (_csHasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

/* ─── Trait Zone ─────────────────────────────────────────────────────────── */

// Cached image loader — avoids proxy re-fetch on every zone drag event
async function _csLoadTraitImage(url) {
    if (_csTraitImgCache.has(url)) return _csTraitImgCache.get(url);
    const img = await _csLoadSafeImage(url);
    if (img) _csTraitImgCache.set(url, img);
    return img;
}


function _csPopulateZoneFontSelects() {
    const fontOptions = CS_GOOGLE_FONTS.map(f =>
        `<option value="${escapeHTML(f.name)}">${escapeHTML(f.name)}</option>`
    ).join('');
    ['cs-tz-namefont', 'cs-tz-descfont'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = fontOptions;
    });
}

function _csPopulateZoneTemplateSel() {
    const sel = document.getElementById('cs-tz-tmpl-sel');
    if (!sel) return;
    const withZone = _csTemplates.filter(t => t.trait_area || (t.layer_data && t.layer_data.includes('isTraitZone')));
    sel.innerHTML = '<option value="">— select template —</option>' +
        withZone.map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join('');
    // Also add all templates as fallback if none have zone data
    if (withZone.length === 0) {
        sel.innerHTML = '<option value="">— select template —</option>' +
            _csTemplates.map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join('');
    }
}

window.csAddTraitZone = function() {
    if (!_csCanvas) return;
    const existing = _csCanvas.getObjects().find(o => o.data?.isTraitZone);
    if (existing) _csCanvas.remove(existing);

    const zone = new fabric.Rect({
        left: CS_W / 2 - 210,
        top: CS_H - 165,
        width: 420,
        height: 148,
        fill: 'rgba(0,242,254,0.04)',
        stroke: 'rgba(0,242,254,0.55)',
        strokeWidth: 1.5,
        strokeDashArray: [5, 4],
        rx: 6, ry: 6,
    });
    zone.setControlsVisibility({ mtr: false });
    zone.data = { layerName: 'Trait Zone', layerType: 'rect', isTraitZone: true };

    _csCanvas.add(zone);
    _csCanvas.setActiveObject(zone);
    _csCanvas.renderAll();

    const panel = document.getElementById('cs-tz-panel');
    if (panel) panel.style.display = 'block';

    csUpdateTraitZonePreview();
    _csPushHistory();
    _csRenderLayerList();
    csTool('select');
};

/* Updates render state — actual drawing happens in _csDrawTraitOverlay via after:render */
window.csUpdateTraitZonePreview = async function() {
    if (!_csCanvas) return;
    const tzObj = _csCanvas.getObjects().find(o => o.data?.isTraitZone);
    if (!tzObj) { _csTraitRenderData = null; return; }

    // Read controls
    const iconSize    = parseInt(document.getElementById('cs-tz-iconsize')?.value) || 28;
    const nameSize    = parseInt(document.getElementById('cs-tz-namesize')?.value) || 20;
    const descSize    = parseInt(document.getElementById('cs-tz-descsize')?.value) || 11;
    const fontColor   = document.getElementById('cs-tz-color')?.value              || '#ffffff';
    const align       = document.getElementById('cs-tz-align')?.value              || 'center';
    const isGenesis   = document.getElementById('cs-tz-genesis')?.checked          || false;
    const displayMode = document.getElementById('cs-tz-displaymode')?.value        || 'full';
    const nameFont    = document.getElementById('cs-tz-namefont')?.value           || 'Space Grotesk';
    const descFont    = document.getElementById('cs-tz-descfont')?.value           || 'Space Grotesk';

    const showIcon = displayMode !== 'name_desc' && displayMode !== 'name_only';
    const showName = displayMode !== 'icon_only';
    const showDesc = displayMode === 'full' || displayMode === 'name_desc';

    Object.assign(tzObj.data, { iconSize, nameSize, descSize, fontColor, textAlign: align, showGenesis: isGenesis, displayMode, nameFont, descFont });

    const primaryTrait = _csMechanics.find(m => (m.display_name || m.name || '').toLowerCase() === 'guard')
        || _csMechanics[0]
        || { display_name: 'Guard', icon: '🛡️', description: 'Reduce incoming damage by 10.' };
    const GENESIS_ICON_URL = 'https://cdn.codeoce.com/traits/Genesis-Icon.png';
    const iconSrc = primaryTrait.icon || '';
    const isIconUrl = iconSrc.startsWith('http') || iconSrc.startsWith('/');

    // Seed render data immediately with whatever is already cached
    _csTraitRenderData = {
        displayMode, align, isGenesis, showIcon, showName, showDesc,
        iconSize, nameSize, descSize, fontColor, nameFont, descFont,
        primaryTrait,
        primaryIconImg: (showIcon && isIconUrl) ? (_csTraitImgCache.get(iconSrc) ?? null) : null,
        genesisIconImg: (isGenesis && showIcon) ? (_csTraitImgCache.get(GENESIS_ICON_URL) ?? null) : null,
    };
    _csCanvas.requestRenderAll();

    // Pre-load missing images; re-render once they're ready
    if (showIcon && isIconUrl && !_csTraitImgCache.has(iconSrc)) {
        _csLoadTraitImage(iconSrc).then(img => {
            if (_csTraitRenderData) { _csTraitRenderData.primaryIconImg = img; _csCanvas?.requestRenderAll(); }
        });
    }
    if (isGenesis && showIcon && !_csTraitImgCache.has(GENESIS_ICON_URL)) {
        _csLoadTraitImage(GENESIS_ICON_URL).then(img => {
            if (_csTraitRenderData) { _csTraitRenderData.genesisIconImg = img; _csCanvas?.requestRenderAll(); }
        });
    }
};

/* Called by Fabric's after:render — draws trait preview directly on 2D context.
   Reads zone position live each frame so preview tracks the zone with zero lag. */
function _csDrawTraitOverlay() {
    if (!_csTraitRenderData || !_csCanvas) return;
    const tzObj = _csCanvas.getObjects().find(o => o.data?.isTraitZone);
    if (!tzObj) return;

    const ctx = _csCanvas.contextContainer;
    const vt  = _csCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const d   = _csTraitRenderData;

    // Zone geometry in canvas coordinates
    const zL = tzObj.left;
    const zT = tzObj.top;
    const zW = (tzObj.width  || 0) * (tzObj.scaleX || 1);
    const pad = 12;
    const iconGap = 4;
    const iconTextGap = 10;
    let cursorY = zT + pad;

    ctx.save();
    // Re-apply viewport transform so canvas-px coords map correctly to screen
    ctx.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]);

    function drawRow(iconSrcs, imgElements, name, desc) {
        const icons = d.showIcon
            ? (Array.isArray(iconSrcs) ? iconSrcs : iconSrcs ? [iconSrcs] : []).filter(Boolean)
            : [];
        const totalIconW = icons.length > 0
            ? icons.length * d.iconSize + (icons.length - 1) * iconGap
            : 0;
        const estimatedTextW = d.showName ? 180 : 0;
        const rowW = totalIconW + (totalIconW > 0 && d.showName ? iconTextGap : 0) + estimatedTextW;

        let startX;
        if (d.align === 'center')      startX = zL + zW / 2 - rowW / 2;
        else if (d.align === 'right')  startX = zL + zW - pad - rowW;
        else                           startX = zL + pad;

        // Draw icons left-to-right
        let iconX = startX;
        icons.forEach((src, i) => {
            const img = imgElements?.[i];
            if ((src.startsWith('http') || src.startsWith('/')) && img) {
                ctx.drawImage(img, iconX, cursorY, d.iconSize, d.iconSize);
            } else if (!src.startsWith('http') && !src.startsWith('/')) {
                // emoji / unicode icon
                ctx.save();
                ctx.font = `${d.iconSize}px sans-serif`;
                ctx.fillStyle = d.fontColor;
                ctx.globalAlpha = 1;
                ctx.fillText(src, iconX, cursorY + d.iconSize * 0.85);
                ctx.restore();
            }
            iconX += d.iconSize + iconGap;
        });

        const textX = startX + totalIconW + (totalIconW > 0 && d.showName ? iconTextGap : 0);

        if (d.showName) {
            ctx.font = `bold ${d.nameSize}px "${d.nameFont}", sans-serif`;
            ctx.fillStyle = d.fontColor;
            ctx.globalAlpha = 1;
            ctx.fillText(String(name), textX, cursorY + d.nameSize * 0.82);

            if (d.showDesc && desc) {
                ctx.font = `${d.descSize}px "${d.descFont}", sans-serif`;
                ctx.fillStyle = d.fontColor;
                ctx.globalAlpha = 0.6;
                ctx.fillText(String(desc), textX, cursorY + d.nameSize + d.descSize + 2);
                cursorY += d.nameSize + d.descSize + 12;
            } else {
                cursorY += d.nameSize + 12;
            }
        } else {
            cursorY += d.iconSize + 10;
        }
    }

    const GENESIS_ICON_URL = 'https://cdn.codeoce.com/traits/Genesis-Icon.png';

    if (d.isGenesis) {
        const gIcons = [GENESIS_ICON_URL];
        const gImgs  = [d.genesisIconImg];
        if (d.primaryTrait.icon) { gIcons.push(d.primaryTrait.icon); gImgs.push(d.primaryIconImg); }
        drawRow(gIcons, gImgs,
            'Genesis: ' + (d.primaryTrait.display_name || d.primaryTrait.name || 'Trait'),
            d.primaryTrait.description || '');
    }

    drawRow(
        d.primaryTrait.icon ? [d.primaryTrait.icon] : [],
        [d.primaryIconImg],
        d.primaryTrait.display_name || d.primaryTrait.name || '',
        d.primaryTrait.description || ''
    );

    ctx.globalAlpha = 1;
    ctx.restore();
}

/* ─── Zone Template save / load ──────────────────────────────────────────── */
window.csSaveZoneTemplate = async function() {
    const name = prompt('Template name:');
    if (!name?.trim()) return;
    await _csRefreshCsrf();

    const tzObj = _csCanvas?.getObjects().find(o => o.data?.isTraitZone);

    // Build trait_area from zone rect (scaled to 750×1050 production dimensions)
    let traitArea = { x: 25, y: 820, w: 700, h: 200 };
    if (tzObj) {
        const rw = 750  / CS_W;
        const rh = 1050 / CS_H;
        const zL = tzObj.left, zT = tzObj.top;
        const zW = (tzObj.width  || 0) * (tzObj.scaleX || 1);
        const zH = (tzObj.height || 0) * (tzObj.scaleY || 1);
        traitArea = {
            x: Math.round(zL * rw), y: Math.round(zT * rh),
            w: Math.round(zW * rw), h: Math.round(zH * rh),
        };
    }

    // Export canvas as template thumbnail
    _csCanvas.renderAll();
    const dataUrl = _csCanvas.toDataURL({ format: 'jpeg', quality: 0.88, multiplier: 1 });
    const imageBlob = await (await fetch(dataUrl)).blob();

    showToast('Saving template...', 'loading');
    try {
        const fd = new FormData();
        fd.append('file', imageBlob, 'template-bg.jpg');
        const up = await fetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST', headers: { 'X-CSRF-Token': _csCsrfToken }, body: fd, credentials: 'include',
        });
        const { url: imageUrl } = up.ok ? await up.json() : {};

        const d = tzObj?.data || {};
        const res = await fetch(`${BACKEND_URL}/api/creator/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csCsrfToken },
            body: JSON.stringify({
                name: name.trim(),
                image_url: imageUrl || null,
                layer_data: _csExportLayerJson(),
                trait_area: traitArea,
                font_size:    d.nameSize    || 20,
                font_color:   d.fontColor   || '#ffffff',
                text_align:   d.textAlign   || 'left',
                display_mode: d.displayMode || 'full',
            }),
            credentials: 'include',
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');

        const saved = await res.json();
        _csTemplates.push(saved);
        _csPopulateTemplateDropdown();
        _csPopulateZoneTemplateSel();
        showToast('Template saved!', 'success');
    } catch (err) {
        showToast(err.message || 'Save failed', 'error');
    }
};

window.csLoadZoneTemplate = async function() {
    const sel = document.getElementById('cs-tz-tmpl-sel');
    const t = _csTemplates.find(t => t.id === sel?.value);
    if (!t) return;

    // Load canvas from template layer_data if present
    if (t.layer_data) {
        if (!confirm('Load this template\'s canvas design? Your current layers will be replaced.')) return;
        await _csInitFromJson(t.layer_data);
    }

    // Sync zone controls from template fields
    const d = {
        nameSize:    t.font_size    || 20,
        fontColor:   t.font_color   || '#ffffff',
        textAlign:   t.text_align   || 'left',
        displayMode: t.display_mode || 'full',
    };
    const nf = document.getElementById('cs-tz-namesize');    if (nf) nf.value = d.nameSize;
    const cf = document.getElementById('cs-tz-color');        if (cf) cf.value = d.fontColor;
    const af = document.getElementById('cs-tz-align');        if (af) af.value = d.textAlign;
    const dm = document.getElementById('cs-tz-displaymode'); if (dm) dm.value = d.displayMode;

    // Show panel and refresh preview
    const panel = document.getElementById('cs-tz-panel');
    if (panel) panel.style.display = 'block';
    csUpdateTraitZonePreview();
    showToast('Template loaded', 'success');
};

/* ─── Fonts ──────────────────────────────────────────────────────────────── */
function _csRenderFontList(filter) {
    const list = document.getElementById('cs-font-list');
    if (!list) return;

    const q = (filter || '').toLowerCase();
    const filtered = CS_GOOGLE_FONTS.filter(f =>
        !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );

    const byCategory = {};
    filtered.forEach(f => {
        if (!byCategory[f.category]) byCategory[f.category] = [];
        byCategory[f.category].push(f);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.15);font-size:10px;text-align:center;padding:10px 0;">No fonts match</div>';
        return;
    }

    list.innerHTML = Object.entries(byCategory).map(([cat, fonts]) => `
        <div class="cs-font-cat">${escapeHTML(cat)}</div>
        ${fonts.map(f => `
        <div class="cs-font-row">
            <div class="cs-font-preview" style="font-family:'${escapeHTML(f.name)}',sans-serif;">${escapeHTML(f.name)}</div>
            <span class="cs-font-name">${escapeHTML(f.name)}</span>
            <button class="cs-font-apply" onclick="csApplyFont('${escapeHTML(f.name)}')" title="Apply to selected text">Apply</button>
        </div>`).join('')}
    `).join('');
}

window.csFilterFonts = function(query) {
    _csRenderFontList(query);
};

window.csApplyFont = async function(fontName) {
    if (!_csCanvas) return;
    await csLoadGoogleFont(fontName);
    const obj = _csCanvas.getActiveObject();
    if (!obj || !['i-text', 'text', 'textbox'].includes(obj.type)) {
        showToast('Select a text layer first', 'error');
        return;
    }
    obj.set('fontFamily', fontName);
    _csCanvas.renderAll();
    _csPushHistory();
    showToast(`Applied ${fontName}`, 'success');
};

// Preload all curated fonts in a single batched Google Fonts request at init time.
// This means every font is ready (or downloading) before the user ever opens the panel.
function _csPreloadAllFonts() {
    const families = CS_GOOGLE_FONTS
        .map(f => encodeURIComponent(f.name).replace(/%20/g, '+') + ':wght@400;700')
        .join('&family=');
    const href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    if (!document.querySelector('link[data-cs-fonts]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.csFonts = '1';
        link.href = href;
        document.head.appendChild(link);
    }
    // Mark all curated fonts as "injected" — they'll be available once the CSS parses
    CS_GOOGLE_FONTS.forEach(f => _csLoadedFonts.add(f.name));
}

async function csLoadGoogleFont(fontName) {
    // Curated fonts are already injected by _csPreloadAllFonts — just wait for ready
    if (!_csLoadedFonts.has(fontName)) {
        // Custom / user-typed font: inject its own stylesheet
        if (!document.querySelector(`link[data-gf="${CSS.escape(fontName)}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.dataset.gf = fontName;
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, '+')}:wght@400;700&display=swap`;
            document.head.appendChild(link);
        }
        _csLoadedFonts.add(fontName);
    }
    // Use the Font Loading API to wait until the face is actually paint-ready
    try {
        await document.fonts.load(`bold 16px "${fontName}"`);
    } catch { /* font may not support bold — ignore */ }
}

window.csLoadCustomFont = async function() {
    const inp = document.getElementById('cs-custom-font-inp');
    const fontName = (inp?.value || '').trim();
    if (!fontName) return;
    showToast(`Loading ${fontName}...`, 'loading');
    await csLoadGoogleFont(fontName);
    // Add to the curated list if not already there
    if (!CS_GOOGLE_FONTS.find(f => f.name.toLowerCase() === fontName.toLowerCase())) {
        CS_GOOGLE_FONTS.unshift({ name: fontName, category: 'Custom' });
    }
    _csRenderFontList(document.getElementById('cs-font-search')?.value || '');
    showToast(`${fontName} loaded`, 'success');
    if (inp) inp.value = '';
};

/* ─── Image library ──────────────────────────────────────────────────────── */
async function _csRefreshLibrary() {
    try {
        const r = await fetch(`${BACKEND_URL}/api/creator/images`, { credentials: 'include' });
        if (r.ok) { _csLibImages = await r.json(); }
    } catch {}
    _csRenderLibrary();
}

function _csRenderLibrary() {
    const grid = document.getElementById('cs-lib-grid');
    if (!grid) return;
    if (_csLibImages.length === 0) {
        grid.innerHTML = `
        <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;text-align:center;">
            <div style="width:52px;height:52px;border-radius:16px;background:oklch(from var(--a) l c h / 0.08);border:1px solid oklch(from var(--a) l c h / 0.15);display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
                <i class="bx bxs-image-alt" style="font-size:22px;color:var(--a);opacity:0.6;"></i>
            </div>
            <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--text);margin-bottom:6px;">Library is empty</div>
            <div style="font-size:10px;line-height:1.6;color:var(--muted);margin-bottom:14px;">Upload artwork, icons, and textures<br>to use in your card designs.</div>
            <button onclick="csOpenUploadModal()" class="cs-tbtn cs-primary" style="padding:7px 18px;font-size:10px;width:100%;">
                <i class="bx bxs-upload"></i>&nbsp; Upload Image <kbd style="opacity:0.5;font-size:8px;margin-left:4px;">U</kbd>
            </button>
        </div>`;
        return;
    }
    grid.innerHTML = _csLibImages.map((img, i) => `
        <div class="cs-lib-img" title="${escapeHTML(img.url)}" onclick="csLibAddToCanvas(${i})">
            <img src="${escapeHTML(img.url)}" alt="" loading="lazy">
            <div class="cs-lib-act">
                <button class="cs-lab" onclick="event.stopPropagation();csLibAddToCanvas(${i})" title="Add to canvas"><i class="bx bxs-plus"></i></button>
                <button class="cs-lab" onclick="event.stopPropagation();csLibSetBackground(${i})" title="Set as background"><i class="bx bxs-layer"></i></button>
            </div>
        </div>
    `).join('');
}

window.csLibAddToCanvas = async function(idx) {
    const img = _csLibImages[idx];
    if (!img || !_csCanvas) return;
    const safeImg = await _csLoadSafeImage(img.url);
    if (!safeImg || !_csCanvas) return;
    const fi = new fabric.Image(safeImg);
    const scale = Math.min((CS_W * 0.85) / safeImg.naturalWidth, (CS_H * 0.85) / safeImg.naturalHeight, 1);
    fi.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
    fi.data = { layerName: 'Image', layerType: 'image', originalUrl: img.url };
    _csCanvas.add(fi); _csCanvas.setActiveObject(fi); _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    showToast('Added to canvas', 'success');
};

window.csLibSetBackground = async function(idx) {
    const img = _csLibImages[idx];
    if (!img || !_csCanvas) return;
    const safeImg = await _csLoadSafeImage(img.url);
    if (!safeImg || !_csCanvas) return;
    const fi = new fabric.Image(safeImg);
    const scale = Math.max(CS_W / safeImg.naturalWidth, CS_H / safeImg.naturalHeight);
    fi.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
    fi.data = { layerName: 'Background', layerType: 'image', originalUrl: img.url };
    _csCanvas.add(fi); _csCanvas.sendToBack(fi); _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    showToast('Set as background', 'success');
};

/* ─── Upload modal ───────────────────────────────────────────────────────── */
window.csOpenUploadModal = function() {
    document.getElementById('cs-upload-modal').classList.remove('hidden');
    const prog = document.getElementById('cs-up-prog');
    const recent = document.getElementById('cs-up-recent');
    if (prog) prog.style.display = 'none';
    if (recent) recent.style.display = 'none';
    const grid = document.getElementById('cs-up-recent-grid');
    if (grid) grid.innerHTML = '';
    const inp = document.getElementById('cs-modal-file');
    if (inp) inp.value = '';
};

window.csCloseUploadModal = function() {
    document.getElementById('cs-upload-modal').classList.add('hidden');
    _csRefreshLibrary();
};

function _csWireDropZone() {
    const dz = document.getElementById('cs-dz');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dov'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dov'));
    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dov');
        if (e.dataTransfer.files.length) csHandleModalFiles(e.dataTransfer.files);
    });
}

window.csHandleModalFiles = async function(files) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const prog = document.getElementById('cs-up-prog');
    const fill = document.getElementById('cs-up-fill');
    const status = document.getElementById('cs-up-status');
    const countEl = document.getElementById('cs-up-count');
    const recentDiv = document.getElementById('cs-up-recent');
    const recentGrid = document.getElementById('cs-up-recent-grid');

    if (prog) prog.style.display = 'block';
    if (recentDiv) recentDiv.style.display = 'none';
    const uploaded = [];

    for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        if (status) status.textContent = `Uploading ${file.name.substring(0, 24)}...`;
        if (countEl) countEl.textContent = `${i + 1} / ${arr.length}`;
        if (fill) fill.style.width = `${Math.round(((i) / arr.length) * 100)}%`;

        try {
            if (file.size > 10 * 1024 * 1024) {
                showToast(`Skip ${file.name}: > 10MB`, 'error');
                continue;
            }
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST',
                headers: { 'X-CSRF-Token': _csCsrfToken },
                body: fd,
                credentials: 'include',
            });
            if (res.ok) {
                const { url } = await res.json();
                if (url) uploaded.push(url);
            }
        } catch {}

        if (fill) fill.style.width = `${Math.round(((i + 1) / arr.length) * 100)}%`;
    }

    if (status) status.textContent = `Done — ${uploaded.length} uploaded`;
    if (fill) fill.style.width = '100%';

    if (uploaded.length > 0 && recentDiv && recentGrid) {
        recentDiv.style.display = 'block';
        recentGrid.innerHTML = uploaded.map(url => `
            <div style="width:64px;height:64px;border-radius:7px;overflow:hidden;border:1px solid rgba(0,242,254,0.2);cursor:pointer;flex-shrink:0;"
                onclick="csAddLibImageByUrl('${escapeHTML(url)}')" title="Click to add to canvas">
                <img src="${escapeHTML(url)}" style="width:100%;height:100%;object-fit:cover;">
            </div>
        `).join('');
        uploaded.forEach(url => {
            if (!_csLibImages.find(i => i.url === url)) _csLibImages.unshift({ url, key: '', size: 0 });
        });
        _csRenderLibrary();
    }
};

window.csAddLibImageByUrl = async function(url, name) {
    if (!_csCanvas) return;
    if (_csIsSvgUrl(url)) { csCloseUploadModal(); _csAddSvgToCanvas(url, name || 'SVG'); return; }
    const safeImg = await _csLoadSafeImage(url);
    if (!safeImg || !_csCanvas) return;
    const fi = new fabric.Image(safeImg);
    const scale = Math.min((CS_W * 0.85) / safeImg.naturalWidth, (CS_H * 0.85) / safeImg.naturalHeight, 1);
    fi.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
    fi.data = { layerName: name || 'Image', layerType: 'image', originalUrl: url };
    _csCanvas.add(fi); _csCanvas.setActiveObject(fi); _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    csCloseUploadModal();
    showToast('Added to canvas', 'success');
};

/* ─── SVG Import ─────────────────────────────────────────────────────────── */
function _csIsSvgUrl(url) {
    return typeof url === 'string' && (url.toLowerCase().includes('.svg') || url.startsWith('data:image/svg'));
}

function _csAddSvgToCanvas(url, name) {
    if (!_csCanvas) return;
    const proxyUrl = url.startsWith('data:') ? url : `${BACKEND_URL}/api/img-proxy?url=${encodeURIComponent(url)}`;
    showToast('Loading SVG...', 'loading');
    fabric.loadSVGFromURL(proxyUrl, (objects, options) => {
        if (!objects?.length || !_csCanvas) {
            showToast('Could not parse SVG', 'error');
            return;
        }
        const group = fabric.util.groupSVGElements(objects, options);
        const w = group.width  || 100;
        const h = group.height || 100;
        const scale = Math.min((CS_W * 0.85) / w, (CS_H * 0.85) / h, 1);
        group.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
        group.data = { layerName: name || 'SVG', layerType: 'group', originalUrl: url };
        _csCanvas.add(group);
        _csCanvas.setActiveObject(group);
        _csCanvas.renderAll();
        _csPushHistory();
        _csRenderLayerList();
        showToast('SVG added', 'success');
    }, null, { crossOrigin: 'anonymous' });
}

/* ─── Canvas background ──────────────────────────────────────────────────── */
function _csApplyCheckerboard() {
    const frame = document.getElementById('cs-card-frame');
    if (frame) frame.classList.toggle('cs-checker', _csCanvasBgTransparent);
}

window.csSetCanvasBg = function(value) {
    if (!_csCanvas) return;
    if (value === 'transparent' || value === '') {
        _csCanvas.backgroundColor = null;
        _csCanvasBgTransparent = true;
    } else {
        _csCanvas.backgroundColor = value;
        _csCanvasBgTransparent = false;
        const colorInput = document.getElementById('cs-bg-color');
        if (colorInput) colorInput.value = value;
    }
    _csApplyCheckerboard();
    _csCanvas.renderAll();
    _csPushHistory();
};

/* ─── Form helpers ───────────────────────────────────────────────────────── */
function _csPopulateSetDropdown() {
    const sel = document.getElementById('cs-set');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">No Set</option>' +
        _csSets.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    if (prev) sel.value = prev;
}

function _csPopulateTemplateDropdown() {
    const sel = document.getElementById('cs-template');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">None</option>' +
        _csTemplates.map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}</option>`).join('');
    if (prev) sel.value = prev;
}

/* ─── Card number duplicate prevention ──────────────────────────────────── */
let _csTakenNumbers = new Set(); // numbers already used in the current set
let _csCurrentCardId = null;     // the card being edited (so its own number isn't "taken")

/* Sync the hidden cs-card-number from the two split inputs */
function _csSyncCardNumber() {
    const num = document.getElementById('cs-card-num');
    const total = document.getElementById('cs-card-total');
    const hidden = document.getElementById('cs-card-number');
    if (!num || !total || !hidden) return;
    if (num.value && total.value) {
        hidden.value = `${num.value}/${total.value}`;
    } else {
        hidden.value = '';
    }
}

/* Show/hide the "taken" warning */
function _csShowNumTaken(taken) {
    const warn = document.getElementById('cs-num-taken-warn');
    if (warn) warn.style.display = taken ? 'block' : 'none';
    const numInput = document.getElementById('cs-card-num');
    if (numInput) numInput.style.borderColor = taken ? '#ef4444' : '';
}

/* Check if the current value is taken */
function _csCheckNumTaken() {
    const input = document.getElementById('cs-card-num');
    if (!input || !input.value) { _csShowNumTaken(false); return false; }
    const n = parseInt(input.value, 10);
    if (!n) { _csShowNumTaken(false); return false; }
    const isTaken = _csTakenNumbers.has(n);
    _csShowNumTaken(isTaken);
    return isTaken;
}

/* Clamp the editable card number: digits only, no exceeding total */
window.csClampCardNum = function(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 3) v = v.slice(0, 3);
    const total = parseInt(document.getElementById('cs-card-total')?.value || '32', 10);
    if (v.length && parseInt(v, 10) > total) v = String(total);
    if (v.length && parseInt(v, 10) < 0) v = '0';
    input.value = v;
    _csSyncCardNumber();
    _csCheckNumTaken();
};

/* On blur, zero-pad and validate */
function _csPadCardNumOnBlur() {
    const input = document.getElementById('cs-card-num');
    if (!input || !input.value) { _csShowNumTaken(false); return; }
    let v = input.value.replace(/\D/g, '');
    if (v.length && parseInt(v, 10) > 0) {
        input.value = String(parseInt(v, 10)).padStart(3, '0');
    } else {
        input.value = '';
    }
    _csSyncCardNumber();
    _csCheckNumTaken();
}
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('cs-card-num');
    if (el) el.addEventListener('blur', _csPadCardNumOnBlur);
});

/* Find the first available number in the set */
function _csNextAvailableNum(total) {
    for (let i = 1; i <= total; i++) {
        if (!_csTakenNumbers.has(i)) return i;
    }
    return null; // set is full
}

/* Fetch taken numbers for a set, excluding the current card */
async function _csFetchTakenNumbers(setId) {
    _csTakenNumbers.clear();
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (!res.ok) return;
        const cards = await res.json();
        const currentId = document.getElementById('cs-card-id')?.value;
        for (const card of cards) {
            if (card.set_id !== setId) continue;
            if (currentId && card.id === currentId) continue; // don't block our own number
            if (!card.card_number) continue;
            const match = card.card_number.match(/^(\d+)/);
            if (match) _csTakenNumbers.add(parseInt(match[1], 10));
        }
    } catch {}
}

window.csOnSetChange = async function() {
    const sel = document.getElementById('cs-set');
    const wrap = document.getElementById('cs-card-number-wrap');
    const numInput = document.getElementById('cs-card-num');
    const totalInput = document.getElementById('cs-card-total');
    if (!sel || !wrap || !numInput || !totalInput) return;

    const setId = sel.value;
    if (!setId) {
        wrap.style.opacity = '0.45';
        numInput.disabled = true;
        numInput.style.cursor = 'not-allowed';
        numInput.value = '';
        numInput.placeholder = '---';
        totalInput.value = '032';
        _csTakenNumbers.clear();
        _csShowNumTaken(false);
        _csSyncCardNumber();
        return;
    }

    // Enable the editable field
    wrap.style.opacity = '1';
    numInput.disabled = false;
    numInput.style.cursor = '';
    totalInput.value = '032';

    // Fetch taken numbers then auto-fill next available
    await _csFetchTakenNumbers(setId);
    const next = _csNextAvailableNum(32);
    if (next !== null) {
        numInput.value = String(next).padStart(3, '0');
    } else {
        numInput.value = '';
        numInput.placeholder = 'FULL';
        numInput.disabled = true;
        numInput.style.cursor = 'not-allowed';
    }
    _csSyncCardNumber();
    _csCheckNumTaken();
};

function _csPopulateForm(card) {
    document.getElementById('cs-card-id').value = card.id;
    document.getElementById('cs-name').value = card.name || '';
    document.getElementById('cs-topbar-name').textContent = card.name || 'New Card';
    document.getElementById('cs-rarity').value = (card.rarity || 'common').toLowerCase();
    document.getElementById('cs-description').value = card.description || '';
    document.getElementById('cs-attack').value = card.attack ?? 0;
    document.getElementById('cs-defense').value = card.defense ?? 0;
    document.getElementById('cs-set').value = card.set_id || '';
    document.getElementById('cs-template').value = card.template_id || '';

    // Populate split card number fields
    const wrap = document.getElementById('cs-card-number-wrap');
    const numInput = document.getElementById('cs-card-num');
    const totalInput = document.getElementById('cs-card-total');
    if (card.card_number && card.card_number.includes('/')) {
        const [n, t] = card.card_number.split('/');
        numInput.value = n;
        totalInput.value = t;
    } else {
        numInput.value = '';
        totalInput.value = '032';
    }
    if (card.set_id) {
        wrap.style.opacity = '1';
        numInput.disabled = false;
        numInput.style.cursor = '';
    } else {
        wrap.style.opacity = '0.45';
        numInput.disabled = true;
        numInput.style.cursor = 'not-allowed';
    }
    document.getElementById('cs-card-number').value = card.card_number || '';

    document.getElementById('cs-battleable').checked = card.is_battle_eligible !== false;
    document.getElementById('cs-tradable').checked = card.is_trading_eligible !== false;
    csOnTemplateChange();
}

window.csOnTemplateChange = async function() {
    const sel = document.getElementById('cs-template');
    const badge = document.getElementById('cs-tmpl-badge');
    const badgeImg = document.getElementById('cs-tmpl-badge-img');
    const badgeName = document.getElementById('cs-tmpl-badge-name');
    const traitBtn = document.getElementById('cs-trait-btn');
    if (!sel) return;
    const t = _csTemplates.find(t => t.id === sel.value);

    _csUpdateTraitZoneDiagram();
    if (t) {
        if (t.image_url && badgeImg) badgeImg.src = t.image_url;
        if (badgeName) badgeName.textContent = t.name;
        if (badge) badge.classList.remove('hidden');
        if (traitBtn) traitBtn.style.display = '';
        // Show trait overlay if template has trait_area
        if (t.trait_area && _csTraitOverlayVisible) _csPositionTraitOverlay(t.trait_area);
    } else {
        if (badge) badge.classList.add('hidden');
        if (traitBtn) traitBtn.style.display = 'none';
        // hide trait overlay
        const overlay = document.getElementById('cs-trait-overlay');
        if (overlay) overlay.style.display = 'none';
        _csTraitOverlayVisible = false;
        const tBtn = document.getElementById('cs-trait-btn');
        if (tBtn) tBtn.classList.remove('on');
    }
};

window.csToggleTraitOverlay = function() {
    if (!_csCanvas) return;
    _csTraitOverlayVisible = !_csTraitOverlayVisible;
    const btn = document.getElementById('cs-aid-traits');
    btn?.classList.toggle('active', _csTraitOverlayVisible);

    if (_csTraitOverlayVisible) {
        const sel = document.getElementById('cs-template');
        const t = _csTemplates.find(t => t.id === sel?.value);
        if (t?.trait_area) {
            _csPositionTraitOverlay(t.trait_area);
        } else {
            showToast('Select a template first to see trait area', 'error');
            _csTraitOverlayVisible = false;
            btn?.classList.remove('active');
        }
    } else {
        const overlay = document.getElementById('cs-trait-overlay');
        if (overlay) overlay.style.display = 'none';
        btn?.classList.remove('active');
    }
};


function _csPositionTraitOverlay(traitArea) {
    const area = document.getElementById('cs-canvas-area');
    const frame = document.getElementById('cs-card-frame');
    const overlay = document.getElementById('cs-trait-overlay');
    if (!area || !frame || !overlay) return;

    const frameLeft = parseFloat(frame.style.left) || 0;
    const frameTop = parseFloat(frame.style.top) || 0;
    const frameW = parseFloat(frame.style.width) || (CS_W * _csGetScale());
    const frameH = parseFloat(frame.style.height) || (CS_H * _csGetScale());

    const scaleX = frameW / CS_W;
    const scaleY = frameH / CS_H;

    overlay.style.display = 'block';
    overlay.style.left = (frameLeft + traitArea.x * scaleX) + 'px';
    overlay.style.top = (frameTop + traitArea.y * scaleY) + 'px';
    overlay.style.width = (traitArea.w * scaleX) + 'px';
    overlay.style.height = (traitArea.h * scaleY) + 'px';
}

function _csGetScale() {
    if (!_csCanvas) return 1;
    return _csCanvas.getZoom();
}

function _csGetFitScale() {
    const area = document.getElementById('cs-canvas-area');
    if (!area) return 1;
    const maxW = area.clientWidth - 48;
    const maxH = area.clientHeight - 48;
    return Math.min(1, maxW / CS_W, maxH / CS_H);
}

/* ─── Grid overlay ───────────────────────────────────────────────────────── */
window.csToggleGrid = function() {
    _csGridVisible = !_csGridVisible;
    const el = document.getElementById('cs-grid-overlay');
    const btn = document.getElementById('cs-grid-btn');
    if (el) el.style.display = _csGridVisible ? 'block' : 'none';
    if (btn) btn.classList.toggle('on', _csGridVisible);
};

/* ─── Canvas init ────────────────────────────────────────────────────────── */
function _csScaleCanvas() {
    if (!_csCanvas) return;
    const area = document.getElementById('cs-canvas-area');
    if (!area) return;
    const fitScale = _csGetFitScale();
    const scale = fitScale * _csZoom;

    const displayW = CS_W * scale;
    const displayH = CS_H * scale;

    _csCanvas.setDimensions({ width: displayW, height: displayH });
    _csCanvas.setZoom(scale);
    _csCanvas.calcOffset();
    _csCanvas.renderAll();

    // Position the frame/grid overlays centered in the area
    const frame = document.getElementById('cs-card-frame');
    if (frame) {
        const offX = Math.max(0, (area.clientWidth - displayW) / 2);
        const offY = Math.max(0, (area.clientHeight - displayH) / 2);
        
        frame.style.left = offX + 'px';
        frame.style.top = offY + 'px';
        frame.style.width = displayW + 'px';
        frame.style.height = displayH + 'px';

        // Position the Fabric wrapper container above all overlay divs
        const container = area.querySelector('.canvas-container');
        if (container) {
            container.style.position = 'absolute';
            container.style.left = offX + 'px';
            container.style.top = offY + 'px';
            container.style.zIndex = '3';
        }
    }

    _csCanvas.calcOffset();
    _csCanvas.renderAll();

    // Update zoom display
    const fitPct = Math.round(scale * 100);
    const zd = document.getElementById('cs-zoom-display');
    if (zd) zd.textContent = fitPct + '%';

    // Re-position trait overlay if visible
    if (_csTraitOverlayVisible) {
        const sel = document.getElementById('cs-template');
        const t = _csTemplates.find(t => t.id === sel?.value);
        if (t?.trait_area) _csPositionTraitOverlay(t.trait_area);
    }

}

/* ─── Zoom ───────────────────────────────────────────────────────────────── */
window.csZoomStep = function(delta) {
    _csZoom = Math.min(4, Math.max(0.25, _csZoom + delta));
    _csScaleCanvas();
};

window.csFitCanvas = function() {
    _csZoom = 1.0;
    _csScaleCanvas();
};

/* ─── Alignment ──────────────────────────────────────────────────────────── */
window.csAlign = function(direction) {
    if (!_csCanvas) return;
    const objs = _csCanvas.getActiveObjects();
    if (!objs.length) return;

    // Distribute requires at least 3 objects to be meaningful
    if (direction === 'hdistribute' || direction === 'vdistribute') {
        if (objs.length < 3) return;
        // Discard active selection so positions are in canvas coords
        _csCanvas.discardActiveObject();
        const rects = objs.map(o => {
            o.set({ originX: 'left', originY: 'top' });
            o.setCoords();
            return { obj: o, br: o.getBoundingRect() };
        });
        if (direction === 'hdistribute') {
            rects.sort((a, b) => a.br.left - b.br.left);
            const totalObjW = rects.reduce((s, r) => s + r.br.width, 0);
            const span = rects[rects.length - 1].br.left + rects[rects.length - 1].br.width - rects[0].br.left;
            const gap  = (span - totalObjW) / (rects.length - 1);
            let cursor = rects[0].br.left;
            rects.forEach(r => { r.obj.set({ left: cursor }); r.obj.setCoords(); cursor += r.br.width + gap; });
        } else {
            rects.sort((a, b) => a.br.top - b.br.top);
            const totalObjH = rects.reduce((s, r) => s + r.br.height, 0);
            const span = rects[rects.length - 1].br.top + rects[rects.length - 1].br.height - rects[0].br.top;
            const gap  = (span - totalObjH) / (rects.length - 1);
            let cursor = rects[0].br.top;
            rects.forEach(r => { r.obj.set({ top: cursor }); r.obj.setCoords(); cursor += r.br.height + gap; });
        }
        // Restore selection
        const sel = new fabric.ActiveSelection(objs, { canvas: _csCanvas });
        _csCanvas.setActiveObject(sel);
        _csCanvas.renderAll();
        _csPushHistory();
        return;
    }

    // Discard active selection so each object's left/top is in canvas coords
    _csCanvas.discardActiveObject();
    objs.forEach(obj => {
        obj.set({ originX: 'left', originY: 'top' });
        obj.setCoords();
        const bw = obj.getBoundingRect().width;
        const bh = obj.getBoundingRect().height;
        if (direction === 'left')    obj.set({ left: 0 });
        if (direction === 'right')   obj.set({ left: CS_W - bw });
        if (direction === 'hcenter') obj.set({ left: (CS_W - bw) / 2 });
        if (direction === 'top')     obj.set({ top: 0 });
        if (direction === 'bottom')  obj.set({ top: CS_H - bh });
        if (direction === 'vcenter') obj.set({ top: (CS_H - bh) / 2 });
        obj.setCoords();
    });
    // Restore selection
    if (objs.length > 1) {
        const sel = new fabric.ActiveSelection(objs, { canvas: _csCanvas });
        _csCanvas.setActiveObject(sel);
    } else if (objs.length === 1) {
        _csCanvas.setActiveObject(objs[0]);
    }
    _csCanvas.renderAll();
    _csPushHistory();
};

/* ─── Duplicate ──────────────────────────────────────────────────────────── */
window.csDuplicate = function() {
    if (!_csCanvas) return;
    const objs = _csCanvas.getActiveObjects();
    if (!objs.length) return;
    _csCanvas.discardActiveObject();
    const clones = [];
    let done = 0;
    objs.forEach(obj => {
        obj.clone(clone => {
            clone.set({ left: (clone.left || 0) + 14, top: (clone.top || 0) + 14 });
            clone.data = Object.assign({}, obj.data || {});
            _csCanvas.add(clone);
            clones.push(clone);
            done++;
            if (done === objs.length) {
                if (clones.length === 1) {
                    _csCanvas.setActiveObject(clones[0]);
                } else {
                    const sel = new fabric.ActiveSelection(clones, { canvas: _csCanvas });
                    _csCanvas.setActiveObject(sel);
                }
                _csCanvas.renderAll();
                _csPushHistory(); _csRenderLayerList();
            }
        }, ['data']);
    });
};

/* ─── Canvas events ──────────────────────────────────────────────────────── */
function _csBindEventsExtra() {
    if (!_csCanvas) return;
    _csCanvas.on('mouse:down', () => _csCanvas.calcOffset());
    _csCanvas.on('selection:created', e => { _csOnSelect(e); _csFocusSync(); _csGradHandlesShow(e.selected?.[0]); });
    _csCanvas.on('selection:updated', e => { _csOnSelect(e); _csFocusSync(); _csGradHandlesShow(e.selected?.[0]); });
    _csCanvas.on('selection:cleared', () => { _csOnDeselect(); if (_csFocusMode) csToggleFocusMode(); _csGradHandlesHide(); _csUpdateColorSwapper(); });
    _csCanvas.on('object:modified', e => {
        if (e.target?.data?.isTraitZone) csUpdateTraitZonePreview();
        if (e.target?.data?.autoLayout) _csApplyAutoLayout(e.target);
        _csGradHandlesShow(_csCanvas.getActiveObject());
        _csPushHistory(); _csRenderLayerList();
    });
    _csCanvas.on('object:moving', e => {
        _csGradHandlesShow(e.target);
    });
    _csCanvas.on('path:created', e => {
        // Brush strokes that go into a paint group are handled in _csBindEvents (path:created);
        // do not tag/history here or we double-push and overwrite stroke data.
        if (_csTool === 'draw') return;
        if (_csTool === 'eraser' && _csEraserPaintTarget) return;

        if (e.path) {
            if (_csTool === 'eraser') {
                e.path.globalCompositeOperation = 'destination-out';
                e.path.stroke = 'rgba(0,0,0,1)';
            }
            const modeLabel = _csTool === 'eraser'
                ? 'Eraser'
                : (_csBrushMode !== 'pencil' ? _csBrushMode.charAt(0).toUpperCase() + _csBrushMode.slice(1) : 'Drawing');
            e.path.data = { layerName: modeLabel, layerType: 'path' };
        }
        _csPushHistory(); _csRenderLayerList();
    });
    // Mouse wheel zoom (Ctrl + Wheel)
    _csCanvas.on('mouse:wheel', e => {
        if (e.e.ctrlKey) {
            e.e.preventDefault();
            const delta = e.e.deltaY;
            let zoom = _csCanvas.getZoom();
            // Smoother, pointer-focused zoom
            const factor = 1.1;
            if (delta < 0) zoom *= factor;
            else zoom /= factor;
            
            if (zoom > 5) zoom = 5;
            if (zoom < 0.1) zoom = 0.1;
            
            _csCanvas.zoomToPoint({ x: e.e.offsetX, y: e.e.offsetY }, zoom);
            _csZoom = zoom / _csGetFitScale(); // Update _csZoom relative to fit
            
            // Sync zoom display
            const zd = document.getElementById('cs-zoom-display');
            if (zd) zd.textContent = Math.round(zoom * 100) + '%';
        }
    });

    // Enhanced Snapping & Smart Guides
    _csCanvas.on('object:moving', e => {
        const obj = e.target;
        if (!obj) return;

        // Clear existing guides
        _csClearGuides();

        let snappedX = false;
        let snappedY = false;
        const margin = 2; // Snap threshold

        if (_csGridVisible) {
            const grid = 10;
            obj.set({
                left: Math.round(obj.left / grid) * grid,
                top: Math.round(obj.top / grid) * grid
            });
            snappedX = snappedY = true;
        }

        // Smart Guides (Object-to-Object)
        if (!snappedX || !snappedY) {
            const objs = _csCanvas.getObjects().filter(o => o !== obj && o.visible && !o.data?.isTraitZone);
            const activeBounds = obj.getBoundingRect();
            const centers = { x: activeBounds.left + activeBounds.width / 2, y: activeBounds.top + activeBounds.height / 2 };

            for (const other of objs) {
                const b = other.getBoundingRect();
                const bCenters = { x: b.left + b.width / 2, y: b.top + b.height / 2 };

                // Vertical Snapping (X-axis)
                if (!snappedX) {
                    if (Math.abs(activeBounds.left - b.left) < margin) { obj.set('left', b.left); snappedX = true; _csShowGuide(b.left, 'v'); }
                    else if (Math.abs(activeBounds.left + activeBounds.width - (b.left + b.width)) < margin) { obj.set('left', b.left + b.width - activeBounds.width); snappedX = true; _csShowGuide(b.left + b.width, 'v'); }
                    else if (Math.abs(centers.x - bCenters.x) < margin) { obj.set('left', bCenters.x - activeBounds.width / 2); snappedX = true; _csShowGuide(bCenters.x, 'v'); }
                }

                // Horizontal Snapping (Y-axis)
                if (!snappedY) {
                    if (Math.abs(activeBounds.top - b.top) < margin) { obj.set('top', b.top); snappedY = true; _csShowGuide(b.top, 'h'); }
                    else if (Math.abs(activeBounds.top + activeBounds.height - (b.top + b.height)) < margin) { obj.set('top', b.top + b.height - activeBounds.height); snappedY = true; _csShowGuide(b.top + b.height, 'h'); }
                    else if (Math.abs(centers.y - bCenters.y) < margin) { obj.set('top', bCenters.y - activeBounds.height / 2); snappedY = true; _csShowGuide(bCenters.y, 'h'); }
                }
            }
        }
    });

    _csCanvas.on('mouse:up', () => _csClearGuides());

    // Bidirectional Highlighting (Canvas -> Sidebar)
    _csCanvas.on('mouse:over', e => {
        const obj = e.target;
        if (!obj || _csTool === 'hand' || obj.data?.isTraitZone) return;
        const objs = _csCanvas.getObjects();
        const idx = objs.indexOf(obj);
        if (idx !== -1) {
            const row = document.getElementById(`cs-layer-row-${idx}`);
            if (row) row.classList.add('hv');
        }
    });
    _csCanvas.on('mouse:out', e => {
        document.querySelectorAll('.cs-lr.hv').forEach(r => r.classList.remove('hv'));
    });

}

function _csInitCanvas(bgImageUrl) {
    if (_csCanvas) { _csCanvas.dispose(); _csCanvas = null; }
    _csCanvas = new fabric.Canvas('cs-canvas', {
        width: CS_W, height: CS_H,
        backgroundColor: null,
        preserveObjectStacking: true,
        selection: true,
        enableRetinaScaling: false,
        selectionColor: 'rgba(0,242,254,0.04)',
        selectionBorderColor: '#00f2fe',
        selectionLineWidth: 1,
    });
    _csScaleCanvas();
    _csBindEvents();
    _csBindEventsExtra();
    _csApplyCheckerboard();

    if (bgImageUrl) {
        _csLoadSafeImage(bgImageUrl).then(htmlImg => {
            if (!htmlImg || !_csCanvas) return;
            const fi = new fabric.Image(htmlImg);
            const scale = Math.max(CS_W / htmlImg.naturalWidth, CS_H / htmlImg.naturalHeight);
            fi.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
            fi.data = { layerName: 'Background', layerType: 'image', originalUrl: bgImageUrl };
            _csCanvas.add(fi); _csCanvas.sendToBack(fi); _csCanvas.renderAll();
            _csPushHistory(); _csRenderLayerList();
        });
    } else {
        _csPushHistory(); _csRenderLayerList();
    }
    csTool('select');
}

async function _csInitFromJson(layerDataJson) {
    if (_csCanvas) { _csCanvas.dispose(); _csCanvas = null; }
    let json;
    try { json = typeof layerDataJson === 'string' ? JSON.parse(layerDataJson) : layerDataJson; }
    catch { _csInitCanvas(null); return; }

    const proxied = JSON.parse(JSON.stringify(json));
    (proxied.objects || []).forEach(obj => {
        if (obj.type === 'image' && obj.src && !obj.src.startsWith('data:') && !obj.src.startsWith('blob:') && !obj.src.startsWith('/')) {
            if (!obj.data) obj.data = {};
            if (!obj.data.originalUrl) obj.data.originalUrl = obj.src;
            obj.src = `/api/img-proxy?url=${encodeURIComponent(obj.src)}`;
        }
    });

    _csCanvasBgTransparent = !proxied.background || proxied.background === 'rgba(0,0,0,0)' || proxied.background === null;
    _csCanvas = new fabric.Canvas('cs-canvas', {
        width: CS_W, height: CS_H,
        backgroundColor: _csCanvasBgTransparent ? null : (proxied.background || null),
        preserveObjectStacking: true,
        selection: true,
        enableRetinaScaling: false,
        selectionColor: 'rgba(0,242,254,0.04)',
        selectionBorderColor: '#00f2fe',
        selectionLineWidth: 1,
    });
    _csScaleCanvas();
    _csBindEvents();
    _csBindEventsExtra();
    _csApplyCheckerboard();

    await new Promise(resolve => {
        _csCanvas.loadFromJSON(proxied, () => {
            if (_csCanvasBgTransparent) _csCanvas.backgroundColor = null;
            _csCanvas.renderAll(); resolve();
        });
    });

    csTool('select');
    _csPushHistory();
    _csRenderLayerList();
}

function _csBindEvents() {
    if (!_csCanvas) return;
    _csCanvas.on('selection:created', e => { _csOnSelect(e); _csFocusSync(); _csGradHandlesShow(e.selected?.[0]); });
    _csCanvas.on('selection:updated', e => { _csOnSelect(e); _csFocusSync(); _csGradHandlesShow(e.selected?.[0]); });
    _csCanvas.on('selection:cleared', () => { _csOnDeselect(); if (_csFocusMode) csToggleFocusMode(); _csGradHandlesHide(); _csUpdateColorSwapper(); });
    _csCanvas.on('object:modified', e => {
        if (e.target?.data?.autoLayout) _csApplyAutoLayout(e.target);
        _csGradHandlesShow(_csCanvas.getActiveObject());
        _csUpdateSelectionContext(); _csPushHistory(); _csRenderLayerList();
    });
    _csCanvas.on('object:moving', e => { _csGradHandlesShow(e.target); });
    _csCanvas.on('after:render', _csUpdateSelectionContext);
    _csCanvas.on('after:render', _csDrawTraitOverlay);
    _csCanvas.on('object:modified', e => {
        if (e.target?.data?.isTraitZone) csUpdateTraitZonePreview();
    });

    // Context menu
    document.addEventListener('contextmenu', e => {
        if (!e.target.closest('#cs-canvas-area')) return;
        e.preventDefault();
        const obj = _csCanvas.findTarget(e);
        if (obj) { _csCanvas.setActiveObject(obj); _csCanvas.renderAll(); }
        _csShowContextMenu(e.clientX, e.clientY);
    });
    document.addEventListener('mousedown', e => {
        if (!e.target.closest('#cs-context-menu')) _csHideContextMenu();
    });

    // Paint Layer Grouping (Affinity-style)
    _csCanvas.on('path:created', opt => {
        const path = opt.path;
        if (!path) return;

        let targetGroup = null;
        if (_csTool === 'draw') {
            targetGroup = _csCanvas.getActiveObject();
            if (!targetGroup || targetGroup.data?.layerType !== 'paint') {
                // Find most recent paint layer
                targetGroup = _csCanvas.getObjects().reverse().find(o => o.data?.layerType === 'paint');
            }
            if (!targetGroup) {
                // Materialise the pending layer (from + button) or create a fresh one
                const layerName = _csPendingLayer?.name || 'Paint Layer';
                _csPendingLayer = null;
                targetGroup = new fabric.Group([], { left: 0, top: 0, subTargetCheck: true });
                targetGroup.data = { layerName, layerType: 'paint' };
                _csCanvas.add(targetGroup);
            }
        } else if (_csTool === 'eraser' && _csEraserPaintTarget) {
            targetGroup = _csEraserPaintTarget;
            if (!_csCanvas.getObjects().includes(targetGroup)) {
                _csCanvas.remove(path);
                _csCanvas.renderAll();
                return;
            }
            path.globalCompositeOperation = 'destination-out';
            path.stroke = 'rgba(0,0,0,1)';
        } else {
            return;
        }
        targetGroup.subTargetCheck = true;

        // Add path to group and remove from canvas
        _csCanvas.remove(path);
        targetGroup.addWithUpdate(path);
        _csCanvas.setActiveObject(targetGroup);
        _csCanvas.renderAll();
        _csPushHistory();
        _csRenderLayerList();
    });
}

/* ─── Tools ──────────────────────────────────────────────────────────────── */
function csTool(tool) {
    _csTool = tool;
    const c = _csCanvas;
    if (!c) return;

    // Update active button in tool strip
    document.querySelectorAll('#cs-toolstrip .cs-t').forEach(b => b.classList.remove('active'));
    const dragShapes = ['rect', 'circle', 'triangle', 'line'];
    if (dragShapes.includes(tool)) {
        document.getElementById('cst-shape')?.classList.add('active');
        _csSetShapeDocIcon(tool);
    } else {
        document.getElementById(`cst-${tool}`)?.classList.add('active');
    }

    // Remove old text click handler
    if (_csTextClickHandler) { c.off('mouse:down', _csTextClickHandler); _csTextClickHandler = null; }
    // Remove canvas-bound tool handlers (eyedropper, fill, zoom, shapes)
    if (_csHandlers._canvasDown)  { c.off('mouse:down', _csHandlers._canvasDown); }
    if (_csHandlers._canvasMove)  { c.off('mouse:move', _csHandlers._canvasMove); }
    if (_csHandlers._canvasUp)    { c.off('mouse:up',   _csHandlers._canvasUp);   }
    // Remove DOM-bound hand handlers
    if (_csHandlers.mousedown) { c.wrapperEl?.removeEventListener('mousedown', _csHandlers.mousedown); }
    if (_csHandlers.mousemove) { document.removeEventListener('mousemove', _csHandlers.mousemove); }
    if (_csHandlers.mouseup)   { document.removeEventListener('mouseup', _csHandlers.mouseup); }
    _csHandlers = {};
    _csEraserPaintTarget = null;

    c.isDrawingMode = false;
    c.selection = (tool === 'select');
    // Reset brush mode when not in a painting tool
    if (!['draw', 'eraser', 'blur'].includes(tool)) _csBrushMode = 'pencil';
    // Hide measure overlay when leaving measure tool
    if (tool !== 'measure') {
        const msvg = document.getElementById('cs-measure-svg');
        const mtip = document.getElementById('cs-measure-tip');
        if (msvg) msvg.style.display = 'none';
        if (mtip) mtip.style.display = 'none';
    }
    // Exit paint stroke edit mode when switching tools
    if (_csPaintEditMode) _csExitPaintStrokeEdit();

    // Hide brush context bar for non-drawing tools; restore object action buttons
    if (!['draw', 'eraser', 'blur'].includes(tool)) {
        const bar = document.getElementById('cs-context-bar');
        if (bar) bar.classList.remove('active');
        const acts = document.getElementById('cs-ctx-obj-actions');
        if (acts) acts.style.display = 'contents';
    }
    c.defaultCursor = tool === 'text' ? 'text' : tool === 'hand' ? 'grab' : 'default';
    const needsEvents = ['select', 'fill', 'eyedropper', 'crop', 'zoom', 'blur'];
    c.skipTargetFind = false;
    c.forEachObject(obj => {
        obj.selectable = (tool === 'select');
        obj.evented = needsEvents.includes(tool);
    });

    if (tool === 'text') {
        let _txtOrigin = null;
        let _txtDragging = false;
        let _txtPreview = null; // dashed preview rect shown while dragging

        const _txtDown = opt => {
            if (opt.target) return; // hit existing object — let Fabric handle selection
            _txtOrigin = c.getPointer(opt.e);
            _txtDragging = false;
            _txtPreview = null;
        };

        const _txtMove = opt => {
            if (!_txtOrigin) return;
            const p = c.getPointer(opt.e);
            const dx = p.x - _txtOrigin.x;
            const dy = p.y - _txtOrigin.y;
            // Only start drag mode once the user has moved > 6px
            if (!_txtDragging && Math.sqrt(dx*dx + dy*dy) < 6) return;
            _txtDragging = true;

            // Draw / update dashed preview box
            const left   = Math.min(_txtOrigin.x, p.x);
            const top    = Math.min(_txtOrigin.y, p.y);
            const width  = Math.abs(dx);
            const height = Math.abs(dy);

            if (!_txtPreview) {
                _txtPreview = new fabric.Rect({
                    left, top, width, height,
                    fill: 'rgba(0,242,254,0.04)',
                    stroke: '#00f2fe', strokeWidth: 1, strokeDashArray: [5, 3],
                    selectable: false, evented: false, excludeFromExport: true,
                });
                _txtPreview.data = { _isTextPreview: true };
                c.add(_txtPreview);
            } else {
                _txtPreview.set({ left, top, width, height });
            }
            c.renderAll();
        };

        const _txtUp = opt => {
            if (!_txtOrigin) return;
            // Remove preview rect
            if (_txtPreview) { c.remove(_txtPreview); _txtPreview = null; }

            const p = c.getPointer(opt.e);
            const dx = p.x - _txtOrigin.x;
            const dy = p.y - _txtOrigin.y;
            const origin = _txtOrigin;
            _txtOrigin = null;

            if (opt.target && !_txtDragging) { _txtDragging = false; return; }

            if (_txtDragging && Math.abs(dx) > 20 && Math.abs(dy) > 10) {
                // ── Drag → Textbox with fixed width ─────────────────────────
                _txtDragging = false;
                const boxLeft  = Math.min(origin.x, p.x);
                const boxTop   = Math.min(origin.y, p.y);
                const boxW     = Math.abs(dx);
                // Font size: scale to ~40% of box height, clamped 12–72
                const fontSize = Math.max(12, Math.min(72, Math.round(Math.abs(dy) * 0.4)));
                const tb = new fabric.Textbox('', {
                    left: boxLeft, top: boxTop,
                    width: boxW,
                    fontFamily: 'Space Grotesk, Arial',
                    fontSize,
                    fill: '#ffffff', fontWeight: 'bold',
                    splitByGrapheme: false,
                });
                tb.data = { layerName: 'Text Box', layerType: 'text' };
                c.add(tb);
                c.setActiveObject(tb);
                tb.enterEditing();
                _csPushHistory(); _csRenderLayerList();
                csTool('select');
            } else {
                // ── Click → Point IText (original behaviour) ─────────────────
                _txtDragging = false;
                const t = new fabric.IText('', {
                    left: origin.x, top: origin.y,
                    fontFamily: 'Space Grotesk, Arial', fontSize: 40,
                    fill: '#ffffff', fontWeight: 'bold',
                });
                t.data = { layerName: 'Text Layer', layerType: 'text' };
                c.add(t);
                c.setActiveObject(t);
                t.enterEditing();
                t.selectAll();
                _csPushHistory(); _csRenderLayerList();
                csTool('select');
            }
        };

        _csTextClickHandler = _txtDown;
        c.on('mouse:down', _txtDown);
        c.on('mouse:move', _txtMove);
        c.on('mouse:up',   _txtUp);

        // Store move/up refs so csTool() cleanup can remove them
        _csHandlers._canvasMove = _txtMove;
        _csHandlers._canvasUp   = _txtUp;
    }

    if (tool === 'draw') {
        c.isDrawingMode = true;
        c.freeDrawingBrush = new fabric.PencilBrush(c);
        c.freeDrawingBrush.color = _csBrushColorWithOpacity();
        c.freeDrawingBrush.width = _csBrushSize;
        c.freeDrawingBrush.globalCompositeOperation = 'source-over';
        _csShowBrushContextBar();
    }

    if (tool === 'eraser') {
        const activeRoot = _csRootObj(c.getActiveObject());
        const isPaintLayer = !!(activeRoot && activeRoot.data?.layerType === 'paint');
        c.isDrawingMode = false;
        c.defaultCursor = 'crosshair';
        c.skipTargetFind = true;
        if (isPaintLayer) {
            _csEraserPaintTarget = activeRoot;
            let isErasingPaint = false;
            let erasedAnyPaintStroke = false;

            const _erasePaintAt = (evt) => {
                const grp = _csEraserPaintTarget;
                if (!grp || grp.data?.layerType !== 'paint') return;
                const p = c.getPointer(evt);
                const radius = Math.max(4, _csBrushSize * 1.2);
                let removed = false;
                const strokes = [...(grp._objects || [])];
                for (let i = strokes.length - 1; i >= 0; i--) {
                    const s = strokes[i];
                    if (!s) continue;
                    const b = s.getBoundingRect(true, true);
                    if (p.x < b.left - radius || p.x > b.left + b.width + radius || p.y < b.top - radius || p.y > b.top + b.height + radius) {
                        continue;
                    }
                    grp.removeWithUpdate(s);
                    removed = true;
                    erasedAnyPaintStroke = true;
                }
                if (removed) {
                    grp.dirty = true;
                    c.renderAll();
                    _csRenderLayerList();
                }
            };

            _csHandlers._canvasDown = opt => {
                isErasingPaint = true;
                _erasePaintAt(opt.e);
            };
            _csHandlers._canvasMove = opt => {
                if (!isErasingPaint) return;
                _erasePaintAt(opt.e);
            };
            _csHandlers._canvasUp = () => {
                if (!isErasingPaint) return;
                isErasingPaint = false;
                if (erasedAnyPaintStroke) {
                    _csPushHistory();
                    _csRenderLayerList();
                    erasedAnyPaintStroke = false;
                }
            };
            c.on('mouse:down', _csHandlers._canvasDown);
            c.on('mouse:move', _csHandlers._canvasMove);
            c.on('mouse:up',   _csHandlers._canvasUp);
            _csShowBrushContextBar();
            c.renderAll();
            _csSyncPaintLayerInteract();
            return;
        }

        c.discardActiveObject();
        let isErasing = false;
        let _eraseObj = null;
        let _eraseOffscreen = null;

        const _pickImageAt = (evt) => {
            const pointer = c.getPointer(evt);
            const objs = c.getObjects();
            for (let i = objs.length - 1; i >= 0; i--) {
                const o = objs[i];
                if (o.type !== 'image' || o.visible === false) continue;
                if (o.containsPoint(new fabric.Point(pointer.x, pointer.y))) return o;
            }
            return null;
        };

        const _eraseAt = (evt) => {
            if (!_eraseObj || !_eraseOffscreen) return;
            const p = c.getPointer(evt);
            const obj = _eraseObj;
            const localPt = obj.toLocalPoint(new fabric.Point(p.x, p.y), 'left', 'top');
            const imgX = Math.round(localPt.x);
            const imgY = Math.round(localPt.y);
            const radius = Math.max(2, Math.round(_csBrushSize / Math.max(0.001, Math.min(Math.abs(obj.scaleX || 1), Math.abs(obj.scaleY || 1)))));
            const ctx = _eraseOffscreen.getContext('2d');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(imgX, imgY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            obj.setElement(_eraseOffscreen);
            obj.dirty = true;
            c.renderAll();
        };

        _csHandlers._canvasDown = opt => {
            const selected = c.getActiveObject();
            const obj = (selected && selected.type === 'image') ? selected : _pickImageAt(opt.e);
            if (!obj || obj.type !== 'image') {
                showToast('Select or click an image layer to erase', 'error');
                return;
            }
            isErasing = true;
            _eraseObj = obj;
            const el = obj._element;
            _eraseOffscreen = document.createElement('canvas');
            _eraseOffscreen.width = el.naturalWidth || el.width;
            _eraseOffscreen.height = el.naturalHeight || el.height;
            _eraseOffscreen.getContext('2d').drawImage(el, 0, 0);
            _eraseAt(opt.e);
        };

        _csHandlers._canvasMove = opt => {
            if (!isErasing) return;
            _eraseAt(opt.e);
        };

        _csHandlers._canvasUp = async () => {
            if (!isErasing || !_eraseOffscreen || !_eraseObj) return;
            isErasing = false;
            const off = _eraseOffscreen;
            const old = _eraseObj;
            const idx = c.getObjects().indexOf(old);
            _eraseOffscreen = null;
            _eraseObj = null;
            const blob = await new Promise(res => off.toBlob(res, 'image/png'));
            const url = URL.createObjectURL(blob);
            fabric.Image.fromURL(url, newImg => {
                newImg.set({
                    left: old.left, top: old.top,
                    scaleX: old.scaleX, scaleY: old.scaleY,
                    originX: old.originX, originY: old.originY,
                    angle: old.angle,
                    flipX: old.flipX, flipY: old.flipY,
                });
                newImg.data = { ...old.data };
                c.remove(old);
                if (idx >= 0) c.insertAt(newImg, idx);
                else c.add(newImg);
                c.setActiveObject(newImg);
                c.renderAll();
                URL.revokeObjectURL(url);
                _csPushHistory();
                _csRenderLayerList();
            }, { crossOrigin: 'anonymous' });
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
        _csShowBrushContextBar();
    }

    if (['rect', 'circle', 'triangle', 'line'].includes(tool)) {
        let isDown = false, shape, origX, origY;
        _csHandlers._canvasDown = opt => {
            isDown = true;
            const p = c.getPointer(opt.e);
            origX = p.x; origY = p.y;
            const common = { left: p.x, top: p.y, fill: '#00f2fe', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 1 };
            if (tool === 'rect') {
                shape = new fabric.Rect({ ...common, width: 0, height: 0, rx: 8, ry: 8 });
                shape.data = { layerName: 'Rectangle', layerType: 'rect' };
            } else if (tool === 'circle') {
                shape = new fabric.Ellipse({ ...common, rx: 0, ry: 0, originX: 'center', originY: 'center' });
                shape.data = { layerName: 'Circle', layerType: 'circle' };
            } else if (tool === 'triangle') {
                shape = new fabric.Triangle({ ...common, width: 0, height: 0 });
                shape.data = { layerName: 'Triangle', layerType: 'polygon' };
            } else if (tool === 'line') {
                shape = new fabric.Line([p.x, p.y, p.x, p.y], { ...common, strokeWidth: 4 });
                shape.data = { layerName: 'Line', layerType: 'path' };
            }
            c.add(shape);
        };
        _csHandlers._canvasMove = opt => {
            if (!isDown) return;
            const p = c.getPointer(opt.e);
            if (tool === 'rect' || tool === 'triangle') {
                shape.set({ width: Math.abs(origX - p.x), height: Math.abs(origY - p.y) });
                if (origX > p.x) shape.set({ left: p.x });
                if (origY > p.y) shape.set({ top: p.y });
            } else if (tool === 'circle') {
                shape.set({ rx: Math.abs(origX - p.x), ry: Math.abs(origY - p.y) });
            } else if (tool === 'line') {
                shape.set({ x2: p.x, y2: p.y });
            }
            c.renderAll();
        };
        _csHandlers._canvasUp = () => {
            if (!isDown) return;
            isDown = false;
            if (shape.width === 0 && shape.height === 0 && tool !== 'line') {
                c.remove(shape);
            } else {
                c.setActiveObject(shape);
                _csPushHistory(); _csRenderLayerList();
                csTool('select');
            }
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
    }

    if (tool === 'eyedropper') {
        c.defaultCursor = 'none';
        const mag      = document.getElementById('cs-eyedrop-mag');
        const circle   = document.getElementById('cs-eyedrop-circle');
        const hexEl    = document.getElementById('cs-eyedrop-hex');
        const rgbEl    = document.getElementById('cs-eyedrop-rgb');
        const swatchEl = document.getElementById('cs-eyedrop-swatch');
        const MAG_SIZE = 96, SAMPLE = 12; // 12 source px → 96 display px = 8× zoom

        // Create inner canvas once
        if (circle && !circle.querySelector('canvas')) {
            const mc = document.createElement('canvas');
            mc.width = MAG_SIZE; mc.height = MAG_SIZE;
            mc.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;display:block;';
            circle.appendChild(mc);
        }
        const magCanvas = circle?.querySelector('canvas');

        const _sampleCanvas = (_pointer) => {
            const tmp = document.createElement('canvas');
            tmp.width = CS_W; tmp.height = CS_H;
            const tctx = tmp.getContext('2d');
            tctx.drawImage(c.getElement(), 0, 0, CS_W, CS_H);
            return { tmp, tctx };
        };

        const _updateMag = (e) => {
            if (!mag) return;
            // Centre magnifier exactly on cursor
            mag.style.display = 'flex';
            mag.style.left = e.clientX + 'px';
            mag.style.top  = e.clientY + 'px';

            const pointer = c.getPointer(e);
            const { tmp } = _sampleCanvas(pointer);
            const px = tmp.getContext('2d').getImageData(Math.round(pointer.x), Math.round(pointer.y), 1, 1).data;
            const [r, g, b] = [px[0], px[1], px[2]];
            const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

            // Update info panel
            if (swatchEl) swatchEl.style.background = hex;
            if (hexEl)    hexEl.textContent = hex.toUpperCase();
            if (rgbEl)    rgbEl.textContent = `${r}, ${g}, ${b}`;

            if (!magCanvas) return;
            const sx = Math.round(pointer.x - SAMPLE / 2);
            const sy = Math.round(pointer.y - SAMPLE / 2);
            const mctx = magCanvas.getContext('2d');
            mctx.imageSmoothingEnabled = false;
            mctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
            mctx.drawImage(tmp, sx, sy, SAMPLE, SAMPLE, 0, 0, MAG_SIZE, MAG_SIZE);
            // Crosshair lines
            mctx.strokeStyle = 'rgba(255,255,255,0.75)';
            mctx.lineWidth = 1;
            mctx.beginPath();
            mctx.moveTo(MAG_SIZE / 2, 0);    mctx.lineTo(MAG_SIZE / 2, MAG_SIZE);
            mctx.moveTo(0, MAG_SIZE / 2);    mctx.lineTo(MAG_SIZE, MAG_SIZE / 2);
            mctx.stroke();
            // Centre pixel highlight box
            const cellW = MAG_SIZE / SAMPLE;
            mctx.strokeStyle = 'rgba(0,0,0,0.9)';
            mctx.lineWidth = 1.5;
            mctx.strokeRect(MAG_SIZE / 2 - cellW / 2, MAG_SIZE / 2 - cellW / 2, cellW, cellW);
        };

        _csHandlers._canvasMove = opt => { _updateMag(opt.e); };
        _csHandlers._canvasDown = opt => {
            const pointer = c.getPointer(opt.e);
            const { tmp } = _sampleCanvas(pointer);
            const px  = tmp.getContext('2d').getImageData(Math.round(pointer.x), Math.round(pointer.y), 1, 1).data;
            const hex = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            _csAddRecentColor(hex);
            const obj = c.getActiveObject();
            if (obj) { _csPropSet('fill', hex); c.renderAll(); _csPushHistory(); }
            showToast(`Picked ${hex}`, 'info');
            // Stay on eyedropper — user must manually switch tool
        };
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:down', _csHandlers._canvasDown);
    }
    // Hide eyedropper magnifier if switching away
    if (tool !== 'eyedropper') {
        const mag = document.getElementById('cs-eyedrop-mag');
        if (mag) mag.style.display = 'none';
    }

    if (tool === 'fill') {
        c.defaultCursor = 'cell';
        _csHandlers._canvasDown = opt => {
            const obj = opt.target;
            if (!obj) return;
            const color = _csRecentColors[0] || '#00f2fe';
            obj.set('fill', color);
            c.renderAll(); _csPushHistory();
            csTool('select');
        };
        c.on('mouse:down', _csHandlers._canvasDown);
    }

    if (tool === 'zoom') {
        c.defaultCursor = 'zoom-in';
        _csHandlers._canvasDown = opt => {
            const delta = opt.e.altKey ? -0.3 : 0.3;
            _csZoom = Math.min(4, Math.max(0.25, _csZoom + delta));
            _csScaleCanvas();
        };
        _csHandlers._canvasMove = opt => {
            c.defaultCursor = opt.e.altKey ? 'zoom-out' : 'zoom-in';
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
    }

    if (tool === 'crop') {
        // Just enter crop mode on the selected image, then switch back to select
        const obj = c.getActiveObject();
        if (obj && obj.type === 'image') {
            _csEnterCropMode();
        } else {
            showToast('Select an image first', 'error');
        }
        csTool('select');
        return;
    }

    if (tool === 'hand') {
        let isPanning = false, lastX = 0, lastY = 0;
        const wrapper = c.wrapperEl;
        if (wrapper) {
            _csHandlers.mousedown = e => {
                isPanning = true; lastX = e.clientX; lastY = e.clientY;
                wrapper.style.cursor = 'grabbing';
            };
            _csHandlers.mousemove = e => {
                if (!isPanning) return;
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX; lastY = e.clientY;
                const vpt = c.viewportTransform.slice();
                vpt[4] += dx; vpt[5] += dy;
                c.setViewportTransform(vpt);
                c.renderAll();
            };
            _csHandlers.mouseup = () => {
                isPanning = false;
                if (wrapper) wrapper.style.cursor = 'grab';
            };
            wrapper.addEventListener('mousedown', _csHandlers.mousedown);
            document.addEventListener('mousemove', _csHandlers.mousemove);
            document.addEventListener('mouseup', _csHandlers.mouseup);
        }
    }

    // ── Lasso Tool ───────────────────────────────────────────────────────────
    if (tool === 'lasso') {
        c.defaultCursor = 'crosshair';
        _csLassoPts = [];
        _csLassoActive = false;
        const svg  = document.getElementById('cs-lasso-svg');
        const poly = document.getElementById('cs-lasso-poly');
        if (svg) svg.style.display = 'block';

        _csHandlers._canvasDown = opt => {
            _csLassoActive = true;
            _csLassoPts = [];
            const canvasEl = c.getElement();
            const rect = canvasEl.getBoundingClientRect();
            const e = opt.e;
            _csLassoPts.push({ sx: e.clientX - rect.left, sy: e.clientY - rect.top, cx: c.getPointer(e).x, cy: c.getPointer(e).y });
        };
        _csHandlers._canvasMove = opt => {
            if (!_csLassoActive) return;
            const canvasEl = c.getElement();
            const rect = canvasEl.getBoundingClientRect();
            const e = opt.e;
            _csLassoPts.push({ sx: e.clientX - rect.left, sy: e.clientY - rect.top, cx: c.getPointer(e).x, cy: c.getPointer(e).y });
            if (poly) poly.setAttribute('points', _csLassoPts.map(p => `${p.sx},${p.sy}`).join(' '));
        };
        _csHandlers._canvasUp = () => {
            if (!_csLassoActive || _csLassoPts.length < 3) { _csLassoActive = false; return; }
            _csLassoActive = false;
            // Ray-casting polygon test in canvas coordinates
            const polygon = _csLassoPts.map(p => ({ x: p.cx, y: p.cy }));
            const selected = c.getObjects().filter(obj => {
                if (obj.data?.isTraitPreview) return false;
                const br = obj.getBoundingRect(true);
                // Test all four corners of the bounding rect
                const corners = [
                    { x: br.left, y: br.top },
                    { x: br.left + br.width, y: br.top },
                    { x: br.left, y: br.top + br.height },
                    { x: br.left + br.width, y: br.top + br.height },
                    { x: br.left + br.width / 2, y: br.top + br.height / 2 },
                ];
                return corners.some(pt => _csPointInPolygon(pt.x, pt.y, polygon));
            });
            if (selected.length === 1) {
                c.setActiveObject(selected[0]);
            } else if (selected.length > 1) {
                const sel = new fabric.ActiveSelection(selected, { canvas: c });
                c.setActiveObject(sel);
            }
            c.renderAll();
            if (poly) poly.setAttribute('points', '');
            if (svg)  svg.style.display = 'none';
            csTool('select');
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
    }

    // ── Measure Tool ─────────────────────────────────────────────────────────
    if (tool === 'measure') {
        c.defaultCursor = 'crosshair';
        _csMeasureStart = null;
        _csMeasureActive = false;
        const msvg  = document.getElementById('cs-measure-svg');
        const mline = document.getElementById('cs-measure-line');
        const md1   = document.getElementById('cs-measure-dot1');
        const md2   = document.getElementById('cs-measure-dot2');
        const mtip  = document.getElementById('cs-measure-tip');
        const canvasEl = c.getElement();

        _csHandlers._canvasDown = opt => {
            _csMeasureActive = true;
            _csMeasureStart = c.getPointer(opt.e);
            if (msvg) msvg.style.display = 'block';
            if (mtip) mtip.style.display = 'none';
        };
        _csHandlers._canvasMove = opt => {
            if (!_csMeasureActive || !_csMeasureStart) return;
            const end = c.getPointer(opt.e);
            const rect = canvasEl.getBoundingClientRect();
            const zoom = _csZoom;
            // Convert canvas coords to screen px relative to canvas area
            const toScreen = (cx, cy) => ({
                sx: cx * zoom + rect.left - (document.getElementById('cs-canvas-area')?.getBoundingClientRect().left || rect.left),
                sy: cy * zoom + rect.top  - (document.getElementById('cs-canvas-area')?.getBoundingClientRect().top  || rect.top),
            });
            const s = toScreen(_csMeasureStart.x, _csMeasureStart.y);
            const e2 = toScreen(end.x, end.y);
            if (mline) { mline.setAttribute('x1', s.sx); mline.setAttribute('y1', s.sy); mline.setAttribute('x2', e2.sx); mline.setAttribute('y2', e2.sy); }
            if (md1)   { md1.setAttribute('cx', s.sx); md1.setAttribute('cy', s.sy); }
            if (md2)   { md2.setAttribute('cx', e2.sx); md2.setAttribute('cy', e2.sy); }
            const dx = end.x - _csMeasureStart.x;
            const dy = end.y - _csMeasureStart.y;
            const dist = Math.round(Math.sqrt(dx*dx + dy*dy));
            const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
            if (mtip) {
                mtip.style.display = 'block';
                mtip.style.left = (e2.sx + 12) + 'px';
                mtip.style.top  = (e2.sy - 10) + 'px';
                mtip.innerHTML  = `<span style="color:var(--a);">${dist}px</span> &nbsp;${angle}° &nbsp;<span style="opacity:0.6;">Δx ${Math.round(dx)} Δy ${Math.round(dy)}</span>`;
            }
        };
        _csHandlers._canvasUp = () => {
            _csMeasureActive = false;
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
    }

    // ── Frame Tool ───────────────────────────────────────────────────────────
    if (tool === 'frame') {
        c.defaultCursor = 'crosshair';
        let isDown = false, frameRect, origX, origY;
        _csHandlers._canvasDown = opt => {
            isDown = true;
            const p = c.getPointer(opt.e);
            origX = p.x; origY = p.y;
            frameRect = new fabric.Rect({
                left: p.x, top: p.y, width: 0, height: 0,
                fill: 'rgba(0,242,254,0.03)',
                stroke: '#00f2fe',
                strokeWidth: 1.5,
                strokeDashArray: [6, 3],
                rx: 4, ry: 4,
            });
            frameRect.data = { layerName: 'Frame', layerType: 'frame', isFrame: true };
            c.add(frameRect);
        };
        _csHandlers._canvasMove = opt => {
            if (!isDown) return;
            const p = c.getPointer(opt.e);
            frameRect.set({ width: Math.abs(origX - p.x), height: Math.abs(origY - p.y) });
            if (origX > p.x) frameRect.set({ left: p.x });
            if (origY > p.y) frameRect.set({ top: p.y });
            c.renderAll();
        };
        _csHandlers._canvasUp = () => {
            if (!isDown) return;
            isDown = false;
            if (frameRect.width < 10 || frameRect.height < 10) {
                c.remove(frameRect);
            } else {
                c.setActiveObject(frameRect);
                _csPushHistory(); _csRenderLayerList();
                showToast('Frame added — drag objects onto it, then use "Use as Mask" in the context bar', 'info');
            }
            csTool('select');
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
    }

    // ── Dodge Tool ───────────────────────────────────────────────────────────
    if (tool === 'dodge') {
        _csBrushMode = 'dodge';
        c.isDrawingMode = true;
        c.freeDrawingBrush = new fabric.PencilBrush(c);
        c.freeDrawingBrush.color = 'rgba(255,255,255,0.12)';
        c.freeDrawingBrush.width = _csBrushSize * 2;
        const origSetStyles = c.freeDrawingBrush._setBrushStyles.bind(c.freeDrawingBrush);
        c.freeDrawingBrush._setBrushStyles = function(ctx) { origSetStyles(ctx); ctx.globalCompositeOperation = 'screen'; };
        _csShowBrushContextBar();
    }

    // ── Burn Tool ────────────────────────────────────────────────────────────
    if (tool === 'burn') {
        _csBrushMode = 'burn';
        c.isDrawingMode = true;
        c.freeDrawingBrush = new fabric.PencilBrush(c);
        c.freeDrawingBrush.color = 'rgba(0,0,0,0.12)';
        c.freeDrawingBrush.width = _csBrushSize * 2;
        const origSetStyles2 = c.freeDrawingBrush._setBrushStyles.bind(c.freeDrawingBrush);
        c.freeDrawingBrush._setBrushStyles = function(ctx) { origSetStyles2(ctx); ctx.globalCompositeOperation = 'multiply'; };
        _csShowBrushContextBar();
    }

    // ── Magic Select ─────────────────────────────────────────────────────────
    if (tool === 'magic') {
        c.defaultCursor = 'crosshair';
        _csHandlers._canvasDown = opt => {
            const obj = opt.target;
            const p   = c.getPointer(opt.e);
            if (obj && obj.type === 'image') {
                _csMagicErase(obj, p.x, p.y);
            } else {
                showToast('Click on an image layer to erase by colour', 'error');
            }
            csTool('select');
        };
        c.on('mouse:down', _csHandlers._canvasDown);
    }

    // ── Blur Brush ───────────────────────────────────────────────────────────
    if (tool === 'blur') {
        _csBrushMode = 'blur';
        c.isDrawingMode = false;
        c.selection = false;
        c.defaultCursor = 'crosshair';
        let isBlurring = false;
        let _blurObj = null;
        let _blurOffscreen = null;

        const _applyBlurAt = (e) => {
            if (!_blurObj || !_blurOffscreen) return;
            const p = c.getPointer(e);
            const obj = _blurObj;
            const localPt = obj.toLocalPoint(new fabric.Point(p.x, p.y), 'left', 'top');
            const imgX = Math.round(localPt.x);
            const imgY = Math.round(localPt.y);
            const radius = Math.max(4, Math.round(_csBrushSize * 1.5 / Math.min(obj.scaleX || 1, obj.scaleY || 1)));
            const ctx = _blurOffscreen.getContext('2d');
            const px = Math.max(0, imgX - radius);
            const py = Math.max(0, imgY - radius);
            const sw = Math.min(radius * 2, _blurOffscreen.width - px);
            const sh = Math.min(radius * 2, _blurOffscreen.height - py);
            if (sw <= 0 || sh <= 0) return;
            const data = ctx.getImageData(px, py, sw, sh);
            _csBoxBlur(data, sw, sh, Math.max(2, Math.round(_csBrushSize / 3)));
            ctx.putImageData(data, px, py);
            obj.setElement(_blurOffscreen);
            c.renderAll();
        };

        _csHandlers._canvasDown = opt => {
            const obj = opt.target || c.getActiveObject();
            if (!obj || obj.type !== 'image') return;
            isBlurring = true;
            _blurObj = obj;
            const el = obj._element;
            _blurOffscreen = document.createElement('canvas');
            _blurOffscreen.width = el.naturalWidth || el.width;
            _blurOffscreen.height = el.naturalHeight || el.height;
            _blurOffscreen.getContext('2d').drawImage(el, 0, 0);
            _applyBlurAt(opt.e);
        };
        _csHandlers._canvasMove = opt => {
            if (!isBlurring) return;
            _applyBlurAt(opt.e);
        };
        _csHandlers._canvasUp = async () => {
            if (!isBlurring || !_blurOffscreen || !_blurObj) return;
            isBlurring = false;
            const off = _blurOffscreen;
            const old = _blurObj;
            _blurOffscreen = null; _blurObj = null;
            const blob = await new Promise(res => off.toBlob(res, 'image/png'));
            const url = URL.createObjectURL(blob);
            fabric.Image.fromURL(url, newImg => {
                newImg.set({
                    left: old.left, top: old.top,
                    scaleX: old.scaleX, scaleY: old.scaleY,
                    originX: old.originX, originY: old.originY,
                    angle: old.angle,
                });
                newImg.data = { ...old.data };
                c.remove(old);
                c.add(newImg);
                c.setActiveObject(newImg);
                c.renderAll();
                URL.revokeObjectURL(url);
                _csPushHistory(); _csRenderLayerList();
            });
        };
        c.on('mouse:down', _csHandlers._canvasDown);
        c.on('mouse:move', _csHandlers._canvasMove);
        c.on('mouse:up',   _csHandlers._canvasUp);
        _csShowBrushContextBar();
    }

    c.renderAll();
    _csSyncPaintLayerInteract();
}
window.csTool = csTool;

window.csAddImage = function() {
    document.getElementById('cs-image-input')?.click();
};

async function _csImportImageFile(file) {
    if (!file || !_csCanvas) return false;
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large (> 10MB)', 'error');
        return false;
    }
    showToast('Uploading image...', 'loading');

    let imgUrl = null;
    try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST', headers: { 'X-CSRF-Token': _csCsrfToken }, body: fd, credentials: 'include',
        });
        if (res.ok) { const d = await res.json(); imgUrl = d.url; }
    } catch {}

    if (imgUrl) {
        if (!_csLibImages.find(i => i.url === imgUrl)) _csLibImages.unshift({ url: imgUrl, key: '', size: 0 });
        _csRenderLibrary();
        if (file.type === 'image/svg+xml' || _csIsSvgUrl(imgUrl)) {
            _csAddSvgToCanvas(imgUrl, file.name || 'SVG');
            return;
        }
        const safeImg = await _csLoadSafeImage(imgUrl);
        if (!safeImg || !_csCanvas) return;
        const fi = new fabric.Image(safeImg);
        const scale = Math.min((CS_W * 0.85) / safeImg.naturalWidth, (CS_H * 0.85) / safeImg.naturalHeight, 1);
        fi.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
        fi.data = { layerName: file.name || 'Image', layerType: 'image', originalUrl: imgUrl };
        _csCanvas.add(fi); _csCanvas.setActiveObject(fi); _csCanvas.renderAll();
        _csPushHistory(); _csRenderLayerList();
        showToast('Image added', 'success');
        return true;
    } else {
        await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = evt => {
                const dataUrl = evt.target.result;
                if (file.type === 'image/svg+xml') {
                    _csAddSvgToCanvas(dataUrl, file.name || 'SVG');
                    resolve();
                    return;
                }
                fabric.Image.fromURL(dataUrl, img => {
                    if (!img || !_csCanvas) {
                        resolve();
                        return;
                    }
                    const scale = Math.min((CS_W * 0.85) / img.width, (CS_H * 0.85) / img.height, 1);
                    img.set({ left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
                    img.data = { layerName: file.name || 'Image', layerType: 'image' };
                    _csCanvas.add(img); _csCanvas.setActiveObject(img); _csCanvas.renderAll();
                    _csPushHistory(); _csRenderLayerList();
                    showToast('Image added (local)', 'success');
                    resolve();
                });
            };
            reader.readAsDataURL(file);
        });
        return true;
    }
}

window._csHandleImageFile = async function(e) {
    const file = e.target?.files?.[0];
    if (e.target) e.target.value = '';
    await _csImportImageFile(file);
};

/* ─── Shape Popout ───────────────────────────────────────────────────────── */
function _csDropShape(type) {
    if (!_csCanvas) return;
    const fill = '#00f2fe', stroke = 'rgba(0,0,0,0.35)', strokeWidth = 1;
    const common = { fill, stroke, strokeWidth, originX: 'center', originY: 'center', left: CS_W / 2, top: CS_H / 2 };
    const name = _CS_SHAPE_CATALOG.find(s => s.id === type)?.label || 'Shape';
    let obj;
    switch (type) {
        case 'roundrect':   obj = new fabric.Rect({ ...common, width: 120, height: 80, rx: 20, ry: 20 }); break;
        case 'diamond':     obj = new fabric.Polygon(_csPoly(0, 0, 55, 4), common); break;
        case 'rtriangle':   obj = new fabric.Polygon([{x:-50,y:-50},{x:50,y:50},{x:-50,y:50}], common); break;
        case 'pentagon':    obj = new fabric.Polygon(_csPoly(0, 0, 55, 5), common); break;
        case 'star5':       obj = new fabric.Polygon(_csPoly(0, 0, 55, 10, 22), common); break;
        case 'starburst':   obj = new fabric.Polygon(_csPoly(0, 0, 55, 16, 38), common); break;
        case 'star6':       obj = new fabric.Polygon(_csPoly(0, 0, 55, 12, 27), common); break;
        case 'arrow':       obj = new fabric.Path('M 0,30 L 65,30 L 65,10 L 100,50 L 65,90 L 65,70 L 0,70 Z', common); break;
        case 'doublearrow': obj = new fabric.Path('M 0,50 L 28,15 L 28,38 L 72,38 L 72,15 L 100,50 L 72,85 L 72,62 L 28,62 L 28,85 Z', common); break;
        case 'heart':       obj = new fabric.Path('M 50,82 C 10,62 0,40 0,28 A 28,28,0,0,1,50,14 A 28,28,0,0,1,100,28 C 100,40 90,62 50,82 Z', common); break;
        case 'cloud':       obj = new fabric.Path('M 20,68 Q 0,68 0,50 Q 0,34 18,34 Q 14,14 32,10 Q 46,4 58,14 Q 65,5 76,12 Q 92,16 90,34 Q 102,36 100,50 Q 100,62 84,60 Z', common); break;
        case 'moon':        obj = new fabric.Path('M 60,5 A 48,48,0,1,0,60,95 A 30,40,0,1,1,60,5 Z', common); break;
        case 'speech':      obj = new fabric.Path('M 10,0 L 90,0 Q 100,0,100,12 L 100,65 Q 100,77,88,77 L 45,77 L 25,100 L 30,77 L 12,77 Q 0,77,0,65 L 0,12 Q 0,0,10,0 Z', common); break;
        case 'droplet':     obj = new fabric.Path('M 50,0 C 28,26 5,50 5,68 A 45,38,0,0,0,95,68 C 95,50 72,26 50,0 Z', common); break;
        case 'plus':        obj = new fabric.Path('M 38,0 L 62,0 L 62,38 L 100,38 L 100,62 L 62,62 L 62,100 L 38,100 L 38,62 L 0,62 L 0,38 L 38,38 Z', common); break;
        case 'hexagon':     obj = new fabric.Polygon(_csPoly(0, 0, 55, 6), common); break;
        default: return;
    }
    obj.data = { layerName: name, layerType: 'shape' };
    _csCanvas.add(obj); _csCanvas.setActiveObject(obj); _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    csTool('select');
}

function _csSetShapeDocIcon(id) {
    const el = document.getElementById('cst-shape-icon');
    if (el) el.innerHTML = `<svg viewBox="0 0 30 30" width="18" height="18">${_csSvgIcon(id)}</svg>`;
}

window.csShapePopout = function() {
    const popout = document.getElementById('cs-shape-popout');
    if (!popout) return;
    if (!popout.dataset.rendered) {
        popout.innerHTML = _CS_SHAPE_CATALOG.map(s =>
            `<button class="cs-shape-opt" onclick="csPickShape('${s.id}')" title="${s.label}">
                <svg viewBox="0 0 30 30" width="22" height="22">${_csSvgIcon(s.id)}</svg>
            </button>`
        ).join('');
        popout.dataset.rendered = '1';
    }
    popout.classList.toggle('hidden');
};

window.csPickShape = function(id) {
    const shape = _CS_SHAPE_CATALOG.find(s => s.id === id);
    if (!shape) return;
    document.getElementById('cs-shape-popout')?.classList.add('hidden');
    _csSetShapeDocIcon(id);
    if (shape.drag) {
        csTool(id);
        document.querySelectorAll('#cs-toolstrip .cs-t').forEach(b => b.classList.remove('active'));
        document.getElementById('cst-shape')?.classList.add('active');
    } else {
        _csDropShape(id);
    }
};

window.csNewLayer = function() {
    // Don't add anything to canvas — just register a pending layer.
    // It materialises into a real group the moment the first stroke lands.
    _csPendingLayer = { name: 'Layer' };
    _csCanvas?.discardActiveObject();
    _csCanvas?.renderAll();
    _csRenderLayerList();
};

window.csNewType = function(type) {
    if (!_csCanvas) return;
    document.getElementById('cs-layer-plus-menu')?.classList.add('hidden');

    if (type === 'text') {
        const t = new fabric.IText('New Text', {
            left: CS_W/2, top: CS_H/2, originX: 'center', originY: 'center',
            fontFamily: 'Space Grotesk, Arial', fontSize: 40, fill: '#ffffff',
            fontWeight: 'bold'
        });
        t.data = { layerName: 'Text Layer', layerType: 'text' };
        _csCanvas.add(t); _csCanvas.setActiveObject(t);
    } else if (type === 'paint') {
        const group = new fabric.Group([], { left: 0, top: 0, subTargetCheck: true });
        group.data = { layerName: 'Paint Layer', layerType: 'paint' };
        _csCanvas.add(group); _csCanvas.setActiveObject(group);
        csTool('draw');
    } else if (type === 'group') {
        const active = _csCanvas.getActiveObjects();
        if (active.length > 0) {
            csGroup();
        } else {
            const group = new fabric.Group([], { left: CS_W/2, top: CS_H/2 });
            group.data = { layerName: 'Group', layerType: 'group' };
            _csCanvas.add(group); _csCanvas.setActiveObject(group);
        }
    }
    _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList();
};

window.csDeleteSelected = function() {
    if (!_csCanvas) return;
    const objs = _csCanvas.getActiveObjects();
    if (!objs.length) return;
    _csCanvas.discardActiveObject();
    objs.forEach(o => {
        if (o.data?.isTraitZone) _csTraitRenderData = null;
        _csCanvas.remove(o);
    });
    _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
};

/* ─── History ────────────────────────────────────────────────────────────── */
function _csUpdateHistoryButtons() {
    const undoBtn = document.querySelector('[onclick="csUndo()"]');
    const redoBtn = document.querySelector('[onclick="csRedo()"]');
    if (undoBtn) undoBtn.disabled = _csHistoryIdx <= 0;
    if (redoBtn) redoBtn.disabled = _csHistoryIdx >= _csHistory.length - 1;
}

let _csHistoryLabels = [];

function _csPushHistory(label) {
    if (_csHistoryPaused || !_csCanvas) return;
    _csHasUnsavedChanges = true;
    const json = JSON.stringify(_csCanvas.toJSON(['data']));
    _csHistory.splice(_csHistoryIdx + 1);
    _csHistoryLabels.splice(_csHistoryIdx + 1);
    _csHistory.push(json);
    _csHistoryLabels.push(label || _csAutoHistoryLabel());
    if (_csHistory.length > 60) { _csHistory.shift(); _csHistoryLabels.shift(); } else _csHistoryIdx++;
    _csUpdateHistoryButtons();
    _csScheduleDraft();
}

function _csAutoHistoryLabel() {
    if (!_csCanvas) return 'Edit';
    const obj = _csCanvas.getActiveObject();
    if (!obj) return 'Canvas change';
    const name = obj.data?.layerName || obj.type || 'Object';
    return name;
}

window.csToggleHistory = function() {
    const dd = document.getElementById('cs-history-dropdown');
    if (!dd) return;
    if (dd.style.display !== 'none') { dd.style.display = 'none'; return; }
    // Build list — most recent first, show last 15 steps
    const items = [];
    const start = Math.max(0, _csHistoryIdx - 14);
    for (let i = _csHistoryIdx; i >= start; i--) {
        const isCurrent = i === _csHistoryIdx;
        const label = _csHistoryLabels[i] || `Step ${i + 1}`;
        items.push(`<div onclick="csJumpHistory(${i})" style="
            padding:6px 10px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:${isCurrent?'700':'500'};
            color:${isCurrent?'#00f2fe':'rgba(255,255,255,0.7)'};
            background:${isCurrent?'rgba(0,242,254,0.08)':'transparent'};
            display:flex;align-items:center;gap:8px;transition:background 0.1s;
        " onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='${isCurrent?'rgba(0,242,254,0.08)':'transparent'}'">
            <span style="font-size:8px;opacity:0.4;min-width:20px;text-align:right;">${i + 1}</span>
            <span>${label}</span>
            ${isCurrent ? '<span style="font-size:8px;opacity:0.5;margin-left:auto;">current</span>' : ''}
        </div>`);
    }
    dd.innerHTML = items.join('') || '<div style="padding:8px 10px;font-size:10px;color:rgba(255,255,255,0.3);">No history yet</div>';
    dd.style.display = 'block';
    // Close on outside click
    setTimeout(() => {
        const close = (e) => { if (!dd.contains(e.target) && e.target.id !== 'cs-hist-arrow') { dd.style.display = 'none'; document.removeEventListener('mousedown', close); } };
        document.addEventListener('mousedown', close);
    }, 0);
};

window.csJumpHistory = function(idx) {
    if (idx < 0 || idx >= _csHistory.length || !_csCanvas) return;
    _csHistoryIdx = idx;
    _csHistoryPaused = true;
    _csCanvas.loadFromJSON(_csHistory[_csHistoryIdx], () => {
        _csCanvas.renderAll();
        _csHistoryPaused = false;
        _csRenderLayerList();
        _csUpdateHistoryButtons();
    });
    document.getElementById('cs-history-dropdown').style.display = 'none';
};

window.csUndo = function() {
    if (_csHistoryIdx <= 0 || !_csCanvas) return;
    _csHistoryIdx--;
    _csHistoryPaused = true;
    _csCanvas.loadFromJSON(_csHistory[_csHistoryIdx], () => {
        _csCanvas.renderAll();
        _csHistoryPaused = false;
        _csRenderLayerList();
        _csUpdateHistoryButtons();
    });
};

window.csRedo = function() {
    if (_csHistoryIdx >= _csHistory.length - 1 || !_csCanvas) return;
    _csHistoryIdx++;
    _csHistoryPaused = true;
    _csCanvas.loadFromJSON(_csHistory[_csHistoryIdx], () => {
        _csCanvas.renderAll();
        _csHistoryPaused = false;
        _csRenderLayerList();
        _csUpdateHistoryButtons();
    });
};

/* ─── Layer thumbnails ───────────────────────────────────────────────────── */
function _csThumbnailSync(obj) {
    try {
        const size = 36;
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = size; tmpCanvas.height = size;
        const ctx = tmpCanvas.getContext('2d');
        // Checker pattern background (transparent indicator)
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, size, size);
        for (let r = 0; r < size; r += 6) {
            for (let c = 0; c < size; c += 6) {
                if ((Math.floor(r/6) + Math.floor(c/6)) % 2 === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.fillRect(c, r, 6, 6);
                }
            }
        }
        const bb = obj.getBoundingRect(true);
        if (!bb || bb.width <= 0 || bb.height <= 0) return tmpCanvas;
        const pad = 3;
        const scale = Math.min((size - pad * 2) / bb.width, (size - pad * 2) / bb.height);
        const offsetX = pad + (size - pad * 2 - bb.width * scale) / 2 - bb.left * scale;
        const offsetY = pad + (size - pad * 2 - bb.height * scale) / 2 - bb.top * scale;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        obj.render(ctx);
        ctx.restore();
        return tmpCanvas;
    } catch (e) {
        return null;
    }
}

/* ─── Layer list ─────────────────────────────────────────────────────────── */
function _csDestroyLayerSortable() {
    if (_csLayerSortable) {
        try { _csLayerSortable.destroy(); } catch (e) { /* noop */ }
        _csLayerSortable = null;
    }
}

/** Apply Fabric z-order from layer panel DOM (top row = front). Uses snapshot indices from data-cs-idx. */
function _csApplyLayerOrderFromRows(sortRoot) {
    if (!_csCanvas || !sortRoot) return;
    const rows = [...sortRoot.querySelectorAll('.cs-lr[data-cs-idx]')];
    if (!rows.length) return;
    const stackBefore = [..._csCanvas.getObjects()];
    const topToBottom = rows.map(r => {
        const idx = parseInt(r.dataset.csIdx, 10);
        return Number.isFinite(idx) && stackBefore[idx] ? stackBefore[idx] : null;
    }).filter(Boolean);
    if (topToBottom.length !== rows.length) return;

    const pairs = topToBottom.map(o => ({ o, i: stackBefore.indexOf(o) })).filter(p => p.i >= 0);
    if (!pairs.length) return;
    const insertAt = Math.min(...pairs.map(p => p.i));
    pairs.sort((a, b) => b.i - a.i).forEach(({ o }) => _csCanvas.remove(o));
    const bottomToTop = [...topToBottom].reverse();
    bottomToTop.forEach((o, k) => {
        _csCanvas.insertAt(o, insertAt + k);
    });
}

function _csRenderLayerList() {
    void _csRenderLayerListAsync();
}

async function _csRenderLayerListAsync() {
    const list = document.getElementById('cs-layer-list');
    if (!list || !_csCanvas) return;

    _csDestroyLayerSortable();

    const objects = [..._csCanvas.getObjects()].reverse().filter(o => !o.data?.isTraitPreview);

    // Pending virtual layer row (shows before first stroke is drawn)
    const pendingRow = _csPendingLayer ? `
        <div class="cs-lr sel" style="opacity:0.6;">
            <span class="cs-dh" style="pointer-events:none;"><i class="bx bxs-dots-vertical"></i></span>
            <div class="cs-lr-thumb"><i class="bx bxs-layer" style="font-size:11px;opacity:0.3;"></i></div>
            <span class="cs-lr-name">${escapeHTML(_csPendingLayer.name)}</span>
            <div class="cs-lr-actions" style="font-size:8px;color:var(--muted);padding-right:4px;">draw to fill</div>
        </div>` : '';

    if (objects.length === 0 && !_csPendingLayer) {
        list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;text-align:center;">
            <div style="width:52px;height:52px;border-radius:16px;background:oklch(from var(--a) l c h / 0.08);border:1px solid oklch(from var(--a) l c h / 0.15);display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
                <i class="bx bxs-layer" style="font-size:22px;color:var(--a);opacity:0.6;"></i>
            </div>
            <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--text);margin-bottom:6px;">No layers yet</div>
            <div style="font-size:10px;line-height:1.6;color:var(--muted);margin-bottom:14px;">Start designing by adding a shape,<br>text block, or image.</div>
            <div style="display:flex;flex-direction:column;gap:5px;width:100%;">
                <button onclick="csAddShape('rect')" class="cs-tbtn cs-ghost" style="width:100%;padding:6px 10px;font-size:9px;justify-content:space-between;">
                    <span><i class="bx bxs-square" style="margin-right:6px;"></i>Add Shape</span><kbd style="opacity:0.4;font-size:8px;">R</kbd>
                </button>
                <button onclick="csTool('text')" class="cs-tbtn cs-ghost" style="width:100%;padding:6px 10px;font-size:9px;justify-content:space-between;">
                    <span><i class="bx bxs-t" style="margin-right:6px;"></i>Add Text</span><kbd style="opacity:0.4;font-size:8px;">T</kbd>
                </button>
                <button onclick="csAddImage()" class="cs-tbtn cs-ghost" style="width:100%;padding:6px 10px;font-size:9px;justify-content:space-between;">
                    <span><i class="bx bxs-image" style="margin-right:6px;"></i>Add Image</span><kbd style="opacity:0.4;font-size:8px;">I</kbd>
                </button>
            </div>
        </div>`;
        return;
    }

    if (objects.length === 0) {
        list.innerHTML = pendingRow;
        return;
    }

    const iconFor = t => ({ text: 'bxs-font', 'i-text': 'bxs-font', rect: 'bxs-square', circle: 'bxs-circle', path: 'bxs-pen', image: 'bxs-image', line: 'bxs-minus', paint: 'bxs-pen' })[t] || 'bxs-layer';

    const rowsHtml = objects.map((obj, i) => {
        const fabricIdx = _csCanvas.getObjects().indexOf(obj);
        const name = obj.data?.layerName || `Layer ${i + 1}`;
        const type = obj.data?.layerType || obj.type || '';
        const active = _csCanvas.getActiveObject();
        const isSelected = (() => {
            if (!active) return false;
            if (active.type === 'activeSelection') return active.getObjects().some(o => _csRootCanvasObject(o) === obj);
            return _csRootCanvasObject(active) === obj;
        })();
        const isHidden = !obj.visible;
        const isLocked = !!(obj.lockMovementX || obj.lockMovementY);

        // Groups act as folders
        const isGroup = obj.type === 'group';
        const isExpanded = isGroup && _csExpandedGroups.has(fabricIdx);
        const children = isGroup ? (obj._objects || []) : [];

        const folderToggle = isGroup ? `
            <button class="cs-vb cs-folder-toggle" onclick="event.stopPropagation();_csToggleGroupExpand(${fabricIdx})" title="${isExpanded ? 'Collapse' : 'Expand'}">
                <i class="bx bx-chevron-${isExpanded ? 'down' : 'right'}" style="font-size:12px;"></i>
            </button>` : '';

        const folderIcon = isGroup
            ? `<i class="bx ${isExpanded ? 'bxs-folder-open' : 'bxs-folder'}" style="font-size:11px;opacity:0.6;color:var(--a);"></i>`
            : `<i class="bx ${iconFor(type)}" style="font-size:11px;opacity:0.3;"></i>`;

        const childCount = isGroup && children.length
            ? `<span style="font-size:8px;color:var(--muted);margin-left:2px;flex-shrink:0;">${children.length}</span>`
            : '';

        let html = `<div class="cs-lr${isSelected ? ' sel' : ''}${isLocked ? ' locked' : ''}${isGroup ? ' cs-lr-group' : ''}"
            onclick="_csSelectLayer(${fabricIdx})"
            data-cs-idx="${fabricIdx}" id="cs-layer-row-${fabricIdx}">
            <span class="cs-dh" title="Drag row to reorder"><i class="bx bxs-dots-vertical"></i></span>
            ${folderToggle}
            <div class="cs-lr-thumb" id="cs-lr-thumb-${fabricIdx}">${folderIcon}</div>
            <span class="cs-lr-name" ondblclick="event.stopPropagation();_csStartRename(${fabricIdx})"
                title="Double-click to rename">${escapeHTML(name)}</span>
            ${childCount}
            <div class="cs-lr-actions">
                <button class="cs-vb" onclick="event.stopPropagation();_csToggleLock(${fabricIdx})"
                    title="${isLocked ? 'Unlock layer' : 'Lock layer'}">
                    <i class="bx ${isLocked ? 'bxs-lock' : 'bxs-lock-open'}"></i>
                </button>
                <button class="cs-vb" onclick="event.stopPropagation();_csToggleVis(${fabricIdx})"
                    title="${isHidden ? 'Show layer' : 'Hide layer'}"
                    style="${isHidden ? 'color:var(--muted);' : ''}">
                    <i class="bx ${isHidden ? 'bxs-hide' : 'bxs-show'}"></i>
                </button>
            </div>
        </div>`;

        // Render children when expanded
        if (isExpanded && children.length) {
            html += children.map((child, ci) => {
                const childType  = child.data?.layerType || child.type || '';
                const childName  = child.data?.layerName || `${childType || 'Object'} ${ci + 1}`;
                const childColor = child.stroke || child.fill || null;
                const colorDot   = childColor && childColor !== 'transparent'
                    ? `<span class="cs-lr-child-dot" style="background:${childColor};"></span>`
                    : '';
                const childIcon  = iconFor(childType);
                return `<div class="cs-lr-child" onclick="event.stopPropagation();_csGroupChildClick(${fabricIdx},${ci})">
                    <i class="bx ${childIcon}" style="font-size:9px;opacity:0.4;flex-shrink:0;"></i>
                    <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;">${escapeHTML(childName)}</span>
                    ${colorDot}
                    <button class="cs-vb" style="opacity:0.5;" onclick="event.stopPropagation();_csGroupChildDelete(${fabricIdx},${ci})" title="Delete stroke">
                        <i class="bx bxs-trash" style="font-size:9px;"></i>
                    </button>
                </div>`;
            }).join('');
        }

        return html;
    }).join('');

    list.innerHTML = `${pendingRow}<div class="cs-layer-rows" id="cs-layer-rows">${rowsHtml}</div>`;

    const rowsRoot = document.getElementById('cs-layer-rows');

    // Populate thumbnails (sync render pass)
    objects.forEach(obj => {
        const fabricIdx = _csCanvas.getObjects().indexOf(obj);
        const thumbEl = document.getElementById(`cs-lr-thumb-${fabricIdx}`);
        if (!thumbEl) return;
        const thumbCanvas = _csThumbnailSync(obj);
        if (thumbCanvas) {
            thumbEl.innerHTML = '';
            thumbEl.appendChild(thumbCanvas);
        }
    });

    await ensureSortableLoaded().catch(() => {});
    if (rowsRoot && typeof Sortable !== 'undefined') {
        _csLayerSortable = Sortable.create(rowsRoot, {
            animation: 120,
            draggable: '.cs-lr[data-cs-idx]',
            filter: '.locked, button, .cs-vb, input, textarea, .cs-lr-name-input',
            preventOnFilter: false,
            onEnd: (evt) => {
                if (!_csCanvas || evt.oldIndex === evt.newIndex) return;
                _csApplyLayerOrderFromRows(evt.to);
                _csCanvas.renderAll();
                _csPushHistory();
                _csRenderLayerList();
            }
        });
    }
}

/* ─── Inline layer rename ────────────────────────────────────────────────── */
window._csStartRename = function(fabricIdx) {
    const row = document.getElementById(`cs-layer-row-${fabricIdx}`);
    if (!row) return;
    const nameEl = row.querySelector('.cs-lr-name');
    if (!nameEl) return;
    const obj = _csCanvas?.getObjects()[fabricIdx];
    if (!obj) return;

    const input = document.createElement('input');
    input.className = 'cs-lr-name-input';
    input.value = obj.data?.layerName || nameEl.textContent;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
        const val = input.value.trim();
        if (!obj.data) obj.data = {};
        obj.data.layerName = val || `Layer`;
        _csRenderLayerList();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { _csRenderLayerList(); }
    });
};

window._csSelectLayer = function(fabricIdx) {
    if (!_csCanvas) return;
    const objs = _csCanvas.getObjects();
    if (fabricIdx >= 0 && fabricIdx < objs.length) {
        const obj = objs[fabricIdx];
        _csCanvas.setActiveObject(obj);
        _csCanvas.renderAll();
        _csRenderPropsPanel(obj);
        _csRenderLayerList();
    }
};

/** Toggle expand/collapse of a group layer in the layer list. */
window._csToggleGroupExpand = function(fabricIdx) {
    if (_csExpandedGroups.has(fabricIdx)) {
        _csExpandedGroups.delete(fabricIdx);
    } else {
        _csExpandedGroups.add(fabricIdx);
    }
    _csRenderLayerList();
};

/** Click a child item inside an expanded group layer. */
window._csGroupChildClick = function(groupFabricIdx, childIdx) {
    if (!_csCanvas) return;
    const grp = _csCanvas.getObjects()[groupFabricIdx];
    if (!grp || grp.type !== 'group') return;

    // Select the parent group on canvas
    _csCanvas.setActiveObject(grp);
    _csCanvas.renderAll();
    _csRenderPropsPanel(grp);

    // If it's a paint layer, enter edit mode and select the specific stroke
    if (grp.data?.layerType === 'paint') {
        _csEnterPaintStrokeEdit();
        requestAnimationFrame(() => {
            const editPaths = _csCanvas.getObjects().filter(o => o.data?._paintEdit);
            // editPaths are in reverse order from group._objects (canvas adds them in order)
            const target = editPaths[childIdx];
            if (target) {
                _csCanvas.setActiveObject(target);
                _csCanvas.renderAll();
                _csRenderPropsPanel(target);
            }
        });
    }
};

/** Delete a child item from a group layer directly from the layer list. */
window._csGroupChildDelete = function(groupFabricIdx, childIdx) {
    if (!_csCanvas) return;
    const grp = _csCanvas.getObjects()[groupFabricIdx];
    if (!grp || grp.type !== 'group') return;
    const child = (grp._objects || [])[childIdx];
    if (!child) return;
    grp.remove(child);
    if (typeof grp.addWithUpdate === 'function') grp.addWithUpdate();
    _csCanvas.renderAll();
    _csRenderLayerList();
    _csPushHistory();
};

window._csHighlightLayer = function(fabricIdx, active) {
    if (!_csCanvas) return;
    const obj = _csCanvas.getObjects()[fabricIdx];
    if (!obj) return;
    // Removed canvas-ring approach as it was janky.
    // CSS in the layer stack handles highlighting.
};

window._csToggleVis = function(fabricIdx) {
    if (!_csCanvas) return;
    const obj = _csCanvas.getObjects()[fabricIdx];
    if (obj) { obj.visible = !obj.visible; _csCanvas.renderAll(); _csRenderLayerList(); }
};

window._csToggleLock = function(fabricIdx) {
    if (!_csCanvas) return;
    const obj = _csCanvas.getObjects()[fabricIdx];
    if (!obj) return;
    const isLocked = !obj.lockMovementX;
    obj.set({
        lockMovementX: isLocked, lockMovementY: isLocked,
        lockScalingX: isLocked, lockScalingY: isLocked,
        lockRotation: isLocked, hasControls: !isLocked,
        selectable: !isLocked
    });
    _csCanvas.discardActiveObject();
    _csCanvas.renderAll();
    _csRenderLayerList();
};

window._csToggleShiny = function(fabricIdx) {
    if (!_csCanvas) return;
    const obj = _csCanvas.getObjects()[fabricIdx];
    if (!obj) return;
    if (!obj.data) obj.data = {};
    obj.data.shiny = !obj.data.shiny;
    _csPushHistory(); _csRenderLayerList();
};

/* ─── Properties panel ───────────────────────────────────────────────────── */
function _csOnSelect() {
    _csRenderLayerList();
    _csUpdateColorSwapper();
    const obj = _csCanvas?.getActiveObject();
    if (obj) {
        _csRenderPropsPanel(obj);
        // If a trait zone is selected, switch to traits tab and sync its controls
        if (obj.data?.isTraitZone) {
            csRTab('traits');
            const panel = document.getElementById('cs-tz-panel');
            if (panel) panel.style.display = 'block';
            // Sync stored values back into controls
            const d = obj.data;
            const _sv = (id, v) => { if (v !== undefined && v !== null) { const el = document.getElementById(id); if (el) el.value = v; } };
            const _sc = (id, v) => { if (v !== undefined) { const el = document.getElementById(id); if (el) el.checked = v; } };
            _sv('cs-tz-iconsize',    d.iconSize);
            _sv('cs-tz-namesize',    d.nameSize);
            _sv('cs-tz-descsize',    d.descSize);
            _sv('cs-tz-color',       d.fontColor);
            _sv('cs-tz-align',       d.textAlign);
            _sv('cs-tz-namefont',    d.nameFont);
            _sv('cs-tz-descfont',    d.descFont);
            _sv('cs-tz-displaymode', d.displayMode || 'full');
            _sc('cs-tz-genesis',     d.showGenesis);
        } else {
            // Props are always visible below the layer list — no tab switch needed
            _csRenderLayerList();
        }
    }
    const ag = document.getElementById('cs-align-group');
    if (ag) ag.classList.remove('hidden');
    _csUpdateSelectionContext();
}

let _csContextBarUpdateRequested = false;
function _csUpdateSelectionContext() {
    _csContextBarUpdateRequested = true;
    requestAnimationFrame(() => {
        _csContextBarUpdateRequested = false;
        const bar = document.getElementById('cs-context-bar');
        if (!bar || !_csCanvas) return;
        const obj = _csCanvas.getActiveObject();
        // Brush tools own the context bar — don't let selection update override it
        if (_csTool === 'draw' || _csTool === 'eraser') return;
        if (!obj || _csTool !== 'select' || obj.data?.isTraitZone) { bar.classList.remove('active'); return; }

        bar.classList.add('active');
        _csRenderContextProps(obj);
    });
}

function _csRenderContextProps(obj) {
    const props = document.getElementById('cs-context-props');
    if (!props) return;
    const type = obj.data?.layerType || obj.type || '';
    let html = '';

    if (type === 'text' || obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const curFont = obj.fontFamily?.split(',')[0].trim() || 'Space Grotesk';
        const fontOpts = CS_GOOGLE_FONTS.map(f =>
            `<option value="${f.name}"${f.name === curFont ? ' selected' : ''}>${f.name}</option>`
        ).join('');
        const isBold   = obj.fontWeight === 'bold';
        const isItalic = obj.fontStyle  === 'italic';
        const isUnder  = !!obj.underline;
        const align    = obj.textAlign || 'left';
        html = `
            <select class="cs-c-inp" style="width:120px;font-size:10px;"
                onchange="csApplyFont(this.value);_csRenderContextProps(_csCanvas.getActiveObject());">${fontOpts}</select>
            <div class="cs-c-sep"></div>
            <input type="number" class="cs-c-inp" style="width:46px;" value="${obj.fontSize||30}" min="6" max="400"
                oninput="_csPropSet('fontSize',parseInt(this.value)||12);_csCanvas.renderAll();">
            <div class="cs-c-sep"></div>
            <button class="cs-c-btn${isBold  ?' active':''}" title="Bold"      onclick="_csToggleProp('fontWeight','bold','normal');_csRenderContextProps(_csCanvas.getActiveObject())"><b>B</b></button>
            <button class="cs-c-btn${isItalic?' active':''}" title="Italic"    onclick="_csToggleProp('fontStyle','italic','normal');_csRenderContextProps(_csCanvas.getActiveObject())"><i>I</i></button>
            <button class="cs-c-btn${isUnder ?' active':''}" title="Underline" onclick="_csPropSet('underline',!_csCanvas.getActiveObject().underline);_csCanvas.renderAll();_csRenderContextProps(_csCanvas.getActiveObject())"><u>U</u></button>
            <div class="cs-c-sep"></div>
            <button class="cs-c-btn${align==='left'   ?' active':''}" title="Align left"   onclick="_csPropSet('textAlign','left');_csCanvas.renderAll();_csRenderContextProps(_csCanvas.getActiveObject())"><i class="bx bx-align-left"></i></button>
            <button class="cs-c-btn${align==='center' ?' active':''}" title="Align center" onclick="_csPropSet('textAlign','center');_csCanvas.renderAll();_csRenderContextProps(_csCanvas.getActiveObject())"><i class="bx bx-align-middle"></i></button>
            <button class="cs-c-btn${align==='right'  ?' active':''}" title="Align right"  onclick="_csPropSet('textAlign','right');_csCanvas.renderAll();_csRenderContextProps(_csCanvas.getActiveObject())"><i class="bx bx-align-right"></i></button>
            <div class="cs-c-sep"></div>
            <input type="color" class="cs-c-btn" style="padding:3px;width:30px;" title="Text color"
                value="${_csColorHex(obj.fill,'#ffffff')}"
                oninput="_csPropSetWithRecent('fill',this.value);_csRenderContextProps(_csCanvas.getActiveObject());">
        `;
    } else if (type === 'rect' || type === 'circle' || type === 'triangle' || type === 'line') {
        html = `
            <div class="cs-c-label">Shape</div>
            <div class="cs-c-cp-wrap">
                <input type="color" class="cs-c-btn" style="padding:4px;" value="${_csColorHex(obj.fill,'#00f2fe')}" oninput="_csPropSetWithRecent('fill',this.value);_csRenderContextProps(_csCanvas.getActiveObject());">
                <div class="cs-c-swatches">${_csRecentColors.slice(0, 5).map(c => `<div class="cs-c-swatch" style="background:${c}" onclick="_csPropSet('fill','${c}');_csRenderContextProps(_csCanvas.getActiveObject())"></div>`).join('')}</div>
            </div>
            <div class="cs-c-cp-wrap">
                <input type="color" class="cs-c-btn" style="padding:4px;border:1px solid rgba(255,255,255,0.1);" value="${_csColorHex(obj.stroke,'#ffffff')}" oninput="_csPropSetWithRecent('stroke',this.value);_csRenderContextProps(_csCanvas.getActiveObject());">
                <div class="cs-c-swatches">${_csRecentColors.slice(0, 5).map(c => `<div class="cs-c-swatch" style="background:${c}" onclick="_csPropSet('stroke','${c}');_csRenderContextProps(_csCanvas.getActiveObject())"></div>`).join('')}</div>
            </div>
        `;
    } else if (type === 'image') {
        html = `
            <div class="cs-c-label">Image</div>
            <button class="cs-c-btn" onclick="_csFlip('X')"><i class="bx bx-arrows-horizontal"></i></button>
        `;
    }

    // Only show the bar for types that have actual content
    if (!html) { bar.classList.remove('active'); return; }

    // Common opacity
    html += `
        <div class="cs-c-sep"></div>
        <div class="cs-c-label">Op</div>
        <input type="number" class="cs-c-inp" style="width:40px;" value="${Math.round((obj.opacity||1)*100)}" oninput="_csPropSet('opacity',this.value/100);_csCanvas.renderAll();">
    `;

    props.innerHTML = html;
    _csUpgradeColorInputs(props);
}

/* ─── Brush context bar ──────────────────────────────────────────────────── */
function _csBrushColorWithOpacity() {
    // Convert _csBrushColor (#rrggbb) + _csBrushOpacity to rgba string
    const c = _csBrushColor;
    if (!c.startsWith('#')) return c;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${_csBrushOpacity})`;
}

function _csGetTargetPaintGroup() {
    const c = _csCanvas;
    if (!c) return null;
    let g = c.getActiveObject();
    if (g?.type === 'activeSelection') {
        const subs = g.getObjects?.() || [];
        const firstPaint = subs.find(o => o.data?.layerType === 'paint' && o.type === 'group');
        if (firstPaint) return firstPaint;
    }
    if (g && g.data?.layerType === 'paint' && g.type === 'group') return g;
    return c.getObjects().reverse().find(o => o.data?.layerType === 'paint' && o.type === 'group') || null;
}

/** Paint layers are groups of paths — allow clicking individual strokes in Select mode. */
function _csSyncPaintLayerInteract() {
    const c = _csCanvas;
    if (!c) return;
    const needsEvents = ['select', 'fill', 'eyedropper', 'crop', 'zoom'];
    const selTool = _csTool === 'select';
    const eventOk = needsEvents.includes(_csTool);
    c.forEachObject(obj => {
        if (obj.data?.layerType !== 'paint' || obj.type !== 'group') return;
        obj.subTargetCheck = true;
        const locked = !!(obj.lockMovementX && obj.lockMovementY);
        const canInteract = selTool && !locked;
        obj.selectable = canInteract;
        obj.evented = eventOk && !locked;
        (obj._objects || []).forEach(child => {
            if (child.type === 'path') {
                child.selectable = canInteract;
                child.evented = canInteract && eventOk;
            }
        });
    });
}

function _csRootCanvasObject(obj) {
    if (!obj) return null;
    let o = obj;
    while (o.group) o = o.group;
    return o;
}

function _csApplyBrush() {
    const c = _csCanvas;
    if (!c || !c.freeDrawingBrush) return;
    if (_csTool === 'draw') {
        c.freeDrawingBrush.color = _csBrushColorWithOpacity();
        c.freeDrawingBrush.width = _csBrushSize;
        // Do not recolor existing strokes here — only new strokes use the brush.
        // Use the layer colour controls / paint edit mode to change past strokes.
    } else if (_csTool === 'eraser') {
        if (c.freeDrawingBrush) c.freeDrawingBrush.width = _csBrushSize;
    }
}
window._csApplyBrush = _csApplyBrush;

/** Get the dominant color of a paint group (reads from first path). */
function _csPaintLayerColor(grp) {
    const p = (grp?._objects || []).find(o => o.type === 'path');
    return p?.stroke || '#ffffff';
}

/** Set the stroke colour on every path in the target paint group. */
window._csSetPaintLayerColor = function(hexColor) {
    const c = _csCanvas;
    let grp = c?.getActiveObject();
    if (!grp || grp.data?.layerType !== 'paint') {
        grp = _csGetTargetPaintGroup();
    }
    if (!grp) return;
    (grp._objects || []).forEach(o => { if (o.type === 'path') o.set({ stroke: hexColor }); });
    if (typeof grp.addWithUpdate === 'function') grp.addWithUpdate();
    c.requestRenderAll();
    if (_csPaintBrushHistoryT) clearTimeout(_csPaintBrushHistoryT);
    _csPaintBrushHistoryT = setTimeout(() => { _csPushHistory(); _csPaintBrushHistoryT = null; }, 400);
};

/** Enter paint stroke edit mode — extracts each path from the group onto the canvas
 *  so the user can click-select, recolour, or delete individual strokes. */
window._csEnterPaintStrokeEdit = function() {
    if (_csPaintEditMode) return;
    const c = _csCanvas;
    let grp = c?.getActiveObject();
    if (!grp || grp.data?.layerType !== 'paint') grp = _csGetTargetPaintGroup();
    if (!grp) return;

    const paths = (grp._objects || []).filter(o => o.type === 'path');
    if (!paths.length) return;

    // Snapshot group metadata before destroying
    _csPaintEditGroupData = {
        layerName: grp.data?.layerName || 'Paint Layer',
        opacity:   grp.opacity ?? 1,
        globalCompositeOperation: grp.globalCompositeOperation || 'source-over',
    };

    // Capture each path's absolute canvas transform BEFORE removing from group
    const extracted = paths.map(p => {
        const matrix   = p.calcTransformMatrix();
        const decomp   = fabric.util.qrDecompose(matrix);
        return { p, decomp };
    });

    // Remove the group from canvas (all paths come with it)
    c.remove(grp);

    // Re-add each path at its absolute position
    extracted.forEach(({ p, decomp }) => {
        p.group = null;
        p.set({
            left:   decomp.translateX,
            top:    decomp.translateY,
            scaleX: decomp.scaleX,
            scaleY: decomp.scaleY,
            angle:  decomp.angle,
            skewX:  decomp.skewX || 0,
            skewY:  decomp.skewY || 0,
            flipX:  false, flipY: false,
            selectable: true, evented: true,
        });
        p.data = { ...(p.data || {}), _paintEdit: true };
        p.setCoords();
        c.add(p);
    });

    _csPaintEditMode = true;
    c.discardActiveObject();
    c.renderAll();
    _csRenderLayerList();
    _csShowPaintEditBanner();
};

/** Exit paint stroke edit mode — re-groups all extracted paths back into a single paint layer. */
window._csExitPaintStrokeEdit = function() {
    if (!_csPaintEditMode) return;
    const c = _csCanvas;

    const editPaths = c.getObjects().filter(o => o.data?._paintEdit);
    editPaths.forEach(p => { delete p.data._paintEdit; p.setCoords(); });
    editPaths.forEach(p => c.remove(p));

    const grp = new fabric.Group(editPaths, { subTargetCheck: true });
    grp.data = { layerName: _csPaintEditGroupData?.layerName || 'Paint Layer', layerType: 'paint' };
    grp.set({
        opacity: _csPaintEditGroupData?.opacity ?? 1,
        globalCompositeOperation: _csPaintEditGroupData?.globalCompositeOperation || 'source-over',
    });

    c.add(grp);
    c.setActiveObject(grp);

    _csPaintEditMode = false;
    _csPaintEditGroupData = null;

    c.renderAll();
    _csRenderLayerList();
    _csHidePaintEditBanner();
    _csPushHistory();
};

function _csShowPaintEditBanner() {
    const bar   = document.getElementById('cs-context-bar');
    const props = document.getElementById('cs-context-props');
    const acts  = document.getElementById('cs-ctx-obj-actions');
    if (!bar || !props) return;
    if (acts) acts.style.display = 'none';
    props.innerHTML = `
        <div class="cs-c-label" style="color:var(--a);">Stroke Edit Mode</div>
        <div class="cs-c-sep"></div>
        <span style="font-size:10px;color:var(--muted);">Click a stroke to select it</span>
        <div class="cs-c-sep"></div>
        <button class="cs-c-btn" onclick="_csExitPaintStrokeEdit()" style="background:rgba(var(--ar),0.12);border-color:rgba(var(--ar),0.3);font-size:10px;padding:4px 10px;">
            <i class="bx bxs-check" style="margin-right:3px;"></i>Done
        </button>`;
    bar.classList.add('active');
}

function _csHidePaintEditBanner() {
    const bar = document.getElementById('cs-context-bar');
    if (bar) bar.classList.remove('active');
}

function _csShowBrushContextBar() {
    const bar  = document.getElementById('cs-context-bar');
    const props = document.getElementById('cs-context-props');
    const acts = document.getElementById('cs-ctx-obj-actions');
    if (!bar || !props) return;
    if (acts) acts.style.display = 'none';
    const isEraser = _csTool === 'eraser';
    const modeNames = { pencil: 'Brush', blur: 'Blur' };
    const label = isEraser ? 'Eraser' : (modeNames[_csBrushMode] || 'Brush');
    props.innerHTML = `
        <div class="cs-c-label">${label}</div>
        <div class="cs-c-sep"></div>
        ${!isEraser ? `
        <input type="color" class="cs-c-btn" style="padding:3px;width:30px;" title="Brush color"
            value="${_csBrushColor}"
            oninput="_csBrushColor=this.value;_csApplyBrush();">
        <div class="cs-c-sep"></div>
        ` : ''}
        <div class="cs-c-label" style="font-size:9px;">Size</div>
        <span id="cs-brush-size-lbl" style="font-size:10px;font-weight:700;color:var(--text);min-width:24px;text-align:center;">${_csBrushSize}</span>
        <input type="range" style="width:80px;" min="1" max="80" value="${_csBrushSize}"
            oninput="_csBrushSize=parseInt(this.value);document.getElementById('cs-brush-size-lbl').textContent=this.value;_csApplyBrush();">
        ${!isEraser ? `
        <div class="cs-c-sep"></div>
        <div class="cs-c-label" style="font-size:9px;">Opacity</div>
        <span id="cs-brush-op-lbl" style="font-size:10px;font-weight:700;color:var(--text);min-width:28px;text-align:center;">${Math.round(_csBrushOpacity*100)}%</span>
        <input type="range" style="width:70px;" min="0" max="100" value="${Math.round(_csBrushOpacity*100)}"
            oninput="_csBrushOpacity=this.value/100;document.getElementById('cs-brush-op-lbl').textContent=Math.round(this.value)+'%';_csApplyBrush();">
        ` : ''}
    `;
    bar.classList.add('active');
}
window._csShowBrushContextBar = _csShowBrushContextBar;

function _csOnDeselect() {
    _csRenderLayerList();
    csRTab('layers');
    const p = document.getElementById('cs-left-props-content');
    if (_csPaintEditMode) {
        if (p) p.innerHTML = `
            <div style="color:var(--muted);font-size:11px;margin-bottom:10px;">Click a stroke to select it</div>
            <button class="cs-pbtn" style="width:100%;" onclick="_csExitPaintStrokeEdit()">
                <i class="bx bxs-check" style="margin-right:4px;"></i>Done Editing
            </button>`;
    } else {
        if (p) p.innerHTML = '<div style="color:var(--muted);font-size:11px;">Select an element on the canvas</div>';
    }
    const ag = document.getElementById('cs-align-group');
    if (ag) ag.classList.add('hidden');
    const bar = document.getElementById('cs-context-bar');
    if (bar && _csTool !== 'draw' && _csTool !== 'eraser' && !_csPaintEditMode) bar.classList.remove('active');
    // Keep zone panel visible if a zone exists on canvas (just not selected)
    const zoneExists = !!_csCanvas?.getObjects().find(o => o.data?.isTraitZone);
    const panel = document.getElementById('cs-tz-panel');
    if (panel) panel.style.display = zoneExists ? 'block' : 'none';
}

/* ─── Blend mode helper ──────────────────────────────────────────────────── */
const _CS_BLEND_MODES = ['source-over','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'];
const _CS_BLEND_LABELS = { 'source-over': 'Normal', 'color-dodge': 'Color Dodge', 'color-burn': 'Color Burn', 'hard-light': 'Hard Light', 'soft-light': 'Soft Light' };
function _csBlendLabel(m) { return _CS_BLEND_LABELS[m] || m.charAt(0).toUpperCase() + m.slice(1); }

function _csBlendSel(obj) {
    const cur = obj.globalCompositeOperation || 'source-over';
    const id = 'cs-blend-dd';
    return `<div class="cs-dd" id="${id}">
        <select class="cs-dd-native" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0;overflow:hidden;"
            onchange="_csPropSet('globalCompositeOperation',this.value);_csCanvas.renderAll();">
            ${_CS_BLEND_MODES.map(m => `<option value="${m}"${m===cur?' selected':''}>${_csBlendLabel(m)}</option>`).join('')}
        </select>
        <button type="button" class="cs-dd-trigger" style="font-size:10px;padding:6px 10px;">
            <span class="cs-dd-label">${_csBlendLabel(cur)}</span>
            <i class="bx bx-chevron-down cs-dd-chevron"></i>
        </button>
        <div class="cs-dd-menu" hidden>
            ${_CS_BLEND_MODES.map(m => `<div class="cs-dd-opt" style="font-size:10px;padding:6px 10px;" data-v="${m}">${_csBlendLabel(m)}</div>`).join('')}
        </div>
    </div>`;
}

/* Attach blend dropdown events after it's inserted into the DOM */
function _csInitBlendDD(wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap || wrap.dataset.csdd) return;
    wrap.dataset.csdd = '1';
    const sel = wrap.querySelector('select');
    const trigger = wrap.querySelector('.cs-dd-trigger');
    const menu = wrap.querySelector('.cs-dd-menu');
    const label = wrap.querySelector('.cs-dd-label');

    function close() { menu.hidden = true; wrap.classList.remove('open'); }
    trigger.onclick = e => {
        e.stopPropagation();
        document.querySelectorAll('.cs-dd.open').forEach(d => {
            if (d !== wrap) { d.classList.remove('open'); d.querySelector('.cs-dd-menu').hidden = true; }
        });
        if (menu.hidden) {
            menu.hidden = false; wrap.classList.add('open');
            const handler = e2 => { if (!wrap.contains(e2.target)) { close(); document.removeEventListener('click', handler); } };
            document.addEventListener('click', handler);
        } else { close(); }
    };
    menu.querySelectorAll('.cs-dd-opt').forEach(opt => {
        opt.onclick = e => {
            e.stopPropagation();
            sel.value = opt.dataset.v;
            label.textContent = opt.textContent;
            close();
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        };
    });
}

function _csRenderPropsPanel(obj) {
    const panel = document.getElementById('cs-left-props-content');
    if (!panel || !obj) return;

    // Trait zone — no properties, everything is in the Traits tab
    if (obj.data?.isTraitZone) {
        panel.innerHTML = '<div style="color:var(--muted);font-size:11px;">Configure in the Traits tab →</div>';
        return;
    }

    // Multi-select panel
    if (obj.type === 'activeSelection') {
        const count = obj.getObjects().length;
        const opPct = Math.round((obj.opacity ?? 1) * 100);
        panel.innerHTML = `
        <div class="cs-pr">
            <div class="cs-pl" style="color:var(--a);">${count} layers selected</div>
            <label class="cs-pl" id="cs-opacity-lbl">Opacity ${opPct}%</label>
            <input type="range" min="0" max="100" value="${opPct}"
                oninput="document.getElementById('cs-opacity-lbl').textContent='Opacity '+this.value+'%';_csPropSet('opacity',this.value/100);_csCanvas.renderAll();">
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Blend</div>
            ${_csBlendSel(obj)}
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Align</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px;">
                <button class="cs-pbtn" onclick="csAlign('left')" title="Align left"><i class="bx bxs-objects-horizontal-left"></i></button>
                <button class="cs-pbtn" onclick="csAlign('hcenter')" title="Center horizontal"><i class="bx bxs-objects-horizontal-center"></i></button>
                <button class="cs-pbtn" onclick="csAlign('right')" title="Align right"><i class="bx bxs-objects-horizontal-right"></i></button>
                <button class="cs-pbtn" onclick="csAlign('top')" title="Align top"><i class="bx bxs-objects-vertical-top"></i></button>
                <button class="cs-pbtn" onclick="csAlign('vcenter')" title="Center vertical"><i class="bx bxs-objects-vertical-center"></i></button>
                <button class="cs-pbtn" onclick="csAlign('bottom')" title="Align bottom"><i class="bx bxs-objects-vertical-bottom"></i></button>
            </div>
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Distribute</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px;">
                <button class="cs-pbtn" onclick="csAlign('hdistribute')" title="Distribute horizontally"><i class="bx bx-horizontal-center"></i>&nbsp;H</button>
                <button class="cs-pbtn" onclick="csAlign('vdistribute')" title="Distribute vertically"><i class="bx bx-vertical-center"></i>&nbsp;V</button>
            </div>
        </div>
        <div class="cs-pr" style="margin-top:6px;">
            <button class="cs-pbtn" style="background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2);color:rgba(239,68,68,0.65);" onclick="csDeleteSelected()">
                <i class="bx bxs-trash" style="margin-right:3px;"></i>Delete Selected
            </button>
        </div>`;
        _csInitBlendDD('cs-blend-dd');
        return;
    }

    const type = obj.data?.layerType || obj.type || '';

    // Position / size / rotation
    const bx = Math.round(obj.left || 0);
    const by = Math.round(obj.top || 0);
    const bw = Math.round((obj.width || 0) * (obj.scaleX || 1));
    const bh = Math.round((obj.height || 0) * (obj.scaleY || 1));
    const rot = Math.round(obj.angle || 0);
    const locked = !!(obj.data?._lockAspect);

    let html = `
    <div class="cs-pr">
        <div class="cs-pl">Transform</div>
        <div class="cs-coord-row">
            <label>X</label>
            <input type="number" value="${bx}" oninput="_csPropSet('left',parseInt(this.value)||0); _csCanvas.renderAll();" style="font-size:10px;">
            <label>Y</label>
            <input type="number" value="${by}" oninput="_csPropSet('top',parseInt(this.value)||0); _csCanvas.renderAll();">
        </div>
        <div class="cs-coord-row" style="margin-top:3px;">
            <label>W</label>
            <input type="number" value="${bw}" id="cs-prop-w" oninput="_csSetScaledDim('width',parseInt(this.value)||1)" style="font-size:10px;">
            <button class="cs-pbtn${locked?' on':''}" style="padding:2px 5px;font-size:11px;flex-shrink:0;color:var(--a);" title="Lock aspect ratio" onclick="_csToggleAspectLock()"><i class="bx ${locked?'bxs-link':'bx-unlink'}"></i></button>
            <label>H</label>
            <input type="number" value="${bh}" id="cs-prop-h" oninput="_csSetScaledDim('height',parseInt(this.value)||1)">
        </div>
        <div class="cs-coord-row" style="margin-top:3px;">
            <label style="font-size:8px;">°</label>
            <input type="number" value="${rot}" min="-360" max="360" oninput="_csPropSet('angle',parseInt(this.value)||0); _csCanvas.renderAll();">
        </div>
    </div>
    <div class="cs-pr">
        <label class="cs-pl" id="cs-opacity-lbl">Opacity ${Math.round((obj.opacity ?? 1) * 100)}%</label>
        <input type="range" min="0" max="100" value="${Math.round((obj.opacity ?? 1) * 100)}"
            oninput="document.getElementById('cs-opacity-lbl').textContent='Opacity '+this.value+'%';_csPropSet('opacity',this.value/100);_csCanvas.renderAll();">
    </div>
    <div class="cs-pr">
        <div class="cs-pl">Blend</div>
        ${_csBlendSel(obj)}
    </div>`;

    if (type === 'text' || obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const shadow = obj.shadow || {};
        const shadowColor = shadow.color || '#000000';
        const shadowBlur  = shadow.blur  ?? 0;
        const shadowX     = shadow.offsetX ?? 0;
        const shadowY     = shadow.offsetY ?? 0;
        const charSpacing = obj.charSpacing ?? 0;
        const lineHeight  = obj.lineHeight  ?? 1.16;
        html += `
        <div class="cs-pr">
            <div class="cs-pl">Text</div>
            <div class="cs-2g">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Size</label>
                    <input type="number" min="6" max="400" value="${obj.fontSize || 36}" oninput="_csPropSet('fontSize',parseInt(this.value)||12);_csCanvas.renderAll();">
                </div>
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Color</label>
                    ${_csRenderSwatches('fill')}
                    <input type="color" value="${_csColorHex(obj.fill, '#ffffff')}" oninput="_csPropSetWithRecent('fill',this.value);_csCanvas.renderAll();">
                </div>
            </div>
            <div class="cs-2g" style="margin-top:4px;">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Stroke</label>
                    ${_csRenderSwatches('stroke')}
                    <input type="color" value="${_csColorHex(obj.stroke, '#000000')}" oninput="_csPropSetWithRecent('stroke',this.value);_csCanvas.renderAll();">
                </div>
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Stroke W</label>
                    <input type="number" min="0" max="20" value="${obj.strokeWidth ?? 0}" oninput="_csPropSet('strokeWidth',parseInt(this.value));_csCanvas.renderAll();">
                </div>
            </div>
            <div class="cs-2g" style="margin-top:4px;">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Spacing</label>
                    <input type="number" min="-500" max="2000" value="${charSpacing}" oninput="_csPropSet('charSpacing',parseInt(this.value)||0);_csCanvas.renderAll();">
                </div>
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Line H</label>
                    <input type="number" min="0.5" max="5" step="0.05" value="${lineHeight.toFixed(2)}" oninput="_csPropSet('lineHeight',parseFloat(this.value)||1.16);_csCanvas.renderAll();">
                </div>
            </div>
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Shadow</div>
            <div class="cs-2g">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Color</label>
                    <input type="color" value="${_csColorHex(shadowColor,'#000000')}" oninput="_csSetShadow('color',this.value);">
                </div>
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Blur</label>
                    <input type="number" min="0" max="60" value="${shadowBlur}" oninput="_csSetShadow('blur',parseInt(this.value)||0);">
                </div>
            </div>
            <div class="cs-2g" style="margin-top:4px;">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Offset X</label>
                    <input type="number" min="-50" max="50" value="${shadowX}" oninput="_csSetShadow('offsetX',parseInt(this.value)||0);">
                </div>
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Offset Y</label>
                    <input type="number" min="-50" max="50" value="${shadowY}" oninput="_csSetShadow('offsetY',parseInt(this.value)||0);">
                </div>
            </div>
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Align</div>
            <div class="cs-btns">
                <button class="cs-pbtn${obj.textAlign==='left'?' on':''}" onclick="_csPropSet('textAlign','left');_csCanvas.renderAll();"><i class="bx bx-align-left"></i></button>
                <button class="cs-pbtn${obj.textAlign==='center'?' on':''}" onclick="_csPropSet('textAlign','center');_csCanvas.renderAll();"><i class="bx bx-align-middle"></i></button>
                <button class="cs-pbtn${obj.textAlign==='right'?' on':''}" onclick="_csPropSet('textAlign','right');_csCanvas.renderAll();"><i class="bx bx-align-right"></i></button>
            </div>
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Style</div>
            <div class="cs-btns">
                <button class="cs-pbtn${obj.fontWeight==='bold'?' on':''}" onclick="_csToggleProp('fontWeight','bold','normal');_csRenderPropsPanel(_csCanvas.getActiveObject())"><b>B</b></button>
                <button class="cs-pbtn${obj.fontStyle==='italic'?' on':''}" onclick="_csToggleProp('fontStyle','italic','normal');_csRenderPropsPanel(_csCanvas.getActiveObject())"><i>I</i></button>
                <button class="cs-pbtn" onclick="_csFlip('X')">↔</button>
                <button class="cs-pbtn" onclick="_csFlip('Y')">↕</button>
            </div>
        </div>`;
    } else if (type === 'rect' || type === 'circle' || type === 'triangle') {
        const isGrad = obj.fill instanceof fabric.Gradient;
        const c1 = isGrad ? (obj.fill.colorStops[0].color || '#003355') : (obj.fill || '#003355');
        const c2 = isGrad ? (obj.fill.colorStops[1].color || '#00f2fe') : '#00f2fe';
        const gType = isGrad ? obj.fill.type : 'linear';

        html += `
        <div class="cs-pr">
            <div class="cs-pl" style="display:flex;justify-content:space-between;align-items:center;">
                Fill
                <button class="cs-pbtn${isGrad?' on':''}" style="padding:2px 6px;font-size:9px;" onclick="_csSetGradient('${_csColorHex(c1)}','${_csColorHex(c2)}','${gType}')">
                    <i class="bx bxs-magic-wand"></i> Gradient
                </button>
            </div>
            ${isGrad ? `
                <div class="cs-2g" style="margin-bottom:6px;">
                    <div>
                        <label style="font-size:8px;color:rgba(var(--ar),0.36);">Color 1</label>
                        <input type="color" value="${_csColorHex(c1)}" oninput="_csSetGradient(this.value,'${c2}','${gType}')">
                    </div>
                    <div>
                        <label style="font-size:8px;color:rgba(var(--ar),0.36);">Color 2</label>
                        <input type="color" value="${_csColorHex(c2)}" oninput="_csSetGradient('${c1}',this.value,'${gType}')">
                    </div>
                </div>
                <div class="cs-btns" style="margin-bottom:6px;">
                    <button class="cs-pbtn${gType==='linear'?' on':''}" onclick="_csSetGradient('${c1}','${c2}','linear')">Linear</button>
                    <button class="cs-pbtn${gType==='radial'?' on':''}" onclick="_csSetGradient('${c1}','${c2}','radial')">Radial</button>
                    <button class="cs-pbtn" onclick="_csPropSetWithRecent('fill','${c1}')"><i class="bx bxs-trash"></i></button>
                </div>
            ` : `
                <div class="cs-2g">
                    <div>
                        <label style="font-size:8px;color:rgba(var(--ar),0.36);">Color</label>
                        ${_csRenderSwatches('fill')}
                        <input type="color" value="${_csColorHex(obj.fill, '#003355')}" oninput="_csPropSetWithRecent('fill',this.value);_csCanvas.renderAll();">
                    </div>
                </div>
            `}
            <div class="cs-2g" style="margin-top:4px;">
                <div>
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);">Stroke</label>
                    ${_csRenderSwatches('stroke')}
                    <input type="color" value="${_csColorHex(obj.stroke, '#00f2fe')}" oninput="_csPropSetWithRecent('stroke',this.value);_csCanvas.renderAll();">
                </div>
                <div>
                     <label style="font-size:8px;color:rgba(var(--ar),0.36);">Width</label>
                     <input type="number" min="0" max="20" value="${obj.strokeWidth ?? 2}" oninput="_csPropSet('strokeWidth',parseInt(this.value)||0);_csCanvas.renderAll();">
                </div>
            </div>
            ${type === 'rect' ? `
            <div style="margin-top:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <label style="font-size:8px;color:rgba(var(--ar),0.36);flex-shrink:0;">Corner radius</label>
                    <input type="range" min="0" max="100" value="${obj.rx ?? 8}" style="flex:1;"
                        oninput="this.nextElementSibling.textContent=this.value+'px';_csPropSet('rx',+this.value);_csPropSet('ry',+this.value);_csCanvas.renderAll();">
                    <span style="font-size:9px;font-weight:700;color:var(--text);min-width:30px;text-align:right;">${obj.rx ?? 8}px</span>
                </div>
            </div>` : ''}
        </div>`;
    } else if (type === 'paint') {
        // Paint layer group selected — show layer-wide color control + edit button
        const paintPaths = (obj._objects || []).filter(p => p.type === 'path');
        const layerColor = _csColorHex(_csPaintLayerColor(obj), '#ffffff');
        html += `
        <div class="cs-pr">
            <div class="cs-pl">Paint Layer <span style="color:var(--muted);font-weight:500;font-size:9px;margin-left:4px;">${paintPaths.length} stroke${paintPaths.length !== 1 ? 's' : ''}</span></div>
            <label style="font-size:9px;color:rgba(var(--ar),0.5);margin-top:4px;display:block;">All Strokes Colour</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <input type="color" value="${layerColor}"
                    oninput="_csSetPaintLayerColor(this.value);"
                    style="width:40px;height:30px;padding:2px;cursor:pointer;border-radius:6px;border:1.5px solid rgba(var(--ar),0.25);">
                <span style="font-size:10px;color:var(--muted);">${layerColor}</span>
            </div>
        </div>
        <div class="cs-pr">
            <button class="cs-pbtn" style="width:100%;" onclick="_csEnterPaintStrokeEdit()">
                <i class="bx bxs-pen" style="margin-right:5px;"></i>Edit Individual Strokes
            </button>
        </div>`;
    } else if (obj.data?._paintEdit && obj.type === 'path') {
        // Individual stroke selected while in paint edit mode
        html += `
        <div class="cs-pr">
            <div class="cs-pl" style="color:var(--a);">Paint Stroke</div>
            <label style="font-size:9px;color:rgba(var(--ar),0.5);margin-top:4px;display:block;">Colour</label>
            <input type="color" value="${_csColorHex(obj.stroke, '#ffffff')}"
                oninput="_csPropSet('stroke',this.value);_csCanvas.renderAll();"
                style="margin-top:4px;width:100%;height:30px;padding:2px;cursor:pointer;border-radius:6px;border:1.5px solid rgba(var(--ar),0.25);">
            <label class="cs-pl" id="cs-paint-sw-lbl" style="margin-top:8px;">Width ${Math.round(obj.strokeWidth ?? 6)}</label>
            <input type="range" min="1" max="80" value="${obj.strokeWidth ?? 6}"
                oninput="document.getElementById('cs-paint-sw-lbl').textContent='Width '+this.value;_csPropSet('strokeWidth',parseInt(this.value,10));_csCanvas.renderAll();">
        </div>
        <div class="cs-pr">
            <button class="cs-pbtn" style="width:100%;background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2);color:rgba(239,68,68,0.65);" onclick="csDeleteSelected()">
                <i class="bx bxs-trash" style="margin-right:3px;"></i>Delete Stroke
            </button>
            <button class="cs-pbtn" style="width:100%;margin-top:6px;" onclick="_csExitPaintStrokeEdit()">
                <i class="bx bxs-check" style="margin-right:4px;"></i>Done Editing
            </button>
        </div>`;
    } else if (type === 'path' || obj.type === 'path') {
        html += `
        <div class="cs-pr">
            <div class="cs-pl">Stroke</div>
            <input type="color" value="${_csColorHex(obj.stroke, '#00f2fe')}" oninput="_csPropSet('stroke',this.value);_csCanvas.renderAll();">
        </div>
        <div class="cs-pr">
            <label class="cs-pl" id="cs-path-sw-lbl">Width ${Math.round(obj.strokeWidth ?? 6)}</label>
            <input type="range" min="1" max="80" value="${obj.strokeWidth ?? 6}"
                oninput="document.getElementById('cs-path-sw-lbl').textContent='Width '+this.value;_csPropSet('strokeWidth',parseInt(this.value,10));_csCanvas.renderAll();">
        </div>`;
    } else if (type === 'image' || obj.type === 'image') {
        const filters = obj.filters || [];
        const getVal = (name) => {
            const f = filters.find(f => f.type === name);
            if (name === 'Brightness') return f ? Math.round(f.brightness * 100) : 0;
            if (name === 'Contrast') return f ? Math.round(f.contrast * 100) : 0;
            if (name === 'Saturation') return f ? Math.round(f.saturation * 100) : 0;
            return 0;
        };
        html += `
        <div class="cs-pr">
            <div class="cs-pl">Image</div>
            <button class="cs-pbtn" style="width:100%;" onclick="_csEnterCropMode()"><i class="bx bxs-crop"></i> Crop Image</button>
            <button class="cs-pbtn" style="width:100%;margin-top:6px;" onclick="csRemoveBg()" id="cs-rmbg-btn"><i class="bx bxs-magic-wand"></i> Remove Background</button>
            <div class="cs-btns" style="margin-top:6px;">
                <button class="cs-pbtn" onclick="_csFlip('X')">↔ H</button>
                <button class="cs-pbtn" onclick="_csFlip('Y')">↕ V</button>
            </div>
        </div>
        <div class="cs-pr">
            <div class="cs-pl">Adjustments</div>
            <label style="font-size:8px;color:rgba(var(--ar),0.36);">Brightness</label>
            <input type="range" min="-100" max="100" value="${getVal('Brightness')}" oninput="_csApplyFilter('Brightness', this.value/100)">
            <label style="font-size:8px;color:rgba(var(--ar),0.36);margin-top:4px;display:block;">Contrast</label>
            <input type="range" min="-100" max="100" value="${getVal('Contrast')}" oninput="_csApplyFilter('Contrast', this.value/100)">
            <label style="font-size:8px;color:rgba(var(--ar),0.36);margin-top:4px;display:block;">Saturation</label>
            <input type="range" min="-100" max="100" value="${getVal('Saturation')}" oninput="_csApplyFilter('Saturation', this.value/100)">
        </div>`;
    }

    html += `<div class="cs-pr" style="margin-top:6px;">
        <button class="cs-pbtn" style="background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2);color:rgba(239,68,68,0.65);" onclick="csDeleteSelected()">
            <i class="bx bxs-trash" style="margin-right:3px;"></i>Delete Layer
        </button>
    </div>`;

    panel.innerHTML = html;
    _csInitBlendDD('cs-blend-dd');
    _csUpgradeColorInputs(panel);
}

/* ─── Shadow helper ──────────────────────────────────────────────────────── */
window._csSetShadow = function(prop, value) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    const s = obj.shadow ? {
        color: obj.shadow.color || '#000000',
        blur: obj.shadow.blur ?? 0,
        offsetX: obj.shadow.offsetX ?? 0,
        offsetY: obj.shadow.offsetY ?? 0,
    } : { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 };
    s[prop] = value;
    obj.set('shadow', new fabric.Shadow(s));
    _csCanvas.renderAll();
};

/* ─── Aspect ratio lock ───────────────────────────────────────────────────── */
window._csToggleAspectLock = function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    if (!obj.data) obj.data = {};
    obj.data._lockAspect = !obj.data._lockAspect;
    _csRenderPropsPanel(obj);
};

window._csSetScaledDim = function(dim, px) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    const orig = obj[dim] || 1;
    const scale = px / orig;
    if (dim === 'width') {
        obj.set('scaleX', scale);
        if (obj.data?._lockAspect) {
            obj.set('scaleY', scale);
            const hEl = document.getElementById('cs-prop-h');
            if (hEl) hEl.value = Math.round((obj.height || 0) * scale);
        }
    } else {
        obj.set('scaleY', scale);
        if (obj.data?._lockAspect) {
            obj.set('scaleX', scale);
            const wEl = document.getElementById('cs-prop-w');
            if (wEl) wEl.value = Math.round((obj.width || 0) * scale);
        }
    }
    _csCanvas.renderAll();
};

window._csPropSet = function(prop, value) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    if (obj.group && obj.type === 'path' && typeof obj.group.addWithUpdate === 'function') obj.group.addWithUpdate();
    _csCanvas?.renderAll();
};

window._csPropSetWithRecent = function(prop, value) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    if (obj.group && obj.type === 'path' && typeof obj.group.addWithUpdate === 'function') obj.group.addWithUpdate();
    _csCanvas?.renderAll();
    if (typeof value === 'string' && value.startsWith('#')) _csAddRecentColor(value);
};

/* ─── Image Cropping ─────────────────────────────────────────────────────── */
let _csCropRect = null;
let _csCropTarget = null;

window.csRemoveBg = async function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj || obj.type !== 'image') { showToast('Select an image first', 'error'); return; }

    const srcUrl = obj.getSrc?.() || obj._element?.src || obj.data?.originalUrl;
    if (!srcUrl) { showToast('Could not read image source', 'error'); return; }

    const btn = document.getElementById('cs-rmbg-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Removing...'; }

    await _csRefreshCsrf();
    try {
        const res = await fetch(`${BACKEND_URL}/api/creator/remove-bg`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csCsrfToken },
            body: JSON.stringify({ image_url: srcUrl }),
            credentials: 'include',
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
        const { url } = await res.json();

        const safeImg = await _csLoadSafeImage(url);
        if (!safeImg) throw new Error('Could not load result image');

        fabric.Image.fromURL(safeImg.src, newImg => {
            if (!newImg || !_csCanvas) return;
            newImg.set({
                left: obj.left, top: obj.top,
                scaleX: obj.scaleX, scaleY: obj.scaleY,
                angle: obj.angle, originX: obj.originX, originY: obj.originY,
            });
            newImg.data = { ...obj.data, layerName: (obj.data?.layerName || 'Image') + ' (no bg)', originalUrl: url };
            _csCanvas.remove(obj);
            _csCanvas.add(newImg);
            _csCanvas.setActiveObject(newImg);
            _csCanvas.renderAll();
            _csPushHistory(); _csRenderLayerList();
            showToast('Background removed!', 'success');
        }, { crossOrigin: 'anonymous' });
    } catch (err) {
        showToast(err.message || 'Remove BG failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bx bxs-magic-wand"></i> Remove Background'; }
    }
};

window._csEnterCropMode = function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    
    _csCropTarget = obj;
    showToast('Adjust crop box and press Enter to apply, Esc to cancel', 'info');

    // Create a semi-transparent crop overlay
    _csCropRect = new fabric.Rect({
        left: obj.left, top: obj.top,
        width: obj.width * obj.scaleX, height: obj.height * obj.scaleY,
        angle: obj.angle,
        fill: 'rgba(0,0,0,0.3)',
        stroke: '#00f2fe', strokeWidth: 2,
        cornerColor: '#00f2fe', cornerSize: 8,
        transparentCorners: false,
        data: { isCropBox: true }
    });

    _csCanvas.add(_csCropRect);
    _csCanvas.setActiveObject(_csCropRect);
    _csCanvas.renderAll();
};

window._csApplyCrop = function() {
    if (!_csCropRect || !_csCropTarget) return;

    const img = _csCropTarget;
    const box = _csCropRect;

    // We use a relative clipPath. Fabric clipPaths are relative to center of object.
    // This part is tricky in v5. We'll use absolute clipPath for simplicity.
    const clip = new fabric.Rect({
        left: box.left, top: box.top,
        width: box.width * box.scaleX, height: box.height * box.scaleY,
        angle: box.angle,
        absolutePositioned: true
    });

    img.set('clipPath', clip);
    _csCancelCrop();
    _csCanvas.renderAll();
    _csPushHistory();
};

window._csCancelCrop = function() {
    if (_csCropRect) _csCanvas.remove(_csCropRect);
    _csCropRect = null;
    _csCropTarget = null;
    _csCanvas.renderAll();
};
let _csRecentColors = JSON.parse(localStorage.getItem('cs_recent_colors') || '["#00f2fe","#ffffff","#ff0000","#00ff00","#0000ff","#ffff00"]');

function _csAddRecentColor(hex) {
    if (!hex || hex.length !== 7) return;
    hex = hex.toLowerCase();
    _csRecentColors = _csRecentColors.filter(c => c !== hex);
    _csRecentColors.unshift(hex);
    if (_csRecentColors.length > 10) _csRecentColors.pop();
    localStorage.setItem('cs_recent_colors', JSON.stringify(_csRecentColors));
}

function _csRenderSwatches(targetProp) {
    return `<div class="cs-swatches">
        ${_csRecentColors.map(c => `
            <div class="cs-swatch" style="background:${c}" onclick="_csPropSet('${targetProp}','${c}');_csCanvas.renderAll();_csRenderPropsPanel(_csCanvas.getActiveObject())"></div>
        `).join('')}
    </div>`;
}

window._csSetGradient = function(color1, color2, type = 'linear') {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    
    _csAddRecentColor(color1);
    _csAddRecentColor(color2);

    const grad = new fabric.Gradient({
        type: type,
        coords: type === 'linear' 
            ? { x1: 0, y1: 0, x2: obj.width, y2: 0 } 
            : { x1: obj.width/2, y1: obj.height/2, x2: obj.width/2, y2: obj.height/2, r1: 0, r2: obj.width/2 },
        colorStops: [
            { offset: 0, color: color1 },
            { offset: 1, color: color2 }
        ]
    });
    obj.set('fill', grad);
    _csCanvas?.renderAll();
    _csRenderPropsPanel(obj);
};

window._csToggleProp = function(prop, onVal, offVal) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, obj[prop] === onVal ? offVal : onVal);
    _csCanvas.renderAll();
};

window._csFlip = function(axis) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    obj.set(axis === 'X' ? 'flipX' : 'flipY', !obj[axis === 'X' ? 'flipX' : 'flipY']);
    _csCanvas.renderAll(); _csPushHistory();
};

/* ─── Right tab switching ────────────────────────────────────────────────── */
function csRTab(tab) {
    ['layers', 'fonts', 'traits', 'library'].forEach(t => {
        document.getElementById(`rtt-${t}`)?.classList.toggle('active', t === tab);
        const c = document.getElementById(`rtc-${t}`);
        if (c) c.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'layers') _csRenderLayerList();
    if (tab === 'library') _csRenderLibrary();
    if (tab === 'traits') { _csUpdateTraitZoneDiagram(); _csRenderMechanicsList(); const zoneExists = !!_csCanvas?.getObjects().find(o => o.data?.isTraitZone); const p = document.getElementById('cs-tz-panel'); if (p) p.style.display = zoneExists ? 'block' : 'none'; }
}
window.csRTab = csRTab;

function _csRenderMechanicsList() {
    _csUpdateTraitZoneDiagram();
}

function _csUpdateTraitZoneDiagram() {
    const diagram = document.getElementById('cs-trait-zone-diagram');
    const label   = document.getElementById('cs-trait-zone-label');
    if (!diagram) return;

    // Get trait_area from the currently selected template
    const sel = document.getElementById('cs-template');
    const t = _csTemplates.find(t => t.id === sel?.value);
    const area = t?.trait_area;

    // Remove old highlight
    diagram.querySelectorAll('.cs-tz-highlight').forEach(el => el.remove());

    if (!area) {
        if (label) label.textContent = 'Select a template to see zone';
        return;
    }

    // Production card dimensions are 750×1050; diagram is 90×126 (scale = 90/750 = 0.12)
    const scaleX = 90  / 750;
    const scaleY = 126 / 1050;

    const highlight = document.createElement('div');
    highlight.className = 'cs-tz-highlight';
    highlight.style.cssText = `
        position:absolute;
        left:${Math.round(area.x * scaleX)}px;
        top:${Math.round(area.y * scaleY)}px;
        width:${Math.round(area.w * scaleX)}px;
        height:${Math.round(area.h * scaleY)}px;
        background:rgba(0,242,254,0.12);
        border:1px solid rgba(0,242,254,0.5);
        border-radius:2px;
        display:flex;
        align-items:center;
        justify-content:center;
    `;
    highlight.innerHTML = '<i class="bx bxs-magic-wand" style="color:rgba(0,242,254,0.6);font-size:7px;"></i>';
    diagram.appendChild(highlight);

    if (label) label.textContent = `x:${area.x} y:${area.y}  ${area.w}×${area.h}px`;
}

window.csPreviewTrait = function(idx) {
    if (!_csCanvas) return;
    _csPreviewTraitIdx = Math.max(0, Math.min(_csMechanics.length - 1, idx));
    const tzObj = _csCanvas.getObjects().find(o => o.data?.isTraitZone);
    if (tzObj) csUpdateTraitZonePreview();
    _csRenderMechanicsList();
};

/* Convert preview objects to permanent baked layers */
window.csBakeTrait = async function() {
    if (!_csCanvas) return;
    const m = _csMechanics[_csPreviewTraitIdx];
    if (!m) { showToast('Select a trait first', 'error'); return; }

    const tzObj = _csCanvas.getObjects().find(o => o.data?.isTraitZone);
    if (!tzObj) { showToast('Add a Trait Zone first to position the trait', 'error'); return; }

    await csUpdateTraitZonePreview();

    const previews = _csCanvas.getObjects().filter(o => o.data?.isTraitPreview);
    if (previews.length === 0) { showToast('Nothing to bake', 'error'); return; }

    const traitName = m.display_name || m.name || 'Trait';
    previews.forEach((obj, i) => {
        obj.data = {
            layerName: i === 0 ? `Trait: ${traitName}` : `Trait detail ${i}`,
            layerType: 'baked-trait',
            traitName,
            traitIcon: m.icon || '',
            traitDesc: m.description || '',
        };
        obj.selectable = true;
        obj.evented = true;
    });

    _csCanvas.renderAll();
    _csPushHistory(`Bake: ${traitName}`);
    _csRenderLayerList();
    _csRenderMechanicsList();
    showToast(`"${traitName}" baked onto card`, 'success');
};

/* ─── Clipboard ──────────────────────────────────────────────────────────── */
let _csClipboard = null;

function _csTargetAllowsNativePaste(target) {
    if (!target) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

async function _csReadImageFromSystemClipboard() {
    if (!navigator.clipboard?.read) return null;
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const imageType = item.types.find(type => type.startsWith('image/'));
            if (!imageType) continue;
            const blob = await item.getType(imageType);
            const ext = imageType.split('/')[1] || 'png';
            return new File([blob], `clipboard-image.${ext}`, { type: imageType });
        }
    } catch {}
    return null;
}

async function _csPasteImageFromClipboardData(clipboardData) {
    const items = Array.from(clipboardData?.items || []);
    for (const item of items) {
        if (!item.type?.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        const ext = item.type.split('/')[1] || 'png';
        const namedFile = file.name ? file : new File([file], `clipboard-image.${ext}`, { type: item.type });
        await _csImportImageFile(namedFile);
        return true;
    }
    return false;
}

window.csCopy = function() {
    if (!_csCanvas) return;
    const objs = _csCanvas.getActiveObjects();
    if (!objs.length) return;
    if (objs.length === 1) {
        objs[0].clone(clone => {
            clone.data = Object.assign({}, objs[0].data || {});
            _csClipboard = [clone];
        }, ['data']);
    } else {
        const clones = [];
        let done = 0;
        objs.forEach(obj => {
            obj.clone(clone => {
                clone.data = Object.assign({}, obj.data || {});
                clones.push(clone);
                if (++done === objs.length) _csClipboard = clones;
            }, ['data']);
        });
    }
};

window.csCut = function() {
    csCopy();
    csDeleteSelected();
};

window.csPaste = async function() {
    if (!_csCanvas) return;
    const clipboardImage = await _csReadImageFromSystemClipboard();
    if (clipboardImage) {
        await _csImportImageFile(clipboardImage);
        return;
    }
    if (!_csClipboard?.length) return;
    _csCanvas.discardActiveObject();
    const pasted = [];
    let done = 0;
    _csClipboard.forEach(src => {
        src.clone(clone => {
            clone.set({ left: (clone.left || 0) + 14, top: (clone.top || 0) + 14 });
            clone.data = Object.assign({}, src.data || {});
            _csCanvas.add(clone);
            pasted.push(clone);
            if (++done === _csClipboard.length) {
                // Re-clone clipboard so next paste offsets again
                _csClipboard = pasted.map(o => { let c; o.clone(x => { c = x; c.data = Object.assign({}, o.data || {}); }, ['data']); return c; });
                if (pasted.length === 1) {
                    _csCanvas.setActiveObject(pasted[0]);
                } else {
                    _csCanvas.setActiveObject(new fabric.ActiveSelection(pasted, { canvas: _csCanvas }));
                }
                _csCanvas.renderAll();
                _csPushHistory();
                _csRenderLayerList();
            }
        }, ['data']);
    });
};

async function _csPasteHandler(e) {
    if (!_csCanvas || _csTargetAllowsNativePaste(e.target)) return;
    const pastedImage = await _csPasteImageFromClipboardData(e.clipboardData);
    if (pastedImage) {
        e.preventDefault();
        return;
    }
    if (_csClipboard?.length) {
        e.preventDefault();
        csPaste();
    }
}

/* ─── Keyboard shortcuts ─────────────────────────────────────────────────── */
let _csNudgeTimer = null;

function _csKeyHandler(e) {
    // Don't intercept when upload modal open
    if (!document.getElementById('cs-upload-modal')?.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // Escape — cancel crop, exit paint edit, or deselect
    if (e.key === 'Escape') {
        if (_csCropRect) { _csCancelCrop(); return; }
        if (_csPaintEditMode) { _csExitPaintStrokeEdit(); return; }
        _csCanvas?.discardActiveObject();
        _csCanvas?.renderAll();
        csTool('select');
        return;
    }

    // Enter — apply crop
    if (e.key === 'Enter') {
        if (_csCropRect) {
            _csApplyCrop();
            e.preventDefault();
        }
        return;
    }

    // Space panning
    if (e.code === 'Space' && !e.repeat) {
        if (_csTool !== 'hand') {
            _csLastTool = _csTool;
            csTool('hand');
        }
        e.preventDefault();
        return;
    }

    // Arrow key nudge (1px; Shift+Arrow = 10px)
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        const obj = _csCanvas?.getActiveObject();
        if (obj) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft')  obj.set('left', (obj.left || 0) - step);
            if (e.key === 'ArrowRight') obj.set('left', (obj.left || 0) + step);
            if (e.key === 'ArrowUp')    obj.set('top',  (obj.top  || 0) - step);
            if (e.key === 'ArrowDown')  obj.set('top',  (obj.top  || 0) + step);
            obj.setCoords();
            _csCanvas.renderAll();
            // Debounce history push so rapid arrows don't flood the stack
            clearTimeout(_csNudgeTimer);
            _csNudgeTimer = setTimeout(() => _csPushHistory(), 400);
            return;
        }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); csDeleteSelected(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); csUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); csRedo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); csSelectAll(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (e.shiftKey) csUngroup();
        else csGroup();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); csCopy(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') { e.preventDefault(); csCut(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') { return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); csDuplicate(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); csZoomStep(0.2); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); csZoomStep(-0.2); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); csSave(); return; }
    if (e.ctrlKey || e.metaKey) return;

    const k = e.key.toLowerCase();
    if (k === '?') { csShowShortcutsModal(); return; }
    if (k === 'v') csTool('select');
    else if (k === 't') csTool('text');
    else if (k === 'b' && !e.ctrlKey && !e.metaKey) { _csBrushMode = 'pencil'; csTool('draw'); }
    else if (k === 'e') csTool('eraser');
    else if (k === 'k') csTool('eyedropper');
    else if (k === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !_csCanvas?.getActiveObject()) csTool('fill');
    else if (k === 'f' && e.shiftKey && !e.ctrlKey && !e.metaKey) csToggleFocusMode();
    else if (k === 'z' && !e.ctrlKey && !e.metaKey) csTool('zoom');
    else if (k === 'c' && !e.ctrlKey && !e.metaKey) csTool('crop');
    else if (k === 'h') csTool('hand');
    else if (k === 'r' && !e.ctrlKey) csAddShape('rect');
    else if (k === 'o' && !e.ctrlKey) csAddShape('circle');
    else if (k === 'i' && !e.ctrlKey) csAddImage();
    else if (k === 'u' && !e.ctrlKey) csOpenUploadModal();
    else if (k === 'g' && !e.ctrlKey) csToggleGrid();
    else if (k === '0' && !e.ctrlKey) csFitCanvas();
    // Phase 1 — Precision & Selection
    else if (k === 'a' && !e.ctrlKey && !e.metaKey) csTool('lasso');
    else if (k === 'q' && !e.ctrlKey && !e.metaKey) csTool('magic');
    else if (k === 'm' && !e.ctrlKey && !e.metaKey) csTool('measure');
    // Phase 2 — Structure
    else if (k === 'n' && !e.ctrlKey && !e.metaKey) csTool('frame');
    else if (k === 'l' && !e.ctrlKey) csAddLine();
}

function _csKeyOffHandler(e) {
    if (e.code === 'Space') {
        if (_csTool === 'hand') csTool(_csLastTool);
    }
}

/* ─── Select All ─────────────────────────────────────────────────────────── */
window.csSelectAll = function() {
    if (!_csCanvas) return;
    const objs = _csCanvas.getObjects().filter(o => !o.data?.isTraitZone && !o.data?.isTraitPreview && o.selectable !== false);
    if (!objs.length) return;
    _csCanvas.discardActiveObject();
    const sel = new fabric.ActiveSelection(objs, { canvas: _csCanvas });
    _csCanvas.setActiveObject(sel);
    _csCanvas.renderAll();
};

/* ─── Navigation ─────────────────────────────────────────────────────────── */
window.csGoBack = function() { window.location.href = '/dashboard.html'; };

/* ─── Inline Title Edit ───────────────────────────────────────────────────── */
window.csStartTitleEdit = function() {
    const span = document.getElementById('cs-topbar-name');
    const input = document.getElementById('cs-topbar-name-input');
    if (!span || !input) return;
    input.value = span.textContent;
    span.style.display = 'none';
    input.style.display = '';
    input.focus();
    input.select();
};

window.csCommitTitleEdit = function() {
    const span = document.getElementById('cs-topbar-name');
    const input = document.getElementById('cs-topbar-name-input');
    const nameInp = document.getElementById('cs-name');
    if (!span || !input) return;
    const val = input.value.trim() || 'New Card';
    span.textContent = val;
    if (nameInp) nameInp.value = val;
    input.style.display = 'none';
    span.style.display = '';
};

window.csCancelTitleEdit = function() {
    const span = document.getElementById('cs-topbar-name');
    const input = document.getElementById('cs-topbar-name-input');
    if (!span || !input) return;
    input.style.display = 'none';
    span.style.display = '';
};

/* ─── Open Studio Modal ───────────────────────────────────────────────────── */
let _csAllCards = [];

window.csShowOpenModal = async function() {
    const modal = document.getElementById('cs-open-modal');
    const list = document.getElementById('cs-open-list');
    if (!modal || !list) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px;">Loading cards...</div>';
    document.getElementById('cs-open-search').value = '';
    try {
        const r = await fetch(`${BACKEND_URL}/api/creator/cards`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to load');
        _csAllCards = await r.json();
        _csRenderOpenList(_csAllCards);
    } catch {
        list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px;">Could not load cards.</div>';
    }
};

function _csRenderOpenList(cards) {
    const list = document.getElementById('cs-open-list');
    if (!list) return;
    if (!cards.length) {
        list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px;">No saved studios found.</div>';
        return;
    }
    list.innerHTML = cards.map(card => `
        <button onclick="csOpenCard('${card.id}')" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;cursor:pointer;text-align:left;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
            ${card.thumbnail_url ? `<img src="${card.thumbnail_url}" style="width:36px;height:50px;object-fit:cover;border-radius:5px;flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:36px;height:50px;background:rgba(255,255,255,0.06);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><i class="bx bxs-image" style="font-size:14px;opacity:0.3;"></i></div>`}
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${card.name || 'Untitled'}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px;">${card.rarity ? card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1) : ''}</div>
            </div>
            <i class="bx bx-chevron-right" style="font-size:16px;opacity:0.3;"></i>
        </button>
    `).join('');
}

window.csFilterOpenCards = function(query) {
    const q = query.toLowerCase();
    _csRenderOpenList(q ? _csAllCards.filter(c => (c.name || '').toLowerCase().includes(q)) : _csAllCards);
};

window.csOpenCard = function(cardId) {
    csHideOpenModal();
    window.location.href = `/card-studio.html?card=${encodeURIComponent(cardId)}`;
};

window.csHideOpenModal = function() {
    const modal = document.getElementById('cs-open-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
};

/* ─── Guides & Snapping ──────────────────────────────────────────────────── */
function _csShowGuide(coord, orient) {
    const area = document.getElementById('cs-canvas-area');
    if (!area) return;
    const container = area.querySelector('.canvas-container');
    const containerLeft = parseFloat(container?.style.left || '0');
    const containerTop  = parseFloat(container?.style.top  || '0');
    const zoom = _csCanvas?.getZoom() || 1;
    const guide = document.createElement('div');
    guide.className = 'cs-smart-guide';
    guide.style.position = 'absolute';
    guide.style.background = 'oklch(65% 0.18 256 / 0.8)';
    guide.style.zIndex = '100';
    guide.style.pointerEvents = 'none';
    if (orient === 'v') {
        guide.style.width = '1px';
        guide.style.height = '100%';
        guide.style.left = (containerLeft + coord * zoom) + 'px';
        guide.style.top = '0';
    } else {
        guide.style.height = '1px';
        guide.style.width = '100%';
        guide.style.top = (containerTop + coord * zoom) + 'px';
        guide.style.left = '0';
    }
    area.appendChild(guide);
}

function _csClearGuides() {
    document.querySelectorAll('.cs-smart-guide').forEach(g => g.remove());
}

/* ─── Image Filters ──────────────────────────────────────────────────────── */
window._csApplyFilter = function(index, value) {
    const obj = _csCanvas?.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    
    const f = fabric.filters;
    let filter = obj.filters.find(fi => fi.type === index);
    
    if (!filter) {
        if (index === 'Brightness') filter = new f.Brightness({ brightness: value });
        else if (index === 'Contrast') filter = new f.Contrast({ contrast: value });
        else if (index === 'Saturation') filter = new f.Saturation({ saturation: value });
        obj.filters.push(filter);
    } else {
        if (index === 'Brightness') filter.brightness = value;
        else if (index === 'Contrast') filter.contrast = value;
        else if (index === 'Saturation') filter.saturation = value;
    }
    
    obj.applyFilters();
    _csCanvas.renderAll();
};

/* ─── Grouping ───────────────────────────────────────────────────────────── */
window.csGroup = function() {
    if (!_csCanvas) return;
    const active = _csCanvas.getActiveObject();
    if (!active || active.type !== 'activeSelection') return;
    
    active.toGroup();
    const group = _csCanvas.getActiveObject();
    group.data = { layerName: 'Group', layerType: 'group' };
    _csCanvas.renderAll();
    _csPushHistory();
    _csRenderLayerList();
};

window.csUngroup = function() {
    if (!_csCanvas) return;
    const active = _csCanvas.getActiveObject();
    if (!active || active.type !== 'group') return;
    
    active.toActiveSelection();
    _csCanvas.renderAll();
    _csPushHistory();
    _csRenderLayerList();
};

/* ─── Foil mask export ───────────────────────────────────────────────────── */
function _csBuildFoilMaskBlob() {
    if (!_csCanvas) return null;
    const objects = _csCanvas.getObjects();
    const shinyLayers = objects.filter(o => o.data?.shiny && o.visible !== false);
    if (shinyLayers.length === 0) return null;

    const saved = objects.map(o => o.visible);
    objects.forEach(o => { o.visible = !!(o.data?.shiny && o.visible !== false); });
    _csCanvas.renderAll();
    const shinyDataUrl = _csCanvas.toDataURL({ format: 'png', multiplier: 1 });
    objects.forEach((o, i) => { o.visible = saved[i]; });
    _csCanvas.renderAll();

    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width = CS_W; offscreen.height = CS_H;
            const ctx = offscreen.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, CS_W, CS_H);
            ctx.drawImage(img, 0, 0, CS_W, CS_H);
            const id = ctx.getImageData(0, 0, CS_W, CS_H);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const a = d[i + 3];
                d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255;
            }
            ctx.putImageData(id, 0, 0);
            offscreen.toBlob(resolve, 'image/png');
        };
        img.src = shinyDataUrl;
    });
}

function _csExportLayerJson() {
    if (!_csCanvas) return null;
    const json = _csCanvas.toJSON(['data']);
    (json.objects || []).forEach(obj => {
        if (obj.type === 'image' && obj.data?.originalUrl) obj.src = obj.data.originalUrl;
    });
    // Strip trait zone and preview overlays — both are view-only, not saved to card
    json.objects = (json.objects || []).filter(o => !o.data?.isTraitPreview && !o.data?.isTraitZone);
    if (_csCanvasBgTransparent) json.background = null;
    return JSON.stringify(json);
}

/* ─── Save ───────────────────────────────────────────────────────────────── */
window.csSave = async function() {
    const name = document.getElementById('cs-name').value.trim();
    if (!name) {
        showToast('Card name is required', 'error');
        document.getElementById('cs-name').focus();
        return;
    }

    // Block save if card number is already taken
    if (_csCheckNumTaken()) {
        showToast('That card number is already taken in this set', 'error');
        document.getElementById('cs-card-num')?.focus();
        return;
    }

    const btn = document.getElementById('cs-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bx bx-loader-alt bx-spin" style="font-size:10px;"></i>Saving...'; }

    // Refresh CSRF token so the cookie and header always match
    await _csRefreshCsrf();

    try {
        // Hide trait zone and previews so they don't appear in the exported image
        const _traitObjs = _csCanvas.getObjects().filter(o => o.data?.isTraitZone || o.data?.isTraitPreview);
        _traitObjs.forEach(o => { o.visible = false; });
        _csCanvas.renderAll();

        const isTransparent = _csCanvasBgTransparent;
        const format = isTransparent ? 'png' : 'jpeg';
        const dataUrl = _csCanvas.toDataURL({ format, quality: 0.95, multiplier: 1.5 }); // 750×1050px production size
        const maskBlob = await _csBuildFoilMaskBlob();
        const layerJson = _csExportLayerJson();

        // Restore trait zone visibility
        _traitObjs.forEach(o => { o.visible = true; });
        _csCanvas.renderAll();

        const imageBlob = await (await fetch(dataUrl)).blob();
        const ext = isTransparent ? 'card-art.png' : 'card-art.jpg';

        showToast('Uploading art...', 'loading');
        const fd = new FormData();
        fd.append('file', imageBlob, ext);
        const uploadRes = await fetch(`${BACKEND_URL}/api/creator/upload`, {
            method: 'POST', headers: { 'X-CSRF-Token': _csCsrfToken }, body: fd, credentials: 'include',
        });
        if (!uploadRes.ok) {
            const e = await uploadRes.json().catch(() => ({}));
            throw new Error(e.error || `Upload failed (${uploadRes.status})`);
        }
        const { url: imageUrl } = await uploadRes.json();
        if (!imageUrl) throw new Error('Upload response missing URL');

        let foilMaskUrl = null;
        if (maskBlob) {
            const mfd = new FormData();
            mfd.append('file', maskBlob, 'foil-mask.png');
            const mr = await fetch(`${BACKEND_URL}/api/creator/upload`, {
                method: 'POST', headers: { 'X-CSRF-Token': _csCsrfToken }, body: mfd, credentials: 'include',
            });
            if (mr.ok) { const { url } = await mr.json(); foilMaskUrl = url; }
        }

        showToast('Saving card...', 'loading');
        const cardId = document.getElementById('cs-card-id').value;
        const templateId = document.getElementById('cs-template').value;
        const payload = {
            id: cardId || undefined,
            name,
            rarity: document.getElementById('cs-rarity').value,
            description: document.getElementById('cs-description').value.trim(),
            attack: _csEvalStat(document.getElementById('cs-attack').value),
            defense: _csEvalStat(document.getElementById('cs-defense').value),
            set_id: document.getElementById('cs-set').value || null,
            image_url: imageUrl,
            is_battle_eligible: document.getElementById('cs-battleable').checked,
            is_trading_eligible: document.getElementById('cs-tradable').checked,
            template_id: templateId || null,
            card_number: document.getElementById('cs-card-number').value.trim() || null,
            trait_list: [],
            auto_roll_traits: !!templateId,
            layer_data: layerJson,
        };
        if (foilMaskUrl !== null) payload.foil_mask_url = foilMaskUrl;

        const saveRes = await fetch(`${BACKEND_URL}/api/creator/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csCsrfToken },
            body: JSON.stringify(payload),
            credentials: 'include',
        });

        if (!saveRes.ok) {
            const e = await saveRes.json().catch(() => ({}));
            throw new Error(e.error || `Save failed (${saveRes.status})`);
        }
        const savedCard = await saveRes.json();

        if (!cardId && savedCard?.id) {
            document.getElementById('cs-card-id').value = savedCard.id;
            const url = new URL(window.location.href);
            url.searchParams.set('id', savedCard.id);
            window.history.replaceState({}, '', url.toString());
        }

        // If traits were auto-rolled server-side, show the baked card preview
        const finalCardId = savedCard?.id || cardId;
        const savedTemplateId = document.getElementById('cs-template').value;
        showToast('Card saved!', 'success');
        _csHasUnsavedChanges = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bx bxs-save" style="font-size:10px;"></i>Save Card'; }
    } catch (err) {
        console.error('[CardStudio] Save failed:', err);
        showToast(err.message || 'Save failed', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bx bxs-save" style="font-size:10px;"></i>Save Card'; }
    }
};

/* ─── Draft Auto-Save ────────────────────────────────────────────────────── */
let _csDraftTimer = null;

function _csDraftSave() {
    const cardId = document.getElementById('cs-card-id')?.value;
    if (!cardId || !_csCanvas) return; // Only save drafts for existing saved cards
    const layerJson = _csExportLayerJson();
    fetch(`${BACKEND_URL}/api/creator/cards/${cardId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csCsrfToken },
        body: JSON.stringify({ layer_data: layerJson }),
        credentials: 'include',
    }).catch(err => console.warn('[CardStudio] Draft save failed:', err));
}

function _csScheduleDraft() {
    clearTimeout(_csDraftTimer);
    _csDraftTimer = setTimeout(_csDraftSave, 30_000); // auto-save draft 30s after last change
}

/* ─── Context Menu ────────────────────────────────────────────────────────── */
function _csShowContextMenu(x, y) {
    const menu = document.getElementById('cs-context-menu');
    if (!menu) return;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
}

function _csHideContextMenu() {
    document.getElementById('cs-context-menu')?.classList.add('hidden');
}

window.csBringToFront = function() {
    if (!_csCanvas) return;
    const obj = _csCanvas.getActiveObject();
    if (obj) { obj.bringToFront(); _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList(); }
    _csHideContextMenu();
};

window.csBringForward = function() {
    if (!_csCanvas) return;
    const obj = _csCanvas.getActiveObject();
    if (obj) { obj.bringForward(); _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList(); }
    _csHideContextMenu();
};

window.csSendBackward = function() {
    if (!_csCanvas) return;
    const obj = _csCanvas.getActiveObject();
    if (obj) { obj.sendBackwards(); _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList(); }
    _csHideContextMenu();
};

window.csMoveSelected = function(dir) {
    if (dir === 'forward') csBringForward();
    else csSendBackward();
};

window.csSendToBack = function() {
    if (!_csCanvas) return;
    const obj = _csCanvas.getActiveObject();
    if (obj) { obj.sendToBack(); _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList(); }
    _csHideContextMenu();
};

/* ─── Session Recovery ───────────────────────────────────────────────────── */
function _csAutoSaveToLocal() {
    if (!_csCanvas || !_csHasUnsavedChanges) return;
    try {
        const json = _csExportLayerJson();
        const cardId = document.getElementById('cs-card-id').value || 'new';
        const data = {
            cardId,
            timestamp: Date.now(),
            layerData: json,
            meta: {
                name: document.getElementById('cs-name').value,
                templateId: document.getElementById('cs-template').value
            }
        };
        localStorage.setItem(`cs_recovery_${cardId}`, JSON.stringify(data));
        console.log('[CardStudio] Auto-saved to local recovery');
    } catch (e) {
        console.warn('[CardStudio] Auto-save failed', e);
    }
}

// ── Server-side draft sync ────────────────────────────────────────────────────
let _csDraftSyncing = false;

function _csDraftIndicator(state) {
    // state: 'saving' | 'saved' | 'error' | 'hidden'
    const dot = document.getElementById('cs-draft-dot');
    const lbl = document.getElementById('cs-draft-lbl');
    if (!dot || !lbl) return;
    if (state === 'hidden') { dot.style.display = 'none'; lbl.textContent = 'Card Studio'; return; }
    dot.style.display = 'block';
    if (state === 'saving') {
        dot.style.background = 'oklch(65% 0.15 60)'; // amber
        lbl.textContent = 'Saving draft…';
    } else if (state === 'saved') {
        dot.style.background = 'oklch(65% 0.18 145)'; // green
        lbl.textContent = 'Draft saved';
        setTimeout(() => _csDraftIndicator('hidden'), 3000);
    } else if (state === 'error') {
        dot.style.background = 'oklch(60% 0.25 20)'; // red
        lbl.textContent = 'Draft sync failed';
        setTimeout(() => _csDraftIndicator('hidden'), 4000);
    }
}

async function _csAutoSaveDraft() {
    if (!_csCanvas || !_csHasUnsavedChanges || _csDraftSyncing) return;
    const cardId = document.getElementById('cs-card-id')?.value;
    if (!cardId) return; // no server draft for unsaved new cards — localStorage only

    _csDraftSyncing = true;
    _csDraftIndicator('saving');
    try {
        await _csRefreshCsrf();
        const json = _csExportLayerJson();
        const res = await fetch(`${BACKEND_URL}/api/creator/cards/${cardId}/draft`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csCsrfToken },
            credentials: 'include',
            body: JSON.stringify({ layer_data: json }),
        });
        if (res.ok) {
            _csDraftIndicator('saved');
            // Also keep localStorage in sync
            _csAutoSaveToLocal();
        } else {
            _csDraftIndicator('error');
        }
    } catch {
        _csDraftIndicator('error');
    } finally {
        _csDraftSyncing = false;
    }
}

async function _csCheckSessionRecovery() {
    const cardId = document.getElementById('cs-card-id').value || 'new';
    const raw = localStorage.getItem(`cs_recovery_${cardId}`);
    if (!raw) return;
    
    try {
        const data = JSON.parse(raw);
        // If it's more than 5 minutes old since we started studio, maybe don't prompt?
        // Or just prompt anyway if it's there.
        if (confirm('Unsaved progress found for this card! Restore it now?')) {
            await _csInitFromJson(data.layerData);
            if (data.meta.name) {
                document.getElementById('cs-name').value = data.meta.name;
                document.getElementById('cs-topbar-name').textContent = data.meta.name;
            }
            if (data.meta.templateId) {
                document.getElementById('cs-template').value = data.meta.templateId;
                csOnTemplateChange();
            }
            showToast('Progress restored', 'success');
        } else {
            localStorage.removeItem(`cs_recovery_${cardId}`);
        }
    } catch (e) {
        localStorage.removeItem(`cs_recovery_${cardId}`);
    }
}

/* ─── Local Export (Download) ────────────────────────────────────────────── */
window.csExportLocal = function(format = 'png', multiplier = 2) {
    if (!_csCanvas) return;
    const traitObjs = _csCanvas.getObjects().filter(o => o.data?.isTraitZone || o.data?.isTraitPreview);
    traitObjs.forEach(o => { o.visible = false; });
    _csCanvas.renderAll();

    const dataUrl = _csCanvas.toDataURL({ format, quality: 0.95, multiplier });

    traitObjs.forEach(o => { o.visible = true; });
    _csCanvas.renderAll();

    const name = (document.getElementById('cs-name')?.value?.trim() || 'card').replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '-').toLowerCase();
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name}-${multiplier}x.${ext}`;
    a.click();
    showToast(`Downloaded ${name}-${multiplier}x.${ext}`, 'success');
};

/* ─── Canvas Background ───────────────────────────────────────────────────── */
window.csSetCanvasBg = function(val) {
    if (!_csCanvas) return;
    _csCanvasBgTransparent = (val === 'transparent');
    const frame = document.getElementById('cs-card-frame');
    if (_csCanvasBgTransparent) {
        _csCanvas.setBackgroundColor(null, _csCanvas.renderAll.bind(_csCanvas));
        if (frame) { frame.style.background = ''; frame.classList.add('cs-checker'); }
    } else {
        _csCanvas.setBackgroundColor(val, _csCanvas.renderAll.bind(_csCanvas));
        if (frame) { frame.style.background = val; frame.classList.remove('cs-checker'); }
    }
    _csPushHistory();
};

window.csBgTab = function(tab) {
    ['solid','gradient','transparent'].forEach(t => {
        const btn = document.getElementById(`cs-bg-tab-${t}`);
        if (btn) btn.classList.toggle('cs-primary', t === tab);
        if (btn) btn.classList.toggle('cs-ghost', t !== tab);
    });
    document.getElementById('cs-bg-solid-ui').style.display    = tab === 'solid'    ? 'flex'        : 'none';
    document.getElementById('cs-bg-gradient-ui').style.display = tab === 'gradient' ? 'flex'        : 'none';
    if (tab === 'transparent') csSetCanvasBg('transparent');
    if (tab === 'solid') csSetCanvasBg(document.getElementById('cs-bg-color')?.value || '#1a1025');
    if (tab === 'gradient') csApplyBgGradient();
};

window.csApplyBgGradient = function() {
    if (!_csCanvas) return;
    const a     = document.getElementById('cs-bg-grad-a')?.value     || '#1a1025';
    const b     = document.getElementById('cs-bg-grad-b')?.value     || '#0d0d2b';
    const angle = parseInt(document.getElementById('cs-bg-grad-angle')?.value || 135);
    const lbl   = document.getElementById('cs-bg-grad-angle-lbl');
    if (lbl) lbl.textContent = angle + '°';

    // Convert CSS-style angle to gradient coords on the canvas
    const rad = (angle - 90) * Math.PI / 180;
    const cx = CS_W / 2, cy = CS_H / 2;
    const len = Math.sqrt(CS_W * CS_W + CS_H * CS_H) / 2;
    const x1 = cx - Math.cos(rad) * len, y1 = cy - Math.sin(rad) * len;
    const x2 = cx + Math.cos(rad) * len, y2 = cy + Math.sin(rad) * len;

    const grad = new fabric.Gradient({
        type: 'linear',
        coords: { x1, y1, x2, y2 },
        colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }],
    });
    _csCanvasBgTransparent = false;
    _csCanvas.setBackgroundColor(grad, _csCanvas.renderAll.bind(_csCanvas));
    const frame = document.getElementById('cs-card-frame');
    if (frame) {
        frame.classList.remove('cs-checker');
        // Mirror in frame element for the visual border preview
        frame.style.background = `linear-gradient(${angle}deg, ${a}, ${b})`;
    }
    _csPushHistory();
};

window.csLibSetBackground = async function(idx) {
    const img = _csLibImages[idx];
    if (!img || !_csCanvas) return;
    showToast('Setting background...', 'loading');
    
    // We treat "background image" as a special bottom layer for now to avoid fabric bg limitations
    const htmlImg = await _csLoadSafeImage(img.url);
    if (!htmlImg) return;
    
    // Remove old background layer if it exists
    const oldBg = _csCanvas.getObjects().find(o => o.data?.isBgLayer);
    if (oldBg) _csCanvas.remove(oldBg);
    
    const fi = new fabric.Image(htmlImg);
    const scale = Math.max(CS_W / htmlImg.naturalWidth, CS_H / htmlImg.naturalHeight);
    fi.set({ 
        left: CS_W / 2, top: CS_H / 2, originX: 'center', originY: 'center', 
        scaleX: scale, scaleY: scale,
        selectable: false, evented: false
    });
    fi.data = { layerName: 'Background Art', layerType: 'image', originalUrl: img.url, isBgLayer: true };
    _csCanvas.add(fi);
    fi.sendToBack();
    _csCanvas.renderAll();
    _csPushHistory();
    _csRenderLayerList();
    showToast('Background updated', 'success');
};

/* ─── Template Browser ───────────────────────────────────────────────────── */
window.csShowTemplateBrowser = function() {
    const modal = document.getElementById('cs-template-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    _csRenderTemplateGrid();
};

window.csHideTemplateBrowser = function() {
    document.getElementById('cs-template-modal')?.classList.add('hidden');
};

function _csRenderTemplateGrid() {
    const grid = document.getElementById('cs-template-grid');
    if (!grid) return;
    
    grid.innerHTML = _csTemplates.map(t => `
        <div class="cs-tm-card" onclick="csSelectTemplate('${t.id}')">
            ${t.image_url ? `<img src="${escapeHTML(t.image_url)}" alt="">` : `<div class="cs-tm-empty">No Preview</div>`}
            <div class="cs-tm-name">${escapeHTML(t.name)}</div>
        </div>
    `).join('');
}

window.csSelectTemplate = function(id) {
    const sel = document.getElementById('cs-template');
    if (sel) {
        sel.value = id;
        csOnTemplateChange();
    }
    csHideTemplateBrowser();
};

/* ─── Phase 1 Helpers ────────────────────────────────────────────────────── */

// Ray-casting point-in-polygon test
function _csPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Simple box blur on ImageData (in-place)
function _csBoxBlur(imageData, w, h, radius) {
    const d = imageData.data;
    const r = Math.max(1, radius);
    const tmp = new Uint8ClampedArray(d.length);
    // Horizontal pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rr = 0, g = 0, b = 0, a = 0, cnt = 0;
            for (let kx = -r; kx <= r; kx++) {
                const nx = Math.min(w - 1, Math.max(0, x + kx));
                const idx = (y * w + nx) * 4;
                rr += d[idx]; g += d[idx+1]; b += d[idx+2]; a += d[idx+3]; cnt++;
            }
            const i = (y * w + x) * 4;
            tmp[i] = rr/cnt; tmp[i+1] = g/cnt; tmp[i+2] = b/cnt; tmp[i+3] = a/cnt;
        }
    }
    // Vertical pass (from tmp back to d)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let rr = 0, g = 0, b = 0, a = 0, cnt = 0;
            for (let ky = -r; ky <= r; ky++) {
                const ny = Math.min(h - 1, Math.max(0, y + ky));
                const idx = (ny * w + x) * 4;
                rr += tmp[idx]; g += tmp[idx+1]; b += tmp[idx+2]; a += tmp[idx+3]; cnt++;
            }
            const i = (y * w + x) * 4;
            d[i] = rr/cnt; d[i+1] = g/cnt; d[i+2] = b/cnt; d[i+3] = a/cnt;
        }
    }
}


/* ─── Phase 2 Helpers ────────────────────────────────────────────────────── */

// Apply the selected shape as a clipPath mask on the object directly below it
window.csApplyMask = function() {
    if (!_csCanvas) return;
    const maskObj = _csCanvas.getActiveObject();
    if (!maskObj || maskObj.type === 'activeSelection') {
        showToast('Select a shape to use as mask', 'error'); return;
    }
    const objs   = _csCanvas.getObjects();
    const idx    = objs.indexOf(maskObj);
    const target = objs[idx - 1];
    if (!target) { showToast('No object beneath the mask shape', 'error'); return; }

    // Clone the mask shape as a clipPath
    maskObj.clone(cloned => {
        cloned.set({
            left:   cloned.left - target.left,
            top:    cloned.top  - target.top,
            absolutePositioned: false,
        });
        target.set('clipPath', cloned);
        _csCanvas.remove(maskObj);
        _csCanvas.setActiveObject(target);
        _csCanvas.renderAll();
        _csPushHistory(); _csRenderLayerList();
        showToast('Mask applied', 'success');
    });
};

/* ─── Phase 4 Helpers ────────────────────────────────────────────────────── */

// Focus Mode — dim all layers except the active selection
window.csToggleFocusMode = function() {
    if (!_csCanvas) return;
    _csFocusMode = !_csFocusMode;
    const btn = document.getElementById('cs-aid-focus');
    if (btn) btn.classList.toggle('active', _csFocusMode);

    const active = _csCanvas.getActiveObject();
    const activeSet = active?.type === 'activeSelection'
        ? active.getObjects()
        : (active ? [active] : []);

    if (_csFocusMode) {
        _csFocusOpacities.clear();
        _csCanvas.getObjects().forEach(obj => {
            if (obj.data?.isTraitPreview) return;
            _csFocusOpacities.set(obj, obj.opacity ?? 1);
            if (!activeSet.includes(obj)) obj.set('opacity', 0.12);
        });
    } else {
        _csCanvas.getObjects().forEach(obj => {
            const orig = _csFocusOpacities.get(obj);
            if (orig !== undefined) obj.set('opacity', orig);
        });
        _csFocusOpacities.clear();
    }
    _csCanvas.renderAll();
};

// Keep Focus Mode in sync when selection changes
function _csFocusSync() {
    if (!_csFocusMode || !_csCanvas) return;
    const active = _csCanvas.getActiveObject();
    const activeSet = active?.type === 'activeSelection'
        ? active.getObjects()
        : (active ? [active] : []);
    _csCanvas.getObjects().forEach(obj => {
        if (obj.data?.isTraitPreview) return;
        if (activeSet.includes(obj)) {
            const orig = _csFocusOpacities.get(obj) ?? obj.opacity ?? 1;
            obj.set('opacity', orig);
        } else {
            obj.set('opacity', 0.12);
        }
    });
    _csCanvas.renderAll();
}

/* ═══════════════════════════════════════════════════════════════════════════
   RARITY STAMP
   Applies a rarity-specific visual overlay (blend-mode rect) on top of all
   layers. Replaces any existing stamp.
   ═══════════════════════════════════════════════════════════════════════════ */
const _CS_RARITY_STAMPS = {
    common:    { fill: 'rgba(180,180,180,0.10)', blend: 'source-over',  shiny: false, label: 'Common'    },
    rare:      { fill: '#4a90e2',                blend: 'screen',        shiny: false, label: 'Rare'      },
    epic:      { fill: '#9b59b6',                blend: 'screen',        shiny: true,  label: 'Epic'      },
    legendary: { fill: '#f39c12',                blend: 'overlay',       shiny: true,  label: 'Legendary' },
};

window.csApplyRarityStamp = function(rarity) {
    if (!_csCanvas) return;
    const cfg = _CS_RARITY_STAMPS[rarity];
    if (!cfg) return;

    // Remove previous stamp
    _csCanvas.getObjects().filter(o => o.data?.isRarityStamp).forEach(o => _csCanvas.remove(o));

    if (rarity === 'common') { _csCanvas.renderAll(); showToast('Common stamp removed', 'info'); return; }

    // Base glow rect covering the whole card
    const stamp = new fabric.Rect({
        left: 0, top: 0, width: CS_W, height: CS_H,
        fill: cfg.fill,
        globalCompositeOperation: cfg.blend,
        selectable: true, evented: true,
        rx: 0, ry: 0,
    });
    stamp.data = { layerName: `${cfg.label} Stamp`, layerType: 'rect', isRarityStamp: true, shiny: cfg.shiny };

    _csCanvas.add(stamp);
    stamp.bringToFront();

    // For legendary: add a radial gold shimmer in the centre too
    if (rarity === 'legendary') {
        const shimmer = new fabric.Gradient({
            type: 'radial',
            coords: { x1: CS_W/2, y1: CS_H*0.35, x2: CS_W/2, y2: CS_H*0.35, r1: 0, r2: CS_W * 0.65 },
            colorStops: [
                { offset: 0,   color: 'rgba(255,215,0,0.35)' },
                { offset: 0.5, color: 'rgba(255,140,0,0.12)' },
                { offset: 1,   color: 'rgba(255,100,0,0)'    },
            ],
        });
        stamp.set('fill', shimmer);
    }

    // Sync the rarity dropdown to match
    const sel = document.getElementById('cs-rarity');
    if (sel) sel.value = rarity;

    _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    showToast(`${cfg.label} stamp applied${cfg.shiny ? ' (Shiny)' : ''}`, 'success');
};

/* ═══════════════════════════════════════════════════════════════════════════
   FRAME SWAPPER
   Renders template thumbnails in the left panel; clicking one swaps the card
   frame layer (isBgLayer = false, isFrameLayer = true) without touching art.
   ═══════════════════════════════════════════════════════════════════════════ */
function _csRenderFrameGrid() {
    const grid = document.getElementById('cs-frame-grid');
    if (!grid) return;
    const frames = _csTemplates.filter(t => t.image_url);
    if (frames.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;font-size:9px;color:var(--muted);text-align:center;padding:12px 0;">No templates with previews found</div>`;
        return;
    }
    grid.innerHTML = frames.map(t => `
        <div onclick="csSwapCardFrame('${escapeHTML(t.id)}')" title="${escapeHTML(t.name)}"
             style="cursor:pointer;border-radius:8px;overflow:hidden;border:1px solid var(--bdr);aspect-ratio:5/7;background:var(--bg);transition:all 0.15s var(--ease);"
             onmouseover="this.style.borderColor='var(--a)'" onmouseout="this.style.borderColor='var(--bdr)'">
            <img src="${escapeHTML(t.image_url)}" alt="${escapeHTML(t.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        </div>
    `).join('');
}

window.csSwapCardFrame = async function(templateId) {
    if (!_csCanvas) return;
    const t = _csTemplates.find(t => t.id === templateId);
    if (!t?.image_url) { showToast('Template has no preview image', 'error'); return; }

    // Remove existing frame layer
    _csCanvas.getObjects().filter(o => o.data?.isFrameLayer).forEach(o => _csCanvas.remove(o));

    const safeImg = await _csLoadSafeImage(t.image_url);
    if (!safeImg) { showToast('Could not load frame image', 'error'); return; }

    const scale = Math.max(CS_W / safeImg.naturalWidth, CS_H / safeImg.naturalHeight);
    const frame = new fabric.Image(safeImg, {
        left: CS_W / 2, top: CS_H / 2,
        originX: 'center', originY: 'center',
        scaleX: scale, scaleY: scale,
        selectable: true, evented: true,
    });
    frame.data = { layerName: `Frame — ${t.name}`, layerType: 'image', isFrameLayer: true, originalUrl: t.image_url };
    _csCanvas.add(frame);
    frame.bringToFront();
    // Keep rarity stamps above the frame
    _csCanvas.getObjects().filter(o => o.data?.isRarityStamp).forEach(o => o.bringToFront());
    _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    showToast(`Frame swapped to ${t.name}`, 'success');
};

window.csRemoveCardFrame = function() {
    if (!_csCanvas) return;
    const removed = _csCanvas.getObjects().filter(o => o.data?.isFrameLayer);
    removed.forEach(o => _csCanvas.remove(o));
    if (removed.length) { _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList(); showToast('Frame removed', 'info'); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   STAT TOOL
   Drops a styled HP / ATK / DEF group: icon emoji + stat value text.
   Inherits the font and colour chosen in the left panel controls.
   ═══════════════════════════════════════════════════════════════════════════ */
const _CS_STAT_CFG = {
    atk: { label: 'ATK', key: 'cs-attack',  defaultVal: '50' },
    def: { label: 'DEF', key: 'cs-defense', defaultVal: '50' },
};

window.csAddStatComponent = function(type) {
    if (!_csCanvas) return;
    const cfg     = _CS_STAT_CFG[type];
    if (!cfg) return;
    const font    = document.getElementById('cs-stat-font')?.value  || 'Space Grotesk';
    const color   = document.getElementById('cs-stat-color')?.value || '#ffffff';
    const statVal = document.getElementById(cfg.key)?.value || cfg.defaultVal;

    const txt = new fabric.IText(String(statVal), {
        left: CS_W / 2,
        top: CS_H - 80,
        originX: 'center', originY: 'center',
        fontSize: 36,
        fontFamily: font + ', sans-serif',
        fontWeight: 'bold',
        fill: color,
    });
    txt.data = { layerName: `${cfg.label}`, layerType: 'stat', statType: type };

    _csCanvas.add(txt);
    _csCanvas.setActiveObject(txt);
    _csCanvas.renderAll();
    _csPushHistory(); _csRenderLayerList();
    showToast(`${cfg.label} added`, 'success');
};

/* ═══════════════════════════════════════════════════════════════════════════
   INTERACTIVE GRADIENT HANDLES
   When a shape with a linear gradient fill is selected, two draggable handles
   appear on the canvas. Dragging them updates the gradient direction live.
   ═══════════════════════════════════════════════════════════════════════════ */
let _csGradDragging = null; // 'h1' | 'h2' | null
let _csGradCoords   = null; // { x1,y1,x2,y2 } in canvas space

function _csGradHandlesShow(obj) {
    if (!obj || typeof obj.fill !== 'object' || obj.fill?.type !== 'linear') {
        _csGradHandlesHide(); return;
    }
    const svg   = document.getElementById('cs-grad-handles');
    if (!svg) return;

    const canvasEl = _csCanvas.getElement();
    const areaRect = document.getElementById('cs-canvas-area')?.getBoundingClientRect();
    const rect     = canvasEl.getBoundingClientRect();
    if (!areaRect) return;

    const fill  = obj.fill;
    const br    = obj.getBoundingRect(true);
    // Gradient coords are relative to object; convert to canvas then to screen
    const toScreen = (gx, gy) => ({
        sx: (br.left + gx) * _csZoom + (rect.left - areaRect.left),
        sy: (br.top  + gy) * _csZoom + (rect.top  - areaRect.top),
    });

    const s1 = toScreen(fill.coords.x1 * (obj.scaleX || 1), fill.coords.y1 * (obj.scaleY || 1));
    const s2 = toScreen(fill.coords.x2 * (obj.scaleX || 1), fill.coords.y2 * (obj.scaleY || 1));

    const h1 = document.getElementById('cs-grad-h1');
    const h2 = document.getElementById('cs-grad-h2');
    const ln = document.getElementById('cs-grad-line');

    if (h1) { h1.setAttribute('cx', s1.sx); h1.setAttribute('cy', s1.sy); }
    if (h2) { h2.setAttribute('cx', s2.sx); h2.setAttribute('cy', s2.sy); }
    if (ln) { ln.setAttribute('x1', s1.sx); ln.setAttribute('y1', s1.sy); ln.setAttribute('x2', s2.sx); ln.setAttribute('y2', s2.sy); }

    svg.style.display = 'block';

    // Wire drag on first show (idempotent guard)
    if (!svg.dataset.wired) {
        svg.dataset.wired = '1';
        const startDrag = (handleId) => (e) => {
            e.preventDefault();
            _csGradDragging = handleId;
            _csGradCoords = {
                x1: fill.coords.x1, y1: fill.coords.y1,
                x2: fill.coords.x2, y2: fill.coords.y2,
            };
        };
        h1?.addEventListener('mousedown', startDrag('h1'));
        h2?.addEventListener('mousedown', startDrag('h2'));

        document.addEventListener('mousemove', e => {
            if (!_csGradDragging || !_csCanvas) return;
            const activeObj = _csCanvas.getActiveObject();
            if (!activeObj) return;
            const br2   = activeObj.getBoundingRect(true);
            const rect2 = canvasEl.getBoundingClientRect();
            // Convert screen → canvas → object-local coords
            const cx = (e.clientX - rect2.left) / _csZoom - br2.left;
            const cy = (e.clientY - rect2.top)  / _csZoom - br2.top;
            const nx = cx / (activeObj.scaleX || 1);
            const ny = cy / (activeObj.scaleY || 1);
            const c  = { ...activeObj.fill.coords };
            if (_csGradDragging === 'h1') { c.x1 = nx; c.y1 = ny; }
            else                          { c.x2 = nx; c.y2 = ny; }
            const newGrad = new fabric.Gradient({
                type: 'linear', coords: c,
                colorStops: activeObj.fill.colorStops,
            });
            activeObj.set('fill', newGrad);
            _csCanvas.renderAll();
            _csGradHandlesShow(activeObj);
        });
        document.addEventListener('mouseup', () => {
            if (_csGradDragging) { _csGradDragging = null; _csPushHistory(); }
        });
    }
}

function _csGradHandlesHide() {
    const svg = document.getElementById('cs-grad-handles');
    if (svg) svg.style.display = 'none';
    _csGradDragging = null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTO LAYOUT
   Adds a "flex" mode to Groups: when enabled, moving/resizing children
   redistributes spacing automatically.
   Toggle via right-click context menu on a Group.
   ═══════════════════════════════════════════════════════════════════════════ */
window.csToggleAutoLayout = function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj || obj.type !== 'group') { showToast('Select a Group first', 'error'); return; }
    const enabled = !obj.data?.autoLayout;
    obj.data = { ...(obj.data || {}), autoLayout: enabled };
    if (enabled) _csApplyAutoLayout(obj);
    _csCanvas.renderAll(); _csPushHistory(); _csRenderLayerList();
    showToast(`Auto Layout ${enabled ? 'on' : 'off'}`, 'info');
};

function _csApplyAutoLayout(group) {
    if (!group?.data?.autoLayout) return;
    const items = group.getObjects();
    if (items.length < 2) return;

    const padding = group.data.autoLayoutPadding ?? 10;
    const dir     = group.data.autoLayoutDir     ?? 'horizontal'; // 'horizontal' | 'vertical'

    // Sort by current position
    items.sort((a, b) => dir === 'horizontal' ? a.left - b.left : a.top - b.top);

    let cursor = padding;
    items.forEach(item => {
        if (dir === 'horizontal') {
            item.set('left', cursor - group.width / 2 + item.width * (item.scaleX || 1) / 2);
            cursor += item.width * (item.scaleX || 1) + padding;
        } else {
            item.set('top', cursor - group.height / 2 + item.height * (item.scaleY || 1) / 2);
            cursor += item.height * (item.scaleY || 1) + padding;
        }
        item.setCoords();
    });
    group.addWithUpdate();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAGIC SELECT
   Click a point on an image layer → flood-fill from that pixel to generate
   a selection mask, then offer to cut/delete the selected region.
   ═══════════════════════════════════════════════════════════════════════════ */
let _csMagicTolerance = 32;

function _csMagicFloodFill(imageData, w, h, startX, startY, tolerance) {
    const data    = imageData.data;
    const idx     = (y, x) => (y * w + x) * 4;
    const target  = [data[idx(startY,startX)], data[idx(startY,startX)+1], data[idx(startY,startX)+2], data[idx(startY,startX)+3]];
    const visited = new Uint8Array(w * h);
    const mask    = new Uint8Array(w * h);
    const queue   = [[startX, startY]];

    const match = (x, y) => {
        const i = idx(y, x);
        return Math.abs(data[i]-target[0]) + Math.abs(data[i+1]-target[1]) +
               Math.abs(data[i+2]-target[2]) + Math.abs(data[i+3]-target[3]) <= tolerance * 4;
    };

    while (queue.length) {
        const [x, y] = queue.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const pos = y * w + x;
        if (visited[pos]) continue;
        visited[pos] = 1;
        if (!match(x, y)) continue;
        mask[pos] = 1;
        queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    return mask;
}

// Apply magic selection: erases the flood-filled region from the image
async function _csMagicErase(obj, canvasX, canvasY) {
    if (!obj || obj.type !== 'image') { showToast('Magic Select works on image layers', 'error'); return; }

    // Show spinner
    let spinner = document.getElementById('cs-magic-spinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'cs-magic-spinner';
        spinner.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);';
        spinner.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,242,254,0.2)" stroke-width="3"/><circle cx="20" cy="20" r="16" fill="none" stroke="#00f2fe" stroke-width="3" stroke-dasharray="60 40" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.8s" repeatCount="indefinite"/></circle></svg>
            <span style="font-size:11px;font-weight:700;color:#00f2fe;text-transform:uppercase;letter-spacing:0.1em;">Erasing…</span>
        </div>`;
        document.body.appendChild(spinner);
    }
    spinner.style.display = 'flex';

    // Render image to an offscreen canvas
    const el  = obj._element;
    const ow  = el.naturalWidth  || el.width;
    const oh  = el.naturalHeight || el.height;
    const tmp = document.createElement('canvas');
    tmp.width = ow; tmp.height = oh;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(el, 0, 0);

    // Map canvas coord → image pixel coord
    const br    = obj.getBoundingRect(true);
    const imgX  = Math.round(((canvasX - br.left) / (br.width  || 1)) * ow);
    const imgY  = Math.round(((canvasY - br.top)  / (br.height || 1)) * oh);
    if (imgX < 0 || imgY < 0 || imgX >= ow || imgY >= oh) return;

    const imageData = ctx.getImageData(0, 0, ow, oh);
    const mask      = _csMagicFloodFill(imageData, ow, oh, imgX, imgY, _csMagicTolerance);

    // Erase masked pixels (set alpha to 0)
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) imageData.data[i * 4 + 3] = 0;
    }
    ctx.putImageData(imageData, 0, 0);

    // Replace Fabric image with the modified canvas blob
    const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
    const url  = URL.createObjectURL(blob);
    fabric.Image.fromURL(url, newImg => {
        newImg.set({
            left: obj.left, top: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            originX: obj.originX, originY: obj.originY,
            angle: obj.angle,
        });
        newImg.data = { ...obj.data };
        _csCanvas.remove(obj);
        _csCanvas.add(newImg);
        _csCanvas.setActiveObject(newImg);
        _csCanvas.renderAll();
        URL.revokeObjectURL(url);
        _csPushHistory(); _csRenderLayerList();
        const sp = document.getElementById('cs-magic-spinner');
        if (sp) sp.style.display = 'none';
        showToast('Background erased', 'success');
    });
}

/* ─── Gradient Editor ────────────────────────────────────────────────────── */
let _csGradStops       = [{ offset: 0, color: '#000000', opacity: 1 }, { offset: 1, color: '#00f2fe', opacity: 1 }];
let _csGradSelStop     = 0;
let _csGradType        = 'linear';
let _csGradPickingStop = false; // true while sub-color-picker open for a stop

function _csVoidTab(tab) {
    const colPanel  = document.getElementById('cvp-panel-color');
    const gradPanel = document.getElementById('cvp-panel-gradient');
    const tCol      = document.getElementById('cvp-tab-color');
    const tGrad     = document.getElementById('cvp-tab-gradient');
    if (!colPanel || !gradPanel) return;
    const isGrad = tab === 'gradient';
    colPanel.style.display  = isGrad ? 'none'  : 'flex';
    gradPanel.style.display = isGrad ? 'flex'  : 'none';
    tCol.style.borderBottomColor  = isGrad ? 'transparent' : '#00f2fe';
    tCol.style.color              = isGrad ? 'rgba(255,255,255,0.35)' : '#fff';
    tGrad.style.borderBottomColor = isGrad ? '#00f2fe' : 'transparent';
    tGrad.style.color             = isGrad ? '#fff' : 'rgba(255,255,255,0.35)';
    if (isGrad) {
        // Seed from active object if it already has a gradient
        const obj = _csCanvas?.getActiveObject();
        if (obj && obj.fill instanceof fabric.Gradient) {
            _csGradType  = obj.fill.type || 'linear';
            _csGradStops = obj.fill.colorStops.map(s => {
                // Parse rgba for opacity
                let col = s.color || '#000000';
                let op  = s.opacity != null ? s.opacity : 1;
                if (col.startsWith('rgba')) {
                    const m = col.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                    if (m) { col = '#' + [+m[1],+m[2],+m[3]].map(v=>v.toString(16).padStart(2,'0')).join(''); op = parseFloat(m[4]); }
                }
                return { offset: s.offset, color: col, opacity: op };
            }).sort((a, b) => a.offset - b.offset);
        }
        _csGradSelStop = 0;
        document.getElementById('cvp-grad-type').value = _csGradType;
        _csGradRender();
    }
}
window._csVoidTab = _csVoidTab;

function _csGradRender() {
    const bar   = document.getElementById('cvp-grad-bar');
    const stops = document.getElementById('cvp-grad-stops');
    if (!bar || !stops) return;

    // Wire bar click to insert stop (idempotent)
    if (!bar.dataset.gradInit) {
        bar.dataset.gradInit = '1';
        bar.addEventListener('mousedown', (e) => {
            // Only if click didn't land on a handle
            if (e.target !== bar) return;
            const rect = bar.getBoundingClientRect();
            const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            // Interpolate color at this position
            const sorted = [..._csGradStops].sort((a,b) => a.offset - b.offset);
            let col = sorted[0].color;
            for (let i = 0; i < sorted.length - 1; i++) {
                if (f >= sorted[i].offset && f <= sorted[i+1].offset) {
                    const t = (f - sorted[i].offset) / (sorted[i+1].offset - sorted[i].offset);
                    const r1=parseInt(sorted[i].color.slice(1,3),16), g1=parseInt(sorted[i].color.slice(3,5),16), b1=parseInt(sorted[i].color.slice(5,7),16);
                    const r2=parseInt(sorted[i+1].color.slice(1,3),16), g2=parseInt(sorted[i+1].color.slice(3,5),16), b2=parseInt(sorted[i+1].color.slice(5,7),16);
                    col = '#' + [Math.round(r1+(r2-r1)*t), Math.round(g1+(g2-g1)*t), Math.round(b1+(b2-b1)*t)].map(v=>v.toString(16).padStart(2,'0')).join('');
                    break;
                }
            }
            _csGradStops.push({ offset: f, color: col, opacity: 1 });
            _csGradStops.sort((a,b) => a.offset - b.offset);
            _csGradSelStop = _csGradStops.findIndex(s => s.offset === f);
            _csGradRender(); _csGradSyncStopUI();
        });
        // Wire type selector here instead of DOMContentLoaded
        const typeEl = document.getElementById('cvp-grad-type');
        if (typeEl) typeEl.addEventListener('change', () => { _csGradType = typeEl.value; });
    }

    // Update bar gradient preview
    const css = _csGradStops.map(s => {
        const hex = s.color || '#000';
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${s.opacity ?? 1}) ${Math.round(s.offset*100)}%`;
    }).join(', ');
    bar.style.background = `linear-gradient(to right, ${css})`;

    // Render stop handles
    stops.innerHTML = '';
    _csGradStops.forEach((s, i) => {
        const pct = Math.round(s.offset * 100);
        const handle = document.createElement('div');
        handle.style.cssText = `
            position:absolute; left:calc(${pct}% - 7px); top:2px;
            width:14px; height:14px; border-radius:50%;
            background:${s.color}; border:2px solid ${i === _csGradSelStop ? '#00f2fe' : 'rgba(255,255,255,0.6)'};
            box-shadow:0 1px 4px rgba(0,0,0,0.6); cursor:pointer; pointer-events:all;
            transform: translateY(-1px);
        `;
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            _csGradSelStop = i;
            _csGradRender();
            _csGradSyncStopUI();
            // Drag to reposition
            const barRect = bar.getBoundingClientRect();
            const mm = (me) => {
                let f = (me.clientX - barRect.left) / barRect.width;
                f = Math.max(0, Math.min(1, f));
                // Don't let first/last stop move past each other
                _csGradStops[i].offset = f;
                _csGradStops.sort((a,b) => a.offset - b.offset);
                _csGradSelStop = _csGradStops.indexOf(s);
                _csGradRender(); _csGradSyncStopUI();
            };
            const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
            window.addEventListener('mousemove', mm);
            window.addEventListener('mouseup', mu);
        });
        stops.appendChild(handle);
    });

    _csGradSyncStopUI();
}

function _csGradSyncStopUI() {
    const s = _csGradStops[_csGradSelStop];
    if (!s) return;
    const clrEl  = document.getElementById('cvp-stop-clr');
    const posEl  = document.getElementById('cvp-stop-pos');
    const opEl   = document.getElementById('cvp-stop-opacity');
    const opLbl  = document.getElementById('cvp-stop-opacity-lbl');
    if (clrEl)  clrEl.style.background = s.color;
    if (posEl)  posEl.value = Math.round(s.offset * 100);
    if (opEl)   opEl.value  = Math.round((s.opacity ?? 1) * 100);
    if (opLbl)  opLbl.textContent = Math.round((s.opacity ?? 1) * 100) + '%';
}

window._csGradStopPickColor = function() {
    const s   = _csGradStops[_csGradSelStop];
    const btn = document.getElementById('cvp-stop-clr');
    if (!s || !btn) return;
    _csVoidPicker.open(btn, s.color,
        (hex) => { _csGradStops[_csGradSelStop].color = hex; _csGradRender(); },
        (hex) => { _csGradStops[_csGradSelStop].color = hex; _csGradRender(); _csVoidPicker.close(); _csVoidTab('gradient'); }
    );
};

window._csGradStopSetPos = function(val) {
    _csGradStops[_csGradSelStop].offset = Math.max(0, Math.min(100, +val)) / 100;
    _csGradStops.sort((a,b) => a.offset - b.offset);
    _csGradRender();
};

window._csGradStopSetOpacity = function(val) {
    _csGradStops[_csGradSelStop].opacity = Math.max(0, Math.min(100, +val)) / 100;
    document.getElementById('cvp-stop-opacity-lbl').textContent = Math.round(+val) + '%';
    _csGradRender();
};

window._csGradStopInsert = function() {
    // Insert midpoint between selected and next stop
    const i   = _csGradSelStop;
    const cur = _csGradStops[i];
    const nxt = _csGradStops[i + 1] || _csGradStops[i - 1];
    const newOffset = nxt ? (cur.offset + nxt.offset) / 2 : Math.min(1, cur.offset + 0.1);
    _csGradStops.push({ offset: newOffset, color: cur.color, opacity: cur.opacity ?? 1 });
    _csGradStops.sort((a,b) => a.offset - b.offset);
    _csGradSelStop = _csGradStops.findIndex(s => s.offset === newOffset);
    _csGradRender();
};

window._csGradStopDelete = function() {
    if (_csGradStops.length <= 2) return; // minimum 2 stops
    _csGradStops.splice(_csGradSelStop, 1);
    _csGradSelStop = Math.min(_csGradSelStop, _csGradStops.length - 1);
    _csGradRender();
};

function _csGradReverse() {
    _csGradStops = _csGradStops.map(s => ({ ...s, offset: 1 - s.offset })).reverse();
    _csGradRender();
}
window._csGradReverse = _csGradReverse;

window._csGradApply = function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    _csGradType = document.getElementById('cvp-grad-type')?.value || 'linear';
    const colorStops = _csGradStops.map(s => {
        const r = parseInt(s.color.slice(1,3),16), g = parseInt(s.color.slice(3,5),16), b = parseInt(s.color.slice(5,7),16);
        return { offset: s.offset, color: `rgba(${r},${g},${b},${s.opacity ?? 1})` };
    });
    const coords = _csGradType === 'linear'
        ? { x1: 0, y1: 0, x2: obj.width, y2: 0 }
        : { x1: obj.width/2, y1: obj.height/2, x2: obj.width/2, y2: obj.height/2, r1: 0, r2: obj.width/2 };
    obj.set('fill', new fabric.Gradient({ type: _csGradType, coords, colorStops }));
    _csCanvas.renderAll();
    _csPushHistory();
    _csRenderPropsPanel(obj);
    _csVoidPicker.close();
};

// Type selector is wired inside _csGradRender on first call (idempotent via dataset.gradInit)

/* ─── Void Color Picker ──────────────────────────────────────────────────── */
const _csVoidPicker = (() => {
    let _onChange = null;
    let _onApply  = null;
    let _h = 180, _s = 100, _v = 100;
    let _open = false;

    function _hsvToHex(h, s, v) {
        s /= 100; v /= 100;
        const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
        let r, g, b;
        if      (h < 60)  [r,g,b] = [c,x,0];
        else if (h < 120) [r,g,b] = [x,c,0];
        else if (h < 180) [r,g,b] = [0,c,x];
        else if (h < 240) [r,g,b] = [0,x,c];
        else if (h < 300) [r,g,b] = [x,0,c];
        else              [r,g,b] = [c,0,x];
        const toHex = n => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function _hexToHsv(hex) {
        const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
        const v = max, s = max === 0 ? 0 : d / max;
        let h = 0;
        if (max !== min) {
            if      (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else                h = (r - g) / d + 4;
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }

    function _sync() {
        const hex = _hsvToHex(_h, _s, _v);
        const sv  = document.getElementById('cvp-sv');
        const svP = document.getElementById('cvp-sv-ptr');
        const hueP = document.getElementById('cvp-hue-ptr');
        const sw  = document.getElementById('cvp-swatch');
        const hexI = document.getElementById('cvp-hex');
        if (sv)   sv.style.background  = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),${_hsvToHex(_h,100,100)}`;
        if (svP)  { svP.style.left = `${_s}%`; svP.style.top = `${100 - _v}%`; }
        if (hueP) hueP.style.left = `${(_h / 360) * 100}%`;
        if (sw)   sw.style.background = hex;
        if (hexI && document.activeElement !== hexI) hexI.value = hex.slice(1).toUpperCase();
        if (_onChange) _onChange(hex);
    }

    function _dragSv(e) {
        const el = document.getElementById('cvp-sv');
        if (!el) return;
        const r = el.getBoundingClientRect();
        _s = Math.max(0, Math.min(100, ((e.clientX - r.left)  / r.width)  * 100));
        _v = Math.max(0, Math.min(100, (1 - (e.clientY - r.top) / r.height) * 100));
        _sync();
    }
    function _dragHue(e) {
        const el = document.getElementById('cvp-hue');
        if (!el) return;
        const r = el.getBoundingClientRect();
        _h = Math.max(0, Math.min(360, ((e.clientX - r.left) / r.width) * 360));
        _sync();
    }

    function _initEvents() {
        const sv  = document.getElementById('cvp-sv');
        const hue = document.getElementById('cvp-hue');
        const hexI = document.getElementById('cvp-hex');
        const applyBtn = document.getElementById('cvp-apply');
        if (!sv || sv.dataset.vpInit) return;
        sv.dataset.vpInit = '1';

        const drag = (handler) => (e) => {
            handler(e);
            const mm = me => handler(me);
            const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
            window.addEventListener('mousemove', mm);
            window.addEventListener('mouseup', mu);
        };
        sv.addEventListener('mousedown',  drag(_dragSv));
        hue.addEventListener('mousedown', drag(_dragHue));

        hexI.addEventListener('input', () => {
            const v = hexI.value.replace(/[^0-9a-f]/gi, '');
            if (v.length === 6) {
                const hsv = _hexToHsv('#' + v);
                _h = hsv.h; _s = hsv.s; _v = hsv.v;
                _sync();
            }
        });

        applyBtn.addEventListener('click', () => {
            const hex = _hsvToHex(_h, _s, _v);
            if (_onApply) _onApply(hex);
            close();
        });

        const transpBtn = document.getElementById('cvp-transparent');
        if (transpBtn) {
            transpBtn.addEventListener('click', () => {
                if (_onApply) _onApply('transparent');
                close();
            });
        }

        document.addEventListener('mousedown', (e) => {
            const picker = document.getElementById('cs-void-picker');
            if (_open && picker && !picker.contains(e.target) && !e.target.closest('.cs-void-clr-btn') && !e.target.closest('#cs-colorswap')) {
                close();
            }
        }, true);
    }

    function open(anchorEl, initialHex, onChange, onApply) {
        _onChange = onChange;
        _onApply  = onApply || onChange;
        const picker = document.getElementById('cs-void-picker');
        if (!picker) return;
        _initEvents();
        if (initialHex && /^#[0-9a-f]{6}$/i.test(initialHex)) {
            const hsv = _hexToHsv(initialHex);
            _h = hsv.h; _s = hsv.s; _v = hsv.v;
        }
        _sync();
        // Show off-screen first so we can measure its real height
        picker.style.visibility = 'hidden';
        picker.style.display = 'flex';
        const W = 240, H = picker.offsetHeight || 340;
        picker.style.visibility = '';
        _open = true;

        // Position adjacent to anchor, always fully inside viewport
        const rect = anchorEl ? anchorEl.getBoundingClientRect()
                              : { left: window.innerWidth/2 - W/2, top: window.innerHeight/2 - H/2, bottom: window.innerHeight/2 + H/2, right: window.innerWidth/2 + W/2 };
        const GAP = 8;
        const vw = window.innerWidth, vh = window.innerHeight;

        // Prefer opening below the anchor; if not enough room, open above
        let top = rect.bottom + GAP;
        if (top + H > vh - GAP) top = rect.top - H - GAP;
        // Clamp to viewport
        top = Math.max(GAP, Math.min(vh - H - GAP, top));

        // Prefer aligning left edge with anchor; shift left if overflows
        let left = rect.left;
        if (left + W > vw - GAP) left = rect.right - W;
        left = Math.max(GAP, Math.min(vw - W - GAP, left));

        picker.style.left = left + 'px';
        picker.style.top  = top  + 'px';
    }

    function close() {
        const picker = document.getElementById('cs-void-picker');
        if (picker) picker.style.display = 'none';
        _open = false;
    }

    return { open, close };
})();

/* ─── Swatch background helper (handles transparent) ────────────────────── */
function _csSwatchBg(el, val) {
    if (!el) return;
    if (!val || val === 'transparent' || val === 'rgba(0,0,0,0)') {
        el.style.background = 'repeating-conic-gradient(rgba(255,255,255,0.15) 0% 25%, rgba(0,0,0,0.25) 0% 50%) 0 0 / 8px 8px';
        el.title = 'Transparent';
    } else {
        el.style.background = val;
        el.title = val;
    }
}

/* ─── Color Input Upgrader ───────────────────────────────────────────────── */
// Replaces native input[type=color] with void-picker swatch buttons
function _csUpgradeColorInputs(root) {
    (root || document).querySelectorAll('input[type="color"]:not([data-cs-upgraded]):not([data-native])').forEach(inp => {
        inp.dataset.csUpgraded = '1';
        const w = parseInt(inp.style.width)  || inp.offsetWidth  || 28;
        const h = parseInt(inp.style.height) || inp.offsetHeight || 28;
        const btn = document.createElement('div');
        btn.className = 'cs-void-clr-btn';
        btn.style.cssText = `width:${w}px;height:${Math.max(h,22)}px;`;
        _csSwatchBg(btn, inp.value || '#000000');
        inp.parentNode.insertBefore(btn, inp);
        inp.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none;';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _csVoidPicker.open(btn, inp._val,
                (val) => {
                    inp._val = val;
                    _csSwatchBg(btn, val);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                },
                (val) => {
                    inp._val = val;
                    _csSwatchBg(btn, val);
                    inp.dispatchEvent(new Event('input',  { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    _csVoidPicker.close();
                }
            );
        });
        // Keep swatch in sync when value changes programmatically
        Object.defineProperty(inp, 'value', {
            get() { return this._val || '#000000'; },
            set(v) { this._val = v; _csSwatchBg(btn, v); },
            configurable: true,
        });
        inp._val = inp.getAttribute('value') || '#000000';
    });
}

/* ─── Fill / Stroke Color Swapper ───────────────────────────────────────── */
function _csUpdateColorSwapper() {
    const obj = _csCanvas?.getActiveObject();
    const fillSq   = document.getElementById('cs-clr-fill-sq');
    const strokeSq = document.getElementById('cs-clr-stroke-sq');
    if (!fillSq || !strokeSq) return;
    const fillVal   = (obj && typeof obj.fill   === 'string') ? obj.fill   : '#ffffff';
    const strokeVal = (obj && typeof obj.stroke === 'string') ? obj.stroke : '#000000';
    _csSwatchBg(fillSq,   fillVal);
    _csSwatchBg(strokeSq, strokeVal);
}

window.csOpenColorFor = function(prop) {
    const sq = document.getElementById(prop === 'fill' ? 'cs-clr-fill-sq' : 'cs-clr-stroke-sq');
    const obj = _csCanvas?.getActiveObject();
    const raw = obj && typeof obj[prop] === 'string' ? obj[prop] : '#ffffff';
    const current = raw.startsWith('#') ? raw : '#ffffff';
    _csVoidPicker.open(sq, current,
        (hex) => {
            const o = _csCanvas?.getActiveObject();
            if (!o) return;
            _csPropSet(prop, hex);
            _csCanvas.renderAll();
            _csAddRecentColor(hex);
            _csUpdateColorSwapper();
        },
        (hex) => {
            const o = _csCanvas?.getActiveObject();
            if (!o) return;
            _csPropSet(prop, hex);
            _csCanvas.renderAll();
            _csAddRecentColor(hex);
            _csUpdateColorSwapper();
            _csPushHistory();
        }
    );
};

window.csSwapFillStroke = function() {
    const obj = _csCanvas?.getActiveObject();
    if (!obj) return;
    const oldFill   = typeof obj.fill   === 'string' ? obj.fill   : '#ffffff';
    const oldStroke = typeof obj.stroke === 'string' ? obj.stroke : '#000000';
    obj.set({ fill: oldStroke, stroke: oldFill });
    _csCanvas.renderAll();
    _csPushHistory();
    _csUpdateColorSwapper();
};

/* ─── Keyboard Shortcuts Modal ───────────────────────────────────────────── */
window.csShowShortcutsModal = function() {
    document.getElementById('cs-shortcuts-modal')?.classList.remove('hidden');
};
window.csHideShortcutsModal = function() {
    document.getElementById('cs-shortcuts-modal')?.classList.add('hidden');
};

/* ─── Entry point ────────────────────────────────────────────────────────── */
initStudio().catch(err => {
    console.error('[CardStudio] Init failed:', err);
    const loading = document.getElementById('cs-loading');
    if (loading) loading.innerHTML = `
        <div style="font-size:13px;color:#ef4444;font-weight:700;">Studio failed to load</div>
        <div style="font-size:10px;color:#64748b;margin-top:6px;">${err.message || 'Unknown error'}</div>
        <button onclick="location.reload()" style="margin-top:14px;padding:7px 16px;background:rgba(0,242,254,0.1);border:1px solid rgba(0,242,254,0.2);border-radius:7px;color:#00f2fe;cursor:pointer;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;">Retry</button>
    `;
});

// Initialise shape dock icon (default: rectangle)
_csSetShapeDocIcon('rect');
