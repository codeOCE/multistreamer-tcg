




window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.dataset.fallbackApplied) return;
        e.target.dataset.fallbackApplied = 'true';
        const isAvatar = e.target.id?.includes('avatar') || e.target.className?.includes('rounded-full') || e.target.src?.includes('twitchcdn');
        e.target.src = isAvatar ? 'https://api.dicebear.com/9.x/avataaars/svg?seed=fallback' : '';
    }
}, true);

const POLL_INTERVAL = 3000;
let lastBattleId = null;
let isAnimating = false;


const stage = document.getElementById('arena-stage');
const idleState = document.getElementById('arena-idle');
const vsScreen = document.getElementById('vs-screen');
const board = document.getElementById('battle-board');
const cCardsEl = document.getElementById('challenger-cards');
const tCardsEl = document.getElementById('target-cards');
const roundBanner = document.getElementById('round-banner');
const winnerBanner = document.getElementById('winner-banner');

const delay = ms => new Promise(res => setTimeout(res, ms));

function mechanicBadgeIconInner(icon) {
    if (!icon) return '';
    const s = String(icon).trim();
    if (s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://')) {
        const safe = s.replace(/"/g, '&quot;');
        return `<img src="${safe}" alt="" class="w-full h-full object-contain p-0.5" />`;
    }
    return s;
}


async function pollForBattles() {
    if (isAnimating) return;
    try {
        const q = new URLSearchParams(window.location.search).get('streamer');
        const url = q ? `/api/public/battle/latest?streamer=${encodeURIComponent(q)}` : '/api/public/battle/latest';
        const res = await fetch(url);
        if (!res.ok) return;
        const battle = await res.json();
        if (!battle || !battle.battle_data) {
            if (lastBattleId === null) { lastBattleId = 'none'; idleState?.classList.remove('hidden'); }
            return;
        }
        if (battle.id === lastBattleId) return;
        if (lastBattleId === null) {
            lastBattleId = battle.id;
            idleState?.classList.remove('hidden');
            return;
        }
        lastBattleId = battle.id;
        isAnimating = true;
        idleState?.classList.add('hidden');
        await playBattleSequence(battle.battle_data);
    } catch (e) {
        console.error('[Arena] Poll error:', e);
        isAnimating = false;
    }
}

setInterval(pollForBattles, POLL_INTERVAL);
pollForBattles();


function buildCardEl(cardData) {
    const wrapper = document.createElement('div');
    const mechName = (cardData.mechanic_name || '').toLowerCase().replace(/[\s-]+/g, '_');
    const mechIcon = cardData.mechanic_icon || '';
    const mechDisplayName = cardData.mechanic_display_name || cardData.mechanic_name || '';
    const hp = cardData.current_hp ?? cardData.defense ?? 0;
    const atk = cardData.attack ?? 0;
    const imgSrc = cardData.image_url
        || `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(cardData.name || 'card')}`;

    const rarityClass = {
        common: 'rarity-common', uncommon: 'rarity-uncommon',
        rare: 'rarity-rare', epic: 'rarity-epic', legendary: 'rarity-legendary'
    }[(cardData.rarity || '').toLowerCase()] || 'rarity-common';

    // Build trait pill(s) for below the card — supports main + genesis mechanic
    const buildTraitPill = (name, icon, displayName) => {
        if (!name && !icon) return '';
        const cls = `card-trait-badge badge-${name || 'default'}`;
        const iconHtml = icon ? `<span class="card-trait-icon">${mechanicBadgeIconInner(icon)}</span>` : '';
        const label = displayName || name || '';
        return `<div class="${cls}" title="${name}">${iconHtml}<span class="card-trait-label">${label}</span></div>`;
    };

    const mainPill = buildTraitPill(mechName, mechIcon, mechDisplayName);
    const genMechName = (cardData.genesis_mechanic_name || '').toLowerCase().replace(/[\s-]+/g, '_');
    const genesisPill = buildTraitPill(genMechName, cardData.genesis_mechanic_icon || '', cardData.genesis_mechanic_display_name || cardData.genesis_mechanic_name || '');

    const traitRow = (mainPill || genesisPill)
        ? `<div class="card-trait-row">${mainPill}${genesisPill}</div>`
        : '<div class="card-trait-row"></div>';

    wrapper.innerHTML = `
        <div class="battle-card-wrapper flex-shrink-0">
            <div class="battle-card relative w-full rounded-xl overflow-hidden border-2 ${rarityClass} shadow-2xl">
                <img class="card-img absolute inset-0 w-full h-full object-cover" src="${imgSrc}" alt="${cardData.name || ''}">
                <div class="absolute inset-0" style="background:linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.05) 50%,transparent 100%)"></div>
                <div class="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-center">
                    <div class="flex items-center gap-1 bg-blue-600/90 rounded px-2 py-0.5">
                        <span class="text-[11px] font-black text-white">⚔</span>
                        <span class="card-atk text-[14px] font-black text-white">${atk}</span>
                    </div>
                    <div class="flex items-center gap-1 bg-red-600/90 rounded px-2 py-0.5">
                        <span class="text-[11px] font-black text-white">❤</span>
                        <span class="card-hp text-[14px] font-black text-white">${hp}</span>
                    </div>
                </div>
            </div>
            <!-- Card info strip below the card -->
            <div class="card-info-strip">
                <div class="card-name">${cardData.name || ''}</div>
                ${traitRow}
            </div>
            <!-- Popups sit at card centre, outside overflow-hidden -->
            <div class="damage-popup absolute left-1/2 text-white font-black opacity-0 pointer-events-none z-40 whitespace-nowrap" style="top:40%;transform:translate(-50%,-50%);font-size:2.2rem;text-shadow:0 0 15px rgba(255,0,0,0.9);"></div>
            <div class="heal-popup absolute left-1/2 font-black text-4xl opacity-0 pointer-events-none z-40 whitespace-nowrap" style="top:40%;transform:translate(-50%,-50%)"></div>
            <div class="event-popup absolute left-1/2 font-black text-4xl opacity-0 pointer-events-none z-40 whitespace-nowrap" style="top:40%;transform:translate(-50%,-50%)"></div>
        </div>
    `;
    return wrapper.firstElementChild;
}


function addFrozenOverlay(cardEl) {
    if (!cardEl || cardEl.querySelector('.card-frozen-overlay')) return;
    cardEl.classList.add('card-is-frozen');
    const overlay = document.createElement('div');
    overlay.className = 'card-frozen-overlay';
    overlay.innerHTML = `
        <div class="cfo-ice-border"></div>
        <div class="cfo-frost"></div>
        <div class="cfo-crystals"></div>
        <div class="cfo-cracks">
            <div class="cfo-crack cfo-crack-1"></div>
            <div class="cfo-crack cfo-crack-2"></div>
            <div class="cfo-crack cfo-crack-3"></div>
        </div>
        <div class="cfo-particles">
            <div class="cfo-particle"></div>
            <div class="cfo-particle"></div>
            <div class="cfo-particle"></div>
            <div class="cfo-particle"></div>
        </div>
        <div class="cfo-status-tag">❄ Frozen</div>
    `;
    cardEl.appendChild(overlay);
}

function removeFrozenOverlay(cardEl) {
    if (!cardEl) return;
    cardEl.querySelector('.card-frozen-overlay')?.remove();
    cardEl.classList.remove('card-is-frozen');
}


function updateScoreboard(side, wins) {
    const container = document.getElementById(`${side}-match-score`);
    if (!container) return;
    const dots = container.querySelectorAll('.score-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('lit-blue', 'lit-red');
        if (i < wins) dot.classList.add(side === 'challenger' ? 'lit-blue' : 'lit-red');
    });
}


async function showCoinFlip(firstAttacker, challengerName, targetName, challengerAvatar, targetAvatar) {
    const safeAvatar = (name, av) => av || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const cAv = safeAvatar(challengerName, challengerAvatar);
    const tAv = safeAvatar(targetName, targetAvatar);
    const winnerAv = firstAttacker === 'challenger' ? cAv : tAv;
    const winnerName = firstAttacker === 'challenger' ? challengerName : targetName;

    const overlay = document.createElement('div');
    overlay.id = 'coin-flip-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:200;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);
        opacity:0;transition:opacity 0.35s;
    `;
    overlay.innerHTML = `
        <div style="font-size:0.7rem;font-weight:900;letter-spacing:0.45em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:28px;">Coin Flip</div>
        <div id="cf-coin" style="
            width:130px;height:130px;border-radius:50%;overflow:hidden;
            border:4px solid rgba(251,191,36,0.6);
            box-shadow:0 0 25px rgba(251,191,36,0.5);
            animation:coinFlipSpin 1.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
            transform-origin:center;
        ">
            <img src="${winnerAv}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous">
        </div>
        <div id="cf-result" style="
            margin-top:24px;font-family:'Rajdhani',sans-serif;
            font-size:1.8rem;font-weight:700;letter-spacing:0.1em;
            color:#fbbf24;opacity:0;transition:opacity 0.5s;
            text-shadow:0 0 20px rgba(251,191,36,0.8);
            text-transform:uppercase;
        ">🎉 ${winnerName} goes first!</div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
    await delay(350);


    await delay(1900);


    const coinEl = overlay.querySelector('#cf-coin');
    const resultEl = overlay.querySelector('#cf-result');
    if (coinEl) {
        coinEl.style.transition = 'box-shadow 0.4s, border-color 0.4s';
        coinEl.style.borderColor = '#fbbf24';
        coinEl.style.boxShadow = '0 0 40px rgba(251,191,36,0.9), 0 0 80px rgba(251,191,36,0.4)';
    }
    if (resultEl) resultEl.style.opacity = '1';

    await delay(2400);
    overlay.style.opacity = '0';
    await delay(400);
    overlay.remove();
}



async function showTraitPopup(cardEl, emojiOrTextOrIconUrl, cssClass, ms = 1200, labelClass = '') {
    // Popups disabled — just wait out the duration so timing-dependent callers still work.
    await delay(ms);
}


async function playBattleSequence(data) {
    if (!data || !data.matchRounds) {
        console.warn('[Arena] No matchRounds in battle_data:', data);
        isAnimating = false; return;
    }

    const safeAvatar = (name, av) => av || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const set = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };


    if (stage) stage.classList.remove('hidden');
    if (board) board.style.opacity = '0';
    if (vsScreen) { vsScreen.style.opacity = '0'; vsScreen.style.transform = 'scale(0.8)'; }


    set('vs-c-avatar', 'src', safeAvatar(data.challenger.name, data.challenger.avatar));
    set('vs-c-name', 'innerText', data.challenger.name);
    set('vs-t-avatar', 'src', safeAvatar(data.target.name, data.target.avatar));
    set('vs-t-name', 'innerText', data.target.name);
    updateScoreboard('challenger', 0);
    updateScoreboard('target', 0);

    if (vsScreen) { vsScreen.style.opacity = '1'; vsScreen.style.transform = 'scale(1)'; }
    const chs = document.getElementById('vs-challenger');
    const tgs = document.getElementById('vs-target');
    if (chs) { chs.style.opacity = '1'; chs.style.transform = 'translateX(0)'; }
    if (tgs) { tgs.style.opacity = '1'; tgs.style.transform = 'translateX(0)'; }
    await delay(500);
    set('vs-logo', 'style', 'opacity:1;transform:scale(1)');
    await delay(3000);
    if (vsScreen) vsScreen.style.opacity = '0';
    await delay(500);


    const cInitialDeck = data.initialChallengerDeck || [];
    const tInitialDeck = data.initialTargetDeck || [];
    console.log('[Arena] Initial decks:', cInitialDeck.length, tInitialDeck.length);


    for (let mIdx = 0; mIdx < data.matchRounds.length; mIdx++) {
        const matchRound = data.matchRounds[mIdx];


        if (cCardsEl) cCardsEl.innerHTML = '';
        if (tCardsEl) tCardsEl.innerHTML = '';
        const cCardsMap = new Map();
        const tCardsMap = new Map();


        const buildSide = (deckCards, container, map) => {
            [1, 2, 3].forEach(slot => {
                const card = deckCards.find(c => c.slot === slot);
                if (card) {
                    const el = buildCardEl(card);
                    container.appendChild(el);
                    map.set(slot, el);
                } else {
                    const spacer = document.createElement('div');
                    spacer.className = 'w-32 flex-shrink-0 opacity-0';
                    spacer.style.aspectRatio = '5/7';
                    container.appendChild(spacer);
                }
            });
        };

        buildSide(cInitialDeck, cCardsEl, cCardsMap);
        buildSide(tInitialDeck, tCardsEl, tCardsMap);


        set('board-c-avatar', 'src', safeAvatar(data.challenger.name, data.challenger.avatar));
        set('board-c-name', 'innerText', data.challenger.name);
        set('board-t-avatar', 'src', safeAvatar(data.target.name, data.target.avatar));
        set('board-t-name', 'innerText', data.target.name);
        if (board) board.style.opacity = '1';




        await showCoinFlip(
            matchRound.firstAttacker,
            data.challenger.name,
            data.target.name,
            data.challenger.avatar,
            data.target.avatar
        );


        for (const ex of matchRound.exchanges) {

            if (ex.type === 'bounty_placed') {
                const oppMap = ex.side === 'challenger' ? tCardsMap : cCardsMap;
                const targetEl = ex.targetSlot != null ? oppMap.get(ex.targetSlot) : [...oppMap.values()][0];
                if (targetEl) {
                    const marker = document.createElement('div');
                    marker.className = 'bounty-marker';
                    marker.textContent = '🎯';
                    targetEl.appendChild(marker);
                    setTimeout(() => marker.remove(), 1800);
                }
                await delay(600);
                continue;
            }

            if (ex.type === 'mirror_transform') {
                const sideMap = ex.side === 'challenger' ? cCardsMap : tCardsMap;
                const mirrorEl = ex.slot ? sideMap.get(ex.slot) : [...sideMap.values()][0];
                if (mirrorEl) {
                    const inner = mirrorEl.querySelector('.battle-card');

                    // Start the whole-card brightness pulse.
                    if (inner) {
                        inner.classList.add('anim-mirror-card');
                        setTimeout(() => inner.classList.remove('anim-mirror-card'), 800);
                    }

                    // Append the scan line — it will animate top → bottom over 750ms.
                    const line = document.createElement('div');
                    line.className = 'anim-mirror-line';
                    if (inner) inner.appendChild(line);
                    setTimeout(() => line.remove(), 800);

                    // Wait until the line is roughly halfway down (~350ms) then swap
                    // all card content so it looks like the line is revealing the new card.
                    await delay(350);

                    // --- Swap stats ---
                    if (ex.newAttack !== undefined) {
                        const atkEl = mirrorEl.querySelector('.card-atk');
                        if (atkEl) atkEl.textContent = ex.newAttack;
                    }
                    if (ex.newDefense !== undefined) {
                        const hpEl = mirrorEl.querySelector('.card-hp');
                        if (hpEl) hpEl.textContent = ex.newDefense;
                    }

                    // --- Swap card image (wipes in behind the line) ---
                    if (ex.newImageUrl) {
                        const imgEl = mirrorEl.querySelector('.card-img');
                        if (imgEl) {
                            imgEl.src = ex.newImageUrl;
                            imgEl.classList.add('anim-mirror-reveal');
                            setTimeout(() => imgEl.classList.remove('anim-mirror-reveal'), 420);
                        }
                    }

                    // --- Swap card name ---
                    if (ex.newName) {
                        const nameEl = mirrorEl.querySelector('.card-name');
                        if (nameEl) {
                            nameEl.textContent = ex.newName;
                            nameEl.classList.add('anim-mirror-reveal');
                            setTimeout(() => nameEl.classList.remove('anim-mirror-reveal'), 420);
                        }
                    }

                    // --- Swap trait pill below the card ---
                    const traitRow = mirrorEl.querySelector('.card-trait-row');
                    if (traitRow) {
                        const mechName = (ex.newMechanicName || '').toLowerCase().replace(/[\s-]+/g, '_');
                        const mechIcon = ex.newMechanicIcon || '';
                        const mechLabel = ex.newMechanicName || '';
                        if (mechName || mechIcon) {
                            const iconHtml = mechIcon ? `<span class="card-trait-icon">${mechanicBadgeIconInner(mechIcon)}</span>` : '';
                            traitRow.innerHTML = `<div class="card-trait-badge badge-${mechName || 'default'}" title="${mechName}">${iconHtml}<span class="card-trait-label">${mechLabel}</span></div>`;
                        } else {
                            traitRow.innerHTML = '';
                        }
                    }

                    // Let the line finish its sweep, then show the 🪞 popup.
                    await delay(420);
                    await showTraitPopup(mirrorEl, '🪞', 'anim-trait-pop', 700);
                }
                await delay(300);
                continue;
            }

            if (ex.type === 'mimic_trigger') {
                const mimicEl = (ex.side === 'challenger' ? cCardsMap : tCardsMap).get(ex.slot);
                if (mimicEl) {
                    mimicEl.classList.add('anim-mimic-morph');
                    setTimeout(() => mimicEl.classList.remove('anim-mimic-morph'), 800);
                    await showTraitPopup(mimicEl, '🪄', 'anim-trait-pop', 1200);
                    const atkEl = mimicEl.querySelector('.card-atk');
                    const hpEl = mimicEl.querySelector('.card-hp');
                    if (atkEl && ex.attack !== undefined) atkEl.textContent = ex.attack;
                    if (hpEl && ex.defense !== undefined) hpEl.textContent = ex.defense;
                }
                await delay(400);
                continue;
            }

            const cSlot = ex.challengerCard?.slot;
            const tSlot = ex.targetCard?.slot;
            if (!cSlot || !tSlot) continue;

            const cCardEl = cCardsMap.get(cSlot);
            const tCardEl = tCardsMap.get(tSlot);

            const attackerEl = ex.side === 'challenger' ? cCardEl : tCardEl;
            const defenderEl = ex.side === 'challenger' ? tCardEl : cCardEl;

            if (!attackerEl || !defenderEl) continue;


            attackerEl.classList.add('ring-4', 'ring-yellow-400', 'z-20', 'scale-105');


            const defCard = ex.side === 'challenger' ? ex.targetCard : ex.challengerCard;
            const defTraitNames = (defCard?.traits || []).map(t => (t.name || '').toLowerCase());
            if (ex.defenderHasGuard || defTraitNames.includes('guard') || defCard?.mechanic_name?.toLowerCase() === 'guard') {
                defenderEl.classList.add('ring-4', 'ring-yellow-300');
                const shield = document.createElement('div');
                shield.className = 'anim-guard-shield';
                defenderEl.appendChild(shield);
                setTimeout(() => shield.remove(), 1000);
                showTraitPopup(defenderEl, '🛡️', 'anim-shield-flash', 900, 'floating-text-block');
            }


            if (!ex.skipped || (ex.skipped && ex.counterDamage > 0)) {
                const rectA = attackerEl.getBoundingClientRect();
                const rectD = defenderEl.getBoundingClientRect();
                const dX = (rectD.left + rectD.width / 2) - (rectA.left + rectA.width / 2);
                const dY = (rectD.top + rectD.height / 2) - (rectA.top + rectA.height / 2);
                attackerEl.style.transition = 'transform 0.2s ease-in';
                attackerEl.style.transform = `translate(${dX * 0.15}px, ${dY * 0.15}px) scale(1.05)`;
                await delay(200);
            } else {
                await delay(120);
            }




            const atkDmg = ex.side === 'challenger' ? ex.challengerCard.attack : ex.targetCard.attack;
            const defDmg = ex.side === 'challenger' ? ex.targetCard.attack : ex.challengerCard.attack;

            const cDmgEl = cCardEl?.querySelector('.damage-popup');
            const tDmgEl = tCardEl?.querySelector('.damage-popup');

            if (!ex.skipped) {
                if (ex.side === 'challenger') {
                    if (tDmgEl) { tDmgEl.textContent = `-${atkDmg}`; tDmgEl.style.opacity = '1'; }
                    if (cDmgEl) { cDmgEl.textContent = `-${defDmg}`; cDmgEl.style.opacity = '1'; }
                } else {
                    if (cDmgEl) { cDmgEl.textContent = `-${atkDmg}`; cDmgEl.style.opacity = '1'; }
                    if (tDmgEl) { tDmgEl.textContent = `-${defDmg}`; tDmgEl.style.opacity = '1'; }
                }

                cCardEl?.classList.add('anim-damage');
                tCardEl?.classList.add('anim-damage');
                setTimeout(() => {
                    cCardEl?.classList.remove('anim-damage');
                    tCardEl?.classList.remove('anim-damage');
                }, 450);
                await delay(250);
            } else if (ex.counterDamage > 0) {
                const initDmgEl = ex.side === 'challenger' ? cDmgEl : tDmgEl;
                if (initDmgEl) { initDmgEl.textContent = `-${ex.counterDamage}`; initDmgEl.style.opacity = '1'; }
                attackerEl?.classList.add('anim-damage');
                setTimeout(() => attackerEl?.classList.remove('anim-damage'), 450);
                await delay(250);
            } else {
                await delay(150);
            }


            attackerEl.style.transition = 'transform 0.4s ease-out';
            attackerEl.style.transform = 'scale(1)';
            attackerEl.style.zIndex = '1';

            await delay(400);


            attackerEl.style.transition = '';


            const cHpEl = cCardEl?.querySelector('.card-hp');
            const tHpEl = tCardEl?.querySelector('.card-hp');
            if (cHpEl && ex.challengerCardAfter) cHpEl.textContent = Math.max(0, ex.challengerCardAfter.current_hp);
            if (tHpEl && ex.targetCardAfter) tHpEl.textContent = Math.max(0, ex.targetCardAfter.current_hp);


            if (!ex.challengerSurvived) cCardEl?.classList.add('card-dead');
            if (!ex.targetSurvived) tCardEl?.classList.add('card-dead');


            const resolveEvtEl = (side) => {
                if (side === 'challenger') return cCardEl;
                if (side === 'target') return tCardEl;
                if (side === 'attacker') return attackerEl;
                if (side === 'defender') return defenderEl;
                return null;
            };

            const spawnOn = (el, cssClass, durationMs = 900) => {
                if (!el) return;
                const d = document.createElement('div');
                d.className = cssClass;
                el.appendChild(d);
                setTimeout(() => d.remove(), durationMs);
            };

            const burstParticles = (el, cssClass, count = 8) => {
                if (!el) return;
                for (let i = 0; i < count; i++) {
                    const f = document.createElement('div');
                    f.className = cssClass;
                    f.style.setProperty('--fx', `${(Math.random() * 2 - 1).toFixed(2)}`);
                    f.style.setProperty('--fy', `${(Math.random() * -1 - 0.5).toFixed(2)}`);
                    f.style.setProperty('--fr', `${(Math.random() * 2 - 1).toFixed(2)}`);
                    f.style.animationDelay = `${(Math.random() * 0.15).toFixed(2)}s`;
                    el.appendChild(f);
                    setTimeout(() => f.remove(), 1100);
                }
            };

            for (const evt of (ex.events || [])) {
                const evtEl = resolveEvtEl(evt.side);

                switch (evt.type) {

                    case 'rage_gain': {
                        const rageEl = evt.cardSide === 'challenger' ? cCardEl
                            : (evt.cardSide === 'target' ? tCardEl : evtEl);
                        if (rageEl) {
                            rageEl.classList.add('anim-rage');
                            setTimeout(() => rageEl.classList.remove('anim-rage'), 900);
                            showTraitPopup(rageEl, '😤', 'anim-trait-pop', 900, 'floating-text-rage');
                        }
                        break;
                    }

                    case 'freeze_applied': {
                        const frostEl = evt.frostVictimSide === 'challenger' ? cCardEl
                            : (evt.frostVictimSide === 'target' ? tCardEl : defenderEl);
                        if (frostEl) {
                            frostEl.classList.add('anim-freeze');
                            setTimeout(() => frostEl.classList.remove('anim-freeze'), 1200);
                            showTraitPopup(frostEl, '🧊', 'anim-trait-pop', 1200, 'floating-text-freeze');
                            addFrozenOverlay(frostEl);
                        }
                        break;
                    }

                    case 'frostbite_applied': {
                        const biteEl = evt.frostVictimSide === 'challenger' ? cCardEl
                            : (evt.frostVictimSide === 'target' ? tCardEl : evtEl);
                        if (biteEl) {
                            burstParticles(biteEl, 'anim-frostbite-flake', 10);
                            biteEl.classList.add('anim-freeze');
                            setTimeout(() => biteEl.classList.remove('anim-freeze'), 800);
                            showTraitPopup(biteEl, '❄️', 'anim-trait-pop', 900, 'floating-text-freeze');
                            await delay(700);
                        }
                        break;
                    }

                    case 'frozen_skip': {
                        if (evtEl) {
                            evtEl.classList.add('anim-frozen-skip');
                            setTimeout(() => evtEl.classList.remove('anim-frozen-skip'), 700);
                            showTraitPopup(evtEl, '🧊', 'anim-trait-pop', 800, 'floating-text-freeze');
                            setTimeout(() => removeFrozenOverlay(evtEl), 800);
                        }
                        break;
                    }

                    case 'bounty_claimed': {
                        if (evtEl) {
                            burstParticles(evtEl, 'anim-bounty-coin', 10);
                            showTraitPopup(evtEl, '💰', 'anim-trait-pop', 1100, 'floating-text-gold');
                            await delay(700);
                        }
                        break;
                    }

                    case 'cleanse_trigger': {
                        if (evtEl) {
                            spawnOn(evtEl, 'anim-cleanse-ring', 1100);
                            evtEl.classList.add('anim-cleanse-card');
                            setTimeout(() => evtEl.classList.remove('anim-cleanse-card'), 900);
                            showTraitPopup(evtEl, '✨', 'anim-trait-pop', 1000, 'floating-text-cleanse');
                            removeFrozenOverlay(evtEl);
                            await delay(700);
                        }
                        break;
                    }

                    case 'echo_trigger': {
                        if (evtEl) {
                            const ghost = document.createElement('div');
                            ghost.className = 'anim-echo-ghost';
                            evtEl.appendChild(ghost);
                            setTimeout(() => ghost.remove(), 900);
                            showTraitPopup(evtEl, '💨', 'anim-trait-pop', 900);
                            await delay(600);
                        }
                        break;
                    }

                    case 'revive':
                    case 'reanimate': {
                        if (evtEl) {
                            evtEl.classList.remove('card-dead');
                            evtEl.classList.add('anim-revive');
                            spawnOn(evtEl, 'anim-revive-light', 1800);
                            spawnOn(evtEl, 'anim-revive-wings', 1600);
                            setTimeout(() => evtEl.classList.remove('anim-revive'), 1800);
                            await showTraitPopup(evtEl, '👼', 'anim-trait-pop', 1400, 'floating-text-revive');
                            const reHpEl = evtEl.querySelector('.card-hp');
                            if (reHpEl) reHpEl.textContent = '1';
                        }
                        break;
                    }

                    case 'absorb_gain':
                    case 'absorb_heal': {
                        if (evtEl) {
                            evtEl.classList.add('anim-absorb-flash');
                            spawnOn(evtEl, 'anim-absorb-drain', 1100);
                            setTimeout(() => evtEl.classList.remove('anim-absorb-flash'), 600);
                            showTraitPopup(evtEl, '🩸', 'anim-trait-pop', 1100, 'floating-text-rage');
                            await delay(500);
                            const afterCard = (evt.side === 'challenger' || (evt.side === 'attacker' && ex.side === 'challenger'))
                                ? ex.challengerCardAfter : ex.targetCardAfter;
                            const absorbHpEl = evtEl.querySelector('.card-hp');
                            if (absorbHpEl && afterCard) absorbHpEl.textContent = Math.max(0, afterCard.current_hp);
                        }
                        break;
                    }

                    case 'mimic_trigger': {
                        const mimicEl = (evt.side === 'challenger') ? cCardsMap.get(evt.slot) : tCardsMap.get(evt.slot);
                        if (mimicEl) {
                            mimicEl.classList.add('anim-mimic-morph');
                            setTimeout(() => mimicEl.classList.remove('anim-mimic-morph'), 800);
                            await showTraitPopup(mimicEl, '🪄', 'anim-trait-pop', 1200);
                            const atkEl = mimicEl.querySelector('.card-atk');
                            const hpEl = mimicEl.querySelector('.card-hp');
                            if (atkEl && evt.attack !== undefined) atkEl.textContent = evt.attack;
                            if (hpEl && evt.defense !== undefined) hpEl.textContent = evt.defense;
                        }
                        break;
                    }
                }
            }


            await delay(400);
            attackerEl.classList.remove('ring-4', 'ring-yellow-400', 'z-20', 'scale-105');
            defenderEl.classList.remove('ring-4', 'ring-yellow-300');
            cCardEl?.classList.remove('anim-damage');
            tCardEl?.classList.remove('anim-damage');
            if (cDmgEl) cDmgEl.style.opacity = '0';
            if (tDmgEl) tDmgEl.style.opacity = '0';

            await delay(300);
        }


        let cWins = 0, tWins = 0;
        for (let i = 0; i <= mIdx; i++) {
            if (data.matchRounds[i].winner === 'challenger') cWins++;
            if (data.matchRounds[i].winner === 'target') tWins++;
        }
        updateScoreboard('challenger', cWins);
        updateScoreboard('target', tWins);

        await delay(1500);
        if (board) board.style.opacity = '0';
        await delay(500);
    }


    const w = data.winner;
    let winnerName, winnerAv, winnerScore;
    if (w === 'challenger') {
        winnerName = data.challenger.name;
        winnerAv = safeAvatar(data.challenger.name, data.challenger.avatar);
        winnerScore = `${data.challenger.matchWins} - ${data.target.matchWins}`;
    } else if (w === 'target') {
        winnerName = data.target.name;
        winnerAv = safeAvatar(data.target.name, data.target.avatar);
        winnerScore = `${data.target.matchWins} - ${data.challenger.matchWins}`;
    } else {
        winnerName = "IT'S A DRAW";
        winnerAv = 'https://api.dicebear.com/9.x/shapes/svg?seed=draw';
        winnerScore = `${data.challenger.matchWins} - ${data.target.matchWins}`;
    }
    set('winner-name', 'innerText', winnerName);
    set('winner-avatar', 'src', winnerAv);
    set('winner-score', 'innerText', `${winnerScore} rounds`);

    if (winnerBanner) {
        winnerBanner.classList.remove('hidden');
        setTimeout(() => winnerBanner.style.opacity = '1', 50);
    }

    await delay(8000);


    if (winnerBanner) winnerBanner.style.opacity = '0';
    if (board) board.style.opacity = '0';
    await delay(1000);
    if (winnerBanner) winnerBanner.classList.add('hidden');
    if (stage) stage.classList.add('hidden');
    isAnimating = false;
}

window._arenaTest = playBattleSequence;
window._arenaReset = () => { isAnimating = false; };
