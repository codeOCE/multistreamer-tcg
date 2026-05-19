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
    'binder', 'binders',
  ]);

  var PAGES = [
    { segment: 'binders',     label: 'Binders',      icon: 'bx bx-book-open' },
    { segment: 'battle',      label: 'Battle Deck',  icon: 'bx bxs-bolt' },
    { segment: 'leaderboard', label: 'Leaderboard',  icon: 'bx bx-trophy' },
    { segment: 'trading',     label: 'Marketplace',  icon: 'bx bx-transfer' },
    { segment: 'magic-dust',  label: 'Fragments',    svg: 'm21.55 11.17-1.26-.84c-.23-.15-.39-.38-.45-.67-.07-.3-.01-.6.15-.84l.84-1.26c.2-.31.22-.7.05-1.03A.98.98 0 0 0 20 6h-2.07a.87.87 0 0 1-.54-.17c-.17-.14-.29-.29-.35-.44l-1.1-2.76c-.11-.27-.33-.48-.61-.58-.28-.09-.58-.06-.83.09l-2.52 1.51c-.39.24-.78.38-1.19.43-.99.13-2.01-.15-2.79-.78L6.64 2.21a1.004 1.004 0 0 0-1.63.78v4.49c0 .1-.05.21-.1.29a.47.47 0 0 1-.4.22h-1.5c-.4 0-.77.24-.92.62-.15.37-.07.8.22 1.09l1.42 1.42c.19.19.31.4.33.62.05.45-.1.89-.41 1.2l-1.34 1.34c-.29.29-.37.72-.22 1.09s.52.62.92.62H6.1c.2 0 .39.06.54.18.24.19.37.45.37.72v4.09c0 .4.24.77.62.92a.995.995 0 0 0 1.09-.21l2.76-2.76c.57-.57 1.28-.94 2.1-1.08.92-.16 1.88-.02 2.71.4l1.27.64a.995.995 0 0 0 1.42-1.09l-.45-2.23c-.05-.26 0-.54.17-.75v-.01c.08-.11.16-.19.25-.25l2.6-1.73c.28-.19.45-.5.45-.83s-.17-.65-.45-.83m-3.71 1.73c-.27.18-.52.43-.74.71l-.02.02c-.49.67-.68 1.52-.52 2.33l.05.26a6.55 6.55 0 0 0-3.43-.33c-1.2.21-2.28.77-3.14 1.63l-1.06 1.06V16.9c0-.88-.41-1.72-1.13-2.3-.49-.39-1.12-.61-1.77-.61h-.72c.54-.71.78-1.6.66-2.51-.07-.58-.33-1.14-.75-1.62.56-.19 1.04-.56 1.35-1.08.25-.42.37-.85.37-1.3V5.06c1.17.83 2.62 1.19 4.06 1 .65-.08 1.3-.32 1.93-.7l1.51-.91.67 1.67c.19.48.51.9.97 1.26.48.39 1.12.6 1.79.6h.23c-.32.63-.42 1.38-.26 2.1.17.78.63 1.45 1.29 1.89h.01l-1.35.91Z' },
  ];

  function getContext() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (!parts.length) return null;
    var slug = parts[0];
    if (KNOWN_BARE_PATHS.has(slug)) return null;
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

  function injectNav(ctx) {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var container = nav.querySelector(':scope > div');
    if (!container) return;

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

  function init() {
    var ctx = getContext();
    if (!ctx) {
      window.streamerNavData = Promise.resolve(null);
      return;
    }

    injectNav(ctx);

    // Fetch streamer data once; apply brand colour and expose as global promise
    window.streamerNavData = fetch(
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
