/**
 * Castle TCG — Streamer-scoped navigation + brand colour.
 * Injects the page nav and applies the creator's brand colour on any
 * /{slug} or /{slug}/{page} route.
 *
 * Usage: <script src="/streamer-nav.js"></script> (after the <nav> element)
 * Exposes window.streamerNavData (Promise<streamer|null>) so page scripts can
 * await the data without a second fetch.
 */
(function () {
  'use strict';

  var BACKEND = (function () {
    var m = document.querySelector('meta[name="castle-public-url"]');
    return m ? m.content.replace(/\/$/, '') : '';
  })();

  var KNOWN_BARE_PATHS = new Set([
    'dashboard', 'onboarding', 'arena', 'privacy', 'terms', 'cookies',
    'arena-test', '404', 'my-collection', 'battle',
    'profile', 'settings', 'card-studio', 'card-creator', 'stream-features',
    'login', 'logout', 'auth', 'trading', 'coming-soon', 'magic-dust',
    'binder', 'binders', 'view',
  ]);

  // Bare paths that should still show the streamer-scoped pill (using the
  // logged-in user's own slug as the streamer context). Maps URL → active pill segment.
  // /my-collection is intentionally omitted — it shows only logo + user dropdown.
  var BARE_PILL_PAGES = {
    'battle': 'battle',
    'trading': 'trading',
    'leaderboard': 'leaderboard',
    'magic-dust': 'magic-dust',
    'binder': 'binder',
  };

  var PAGES = [
    { segment: 'binder',      label: 'Binder',       icon: 'bx bx-book-open' },
    { segment: 'battle',      label: 'Battle Deck',  svg: 'M21 2h-5c-.3 0-.58.13-.77.37l-8.3 10.14L5 10.58V7.99H3v3c0 .27.11.52.29.71l3 3 .09.09-4.79 4.79 2.83 2.83 4.79-4.79.09.09 3 3c.19.19.44.29.71.29h3v-2h-2.59l-1.93-1.93 10.14-8.3c.23-.19.37-.47.37-.77V3c0-.55-.45-1-1-1m-1 5.53-9.93 8.13-1.72-1.72 8.13-9.93h3.53v3.53Z' },
    { segment: 'leaderboard', label: 'Leaderboard',  icon: 'bx bx-trophy' },
    { segment: 'trading',     label: 'Marketplace',  icon: 'bx bx-transfer' },
    { segment: 'magic-dust',  label: 'Fragments',    svg: 'm21.55 11.17-1.26-.84c-.23-.15-.39-.38-.45-.67-.07-.3-.01-.6.15-.84l.84-1.26c.2-.31.22-.7.05-1.03A.98.98 0 0 0 20 6h-2.07a.87.87 0 0 1-.54-.17c-.17-.14-.29-.29-.35-.44l-1.1-2.76c-.11-.27-.33-.48-.61-.58-.28-.09-.58-.06-.83.09l-2.52 1.51c-.39.24-.78.38-1.19.43-.99.13-2.01-.15-2.79-.78L6.64 2.21a1.004 1.004 0 0 0-1.63.78v4.49c0 .1-.05.21-.1.29a.47.47 0 0 1-.4.22h-1.5c-.4 0-.77.24-.92.62-.15.37-.07.8.22 1.09l1.42 1.42c.19.19.31.4.33.62.05.45-.1.89-.41 1.2l-1.34 1.34c-.29.29-.37.72-.22 1.09s.52.62.92.62H6.1c.2 0 .39.06.54.18.24.19.37.45.37.72v4.09c0 .4.24.77.62.92a.995.995 0 0 0 1.09-.21l2.76-2.76c.57-.57 1.28-.94 2.1-1.08.92-.16 1.88-.02 2.71.4l1.27.64a.995.995 0 0 0 1.42-1.09l-.45-2.23c-.05-.26 0-.54.17-.75v-.01c.08-.11.16-.19.25-.25l2.6-1.73c.28-.19.45-.5.45-.83s-.17-.65-.45-.83m-3.71 1.73c-.27.18-.52.43-.74.71l-.02.02c-.49.67-.68 1.52-.52 2.33l.05.26a6.55 6.55 0 0 0-3.43-.33c-1.2.21-2.28.77-3.14 1.63l-1.06 1.06V16.9c0-.88-.41-1.72-1.13-2.3-.49-.39-1.12-.61-1.77-.61h-.72c.54-.71.78-1.6.66-2.51-.07-.58-.33-1.14-.75-1.62.56-.19 1.04-.56 1.35-1.08.25-.42.37-.85.37-1.3V5.06c1.17.83 2.62 1.19 4.06 1 .65-.08 1.3-.32 1.93-.7l1.51-.91.67 1.67c.19.48.51.9.97 1.26.48.39 1.12.6 1.79.6h.23c-.32.63-.42 1.38-.26 2.1.17.78.63 1.45 1.29 1.89h.01l-1.35.91Z' },
  ];

  function getContext() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (!parts.length) return null;
    var slug = parts[0];
    if (KNOWN_BARE_PATHS.has(slug)) {
      // Bare path — only inject pill if it's a known pill page (slug fetched from session).
      if (Object.prototype.hasOwnProperty.call(BARE_PILL_PAGES, slug)) {
        return { isBare: true, slug: null, segment: BARE_PILL_PAGES[slug] };
      }
      return null;
    }
    return { slug: slug, segment: parts[1] || null };
  }

  function applyBrandColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var rgb = r + ', ' + g + ', ' + b;
    var root = document.documentElement;
    // Override every alias the pages use
    root.style.setProperty('--void-accent', hex);
    root.style.setProperty('--void-accent-rgb', rgb);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-rgb', rgb);
    root.style.setProperty('--page-accent', hex);
    root.style.setProperty('--page-accent-rgb', rgb);
  }

  function buildStreamerIdentity(slug) {
    var wrap = document.createElement('div');
    wrap.id = 'streamer-nav-identity';
    wrap.className = 'hidden md:flex items-center gap-3';

    // Vertical separator matching the nav's border colour
    var sep = document.createElement('div');
    sep.className = 'w-px h-5 bg-white/10 shrink-0';
    wrap.appendChild(sep);

    // Clickable streamer name + avatar
    var link = document.createElement('a');
    link.href = '/' + slug;
    link.className = 'flex items-center gap-2 no-underline group';

    var avatarWrap = document.createElement('div');
    avatarWrap.id = 'streamer-nav-avatar-wrap';
    avatarWrap.className = 'w-7 h-7 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0';
    link.appendChild(avatarWrap);

    var nameEl = document.createElement('span');
    nameEl.id = 'streamer-nav-name';
    nameEl.className = 'text-[11px] font-black uppercase tracking-widest text-void-muted group-hover:text-void-accent transition-colors whitespace-nowrap';
    nameEl.textContent = slug;
    link.appendChild(nameEl);

    wrap.appendChild(link);
    return wrap;
  }

  function buildNav(slug, activeSegment) {
    var wrap = document.createElement('div');
    wrap.id = 'streamer-nav-links';
    wrap.className = 'hidden md:flex items-center bg-white/[0.04] border border-white/5 p-1 rounded-2xl shadow-xl backdrop-blur-md';

    PAGES.forEach(function (page) {
      var a = document.createElement('a');
      a.href = page.segment ? ('/' + slug + '/' + page.segment) : ('/' + slug);
      a.className = 'flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap no-underline';

      if (page.segment === activeSegment) {
        a.classList.add('text-void-accent', 'bg-void-accent/10');
      } else {
        a.classList.add('text-void-muted', 'hover:text-void-text', 'hover:bg-white/[0.04]');
      }

      if (page.svg) {
        var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('width', '12'); svgEl.setAttribute('height', '12');
        svgEl.setAttribute('viewBox', '0 0 24 24'); svgEl.setAttribute('fill', 'currentColor');
        svgEl.style.flexShrink = '0';
        var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', page.svg);
        svgEl.appendChild(pathEl);
        a.appendChild(svgEl);
      } else {
        var icon = document.createElement('i');
        icon.className = page.icon + ' text-xs';
        a.appendChild(icon);
      }
      a.appendChild(document.createTextNode(' ' + page.label));

      wrap.appendChild(a);
    });

    return wrap;
  }

  function updateStreamerIdentity(data) {
    var nameEl = document.getElementById('streamer-nav-name');
    var avatarWrap = document.getElementById('streamer-nav-avatar-wrap');
    if (!nameEl || !avatarWrap) return;

    var name = (data && (data.brand_name || data.display_name || data.username)) || null;
    if (name) nameEl.textContent = name;
    nameEl.classList.remove('text-void-muted');
    nameEl.classList.add('text-void-text');

    if (data && data.avatar_url) {
      var img = document.createElement('img');
      img.src = data.avatar_url;
      img.alt = '';
      img.className = 'w-full h-full object-cover';
      avatarWrap.innerHTML = '';
      avatarWrap.appendChild(img);
    }
  }

  function ensureVisibilityStyles() {
    if (document.getElementById('streamer-nav-visibility')) return;
    var style = document.createElement('style');
    style.id = 'streamer-nav-visibility';
    style.textContent =
      '@media (min-width: 768px) {' +
        '#streamer-nav-left,' +
        '#streamer-nav-identity,' +
        '#streamer-nav-links { display: flex !important; }' +
      '}';
    document.head.appendChild(style);
  }

  // Canonical nav markup — single source of truth for every page that loads
  // streamer-nav.js. Pages no longer need to embed the nav block in their HTML.
  var BASE_NAV_HTML =
    '<div class="w-full px-8 h-20 flex items-center justify-between">' +
      '<a href="/my-collection" class="flex items-center gap-2 group cursor-pointer shrink-0">' +
        '<div class="w-11 h-11 bg-void-accent/10 flex items-center justify-center rounded-2xl shadow-2xl shadow-void-accent/10 transition-all group-hover:bg-void-accent/20 overflow-hidden p-1.5">' +
          '<img src="https://cdn.codeoce.com/logo/logo_white.png" alt="" class="brand-castle-mark w-full h-full" width="36" height="36">' +
        '</div>' +
        '<span class="text-lg font-display font-black uppercase tracking-tight text-void-text leading-none">Castle<span class="text-void-accent">TCG</span></span>' +
      '</a>' +
      '<div class="flex items-center gap-3 shrink-0">' +
        '<div id="nav-user-preview" class="hidden items-center">' +
          '<span id="nav-username" class="hidden">---</span>' +
          '<span id="nav-user-role" class="hidden">Collector</span>' +
          '<div id="nav-user-menu-root" class="relative">' +
            '<button type="button" id="nav-user-menu-trigger" class="group flex items-center gap-1.5 rounded-2xl p-0.5 pr-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all focus:outline-none" aria-expanded="false" aria-haspopup="true" aria-controls="nav-user-menu">' +
              '<span class="relative inline-block">' +
                '<img id="nav-avatar" src="" alt="" class="w-10 h-10 rounded-full border border-white/10 shadow-lg object-cover bg-void-bg">' +
              '</span>' +
              '<i class="bx bx-chevron-down text-[10px] text-void-muted group-hover:text-void-text transition-colors"></i>' +
            '</button>' +
            '<div id="nav-user-menu" class="hidden absolute right-0 top-full mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-white/10 bg-void-bg shadow-2xl shadow-black/50 z-[600] overflow-hidden" role="menu">' +
              '<div class="border-b border-white/5">' +
                '<button type="button" id="nav-user-identity-toggle" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus:outline-none" aria-expanded="false" aria-controls="nav-user-team-panel">' +
                  '<img id="nav-user-menu-avatar" src="" alt="" class="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0 bg-void-bg" width="44" height="44">' +
                  '<div class="min-w-0 flex-1">' +
                    '<p id="nav-user-menu-name" class="text-sm font-bold text-white tracking-tight truncate">—</p>' +
                    '<div class="flex items-center gap-2 mt-1 flex-wrap">' +
                      '<span id="nav-user-platform-icons" class="flex items-center gap-1 shrink-0"></span>' +
                      '<span id="nav-user-menu-role" class="text-[10px] font-black uppercase tracking-widest text-void-muted/95">—</span>' +
                    '</div>' +
                  '</div>' +
                  '<span id="nav-user-team-chevron-wrap" class="hidden shrink-0 rounded-lg border border-white/15 bg-white/[0.07] p-1.5 shadow-inner">' +
                    '<i id="nav-user-team-chevron" class="bx bx-chevron-down text-void-accent text-sm leading-none block transition-transform duration-200"></i>' +
                  '</span>' +
                '</button>' +
                '<div id="nav-user-team-panel" class="hidden border-t border-white/5 bg-zinc-950 px-2 py-2 max-h-[min(50vh,14rem)] overflow-y-auto">' +
                  '<p class="text-[9px] font-black uppercase tracking-widest text-void-muted px-2 pt-1 pb-2">Team channels</p>' +
                  '<div id="nav-user-team-list" class="space-y-0.5 pb-1"></div>' +
                '</div>' +
              '</div>' +
              '<div class="px-4 py-3 border-b border-white/5">' +
                '<div class="flex items-center justify-between gap-2">' +
                  '<div class="min-w-0">' +
                    '<p class="text-[9px] font-black uppercase tracking-widest text-void-muted mb-0.5">Castle code</p>' +
                    '<p id="nav-user-menu-castle-code" class="font-mono text-sm font-bold text-white tracking-wider">—</p>' +
                  '</div>' +
                  '<button type="button" id="nav-user-menu-copy-code" class="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-widest text-void-accent transition-colors">Copy</button>' +
                '</div>' +
              '</div>' +
              '<div class="p-1.5">' +
                '<button type="button" id="nav-user-menu-settings" role="menuitem" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold uppercase tracking-widest text-void-text hover:bg-white/5 transition-colors">' +
                  '<i class="bx bxs-cog text-void-muted w-4 text-center shrink-0"></i>' +
                  '<span class="flex flex-col leading-tight normal-case">' +
                    '<span class="uppercase tracking-widest">Account settings</span>' +
                    '<span class="text-[9px] font-semibold text-void-muted tracking-normal mt-0.5">Castle code, blocks, security</span>' +
                  '</span>' +
                '</button>' +
                '<button type="button" id="nav-user-menu-logout" role="menuitem" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors">' +
                  '<i class="bx bx-log-out w-4 text-center"></i> Log out' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function ensureBaseNav() {
    var existing = document.querySelector('nav');
    if (existing) return existing;
    var nav = document.createElement('nav');
    nav.className = 'fixed top-0 w-full z-[500] border-b border-white/5 bg-void-bg/40 backdrop-blur-2xl';
    nav.innerHTML = BASE_NAV_HTML;
    if (document.body.firstChild) {
      document.body.insertBefore(nav, document.body.firstChild);
    } else {
      document.body.appendChild(nav);
    }
    // Hydrate the avatar dropdown from localStorage immediately so it's visible
    // before the page's bootstrap fetch completes. setupNavUser overwrites with
    // fresh data once the real user loads.
    if (typeof window.hydrateNavFromCache === 'function') {
      window.hydrateNavFromCache();
    }
    return nav;
  }

  function injectNav(ctx) {
    var nav = ensureBaseNav();
    if (!nav) return;
    var container = nav.querySelector(':scope > div');
    if (!container) return;

    ensureVisibilityStyles();

    ['castle-nav-links', 'page-nav-links', 'streamer-nav-links', 'streamer-nav-identity', 'streamer-nav-left'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    // Group Castle logo + streamer identity together on the left
    var castleLogo = container.firstElementChild;
    var leftGroup = document.createElement('div');
    leftGroup.id = 'streamer-nav-left';
    leftGroup.className = 'flex items-center gap-3';
    container.insertBefore(leftGroup, castleLogo);
    leftGroup.appendChild(castleLogo);
    leftGroup.appendChild(buildStreamerIdentity(ctx.slug));

    // Page nav pill — absolutely centred so it's always at 50% of the nav width
    // regardless of how wide the left identity or right user-menu blocks are.
    container.style.position = 'relative';
    var navEl = buildNav(ctx.slug, ctx.segment);
    navEl.style.position = 'absolute';
    navEl.style.left = '50%';
    navEl.style.top = '50%';
    navEl.style.transform = 'translate(-50%, -50%)';
    container.appendChild(navEl);
  }

  function setupForSlug(ctx) {
    injectNav(ctx);

    // Eagerly prefetch all sibling pages so tab clicks are instant
    var schedule = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
    schedule(function () {
      PAGES.forEach(function (page) {
        var href = page.segment ? ('/' + ctx.slug + '/' + page.segment) : ('/' + ctx.slug);
        if (href === window.location.pathname) return;
        if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
        var lnk = document.createElement('link');
        lnk.rel = 'prefetch'; lnk.href = href; lnk.as = 'document';
        document.head.appendChild(lnk);
      });
    }, { timeout: 2000 });

    return fetch(
      BACKEND + '/api/public/streamer?streamer=' + encodeURIComponent(ctx.slug)
    ).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      var themeHex = (data && (data.binder_color || data.brand_color_primary)) || null;
      if (themeHex) applyBrandColor(themeHex);
      updateStreamerIdentity(data);
      return data;
    }).catch(function () { return null; });
  }

  function init() {
    ensureBaseNav();
    ensureVisibilityStyles();
    var ctx = getContext();
    if (!ctx) {
      window.streamerNavData = Promise.resolve(null);
      return;
    }

    if (ctx.isBare) {
      // Resolve the user's own slug from bootstrap, then inject.
      window.streamerNavData = fetch(BACKEND + '/api/v2/bootstrap', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (bs) {
          var slug = (bs && bs.streamer && bs.streamer.username)
                  || (bs && bs.user && bs.user.username);
          if (!slug) return null;
          ctx.slug = String(slug).toLowerCase();
          return setupForSlug(ctx);
        })
        .catch(function () { return null; });
      return;
    }

    window.streamerNavData = setupForSlug(ctx);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
