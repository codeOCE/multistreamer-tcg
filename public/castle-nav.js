/**
 * Castle TCG — Shared navigation strip.
 * Injects role-aware nav links between the logo and user-menu on standalone pages.
 *
 * Usage: <script src="/castle-nav.js"></script> (after the <nav> element)
 *
 * Expects:
 *   - A <nav> with a direct child flex container that has the logo on the left
 *     and user-menu on the right.
 *   - window.currentUser to be set (by page bootstrap) before calling castleNav.init().
 *   - Alternatively, auto-detects user role from #nav-user-role text content.
 */
(function () {
    'use strict';

    const VIEWER_LINKS = [
        { label: 'My Collection', href: '/my-collection', icon: 'bx bxs-collection' },
        { label: 'Trading',       href: '/trading',       icon: 'bx bx-transfer' },
        { label: 'Battle',        href: '/battle',        icon: 'bx bxs-bolt' },
        { label: 'Profile',       href: '/profile',       icon: 'bx bxs-user' },
        { label: 'Settings',      href: '/settings',      icon: 'bx bxs-cog' },
    ];

    const CREATOR_LINKS = [
        { label: 'Dashboard',     href: '/dashboard',     icon: 'bx bxs-dashboard' },
        { label: 'My Collection', href: '/my-collection', icon: 'bx bxs-collection' },
        { label: 'Trading',       href: '/trading',       icon: 'bx bx-transfer' },
        { label: 'Battle',        href: '/battle',        icon: 'bx bxs-bolt' },
        { label: 'Profile',       href: '/profile',       icon: 'bx bxs-user' },
        { label: 'Settings',      href: '/settings',      icon: 'bx bxs-cog' },
    ];

    function currentPath() {
        return window.location.pathname.replace(/\/$/, '') || '/';
    }

    function isActive(href) {
        const p = currentPath();
        if (href === '/profile') return p === '/profile' || p.startsWith('/profile/');
        return p === href;
    }

    function buildNav(links) {
        const wrap = document.createElement('div');
        wrap.id = 'castle-nav-links';
        wrap.className = 'hidden md:flex items-center bg-white/[0.04] border border-white/5 p-1 rounded-2xl shadow-xl backdrop-blur-md';

        links.forEach(link => {
            const a = document.createElement('a');
            a.href = link.href;
            a.className = 'castle-nav-link flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap';

            if (isActive(link.href)) {
                a.classList.add('text-void-accent', 'bg-void-accent/10');
            } else {
                a.classList.add('text-void-muted', 'hover:text-void-text', 'hover:bg-white/[0.04]');
            }

            const icon = document.createElement('i');
            icon.className = link.icon + ' text-xs';
            a.appendChild(icon);
            a.appendChild(document.createTextNode(link.label));

            wrap.appendChild(a);
        });

        return wrap;
    }

    function inject(isCreator) {
        // Creator section pages have their own nav — no shared nav
        const creatorPages = ['/dashboard', '/card-studio', '/card-creator', '/stream-features'];
        if (creatorPages.includes(currentPath())) return;

        // Find the nav's inner flex container
        const nav = document.querySelector('nav');
        if (!nav) return;
        const container = nav.querySelector(':scope > div');
        if (!container) return;

        // Don't double-inject
        if (document.getElementById('castle-nav-links')) return;

        const links = isCreator ? CREATOR_LINKS : VIEWER_LINKS;
        const navEl = buildNav(links);

        // Insert between logo (first child) and user-menu area (last child)
        const children = Array.from(container.children);
        if (children.length >= 2) {
            container.insertBefore(navEl, children[1]);
        } else {
            container.appendChild(navEl);
        }
    }

    // Public API
    window.castleNav = {
        init: function (opts) {
            const isCreator = !!(opts && opts.isCreator);
            inject(isCreator);
        },
        /** Auto-detect from window.currentUser or #nav-user-role */
        autoInit: function () {
            let isCreator = false;
            try {
                const u = window.currentUser;
                if (u && (u.is_creator || u.role === 'creator')) isCreator = true;
            } catch (_) { /* ignore */ }
            if (!isCreator) {
                const roleEl = document.getElementById('nav-user-role');
                if (roleEl && roleEl.textContent.trim().toUpperCase() === 'CREATOR') isCreator = true;
            }
            inject(isCreator);
        }
    };
})();
