(function () {
  'use strict';

  var BACKEND = (function () {
    var m = document.querySelector('meta[name="castle-public-url"]');
    return m ? m.content.replace(/\/$/, '') : '';
  })();

  var handle = window.location.pathname.split('/').filter(Boolean)[0] || '';
  var sbAccentRgb = '139,92,246';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Tile builders ──
  // Each tile gets data-tile-id for order persistence.
  function staticTileHTML(tileId, name, href, count, rgb) {
    rgb = rgb || sbAccentRgb;
    return '<a class="binder-tile" href="' + esc(href) + '"' +
      ' data-tile-id="' + esc(tileId) + '"' +
      ' style="--binder-accent-rgb:' + rgb + '">' +
      '<div class="binder-book">' +
        '<div class="binder-spine-strip"></div>' +
        '<div class="binder-face">' +
          '<div class="binder-weave"></div>' +
          '<div class="binder-sheen"></div>' +
          '<div class="binder-stitch"></div>' +
          '<div class="binder-zipper"></div>' +
          '<div class="binder-etched">' +
            '<div class="binder-etch-name" style="color:rgba(255,255,255,0.9)">' + esc(name) + '</div>' +
          '</div>' +
          '<div class="binder-card-count" style="color:rgba(255,255,255,0.45)">' + count + ' cards</div>' +
        '</div>' +
      '</div>' +
      '<div class="binder-label">' +
        '<span class="binder-name">' + esc(name) + '</span>' +
        '<div class="binder-meta"><span class="accent-dot"></span>' + count + ' cards</div>' +
      '</div>' +
    '</a>';
  }

  function customTileHTML(binder, rgb) {
    rgb = rgb || sbAccentRgb;
    var count = binder.card_count != null ? binder.card_count : (Array.isArray(binder.cards) ? binder.cards.length : 0);
    var bid = esc(binder.id || '');
    return '<div class="binder-tile"' +
      ' data-tile-id="' + bid + '"' +
      ' data-binder-id="' + bid + '"' +
      ' onclick="window._sbSelectBinder(\'' + bid + '\')"' +
      ' style="--binder-accent-rgb:' + rgb + ';cursor:pointer">' +
      '<div class="binder-book">' +
        '<div class="binder-spine-strip"></div>' +
        '<div class="binder-face">' +
          '<div class="binder-weave"></div>' +
          '<div class="binder-sheen"></div>' +
          '<div class="binder-stitch"></div>' +
          '<div class="binder-zipper"></div>' +
          '<div class="binder-etched">' +
            '<div class="binder-etch-name" style="color:rgba(255,255,255,0.9)">' + esc(binder.name || 'Binder') + '</div>' +
          '</div>' +
          '<div class="binder-card-count" style="color:rgba(255,255,255,0.45)">' + count + ' cards</div>' +
        '</div>' +
      '</div>' +
      '<div class="binder-label">' +
        '<span class="binder-name">' + esc(binder.name || 'Binder') + '</span>' +
        '<div class="binder-meta"><span class="accent-dot"></span>' + count + ' cards</div>' +
      '</div>' +
    '</div>';
  }

  // ── Order persistence (localStorage) ──
  var ORDER_KEY = 'sb-order-' + handle;

  function loadOrder() {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); } catch (_) { return []; }
  }

  function saveOrder(grid) {
    var ids = Array.from(grid.querySelectorAll('[data-tile-id]')).map(function (el) {
      return el.dataset.tileId;
    });
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch (_) {}

    // Persist custom binder order to backend
    var binderIds = ids.filter(function (id) { return id.charAt(0) !== '_'; });
    if (binderIds.length) {
      fetch(BACKEND + '/api/binders/sort?streamer=' + encodeURIComponent(handle), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order: binderIds })
      }).catch(function () {});
    }
  }

  function applyOrder(tiles, savedOrder) {
    if (!savedOrder.length) return tiles;
    var map = {};
    tiles.forEach(function (t) { map[t.id] = t; });
    var ordered = [];
    savedOrder.forEach(function (id) {
      if (map[id]) { ordered.push(map[id]); delete map[id]; }
    });
    // Append any new tiles not yet in the saved order
    Object.keys(map).forEach(function (id) { ordered.push(map[id]); });
    return ordered;
  }

  // ── Grid helpers ──
  function gridCols(grid) {
    var w = grid.offsetWidth || window.innerWidth;
    if (w <= 560) return 2;
    if (w <= 900) return 3;
    return 4;
  }

  function addEmptySlots(grid, cols) {
    var real = grid.querySelectorAll('.binder-tile').length;
    var rem = real % cols;
    if (!rem) return;
    for (var i = 0; i < cols - rem; i++) {
      var el = document.createElement('div');
      el.className = 'sb-empty-slot';
      el.setAttribute('style', '--binder-accent-rgb:' + sbAccentRgb);
      el.innerHTML = '<div class="binder-book binder-book--empty" aria-hidden="true">' +
        '<div style="opacity:0.15;font-size:1.2rem"><i class="bx bx-plus"></i></div>' +
        '</div>';
      grid.appendChild(el);
    }
  }

  function removeEmptySlots(grid) {
    Array.from(grid.querySelectorAll('.sb-empty-slot')).forEach(function (el) { el.remove(); });
  }

  // ── Sortable (always-on, no toggle) ──
  var sortableLoaded = false;
  var sortablePromise = null;

  function loadSortable() {
    if (sortableLoaded) return Promise.resolve();
    if (sortablePromise) return sortablePromise;
    sortablePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js';
      s.onload = function () { sortableLoaded = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return sortablePromise;
  }

  function initSortable(grid) {
    loadSortable().then(function () {
      Sortable.create(grid, {
        animation: 150,
        ghostClass: 'sb-sort-ghost',
        filter: '.sb-empty-slot',
        onEnd: function () {
          removeEmptySlots(grid);
          saveOrder(grid);
          addEmptySlots(grid, gridCols(grid));
        }
      });
    });
  }

  // ── Achievements sidebar ──
  function renderAchievements(achievements) {
    var list = document.getElementById('sb-achievements-list');
    if (!list) return;
    if (!achievements.length) {
      list.innerHTML = '<p style="font-size:0.52rem;font-weight:700;letter-spacing:0.1em;' +
        'text-transform:uppercase;color:var(--void-muted);text-align:center;padding:24px 0">No achievements yet</p>';
      return;
    }
    list.innerHTML = achievements.map(function (a) {
      var earnedAt = a.earned_at || a.unlocked_at;
      var unlocked = !!earnedAt;
      var dateStr = '';
      if (unlocked) {
        try { dateStr = new Date(earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (_) {}
      }
      var icon = a.icon || '';
      var isUrl = icon && (icon.indexOf('http') === 0 || icon.charAt(0) === '/');
      var iconHTML = isUrl
        ? '<img src="' + esc(icon) + '" alt="" style="width:16px;height:16px;object-fit:cover;border-radius:4px">'
        : esc(icon || (unlocked ? '★' : '○'));
      var hasProgress = a.progress != null && a.target != null && a.target > 0;
      var pct = hasProgress ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0;
      var progressHTML = hasProgress
        ? '<div class="sb-ach-bar-track"><div class="sb-ach-bar-fill" style="width:' + pct + '%"></div></div>'
        : '';
      var metaText = unlocked ? ('Earned ' + dateStr) : (hasProgress ? (a.progress + ' / ' + a.target) : 'Locked');
      return '<div class="sb-ach-card ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        '<div class="sb-ach-icon">' + iconHTML + '</div>' +
        '<div class="sb-ach-body">' +
          '<div class="sb-ach-title">' + esc(a.name || a.title || 'Achievement') + '</div>' +
          '<div class="sb-ach-meta">' + esc(metaText) + '</div>' +
          progressHTML +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Render ──
  function render(bootstrapData, streamerData) {
    var binders      = Array.isArray(bootstrapData.binders)      ? bootstrapData.binders      : [];
    var achievements = Array.isArray(bootstrapData.achievements) ? bootstrapData.achievements : [];
    var collection   = Array.isArray(bootstrapData.collection)   ? bootstrapData.collection   : [];

    // Binder cover colour (settings) falls back to brand primary
    var hex = streamerData && (streamerData.binder_color || streamerData.brand_color_primary);
    if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      sbAccentRgb = r + ',' + g + ',' + b;
      document.documentElement.style.setProperty('--void-accent-rgb', sbAccentRgb);
    }

    // Build all tiles as a flat list
    var totalCards   = collection.length;
    var favCount     = collection.filter(function (c) { return c.is_favorited; }).length;
    var collectCount = collection.filter(function (c) { return c.is_collectable || c.rarity === 'collectable'; }).length;

    var setCounts = {};
    collection.forEach(function (c) {
      if (c.set_name) setCounts[c.set_name] = (setCounts[c.set_name] || 0) + 1;
    });

    var tiles = [];

    if (totalCards > 0) {
      tiles.push({ id: '__all__',     html: staticTileHTML('__all__',     'All Cards',    '/' + handle + '/binder',                            totalCards,   sbAccentRgb) });
      tiles.push({ id: '__fav__',     html: staticTileHTML('__fav__',     'Favourites',   '/' + handle + '/binder?filter=favourites',          favCount,     sbAccentRgb) });
      tiles.push({ id: '__collect__', html: staticTileHTML('__collect__', 'Collectables', '/' + handle + '/binder?filter=collectables',        collectCount, sbAccentRgb) });
    }

    Object.keys(setCounts).forEach(function (sn) {
      var id = '__set__:' + sn;
      tiles.push({ id: id, html: staticTileHTML(id, sn, '/' + handle + '/binder?set=' + encodeURIComponent(sn), setCounts[sn], sbAccentRgb) });
    });

    binders.forEach(function (b) {
      tiles.push({ id: b.id, html: customTileHTML(b, sbAccentRgb) });
    });

    if (!tiles.length) {
      var emptyLink = document.getElementById('sb-empty-link');
      if (emptyLink) emptyLink.href = '/' + handle + '/binder';
      document.getElementById('sb-empty').classList.remove('hidden');
      return;
    }

    // Restore saved order
    tiles = applyOrder(tiles, loadOrder());

    var grid = document.getElementById('sb-all-grid');
    if (!grid) return;
    grid.innerHTML = tiles.map(function (t) { return t.html; }).join('');
    addEmptySlots(grid, gridCols(grid));

    initSortable(grid);
    renderAchievements(achievements);
  }

  window._sbSelectBinder = function (binderId) {
    window.location.href = '/' + handle + '/binder?binder=' + encodeURIComponent(binderId);
  };

  // ── Boot ──
  function boot() {
    if (!handle) return;

    var bootstrapPromise = fetch(
      BACKEND + '/api/v2/bootstrap?streamer=' + encodeURIComponent(handle),
      { credentials: 'include' }
    ).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });

    Promise.all([bootstrapPromise, window.streamerNavData || Promise.resolve(null)])
      .then(function (results) {
        var bootstrapData = results[0] || {};
        var streamerData  = results[1];

        if (!bootstrapData.user) {
          document.getElementById('sb-loading').classList.add('hidden');
          document.getElementById('sb-signin').classList.remove('hidden');
          return;
        }

        // Wire up nav user menu
        var user = bootstrapData.user;
        window.currentUser = user;
        var avatar = user.avatar_url || user.avatar || '';
        var navAv = document.getElementById('nav-avatar');
        var menuAv = document.getElementById('nav-user-menu-avatar');
        if (navAv) navAv.src = avatar;
        if (menuAv) menuAv.src = avatar;
        var preview = document.getElementById('nav-user-preview');
        if (preview) { preview.classList.remove('hidden'); preview.style.display = 'flex'; }
        if (typeof window.initNavUserMenu === 'function') window.initNavUserMenu();
        if (typeof window.updateNavUserMenuLabels === 'function') window.updateNavUserMenuLabels();

        render(bootstrapData, streamerData);
        document.getElementById('sb-loading').classList.add('hidden');
        document.getElementById('sb-root').classList.remove('hidden');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
