(function () {
  'use strict';

  const BACKEND = (() => {
    const m = document.querySelector('meta[name="castle-public-url"]');
    return m ? m.content.replace(/\/$/, '') : '';
  })();
  const DEFAULT_PACK_IMG  = 'https://cdn.codeoce.com/branding/default-pack.png';
  const DEFAULT_CARD_BACK = 'https://cdn.codeoce.com/logo/logo_white.png';

  let pendingPacks   = [];
  let currentPackIdx = 0;
  let currentCards   = [];
  let currentCardIdx = 0;
  let csrfToken      = '';
  let tracing        = false;
  let traceComplete  = false;
  let currentPackUrl = DEFAULT_PACK_IMG;
  let packNatW = 0, packNatH = 0; // cached natural image dimensions

  // ── CSRF ──────────────────────────────────────────────────────────────────
  async function fetchCsrf() {
    try {
      const r = await fetch(`${BACKEND}/api/csrf`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); csrfToken = d.token || ''; }
    } catch (_) {}
  }

  // ── Rarity helpers ────────────────────────────────────────────────────────
  const RARITY_RANK = { common:0, uncommon:1, rare:2, epic:3, legendary:4, secret:5 };
  function rarityKey(r)  { return (r||'common').toLowerCase().replace(/\s+/g,''); }
  function rarityClass(r) {
    const k = rarityKey(r);
    if (['legendary','secret'].includes(k)) return 'legendary';
    return ['epic','rare','uncommon'].includes(k) ? k : 'common';
  }
  function rarityGlowRgb(r) {
    const k = rarityKey(r);
    if (['legendary','secret'].includes(k)) return '217,70,239';
    if (k==='epic')     return '139,92,246';
    if (k==='rare')     return '250,204,21';
    if (k==='uncommon') return '96,165,250';
    return '99,102,241';
  }
  function holoOpacity(r) {
    const k = rarityKey(r);
    if (['legendary','secret'].includes(k)) return 0.95;
    if (k==='epic')     return 0.7;
    if (k==='rare')     return 0.5;
    if (k==='uncommon') return 0.22;
    return 0;
  }
  function isUltraRarity(r) { return ['legendary','secret'].includes(rarityKey(r)); }
  function isHighRarity(r)  { return ['rare','epic','legendary','secret'].includes(rarityKey(r)); }

  // ── Screen management ─────────────────────────────────────────────────────
  const SCREEN_IDS = ['s-loading','s-empty','s-lobby','s-open','s-reveal','s-results'];
  function showScreen(name) {
    SCREEN_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('out', id !== `s-${name}`);
    });
  }

  // ── Background glow ───────────────────────────────────────────────────────
  function setBgGlow(rgb) {
    const el = document.getElementById('bg-glow');
    if (el) el.style.background =
      `radial-gradient(ellipse 80% 60% at 50% 55%, rgba(${rgb},.2) 0%, transparent 70%)`;
  }

  // ── Pack chip ─────────────────────────────────────────────────────────────
  function updatePackChip() {
    const chip = document.getElementById('pack-chip');
    if (!chip) return;
    const rem = pendingPacks.length - currentPackIdx;
    if (rem > 0) {
      chip.textContent = `${rem} pack${rem!==1?'s':''} remaining`;
      chip.style.display = 'block';
    } else {
      chip.style.display = 'none';
    }
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('fx-canvas');
  const ctx2d  = canvas ? canvas.getContext('2d') : null;
  let particles = [], particlesActive = false;
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas); resizeCanvas();

  function spawnBurst(x, y, rgb, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      particles.push({ x, y,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 2.5,
        life: 1, decay: .013 + Math.random()*.017,
        size: 2.5 + Math.random()*4, rgb });
    }
    if (!particlesActive) { particlesActive = true; animateParticles(); }
  }
  function animateParticles() {
    if (!ctx2d) return;
    ctx2d.clearRect(0,0,canvas.width,canvas.height);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .14; p.life -= p.decay;
      ctx2d.save();
      ctx2d.globalAlpha = Math.max(0, p.life);
      ctx2d.fillStyle = `rgb(${p.rgb})`;
      ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx2d.fill();
      ctx2d.restore();
    }
    if (particles.length) requestAnimationFrame(animateParticles);
    else { particlesActive = false; ctx2d.clearRect(0,0,canvas.width,canvas.height); }
  }
  function burst(el, rgb, count) {
    const r = el.getBoundingClientRect();
    spawnBurst(r.left + r.width/2, r.top + r.height/2, rgb, count);
  }

  // ── Flash ─────────────────────────────────────────────────────────────────
  function flashScreen() {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.opacity = '.8'; setTimeout(() => el.style.opacity = '0', 80);
  }

  // ── Sound effects ─────────────────────────────────────────────────────────
  function playSliceSound() {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      // White noise burst — sounds like slicing paper
      const buf  = actx.createBuffer(1, actx.sampleRate * .22, actx.sampleRate);
      const d    = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 1.4);
      const src  = actx.createBufferSource(); src.buffer = buf;
      const gain = actx.createGain(); gain.gain.value = .32;
      // Bandpass filter for more "slice" character
      const bpf  = actx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 3800; bpf.Q.value = 0.6;
      src.connect(bpf).connect(gain).connect(actx.destination);
      src.start();
    } catch (_) {}
  }

  function playRevealSound(tier) {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain).connect(actx.destination);
      const now = actx.currentTime;
      if (tier === 'ultra') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now+.12);
        osc.frequency.exponentialRampToValueAtTime(1320, now+.26);
        gain.gain.setValueAtTime(.2, now);
        gain.gain.exponentialRampToValueAtTime(.001, now+.42);
        osc.start(now); osc.stop(now+.42);
      } else if (tier === 'rare') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(784, now+.16);
        gain.gain.setValueAtTime(.14, now);
        gain.gain.exponentialRampToValueAtTime(.001, now+.26);
        osc.start(now); osc.stop(now+.26);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(440, now+.07);
        gain.gain.setValueAtTime(.07, now);
        gain.gain.exponentialRampToValueAtTime(.001, now+.11);
        osc.start(now); osc.stop(now+.11);
      }
    } catch (_) {}
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    showScreen('loading');
    let user = null;
    try {
      const r = await fetch(`${BACKEND}/api/v2/bootstrap?lite=1`, { credentials: 'include' });
      if (r.ok) { const bs = await r.json(); user = bs?.user ?? null; }
    } catch (_) {}

    if (!user?.twitch_id) {
      const p = document.querySelector('#s-empty p');
      if (p) p.textContent = 'Sign in to open your packs.';
      showScreen('empty'); return;
    }

    await fetchCsrf();

    try {
      const r = await fetch(`${BACKEND}/api/packs/pending`, { credentials: 'include' });
      if (r.ok) { pendingPacks = await r.json(); }
      if (!Array.isArray(pendingPacks)) pendingPacks = [];
    } catch (_) {}

    if (pendingPacks.length === 0) { showScreen('empty'); return; }

    updatePackChip();
    showScreen('lobby');
    setBgGlow('99,102,241');
  }

  // ── Pack split renderer ───────────────────────────────────────────────────
  // Both halves use the SAME scale factor (cover for the full wrap) so they
  // form one continuous image when butted together.
  function applyPackSplit(url, cutRatio) {
    const pw = document.getElementById('pack-wrap');
    if (!pw || !packNatW || !packNatH) return;

    const packW = pw.offsetWidth;
    const packH = pw.offsetHeight;

    // Contain scale — full pack always visible, no cropping of seals
    const scale  = Math.min(packW / packNatW, packH / packNatH);
    const bgW    = Math.round(packNatW * scale);
    const bgH    = Math.round(packNatH * scale);
    const left   = Math.round((packW - bgW) / 2); // negative = centered
    const top    = Math.round((packH - bgH) / 2);
    const cutH   = Math.round(packH * cutRatio);
    const bgSize = `${bgW}px ${bgH}px`;

    const topEl = document.getElementById('pack-top');
    const botEl = document.getElementById('pack-bot');

    if (topEl) {
      topEl.style.height          = `${cutRatio * 100}%`;
      topEl.style.backgroundImage = `url(${url})`;
      topEl.style.backgroundSize  = bgSize;
      // background-position is relative to the element's top-left
      topEl.style.backgroundPosition = `${left}px ${top}px`;
    }
    if (botEl) {
      botEl.style.height          = `${(1 - cutRatio) * 100}%`;
      botEl.style.backgroundImage = `url(${url})`;
      botEl.style.backgroundSize  = bgSize;
      // shift the image up by cutH so it continues from where pack-top left off
      botEl.style.backgroundPosition = `${left}px ${top - cutH}px`;
    }
  }

  function loadPackImage(url, cutRatio) {
    if (packNatW && packNatH && url === currentPackUrl) {
      sizePackWrap();
      applyPackSplit(url, cutRatio);
      return;
    }
    const img = new Image();
    img.onload = () => {
      packNatW = img.naturalWidth;
      packNatH = img.naturalHeight;
      sizePackWrap();
      applyPackSplit(url, cutRatio);
    };
    img.src = url;
  }

  // Resize #pack-wrap to exactly match the image aspect ratio — no letterboxing, no box
  function sizePackWrap() {
    const pw = document.getElementById('pack-wrap');
    if (!pw || !packNatW || !packNatH) return;
    const maxW = Math.min(220, window.innerWidth  * 0.46);
    const maxH = Math.min(380, window.innerHeight * 0.78);
    const s = Math.min(maxW / packNatW, maxH / packNatH);
    pw.style.width  = `${Math.round(packNatW * s)}px`;
    pw.style.height = `${Math.round(packNatH * s)}px`;
  }

  // ── Begin open ─────────────────────────────────────────────────────────────
  window.beginOpen = async function () {
    const pack = pendingPacks[currentPackIdx];
    if (!pack) return;

    // Disable button during load
    const btn = document.querySelector('.lobby-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }

    let data;
    try {
      const r = await fetch(`${BACKEND}/api/packs/${pack.id}/open`, {
        method: 'POST', credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!r.ok) throw new Error(await r.text());
      data = await r.json();
    } catch (e) {
      alert('Could not open pack: ' + e.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right:8px"></i>Open Pack'; }
      return;
    }

    currentCards   = data.cards || [];
    currentCardIdx = 0;
    const streamer = data.streamer || {};
    const packImg = (streamer.pack_image_url && streamer.pack_image_url.startsWith('http'))
      ? streamer.pack_image_url
      : DEFAULT_PACK_IMG;

    const lobbyImg = document.getElementById('lobby-img');
    if (lobbyImg) lobbyImg.src = packImg;

    // Reset trace state
    tracing = false; traceComplete = false;
    currentPackUrl = packImg;
    const fill = document.getElementById('trace-fill');
    if (fill) { fill.style.width = '0px'; fill.style.left = '0'; }
    const wrap = document.getElementById('pack-wrap');
    if (wrap) wrap.classList.remove('sliced');

    showScreen('open');
    loadPackImage(packImg, 0.12);
    if (streamer.brand_color_primary) setBgGlow(hexToRgb(streamer.brand_color_primary));

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right:8px"></i>Open Pack'; }

    // Wire up trace gesture
    setupTrace();
  };

  // ── Trace gesture ─────────────────────────────────────────────────────────
  function setupTrace() {
    const wrap = document.getElementById('pack-wrap');
    if (!wrap) return;

    // Remove any old listeners via clone trick
    const fresh = wrap.cloneNode(true);
    wrap.parentNode.replaceChild(fresh, wrap);
    const pw = document.getElementById('pack-wrap');

    let startX = 0, packLeft = 0, packW = 0;

    function getClientX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }
    function getClientY(e) {
      return e.touches ? e.touches[0].clientY : e.clientY;
    }

    pw.addEventListener('pointerdown', (e) => {
      if (traceComplete) return;
      e.preventDefault();
      tracing = true;
      // Freeze drift animation and clear any mouse-tilt transform
      const scene = document.getElementById('pack-scene');
      if (scene) {
        scene.style.transform = '';
        scene.style.animationPlayState = '';
        scene.classList.add('tracing');
      }
      const rect = pw.getBoundingClientRect();
      packLeft = rect.left; packW = rect.width;
      startX   = getClientX(e);

      // Allow cutting anywhere on the pack (10%–85%)
      const touchY   = getClientY(e);
      const cutRatio = Math.min(0.85, Math.max(0.10, (touchY - rect.top) / rect.height));
      const cutPct   = `${cutRatio * 100}%`;

      // Re-render both halves with the new cut position
      applyPackSplit(currentPackUrl, cutRatio);

      // Move trace line + fill + scissors to cut position
      const line = document.getElementById('trace-line');
      if (line) line.style.top = cutPct;
      const fill = document.getElementById('trace-fill');
      if (fill) {
        fill.style.top   = cutPct;
        fill.style.left  = `${startX - packLeft}px`;
        fill.style.width = '0px';
      }
    }, { passive: false });

    pw.addEventListener('pointermove', (e) => {
      if (!tracing || traceComplete) return;
      e.preventDefault();

      const cx   = getClientX(e);
      const drag = Math.max(0, cx - startX);
      const progress = Math.min(1, drag / (packW * 0.55));

      // Color shifts cyan → white as progress builds, like TCG Pocket
      const r = Math.round(progress * 255);
      const g = Math.round(212 + progress * 43);
      const b = 255;
      const mid  = `rgb(${r},${g},${b})`;
      const glow1 = 16 + progress * 20;
      const glow2 = 40 + progress * 40;

      const fill = document.getElementById('trace-fill');
      if (fill) {
        fill.style.width      = `${drag}px`;
        fill.style.background = `linear-gradient(90deg, transparent, rgba(${r},${g},${b},.8) 10%, ${mid} 50%, rgba(${r},${g},${b},.8) 90%, transparent)`;
        fill.style.boxShadow  = `0 0 ${glow1}px 5px rgba(${r},${g},${b},1), 0 0 ${glow2}px 14px rgba(${r},${g},${b},.55)`;
      }

      if (progress >= 1) { onTraceComplete(); }
    }, { passive: false });

    pw.addEventListener('pointerup', () => {
      if (!traceComplete) {
        tracing = false;
        const scene = document.getElementById('pack-scene');
        if (scene) scene.classList.remove('tracing');
      }
    });
    pw.addEventListener('pointercancel', () => {
      if (!traceComplete) {
        tracing = false;
        const scene = document.getElementById('pack-scene');
        if (scene) scene.classList.remove('tracing');
      }
    });
  }

  function onTraceComplete() {
    if (traceComplete) return;
    traceComplete = true; tracing = false;

    playSliceSound();

    // Snap fill to right edge of pack
    const pw2  = document.getElementById('pack-wrap');
    const fill = document.getElementById('trace-fill');
    if (fill && pw2) {
      const rect = pw2.getBoundingClientRect();
      fill.style.width = `${rect.width - (parseFloat(fill.style.left) || 0) + 8}px`;
    }

    // Brief pause then animate pack split
    setTimeout(() => {
      const pw = document.getElementById('pack-wrap');
      if (pw) pw.classList.add('sliced');
      // Transition to reveal screen after pack disappears
      setTimeout(startReveal, 750);
    }, 120);
  }

  // ── Build reveal screen — all cards stacked, swipe to reveal ─────────────
  function startReveal() {
    buildDots();
    showScreen('reveal');
    setBgGlow('99,102,241');

    const hint = document.getElementById('rev-swipe-hint');
    if (hint) hint.classList.remove('hide');

    currentCardIdx = 0;
    buildStack();
    attachStackSwipe();
    attachStackTilt();
  }

  function buildDots() {
    const container = document.getElementById('rev-dots');
    if (!container) return;
    container.innerHTML = '';
    currentCards.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'rdot' + (i === 0 ? ' active' : '');
      d.dataset.idx = i;
      container.appendChild(d);
    });
  }

  function updateDots(idx) {
    document.querySelectorAll('.rdot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
      d.classList.toggle('seen',   i < idx);
    });
  }

  // Build all card elements and render as a stacked deck
  function buildStack() {
    const stage = document.getElementById('rev-stage');
    if (!stage) return;
    stage.innerHTML = '';

    // Append bottom card first so top card is last in DOM (highest paint order)
    for (let i = currentCards.length - 1; i >= 0; i--) {
      stage.appendChild(buildCardEl(currentCards[i], i));
    }

    repositionStack();
    updateRevealUI(0);

    // Flip top card after a beat
    setTimeout(flipTopCard, 420);
  }

  function buildCardEl(card, idx) {
    const el = document.createElement('div');
    el.className   = 'rev-card';
    el.dataset.r   = card.rarity || 'Common';
    el.dataset.idx = idx;
    el.style.setProperty('--holo-opacity', holoOpacity(card.rarity));
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--holo-angle', '135deg');

    const tilt  = document.createElement('div'); tilt.className  = 'rev-tilt';
    const inner = document.createElement('div'); inner.className = 'rev-inner';

    const back = document.createElement('div'); back.className = 'rev-back';
    const logo = document.createElement('img'); logo.src = DEFAULT_CARD_BACK; logo.className = 'back-logo';
    back.appendChild(logo);

    const face = document.createElement('div'); face.className = 'rev-face';
    const img  = document.createElement('img');
    img.src = card.baked_image_url || card.image_url || DEFAULT_CARD_BACK;
    img.alt = card.name || 'Card';
    face.appendChild(img);

    const holo  = document.createElement('div'); holo.className  = 'rev-holo';
    const shine = document.createElement('div'); shine.className = 'rev-shine';
    face.appendChild(holo); face.appendChild(shine);

    const pip = document.createElement('div');
    pip.className   = `rev-pip rp-${rarityClass(card.rarity)}`;
    pip.textContent = card.rarity || 'Common';
    face.appendChild(pip);

    inner.appendChild(back); inner.appendChild(face);
    tilt.appendChild(inner); el.appendChild(tilt);
    return el;
  }

  // Position every card in the stack based on currentCardIdx
  function repositionStack() {
    const stage = document.getElementById('rev-stage');
    if (!stage) return;
    stage.querySelectorAll('.rev-card').forEach(el => {
      const idx     = parseInt(el.dataset.idx);
      const pos     = idx - currentCardIdx;       // 0 = top, 1 = second, …
      const gone    = pos < 0;
      const hidden  = pos > 3;
      const offsetY = pos * 10;
      const scale   = 1 - pos * 0.045;
      el.style.transition    = 'transform .4s cubic-bezier(.16,1,.3,1), opacity .3s ease';
      el.style.zIndex        = gone ? 0 : 200 - pos;
      el.style.opacity       = (gone || hidden) ? 0 : 1;
      el.style.pointerEvents = pos === 0 ? 'auto' : 'none';
      if (!gone) el.style.transform = `translateY(${offsetY}px) scale(${scale})`;
    });
  }

  function flipTopCard() {
    const stage = document.getElementById('rev-stage');
    const card  = currentCards[currentCardIdx];
    if (!stage || !card) return;
    const el = stage.querySelector(`.rev-card[data-idx="${currentCardIdx}"]`);
    if (!el || el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    onCardFlipped(card, el, currentCardIdx);
  }

  function onCardFlipped(card, el, idx) {
    const rgb = rarityGlowRgb(card.rarity);
    setBgGlow(rgb);

    if (isUltraRarity(card.rarity)) {
      flashScreen(); burst(el, rgb, 65); playRevealSound('ultra');
    } else if (isHighRarity(card.rarity)) {
      burst(el, rgb, 32); playRevealSound('rare');
    } else {
      playRevealSound('common');
    }

    const info  = document.getElementById('rev-info');
    const name  = document.getElementById('rev-card-name');
    const rarity = document.getElementById('rev-card-rarity');
    if (name)   name.textContent   = card.name   || 'Card';
    if (rarity) rarity.textContent = card.rarity || 'Common';
    if (info)   info.classList.add('show');

    const btn = document.getElementById('rev-next-btn');
    if (btn) {
      btn.classList.add('show');
      const isLast = idx === currentCards.length - 1;
      btn.classList.toggle('final', isLast);
      btn.innerHTML = isLast ? 'See results &rsaquo;' : 'Next card &rsaquo;';
    }
  }

  function updateRevealUI(idx) {
    const info = document.getElementById('rev-info');
    const btn  = document.getElementById('rev-next-btn');
    if (info) info.classList.remove('show');
    if (btn)  btn.classList.remove('show', 'final');
  }

  // Fly the top card off in a direction, advance to next
  function flyCardAway(el, dir) {
    el.style.transition    = 'transform .42s cubic-bezier(.4,0,.2,1), opacity .35s ease';
    el.style.transform     = `translateX(${dir * 130}%) translateY(-5%) rotate(${dir * 20}deg) scale(.95)`;
    el.style.opacity       = '0';
    el.style.pointerEvents = 'none';

    document.getElementById('rev-swipe-hint')?.classList.add('hide');

    setTimeout(() => {
      currentCardIdx++;
      updateDots(currentCardIdx);
      updateRevealUI(currentCardIdx);

      if (currentCardIdx >= currentCards.length) { showResults(); return; }

      repositionStack();
      setTimeout(flipTopCard, 200);
    }, 380);
  }

  // ── Next card button ──────────────────────────────────────────────────────
  window.nextCard = function () {
    const stage = document.getElementById('rev-stage');
    const el    = stage?.querySelector(`.rev-card[data-idx="${currentCardIdx}"]`);
    if (el) flyCardAway(el, -1);
  };

  // ── Stack drag-to-swipe ───────────────────────────────────────────────────
  function attachStackSwipe() {
    const screen = document.getElementById('s-reveal');
    if (!screen) return;

    let sx = 0, sy = 0, dragging = false, dragEl = null;

    function topEl() {
      return document.getElementById('rev-stage')
        ?.querySelector(`.rev-card[data-idx="${currentCardIdx}"]`) || null;
    }

    screen.addEventListener('pointerdown', (e) => {
      const top = topEl();
      if (!top || !top.classList.contains('flipped')) return;
      dragEl = top;
      sx = e.clientX; sy = e.clientY;
      dragging = true;
      dragEl.style.transition = 'none';
      dragEl.setPointerCapture(e.pointerId);
    });

    screen.addEventListener('pointermove', (e) => {
      if (!dragging || !dragEl) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      dragEl.style.transform = `translateX(${dx}px) translateY(${dy * 0.2}px) rotate(${dx * 0.06}deg) scale(1)`;
    });

    screen.addEventListener('pointerup', (e) => {
      if (!dragging || !dragEl) return;
      dragging = false;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 90) {
        flyCardAway(dragEl, dx > 0 ? 1 : -1);
      } else {
        dragEl.style.transition = 'transform .45s cubic-bezier(.16,1,.3,1)';
        repositionStack();
      }
      dragEl = null;
    });

    screen.addEventListener('pointercancel', () => {
      if (dragEl) { dragEl.style.transition = 'transform .45s cubic-bezier(.16,1,.3,1)'; repositionStack(); dragEl = null; }
      dragging = false;
    });
  }

  // ── Tilt on the top card of the stack ────────────────────────────────────
  function attachStackTilt() {
    const screen = document.getElementById('s-reveal');
    if (!screen) return;

    function applyTilt(cx, cy) {
      const el = document.getElementById('rev-stage')
        ?.querySelector(`.rev-card[data-idx="${currentCardIdx}"]`);
      if (!el || !el.classList.contains('flipped')) return;
      const tiltEl = el.querySelector('.rev-tilt');
      if (!tiltEl) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const rx    = ((cy - (rect.top  + rect.height/2)) / (rect.height/2)) * 12;
      const ry    = ((cx - (rect.left + rect.width/2))  / (rect.width/2))  * -12;
      const mx    = ((cx - rect.left) / rect.width)  * 100;
      const my    = ((cy - rect.top)  / rect.height) * 100;
      const angle = Math.atan2(cy-(rect.top+rect.height/2), cx-(rect.left+rect.width/2)) * 180/Math.PI + 90;
      tiltEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      el.style.setProperty('--mx', `${mx}%`);
      el.style.setProperty('--my', `${my}%`);
      el.style.setProperty('--holo-angle', `${angle}deg`);
    }

    function resetTilt() {
      const el = document.getElementById('rev-stage')
        ?.querySelector(`.rev-card[data-idx="${currentCardIdx}"]`);
      const tiltEl = el?.querySelector('.rev-tilt');
      if (tiltEl) tiltEl.style.transform = '';
    }

    screen.addEventListener('mousemove',  (e) => applyTilt(e.clientX, e.clientY));
    screen.addEventListener('mouseleave', resetTilt);
    screen.addEventListener('touchmove',  (e) => applyTilt(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  }

  // ── Lobby interactive tilt + foil ─────────────────────────────────────────
  function setupLobbyInteraction() {
    const wrap = document.getElementById('lobby-pack-wrap');
    if (!wrap) return;

    function applyLobbyTilt(cx, cy) {
      const rect = wrap.getBoundingClientRect();
      const nx = (cx - rect.left) / rect.width;
      const ny = (cy - rect.top)  / rect.height;
      const rx = (ny - .5) * -28;
      const ry = (nx - .5) *  28;
      const angle = Math.atan2(
        cy - (rect.top  + rect.height / 2),
        cx - (rect.left + rect.width  / 2)
      ) * 180 / Math.PI + 90;
      wrap.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      wrap.style.animationPlayState = 'paused';
      wrap.style.setProperty('--foil-angle', `${angle}deg`);
      wrap.style.setProperty('--shine-x',    `${nx * 100}%`);
      wrap.style.setProperty('--shine-y',    `${ny * 100}%`);
    }

    function resetLobbyTilt() {
      wrap.style.transform = '';
      wrap.style.animationPlayState = '';
    }

    wrap.addEventListener('mousemove',  (e) => applyLobbyTilt(e.clientX, e.clientY));
    wrap.addEventListener('mouseleave', resetLobbyTilt);
    wrap.addEventListener('touchmove',  (e) => {
      applyLobbyTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    wrap.addEventListener('touchend', resetLobbyTilt);
  }

  // ── Open screen interactive tilt + foil ──────────────────────────────────
  function setupOpenInteraction() {
    const stage    = document.getElementById('open-stage');
    const scene    = document.getElementById('pack-scene');
    const packWrap = document.getElementById('pack-wrap');
    if (!stage || !scene || !packWrap) return;

    function applyOpenTilt(cx, cy) {
      if (tracing || traceComplete) return;
      const rect = stage.getBoundingClientRect();
      const nx = (cx - rect.left) / rect.width;
      const ny = (cy - rect.top)  / rect.height;
      const rx = (ny - .5) * -24;
      const ry = (nx - .5) *  24;
      const angle = Math.atan2(
        cy - (rect.top  + rect.height / 2),
        cx - (rect.left + rect.width  / 2)
      ) * 180 / Math.PI + 90;
      scene.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      scene.style.animationPlayState = 'paused';
      packWrap.style.setProperty('--foil-angle', `${angle}deg`);
      packWrap.style.setProperty('--shine-x',    `${nx * 100}%`);
      packWrap.style.setProperty('--shine-y',    `${ny * 100}%`);
    }

    function resetOpenTilt() {
      if (tracing || traceComplete) return;
      scene.style.transform = '';
      scene.style.animationPlayState = '';
    }

    stage.addEventListener('mousemove',  (e) => applyOpenTilt(e.clientX, e.clientY));
    stage.addEventListener('mouseleave', resetOpenTilt);
    stage.addEventListener('touchmove',  (e) => {
      if (!tracing) applyOpenTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    stage.addEventListener('touchend', () => { if (!tracing) resetOpenTilt(); });
  }

  // ── Tilt / holographic tracking on reveal card ────────────────────────────
  // ── Results ───────────────────────────────────────────────────────────────
  function showResults() {
    showScreen('results');
    const swipeHint = document.getElementById('rev-swipe-hint');
    if (swipeHint) swipeHint.classList.add('hide');

    const countEl = document.getElementById('res-count');
    if (countEl) countEl.textContent = currentCards.length;

    const grid = document.getElementById('res-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const sorted = [...currentCards].sort((a, b) =>
      (RARITY_RANK[rarityKey(b.rarity)] ?? 0) - (RARITY_RANK[rarityKey(a.rarity)] ?? 0)
    );

    sorted.forEach((card, i) => {
      const el   = document.createElement('div'); el.className = 'res-card';
      el.style.animationDelay = `${i * 60}ms`;

      const img  = document.createElement('img');
      img.src = card.baked_image_url || card.image_url || DEFAULT_CARD_BACK;
      img.alt = card.name || 'Card';

      const name = document.createElement('div'); name.className = 'res-name';
      name.textContent = card.name || 'Card';

      const rar  = document.createElement('div');
      rar.className  = `res-rar rc-${rarityClass(card.rarity)}`;
      rar.textContent = card.rarity || 'Common';

      el.appendChild(img); el.appendChild(name); el.appendChild(rar);
      grid.appendChild(el);
    });

    burst(grid, '99,102,241', 50);

    pendingPacks.splice(currentPackIdx, 1);
    if (currentPackIdx >= pendingPacks.length && currentPackIdx > 0) currentPackIdx--;
    updatePackChip();

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = pendingPacks.length > 0 ? 'inline-flex' : 'none';
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  window.nextPack = function () {
    if (pendingPacks.length === 0) { window.location.href = '/my-collection.html'; return; }
    currentCardIdx = 0;
    updatePackChip();
    showScreen('lobby');
    setBgGlow('99,102,241');
  };
  window.goCollection = function () { window.location.href = '/my-collection.html'; };

  // ── Utility ───────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '99,102,241';
    return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupLobbyInteraction();
    setupOpenInteraction();
    init();
  });
})();
