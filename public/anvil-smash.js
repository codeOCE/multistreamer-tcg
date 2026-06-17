/* ════════════════════════════════════════════════════════════════════════════
   anvil-smash.js  —  PLACEHOLDER "anvil" card-shatter animation
   ----------------------------------------------------------------------------
   Vision (real art TODO): a workshop scene with an anvil. The card is laid on
   the anvil, struck by a hammer, and shatters into "fragment" shards that
   float up into the fragment/dust counter in the top corner.

   This file is a no-art stand-in: a CSS-drawn anvil rises under the card, a
   hammer strikes it, the card image is sliced into a mosaic of shards, and the
   shards burst then home toward a target (the dust counter). Replace the
   CSS anvil + emoji hammer with real art later; the hook points stay the same.

   Usage:
     window.playAnvilSmash({
       cardEl,            // element to shatter (its bounding box + image)
       imageUrl,          // card art url (falls back to <img> inside cardEl)
       amount,            // fragments earned (shown in the floating label)
       target,            // OPTIONAL element to fly toward (default: top-right)
       onDone,            // OPTIONAL callback when the animation finishes
     });
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COLS = 5;          // mosaic columns
  var ROWS = 7;          // mosaic rows (cards are tall)
  var Z    = 99999;

  // ── one-time CSS injection ─────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('as-styles')) return;
    var css =
      '.as-overlay{position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;overflow:hidden;}' +
      '.as-shard{position:fixed;will-change:transform,opacity;background-repeat:no-repeat;' +
        'border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.45);}' +
      '.as-hammer{position:fixed;font-size:72px;line-height:1;transform-origin:78% 82%;' +
        'will-change:transform;filter:drop-shadow(0 6px 10px rgba(0,0,0,.55));}' +
      '.as-flash{position:fixed;border-radius:50%;pointer-events:none;' +
        'background:radial-gradient(circle,rgba(253,224,71,.92)0%,rgba(253,224,71,.4)32%,transparent70%);}' +
      '.as-spark{position:fixed;width:5px;height:5px;border-radius:50%;background:#fde047;' +
        'box-shadow:0 0 8px 2px rgba(253,224,71,.85);will-change:transform,opacity;}' +
      '.as-ring{position:fixed;border-radius:50%;border:2px solid rgba(253,224,71,.7);' +
        'pointer-events:none;will-change:transform,opacity;}' +
      '.as-label{position:fixed;display:flex;align-items:center;gap:7px;' +
        'padding:8px 14px;border-radius:13px;font-family:"Space Grotesk","Outfit",sans-serif;' +
        'font-weight:800;font-size:15px;letter-spacing:.02em;color:#fde047;white-space:nowrap;' +
        'background:rgba(20,16,7,.92);border:1px solid rgba(253,224,71,.35);' +
        'box-shadow:0 8px 24px rgba(0,0,0,.5);opacity:0;will-change:transform,opacity;}' +
      '@media (prefers-reduced-motion: reduce){.as-overlay{display:none!important;}}';
    var s = document.createElement('style');
    s.id = 'as-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function done(fn) { if (typeof fn === 'function') fn(); }

  // ── public entry point ─────────────────────────────────────────────────────
  window.playAnvilSmash = function (opts) {
    opts = opts || {};
    var cardEl = opts.cardEl;
    if (!cardEl) { done(opts.onDone); return; }

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    injectStyles();

    var rect = cardEl.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) { done(opts.onDone); return; }

    var imageUrl = opts.imageUrl ||
      (cardEl.querySelector('img') && cardEl.querySelector('img').src) ||
      (cardEl.tagName === 'IMG' ? cardEl.src : '') || '';

    var dest;
    if (opts.target && opts.target.getBoundingClientRect) {
      var t = opts.target.getBoundingClientRect();
      dest = { x: t.left + t.width / 2, y: t.top + t.height / 2 };
    } else {
      dest = { x: window.innerWidth - 46, y: 40 };
    }

    var overlay = document.createElement('div');
    overlay.className = 'as-overlay';
    document.body.appendChild(overlay);

    if (reduce) {
      floatLabel(overlay, rect, dest, opts.amount);
      setTimeout(function () { overlay.remove(); done(opts.onDone); }, 1400);
      return;
    }

    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    // Hammer swings in from upper-right and strikes the card on the anvil.
    var hammer = document.createElement('div');
    hammer.className = 'as-hammer';
    hammer.textContent = '🔨';
    hammer.style.left = (cx + 30) + 'px';
    hammer.style.top  = (cy - 110) + 'px';
    overlay.appendChild(hammer);

    var HAMMER_START = 120;
    var IMPACT = HAMMER_START + 240;

    setTimeout(function () {
      hammer.animate(
        [
          { transform: 'rotate(72deg) translate(20px,-34px)', opacity: 0 },
          { transform: 'rotate(72deg) translate(12px,-20px)', opacity: 1, offset: 0.18 },
          { transform: 'rotate(-12deg) translate(-8px,12px)', offset: 0.52 },
          { transform: 'rotate(-4deg) translate(-2px,4px)',   offset: 0.64 },
          { transform: 'rotate(-9deg) translate(-6px,8px)',   offset: 1 }
        ],
        { duration: 480, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }
      );
    }, HAMMER_START);

    setTimeout(impact, IMPACT);

    function impact() {
      // Shake the card host.
      var host = cardEl.parentElement || cardEl;
      var hostAnim = host.animate(
        [{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,0)' },
         { transform: 'translate(5px,0)' }, { transform: 'translate(-3px,0)' },
         { transform: 'translate(0,0)' }],
        { duration: 220, easing: 'ease-in-out' }
      );

      // Flash + shockwave ring at impact.
      var fSize = Math.max(rect.width, rect.height) * 1.15;
      var flash = document.createElement('div');
      flash.className = 'as-flash';
      flash.style.width = flash.style.height = fSize + 'px';
      flash.style.left = (cx - fSize / 2) + 'px';
      flash.style.top  = (cy - fSize / 2) + 'px';
      overlay.appendChild(flash);
      flash.animate(
        [{ transform: 'scale(.2)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: 340, easing: 'ease-out', fill: 'forwards' }
      );

      var ring = document.createElement('div');
      ring.className = 'as-ring';
      var rSize = rect.width * 0.7;
      ring.style.width = ring.style.height = rSize + 'px';
      ring.style.left = (cx - rSize / 2) + 'px';
      ring.style.top  = (cy - rSize / 2) + 'px';
      overlay.appendChild(ring);
      ring.animate(
        [{ transform: 'scale(.3)', opacity: .8 }, { transform: 'scale(2.4)', opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
      );

      for (var s = 0; s < 16; s++) spark(cx, cy);

      // Hide the source card — the shards "become" it.
      cardEl.style.transition = 'opacity .08s linear';
      cardEl.style.opacity = '0';

      shatter();
    }

    function spark(x, y) {
      var sp = document.createElement('div');
      sp.className = 'as-spark';
      sp.style.left = x + 'px';
      sp.style.top  = y + 'px';
      overlay.appendChild(sp);
      var ang = rand(-Math.PI, 0), distM = rand(50, 150);   // bias upward/outward
      sp.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + Math.cos(ang) * distM + 'px,' +
            (Math.sin(ang) * distM) + 'px) scale(.2)', opacity: 0 }
        ],
        { duration: rand(380, 640), easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' }
      ).onfinish = function () { sp.remove(); };
    }

    function shatter() {
      var pieceW = rect.width / COLS;
      var pieceH = rect.height / ROWS;
      var total = COLS * ROWS;
      var finished = 0, labelShown = false;

      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var sh = document.createElement('div');
          sh.className = 'as-shard';
          sh.style.width  = Math.ceil(pieceW) + 'px';
          sh.style.height = Math.ceil(pieceH) + 'px';
          sh.style.left = (rect.left + c * pieceW) + 'px';
          sh.style.top  = (rect.top + r * pieceH) + 'px';
          if (imageUrl) {
            sh.style.backgroundImage = 'url("' + imageUrl + '")';
            sh.style.backgroundSize = rect.width + 'px ' + rect.height + 'px';
            sh.style.backgroundPosition = (-c * pieceW) + 'px ' + (-r * pieceH) + 'px';
          } else {
            sh.style.background = 'linear-gradient(135deg,#3b3550,#1b1830)';
          }
          overlay.appendChild(sh);

          var scx = rect.left + c * pieceW + pieceW / 2;
          var scy = rect.top + r * pieceH + pieceH / 2;
          var burstAng = Math.atan2(scy - cy, scx - cx) + rand(-0.5, 0.5);
          var burstDist = rand(34, 100);
          var bx = Math.cos(burstAng) * burstDist;
          var by = Math.sin(burstAng) * burstDist - rand(20, 55);   // pop upward
          var spin = rand(-260, 260);
          var toX = dest.x - scx;
          var toY = dest.y - scy;
          var delay = rand(0, 150);

          var anim = sh.animate(
            [
              { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
              { transform: 'translate(' + bx + 'px,' + by + 'px) rotate(' + spin +
                'deg) scale(1.05)', opacity: 1, offset: 0.22 },
              { transform: 'translate(' + (toX * 0.55) + 'px,' + (toY * 0.55) +
                'px) rotate(' + (spin * 1.6) + 'deg) scale(.5)', opacity: 1, offset: 0.7 },
              { transform: 'translate(' + toX + 'px,' + toY + 'px) rotate(' +
                (spin * 2) + 'deg) scale(.1)', opacity: 0, offset: 1 }
            ],
            { duration: rand(760, 1020), delay: delay,
              easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' }
          );
          anim.onfinish = function () {
            if (!labelShown) { labelShown = true; floatLabel(overlay, rect, dest, opts.amount); }
            finished++;
            if (finished >= total) { overlay.remove(); done(opts.onDone); }
          };
        }
      }

      // Safety cleanup if WAAPI onfinish never fires.
      setTimeout(function () {
        if (overlay.isConnected) { overlay.remove(); done(opts.onDone); }
      }, 2800);
    }
  };

  // Back-compat alias.
  window.playFragmentSmash = window.playAnvilSmash;

  // ── floating "+N Fragments" label that drifts up toward the counter ────────
  function floatLabel(overlay, rect, dest, amount) {
    var el = document.createElement('div');
    el.className = 'as-label';
    var n = (amount == null) ? '' : ('+' + amount + ' ');
    el.innerHTML = '<span style="font-size:17px">🔧</span><span>' + n + 'Fragments</span>';
    // start near the card, end near the destination corner
    var startX = rect.left + rect.width / 2;
    var startY = rect.top + rect.height * 0.4;
    el.style.left = startX + 'px';
    el.style.top  = startY + 'px';
    overlay.appendChild(el);
    var r = el.getBoundingClientRect();
    var dx = dest.x - (startX + r.width / 2);
    var dy = dest.y - startY;
    el.animate(
      [
        { transform: 'translate(-50%,0) scale(.85)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%,-10px) scale(1.08)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-10px) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translate(calc(-50% + ' + dx + 'px),' + dy + 'px) scale(.5)',
          opacity: 0, offset: 1 }
      ],
      { duration: 1500, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' }
    );
  }
})();
