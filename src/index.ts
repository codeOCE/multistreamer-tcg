import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';

// Type definitions
interface LoginBody {
  username: string;
  password: string;
}

interface CardBody {
  id: string;
  streamer_id?: string;
  creator_id?: string;
  name: string;
  image_url: string;
  rarity: string;
  type?: string;
  set_name?: string;
}

interface GrantBody {
  username: string;
  card_id: string;
  quantity?: number;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  TWITCH_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  CARD_IMAGES: any; // R2Bucket
}

// Card image upload limits (storage conservation)
const CARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8MB
const CARD_IMAGE_MAX_EDGE_PX = 2000;

// CDN base for creator card art (R2); used to detect and delete old art on re-upload
const CREATOR_CDN_BASE = 'https://cdn.codeoce.com/';

/** If image_url is from our R2-backed CDN, return the R2 object key; else null. */
function getR2KeyFromImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (!imageUrl.startsWith(CREATOR_CDN_BASE)) return null;
  const key = imageUrl.slice(CREATOR_CDN_BASE.length).split('?')[0].trim();
  return key.length > 0 ? key : null;
}

// Security & Type Hardening Interfaces
interface AdminCardBody {
  id: string;
  streamer_id?: string;
  creator_id?: string;
  name: string;
  image_url: string;
  rarity: string;
  type?: string;
  set_id: string;
  card_number: string;
  set_name?: string;
  description?: string;
  attack?: number;
  defense?: number;
}

interface BulkCardsBody {
  cards: AdminCardBody[];
}

interface AdminSetBody {
  id: string;
  name: string;
  code: string;
  icon_url: string;
  release_date: string;
  description: string;
  total_cards: number;
  card_back_url?: string;
}

interface ConfigBody {
  id: string;
  data: any;
}

interface NotificationBody {
  ids: string[];
}

interface BypassBody {
  code: string;
}

interface TradeOfferBody {
  target_code: string;
  sender_items: string[]; // array of user_card_ids
}

interface TradeReplyBody {
  trade_id: string;
  receiver_items: string[]; // array of user_card_ids
}

interface TradeRespondBody {
  trade_id: string;
  action: 'accept' | 'reject' | 'cancel';
}

interface TradeInBody {
  user_card_ids: string[];
}

interface CardUploadBody {
  name: string;
  rarity: string;
  image_url: string;
  type?: string;
}
// --- SECURE CREATOR HELPERS ---

async function getUserFromSession(request: Request, env: Env, supabase: any) {
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.match(/(?:^|; )session=([^;]*)/)?.[1];

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SESSION_SECRET)
    );

    const twitchId = payload.sub || (payload as any).twitch_id || (payload as any).id;
    if (!twitchId) return null;

    const { data: user, error } = await supabase
      .from('users')
      .select('twitch_id, username, avatar_url, binder_layout, binder_theme, onboarding_collector_step, is_onboarding_complete')
      .eq('twitch_id', twitchId.toString())
      .single();

    if (error || !user) return null;

    return user;
  } catch (e: any) {
  }
}

async function getTwitchFollows(twitchId: string, accessToken: string, clientId: string): Promise<any[]> {
  if (!accessToken) return [];

  const allFollows: any[] = [];
  let cursor = '';
  let pagesFetched = 0;
  const MAX_PAGES = 5; // Scan up to 500 follows to protect performance/latency

  try {
    do {
      const url = `https://api.twitch.tv/helix/channels/followed?user_id=${twitchId}&first=100${cursor ? `&after=${cursor}` : ''}`;
      const resp = await fetch(url, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[Twitch] Follows fetch failed on page ${pagesFetched + 1}:`, errorText);
        break;
      }

      const data: any = await resp.json();
      const pageData = data.data || [];
      allFollows.push(...pageData);

      cursor = data.pagination?.cursor || '';
      pagesFetched++;

      if (!cursor) break;
    } while (pagesFetched < MAX_PAGES);

    console.log(`[Twitch] Follows summary for ${twitchId}: Total ${allFollows.length} across ${pagesFetched} pages.`);
    return allFollows;
  } catch (e) {
    console.error('[Twitch] Follows fatal fetch error:', e);
    return allFollows; // Return what we have so far
  }
}

async function getStreamerForCreator(user: any, supabase: any): Promise<any | null> {
  const { data } = await supabase
    .from('streamers')
    .select('*')
    .eq('twitch_id', user.twitch_id)
    .maybeSingle();
  return data;
}

// --- ENCRYPTION HELPERS ---
async function encryptSensitive(text: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyBuf = encoder.encode(secret.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'AES-CBC' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptSensitive(encryptedBase64: string, secret: string): Promise<string> {
  const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 16);
  const data = combined.slice(16);
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secret.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'AES-CBC' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// --- Streamer Context Resolver ---
async function resolveStreamerContext(request: Request, supabase: any, url: URL): Promise<any | null> {
  const rawParam = url.searchParams.get('streamer_id') || url.searchParams.get('creator_id') || url.searchParams.get('streamer');
  const streamerId = rawParam;
  if (streamerId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerId);
    if (isUuid) {
      const { data: streamer } = await supabase.from('streamers').select('*').eq('id', streamerId).maybeSingle();
      if (streamer) return streamer;
    }
    const { data: streamerByNick } = await supabase.from('streamers').select('*').ilike('username', streamerId).maybeSingle();
    if (streamerByNick) return streamerByNick;
  }
  const { data: defaultStreamer } = await supabase.from('streamers').select('*').ilike('username', 'codeoce').maybeSingle();
  return defaultStreamer;
}

// --- TWITCH SIGNATURE VERIFIER ---
async function verifyTwitchSignature(secret: string, signature: string, id: string, timestamp: string, body: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signatureBytes = new Uint8Array(signature.split('=')[1].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(id + timestamp + body));
}



// --- HELPER FUNCTIONS ---


async function handleTwitchWebhook(req: Request, env: Env): Promise<Response> {
  console.log('[Webhook] Received request');

  const signature = req.headers.get('Twitch-Eventsub-Message-Signature');
  const timestamp = req.headers.get('Twitch-Eventsub-Message-Timestamp');
  const id = req.headers.get('Twitch-Eventsub-Message-Id');
  const messageType = req.headers.get('Twitch-Eventsub-Message-Type');
  const body = await req.text();

  console.log('[Webhook] Message Type:', messageType);

  if (!signature || !timestamp || !id) {
    console.error('[Webhook] Missing required headers');
    return new Response('Missing headers', { status: 403 });
  }

  const isValidSignature = await verifyTwitchSignature(env.TWITCH_WEBHOOK_SECRET, signature, id, timestamp, body);
  if (!isValidSignature) {
    console.error('[Webhook] Invalid signature');
    return new Response('Invalid Signature', { status: 403 });
  }

  let json: any;
  try {
    json = JSON.parse(body);
  } catch (e: any) {
    console.error('[Webhook] Failed to parse JSON:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  // Handle verification challenge
  if (json.challenge) {
    console.log('[Webhook] ✅ Responding to verification challenge:', json.challenge);
    return new Response(json.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Handle notification events
  if (!json.event) {
    console.log('[Webhook] No event data in payload, returning OK');
    return new Response('OK', { status: 200 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Handle Channel Points Redemption
  if (json.subscription.type === 'channel.channel_points_custom_reward_redemption.add') {
    const redeemedRewardId = json.event.reward.id;
    const broadcasterId = json.event.broadcaster_user_id;
    const userId = json.event.user_id;
    const userName = json.event.user_name || json.event.user_login;

    console.log(`[Webhook] Reward redemption: ${json.event.reward.title} by ${userName}`);

    const { data: streamer, error: sErr } = await supabase
      .from('streamers')
      .select('*')
      .eq('twitch_id', broadcasterId)
      .maybeSingle();

    if (sErr || !streamer) {
      console.error(`[Webhook] Streamer not found for broadcaster_id: ${broadcasterId}`);
      return new Response('Streamer not found', { status: 200 });
    }

    // 1. Grant Random Card
    if (redeemedRewardId === streamer.twitch_reward_id) {
      console.log(`[Webhook] Granting card for ${userName} in ${streamer.username}'s stream`);
      await grantRandomCard(supabase, userId, userName, streamer.id, `🏰 Redemption: ${json.event.reward.title}!`, env);
    }

    // 2. Battle Initiation
    if (streamer.twitch_battle_reward_id && redeemedRewardId === streamer.twitch_battle_reward_id) {
      console.log(`[Webhook] Battle redemption by ${userName}`);
      const userInput = json.event.user_input || '';
      const targetUser = userInput.replace('@', '').trim();

      if (targetUser) {
        // Trigger battle logic
        console.log(`[Webhook] Battle: ${userName} vs ${targetUser}`);
        // Here we would ideally trigger the battle initiation logic
      }
    }
  }

  return new Response('OK', { status: 200 });
}

// --- BATTLE SYSTEM HELPERS ---

/**
 * Assigns a weighted-random mechanic to a card at grant time.
 * Uses reservoir sampling: ORDER BY -log(random()) / rarity_weight.
 * Returns the mechanic UUID or null if the table is empty.
 */
async function assignMechanic(supabase: any): Promise<string | null> {
  try {
    const { data: mechanics } = await supabase
      .from('mechanics')
      .select('id, rarity_weight')
      .eq('is_active', true);

    if (!mechanics || mechanics.length === 0) return null;

    // Weighted random using Efraimidis-Spirakis reservoir sampling.
    // Key = random() ^ (1 / weight). Higher weight → key closer to 1.0 → wins more often.
    // Guard=32 & Vampire=32 & Reanimate=33 each win ~32%. Mimic=3 wins ~3%.
    let best: any = null;
    let bestScore = -Infinity;
    for (const m of mechanics) {
      const score = Math.random() ** (1.0 / Math.max(m.rarity_weight || 1, 1));
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best?.id ?? null;
  } catch (e: any) {
    console.error('[assignMechanic] Error:', e.message);
    return null;
  }
}

/**
 * Generates battle stats based on rarity budget.
 */
function generateCardStats(rarity: string) {
  const STAT_BUDGET: Record<string, number> = {
    Common: 5, Uncommon: 7, Rare: 9, Epic: 11, Legendary: 15,
  };
  const budget = STAT_BUDGET[rarity] ?? 5;
  const attack = Math.max(1, Math.floor(Math.random() * (budget - 1)) + 1);
  const defense = budget - attack;
  return { attack, defense, max_hp: defense };
}

/**
 * Pure battle engine. Takes two arrays of 3 card-state objects and simulates
 * the full battle, returning the battle_data payload for arena.js.
 *
 * Card state shape (input):
 *   { id, name, image_url, mechanic, attack, defense, max_hp }
 *
 * Returns battle_data conforming to the arena.js expected format.
 */
function runBattleEngine(
  challenger: { name: string; avatar: string; twitch_id: string },
  target: { name: string; avatar: string; twitch_id: string },
  challengerDeck: any[],
  targetDeck: any[]
): any {
  // Single round battle
  const roundResult = simulateMatchRound(1, challenger, target, challengerDeck, targetDeck);
  const matchRounds = [roundResult];

  const finalWinner = roundResult.winner; // challenger, target, or draw

  return {
    challenger: { name: challenger.name, avatar: challenger.avatar, twitch_id: challenger.twitch_id, matchWins: finalWinner === 'challenger' ? 1 : 0 },
    target: { name: target.name, avatar: target.avatar, twitch_id: target.twitch_id, matchWins: finalWinner === 'target' ? 1 : 0 },
    winner: finalWinner,
    winnerId: finalWinner === 'challenger' ? challenger.twitch_id : (finalWinner === 'target' ? target.twitch_id : null),
    initialChallengerDeck: challengerDeck,
    initialTargetDeck: targetDeck,
    matchRounds,
    rounds: roundResult.exchanges
  };
}


/**
 * Simulates a single 3v3 round.
 */
function simulateMatchRound(roundNum: number, challenger: any, target: any, cDeck: any[], tDeck: any[]) {
  const mkState = (card: any, slot: number) => {
    const traits = [];
    if (card.mechanic_name) traits.push({ name: card.mechanic_name, icon: card.mechanic_icon });
    if (card.genesis_mechanic_name) traits.push({ name: card.genesis_mechanic_name, icon: card.genesis_mechanic_icon });
    
    return {
      id: card.id,
      name: card.name,
      image_url: card.image_url || '',
      traits,
      base_attack: card.attack || 0,
      base_defense: card.defense || 0,
      attack: card.attack || 0,
      defense: card.defense || 0,
      max_defense: card.defense || 0,
      slot, // 1=Left, 2=Middle, 3=Right
      alive: true,
      reviveUsed: false,
    };
  };

  const cCards = cDeck.map((c, i) => mkState(c, i + 1));
  const tCards = tDeck.map((c, i) => mkState(c, i + 1));

  const recalculateMimics = (cards: any[], eventLog: any[], sideLabel: string) => {
    cards.forEach(card => {
      const hasMimic = card.traits.some((t: any) => t.name === 'mimic');
      if (hasMimic && card.alive) {
        const left = cards.find(c => c.slot === card.slot - 1 && c.alive);
        const right = cards.find(c => c.slot === card.slot + 1 && c.alive);
        let triggered = false;
        if (left && (card.attack !== left.attack || card.defense !== left.defense)) {
          card.attack = left.attack;
          card.defense = left.defense;
          triggered = true;
        }
        if (right && right.traits.length > 0) {
          // Rule: Gains Mechanic from Slot 3 (Right)
          // We'll append the right slot's first trait if not already present
          const newTrait = right.traits[0];
          if (!card.traits.some((t: any) => t.name === newTrait.name)) {
             // In dual trait context, mimic keeps 'mimic' but adds the target trait
             card.traits.push({ ...newTrait });
             triggered = true;
          }
        }
        if (triggered && typeof eventLog !== 'undefined' && eventLog) {
          eventLog.push({
            type: 'mimic_trigger',
            side: sideLabel,
            card: card.name,
            slot: card.slot,
            attack: card.attack,
            defense: card.defense,
            mechanic: card.traits.map((t: any) => t.name).join(', ')
          });
        }
      }
    });
  };

  recalculateMimics(cCards, [], 'challenger');
  recalculateMimics(tCards, [], 'target');

  const exchanges: any[] = [];
  const coinFlip = Math.random() > 0.5 ? 'challenger' : 'target'; // Rule 1: Coin Flip
  let attackerSide = coinFlip;
  const MAX_EXCHANGES = 50;
  let exchangeCount = 0;

  while (cCards.some(c => c.alive) && tCards.some(c => c.alive) && exchangeCount < MAX_EXCHANGES) {
    exchangeCount++;

    // 1. Determine Attacker and Defender
    const attackers = attackerSide === 'challenger' ? cCards : tCards;
    const defenders = attackerSide === 'challenger' ? tCards : cCards;

    // Rule 2 & 7: "If no card exists on the side (no living cards), combat ends"
    const activeAttacker = attackers.find(c => c.alive); // Leftmost living
    if (!activeAttacker) break;

    // Rule 2: Targeting
    let activeDefender = defenders.find((c: any) => c.alive && c.traits.some((t: any) => t.name === 'guard')); // Leftmost Guard
    if (!activeDefender) activeDefender = defenders.find(c => c.alive); // Leftmost living

    if (!activeDefender) break;

    const exchangeData: any = {
      exchange: exchangeCount,
      side: attackerSide,
      challengerCard: null,
      targetCard: null,
      events: []
    };

    const cActive = attackers === cCards ? activeAttacker : activeDefender;
    const tActive = attackers === tCards ? activeAttacker : activeDefender;

    // Snapshot after damage
    const snapshot = (c: any) => ({
      ...c,
      current_hp: c.defense,
      max_hp: c.max_defense || c.base_defense,
      // Compatibility for legacy arena.js
      mechanic_name: c.traits.length > 0 ? c.traits[0].name : null,
      mechanic_icon: c.traits.length > 0 ? c.traits[0].icon : '',
    });

    exchangeData.challengerCard = snapshot(cActive);
    exchangeData.targetCard = snapshot(tActive);

    // Rule 3: Simultaneous Damage Exchange
    const atkDmg = activeAttacker.attack;
    const defDmg = activeDefender.attack;

    console.log(`[BATTLE EX] #${exchangeCount}: ${attackerSide === 'challenger' ? 'Challenger' : 'Target'} Attacking!`);
    console.log(`[BATTLE ATK] ${activeAttacker.name} (ATK: ${atkDmg}) -> ${activeDefender.name} (DEF: ${activeDefender.defense})`);
    console.log(`[BATTLE DEF] ${activeDefender.name} (ATK: ${defDmg}) -> ${activeAttacker.name} (DEF: ${activeAttacker.defense})`);

    activeDefender.defense -= atkDmg;
    activeAttacker.defense -= defDmg;

    console.log(`[BATTLE RESULT] ${activeDefender.name} now has ${Math.max(0, activeDefender.defense)} DEF`);
    console.log(`[BATTLE RESULT] ${activeAttacker.name} now has ${Math.max(0, activeAttacker.defense)} DEF`);

    exchangeData.challengerCard = snapshot(cActive);
    exchangeData.targetCard = snapshot(tActive);

    // Rule 4: Death Check Phase
    const processDeaths = (cards: any[], sideLabel: string) => {
      cards.forEach(card => {
        if (card.alive && card.defense <= 0) {
          // 4.1 Reanimate
          if (card.traits.some((t: any) => t.name === 'reanimate') && !card.reviveUsed) {
            card.defense = 1;
            card.reviveUsed = true;
            exchangeData.events.push({ type: 'reanimate', card: card.name, side: sideLabel });
          } else {
            // 4.2 Final Death
            card.defense = 0;
            card.alive = false;
            exchangeData.events.push({ type: 'death', card: card.name, side: sideLabel });
          }
        }
      });
    };

    const attackerLabel = attackerSide === 'challenger' ? 'attacker' : 'defender';
    const defenderLabel = attackerSide === 'challenger' ? 'defender' : 'attacker';

    processDeaths(attackers, attackerLabel);
    processDeaths(defenders, defenderLabel);

    // Rule 5: On-Kill Effects (Vampire)
    const handleVampire = (killer: any, victim: any, side: string) => {
      if (killer.alive && !victim.alive && killer.traits.some((t: any) => t.name === 'vampire')) {
        const heal = Math.floor(victim.max_defense * 0.30); // Rule says X%, using 30% as default
        const oldDef = killer.defense;
        killer.defense = Math.min(killer.base_defense, killer.defense + heal);
        const actualHeal = killer.defense - oldDef;
        if (actualHeal > 0) {
          exchangeData.events.push({ type: 'vampire_heal', amount: actualHeal, card: killer.name, side });
        }
      }
    };

    handleVampire(activeAttacker, activeDefender, attackerLabel);
    handleVampire(activeDefender, activeAttacker, defenderLabel);

    // Rule 6: Passive Recalculation (Mimic)
    recalculateMimics(cCards, exchangeData.events, 'challenger');
    recalculateMimics(tCards, exchangeData.events, 'target');

    // Final snapshots for round results
    exchangeData.challengerCardAfter = snapshot(cActive);
    exchangeData.targetCardAfter = snapshot(tActive);
    exchangeData.challengerSurvived = cActive.alive;
    exchangeData.targetSurvived = tActive.alive;

    exchanges.push(exchangeData);

    // Rule 7: Turn Alternation
    attackerSide = attackerSide === 'challenger' ? 'target' : 'challenger';
  }

  const cAlive = cCards.filter(c => c.alive).length;
  const tAlive = tCards.filter(c => c.alive).length;

  return {
    round: roundNum,
    firstAttacker: coinFlip, // Who won the coin flip this round
    winner: cAlive > tAlive ? 'challenger' : (tAlive > cAlive ? 'target' : 'draw'),
    exchanges
  };
}


async function grantRandomCard(supabase: any, userId: string, userName: string, creatorId: string, customMessage?: string | null, env?: Env, options: { forcedCardId?: string, forcedRarity?: string, isSilent?: boolean } = {}) {
  try {
    const { forcedCardId, forcedRarity, isSilent } = options;
    const now = new Date().toISOString();
    
    let randomCard: any = null;
    let selectedRarity = 'Common';

    if (forcedCardId) {
      const { data: c, error: cErr } = await supabase.from('cards').select('*').eq('id', forcedCardId).single();
      if (cErr || !c) throw new Error('Forced card not found');
      randomCard = c;
      selectedRarity = c.rarity;
    } else {
      let rarityWeights = null;
      
      if (forcedRarity) {
        selectedRarity = forcedRarity.charAt(0).toUpperCase() + forcedRarity.slice(1);
      } else {
        // 1. Check for active special events (highest priority)
        const { data: activeEvent } = await supabase
          .from('streamer_events')
          .select('config')
          .eq('streamer_id', creatorId)
          .eq('is_active', true)
          .lte('starts_at', now)
          .gte('ends_at', now)
          .maybeSingle();

        rarityWeights = activeEvent?.config;

        // 2. Fallback to per-streamer override
        if (!rarityWeights) {
          const { data: customConfig } = await supabase
            .from('streamer_rarity_configs')
            .select('common_weight, rare_weight, epic_weight, legendary_weight')
            .eq('streamer_id', creatorId)
            .maybeSingle();
          
          if (customConfig) {
            rarityWeights = {
              common: customConfig.common_weight,
              rare: customConfig.rare_weight,
              epic: customConfig.epic_weight,
              legendary: customConfig.legendary_weight
            };
          }
        }

        // 3. Fallback to global matrix config
        if (!rarityWeights) {
          const { data: configData } = await supabase.from('system_config').select('*');
          rarityWeights = configData?.find((c: any) => c.id === 'rarity_weights')?.data || { common: 70, rare: 20, epic: 8, legendary: 2 };
        }

        const roll = Math.random() * 100;
        let cumulative = 0;
        for (const r of ['common', 'rare', 'epic', 'legendary']) {
          cumulative += rarityWeights[r] || 0;
          if (roll <= cumulative) { selectedRarity = r.charAt(0).toUpperCase() + r.slice(1); break; }
        }
      }

      const { data: pool } = await supabase.from('cards').select('*').eq('rarity', selectedRarity).eq('streamer_id', creatorId);
      if (!pool || pool.length === 0) {
        // If we forced a rarity that doesn't exist, we fallback
        if (forcedRarity) {
           // If forced rarity has no cards, fallback to ANY card from streamer
           const { data: anyPool } = await supabase.from('cards').select('*').eq('streamer_id', creatorId).limit(1);
           if (!anyPool || anyPool.length === 0) throw new Error('No cards available for this streamer');
           randomCard = anyPool[0];
        } else {
           if (selectedRarity !== 'Common') return grantRandomCard(supabase, userId, userName, creatorId, customMessage, env, options);
           return;
        }
      } else {
        randomCard = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    
    const { data: user } = await supabase.from('users').select('is_linked').eq('twitch_id', userId).maybeSingle();

    if (user?.is_linked) {
      // Genesis Trait System (1% chance for dual traits)
      const isGenesis = Math.random() < 0.01;
      const primaryMechanicId = await assignMechanic(supabase);
      let secondaryMechanicId = null;

      if (isGenesis) {
        // Roll for a second distinct mechanic
        let retries = 0;
        while (retries < 5) {
          secondaryMechanicId = await assignMechanic(supabase);
          if (secondaryMechanicId !== primaryMechanicId) break;
          retries++;
        }
      }

      await supabase.from('user_cards').insert({
        twitch_id: userId,
        card_id: randomCard.id,
        streamer_id: creatorId,
        granted_by_streamer: creatorId,
        is_obs_consumed: isSilent || false,
        attack: randomCard.attack,
        defense: randomCard.defense,
        max_hp: randomCard.defense,
        mechanic_id: isGenesis ? secondaryMechanicId : primaryMechanicId,
        genesis_mechanic_id: isGenesis ? primaryMechanicId : null,
      });

      const notificationMsg = isGenesis 
        ? `🌌 GENESIS CARD! ${customMessage || `You got a dual-trait card: ${randomCard.name}!`}`
        : customMessage || `🏰 You got a new card: ${randomCard.name}!`;

      await supabase.from('notifications').insert({ 
        twitch_id: userId, 
        streamer_id: creatorId, 
        type: 'card_drop', 
        message: notificationMsg, 
        data: { 
          card_id: randomCard.id, 
          name: randomCard.name, 
          rarity: randomCard.rarity, 
          image_url: randomCard.image_url,
          is_genesis: isGenesis
        } 
      });
      await checkAndUnlockAchievements(supabase, userId, randomCard, creatorId);
    } else {
      await supabase.from('pending_rewards').insert({ 
        twitch_id: userId, 
        card_id: randomCard.id, 
        streamer_id: creatorId,
        is_obs_consumed: isSilent || false
      });
    }
    if (!user) await supabase.from('users').upsert({ twitch_id: userId, username: userName, is_linked: false }, { onConflict: 'twitch_id' });
  } catch (e: any) { console.error('[Grant] Error:', e.message); }
}

async function sendBotNotification(env: Env, streamer: any, message: string) {
  if (!streamer.streamelements_jwt || !streamer.streamelements_id) return { success: false };
  try {
    const res = await fetch(`https://api.streamelements.com/kappa/v2/bot/${streamer.streamelements_id}/say`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${streamer.streamelements_jwt}` },
      body: JSON.stringify({ message, channel: streamer.streamelements_id })
    });
    return { success: res.ok };
  } catch (err) { return { success: false }; }
}


// Security Response Helper
function secureResponse(data: any, status: number, corsHeaders: any, isError: boolean = false): Response {
  const securityHeaders = {
    ...corsHeaders,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob:;",
    'Content-Type': 'application/json'
  };

  const payload = isError ? { error: data } : data;
  return new Response(JSON.stringify(payload), { status, headers: securityHeaders });
}

// Pretty HTML Error Helper
function failHtmlResponse(title: string, message: string, status: number = 500): Response {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title} | Castle TCG</title>
      <style>
        body { background: #050706; color: #fcfaf7; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 3rem; border-radius: 2rem; max-width: 500px; text-align: center; backdrop-filter: blur(20px); }
        h1 { font-size: 3rem; margin: 0 0 1rem; color: #00f2fe; italic: true; }
        p { color: #4a5568; line-height: 1.6; }
        .btn { display: inline-block; margin-top: 2rem; padding: 1rem 2rem; background: #00f2fe; color: #050706; text-decoration: none; border-radius: 1rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Return to Matrix</a>
      </div>
    </body>
    </html>
  `, {
    status,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function logSystem(supabase: any, level: 'info' | 'warn' | 'error', category: 'webhook' | 'grant' | 'admin' | 'auth' | 'system' | 'trade', message: string, streamerId?: string, metadata: any = {}) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${category.toUpperCase()}] [${level.toUpperCase()}]`;
  const streamerInfo = streamerId ? ` [${streamerId}]` : '';
  
  console.log(`${logPrefix}${streamerInfo} ${message}`, Object.keys(metadata).length ? metadata : '');
}

// Rate limiting - in-memory store (resets on worker restart, but that's fine for basic protection)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit: number = 60): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false; // Rate limited
  }

  record.count++;
  return true;
}

// Achievement check function
async function checkAndUnlockAchievements(supabase: any, twitchId: string, card: any, streamerId: string) {
  try {
    console.log('[Achievements] ========== CHECKING ACHIEVEMENTS ==========');
    console.log('[Achievements] User:', twitchId);
    console.log('[Achievements] Streamer:', streamerId);
    console.log('[Achievements] Card:', card.id, card.name, card.rarity);

    // Get user's card count for THIS streamer
    const { count: cardCount, error: countError } = await supabase
      .from('user_cards')
      .select('*', { count: 'exact', head: true })
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    if (countError) {
      console.error('[Achievements] Error getting card count:', countError);
      return;
    }

    console.log('[Achievements] Total cards owned:', cardCount);

    // Get already unlocked achievements for THIS streamer
    const { data: unlocked, error: unlockedError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    if (unlockedError) {
      console.error('[Achievements] Error getting unlocked achievements:', unlockedError);
      return;
    }

    const unlockedIds = new Set(unlocked?.map((a: any) => a.achievement_id) || []);
    console.log('[Achievements] Already unlocked:', Array.from(unlockedIds).join(', ') || 'none');

    const toUnlock: string[] = [];

    // First card achievement
    if (cardCount === 1 && !unlockedIds.has('first_card')) {
      toUnlock.push('first_card');
      console.log('[Achievements] ✓ Qualifies for: first_card');
    }

    // Collector milestones
    if (cardCount >= 10 && !unlockedIds.has('collector_10')) {
      toUnlock.push('collector_10');
      console.log('[Achievements] ✓ Qualifies for: collector_10');
    }
    if (cardCount >= 50 && !unlockedIds.has('collector_50')) {
      toUnlock.push('collector_50');
      console.log('[Achievements] ✓ Qualifies for: collector_50');
    }

    // Rarity-based achievements
    const rarity = card.rarity?.toLowerCase();
    console.log('[Achievements] Card rarity (lowercase):', rarity);

    if (rarity === 'rare' && !unlockedIds.has('rare_finder')) {
      toUnlock.push('rare_finder');
      console.log('[Achievements] ✓ Qualifies for: rare_finder');
    }
    if (rarity === 'epic' && !unlockedIds.has('epic_moment')) {
      toUnlock.push('epic_moment');
      console.log('[Achievements] ✓ Qualifies for: epic_moment');
    }
    if (rarity === 'legendary' && !unlockedIds.has('legendary_luck')) {
      toUnlock.push('legendary_luck');
      console.log('[Achievements] ✓ Qualifies for: legendary_luck');
    }

    // Completionist achievement - check if user has all cards for THIS streamer
    const { count: totalCards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('streamer_id', streamerId);

    const { count: uniqueCardsOwned } = await supabase
      .from('user_cards')
      .select('card_id', { count: 'exact', head: true })
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    console.log('[Achievements] Unique cards owned:', uniqueCardsOwned, '/', totalCards);

    if (uniqueCardsOwned >= totalCards && !unlockedIds.has('completionist')) {
      toUnlock.push('completionist');
      console.log('[Achievements] ✓ Qualifies for: completionist (ALL CARDS COLLECTED!)');
    }

    // NEW: Set Collector achievement - collected cards from 2+ different sets
    if (!unlockedIds.has('set_collector')) {
      const { data: setCounts } = await supabase
        .from('enriched_user_cards')
        .select('set_id')
        .eq('twitch_id', twitchId)
        .eq('streamer_id', streamerId);

      const distinctSets = new Set(setCounts?.map((c: any) => c.set_id).filter(Boolean) || []);
      console.log('[Achievements] Distinct sets owned:', distinctSets.size);

      if (distinctSets.size >= 2) {
        toUnlock.push('set_collector');
        console.log('[Achievements] ✓ Qualifies for: set_collector');
      }
    }

    // NEW: Rarity Streak achievement - last 3 cards pulled were Rare or higher
    if (!unlockedIds.has('rarity_streak_3')) {
      const { data: lastPulls } = await supabase
        .from('enriched_user_cards')
        .select('rarity')
        .eq('twitch_id', twitchId)
        .eq('streamer_id', streamerId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (lastPulls && lastPulls.length === 3) {
        const streakStats = lastPulls.every((p: any) => {
          const r = p.rarity?.toLowerCase();
          return r === 'rare' || r === 'epic' || r === 'legendary';
        });

        if (streakStats) {
          toUnlock.push('rarity_streak_3');
          console.log('[Achievements] ✓ Qualifies for: rarity_streak_3 (HOT STREAK!)');
        }
      }
    }

    // Insert new achievements
    if (toUnlock.length > 0) {
      console.log('[Achievements] Unlocking:', toUnlock.join(', '));
      const inserts = toUnlock.map(id => ({
        twitch_id: twitchId,
        achievement_id: id,
        streamer_id: streamerId
      }));
      const { error: insertError } = await supabase.from('user_achievements').insert(inserts);

      if (insertError) {
        console.error('[Achievements] ❌ Error inserting achievements:', insertError);
      } else {
        console.log('[Achievements] ✅ Successfully unlocked:', toUnlock.join(', '));

        // Create notifications for each unlocked achievement
        const notifications = toUnlock.map(id => ({
          twitch_id: twitchId,
          streamer_id: streamerId,
          type: 'achievement_unlock',
          message: `🏆 Achievement Unlocked: ${id.replace(/_/g, ' ').toUpperCase()}!`,
          data: { achievement_id: id }
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } else {
      console.log('[Achievements] No new achievements to unlock');
    }

    console.log('[Achievements] ==========================================');
  } catch (e: any) {
    console.error('[Achievements] ❌ CRITICAL ERROR:', e);
  }
}

async function syncUserAchievements(supabase: any, twitchId: string, streamerId: string) {
  try {
    console.log(`[Achievements] Starting full sync for user ${twitchId} on streamer ${streamerId}`);

    // 1. Get ALL user cards for this streamer
    const { data: userCards, error: cardsError } = await supabase
      .from('user_cards')
      .select('card_id, attack, defense, cards(rarity, set_id)')
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    if (cardsError || !userCards) {
      console.error('[Achievements] Sync failed: error fetching cards', cardsError);
      return { success: false, error: 'Failed to fetch cards' };
    }

    const cardCount = userCards.length;
    if (cardCount === 0) return { success: true, count: 0 };

    // 2. Get already unlocked
    const { data: unlocked } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    const unlockedIds = new Set(unlocked?.map((a: any) => a.achievement_id) || []);
    const toUnlock: string[] = [];

    // --- CHECK CRITERIA ---

    // Milestones
    if (cardCount >= 1 && !unlockedIds.has('first_card')) toUnlock.push('first_card');
    if (cardCount >= 10 && !unlockedIds.has('collector_10')) toUnlock.push('collector_10');
    if (cardCount >= 50 && !unlockedIds.has('collector_50')) toUnlock.push('collector_50');

    // Rarity Checks (optimized scan)
    const rarities = new Set(userCards.map((c: any) => c.cards?.rarity?.toLowerCase()));
    if (rarities.has('rare') && !unlockedIds.has('rare_finder')) toUnlock.push('rare_finder');
    if (rarities.has('epic') && !unlockedIds.has('epic_moment')) toUnlock.push('epic_moment');
    if (rarities.has('legendary') && !unlockedIds.has('legendary_luck')) toUnlock.push('legendary_luck');

    // Distinct Sets
    if (!unlockedIds.has('set_collector')) {
      const distinctSets = new Set(userCards.map((c: any) => c.cards?.set_id).filter(Boolean));
      if (distinctSets.size >= 2) toUnlock.push('set_collector');
    }

    // Completionist
    if (!unlockedIds.has('completionist')) {
      const { count: totalCardsInPool } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamerId);
      const uniqueOwned = new Set(userCards.map((c: any) => c.card_id)).size;
      if (uniqueOwned >= (totalCardsInPool || 999)) toUnlock.push('completionist');
    }

    // Rarity Streak - hardest to backfill perfectly but we check the last 3 most recent
    if (!unlockedIds.has('rarity_streak_3')) {
      const { data: last3 } = await supabase
        .from('user_cards')
        .select('cards(rarity)')
        .eq('twitch_id', twitchId)
        .eq('streamer_id', streamerId)
        .order('created_at', { ascending: false })
        .limit(3);
      if (last3?.length === 3 && last3.every((c: any) => ['rare', 'epic', 'legendary'].includes(c.cards?.rarity?.toLowerCase()))) {
        toUnlock.push('rarity_streak_3');
      }
    }

    if (toUnlock.length > 0) {
      console.log(`[Achievements] Sync unlocking ${toUnlock.length} items for ${twitchId}`);
      const inserts = toUnlock.map(id => ({
        twitch_id: twitchId,
        achievement_id: id,
        streamer_id: streamerId
      }));
      await supabase.from('user_achievements').insert(inserts);

      // Batch notifications
      const notifications = toUnlock.map(id => ({
        twitch_id: twitchId,
        streamer_id: streamerId,
        type: 'achievement_unlock',
        message: `🏆 Retroactive Unlock: ${id.replace(/_/g, ' ').toUpperCase()}!`,
        data: { achievement_id: id, is_retro: true }
      }));
      await supabase.from('notifications').insert(notifications);
    }

    return { success: true, unlocked: toUnlock };
  } catch (e) {
    console.error('[Achievements] Sync exception:', e);
    return { success: false, error: 'Exception during sync' };
  }
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/$/, '') || '/';
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const origin = request.headers.get('Origin') || '';
    const domainMatch = env.FRONTEND_URL ? new URL(env.FRONTEND_URL).hostname.replace('www.', '') : '';

    const isAllowedOrigin = origin === env.FRONTEND_URL ||
      (domainMatch && origin.includes(domainMatch)) ||
      origin === 'http://localhost:8787' ||
      origin === 'http://localhost:3000' ||
      origin.endsWith('.workers.dev');

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : env.FRONTEND_URL,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Twitch-ID, X-CSRF-Token',
    };

    // Metadata Endpoint
    if (method === 'GET' && path === '/api/mechanics') {
      const { data, error } = await supabase.from('mechanics').select('*');
      if (error) return secureResponse('Failed to fetch mechanics', 500, corsHeaders, true);
      return secureResponse(data, 200, corsHeaders);
    }

    try {
      // --- MIDDLEWARE HELPERS ---

      async function checkAdmin(req: Request) {
        const cookie = req.headers.get('Cookie');
        const token = cookie?.match(/admin_session=([^;]+)/)?.[1];

        if (!token) {
          throw new Error("Unauthorized: Session missing");
        }

        try {
          await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET));
          return; // Valid session
        } catch (e: any) {
          throw new Error("Unauthorized: Invalid session");
        }
      }

      async function checkCreator(req: Request, sbase: any) {
        const u = await getUserFromSession(req, env, sbase);
        if (!u) throw new Error("Unauthorized");

        console.log('[checkCreator] Checking for creator with twitch_id:', u.twitch_id);

        let { data: s, error: streamerError } = await sbase
          .from('streamers')
          .select('*, obs_overlay_token')
          .eq('twitch_id', u.twitch_id)
          .maybeSingle();

        if (streamerError) {
          console.error('[checkCreator] Database error:', streamerError);
          throw new Error("Database error: " + streamerError.message);
        }

        if (!s) {
          console.log('[checkCreator] No streamer found, auto-onboarding user:', u.username);
          try {
            const { data: newStreamer, error: onboardErr } = await sbase
              .from('streamers')
              .insert({
                twitch_id: u.twitch_id,
                username: u.username.toLowerCase(),
                display_name: u.username,
                brand_name: u.username || 'My Collection',
                avatar_url: u.avatar_url,
                is_active: false
              })
              .select('*, obs_overlay_token')
              .single();

            if (onboardErr) {
              if (onboardErr.code === '23505' || onboardErr.message?.includes('duplicate')) {
                const { data: existing } = await sbase
                  .from('streamers')
                  .select('*, obs_overlay_token')
                  .eq('twitch_id', u.twitch_id)
                  .maybeSingle();
                if (existing) s = existing;
                else throw new Error("Failed to auto-onboard: " + onboardErr.message);
              } else {
                throw new Error("Failed to auto-onboard: " + onboardErr.message);
              }
            } else if (newStreamer) {
              s = newStreamer;
            }
          } catch (onboardException: any) {
            throw new Error("Not a registered creator. Auto-onboard failed: " + (onboardException.message || 'Unknown error'));
          }
        }

        if (!s) throw new Error("Not a registered creator");
        return { user: u, streamer: s };
      }


      // GLOBAL LOGGER
      console.log(`[Request] ${method} ${url.pathname}`);
      console.log(`[CORS] Origin: ${origin || 'none'}, Allowed: ${isAllowedOrigin}, Final: ${corsHeaders['Access-Control-Allow-Origin']}`);
      const cookieHeader = request.headers.get('Cookie') || '';
      console.log(`[Cookies] ${cookieHeader ? 'Header present (' + cookieHeader.split(';').length + ' items)' : 'Header missing'}`);

      if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

      // --- ASSETS & SPA ROUTING ---
      // OBS Overlay Route (before asset serving)
      if (method === 'GET' && path === '/obs-overlay') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam = url.searchParams.get('token');

        if (!streamerParam || !tokenParam) {
          return new Response('Missing streamer or token parameter', {
            status: 400,
            headers: { 'Content-Type': 'text/html' }
          });
        }

        // Verify token matches streamer
        // Try case-insensitive search first (most reliable)
        console.log('[OBS Overlay] Looking for streamer:', streamerParam);

        let { data: streamerData, error: streamerError } = await supabase
          .from('streamers')
          .select('id, username, obs_overlay_token')
          .ilike('username', streamerParam)
          .maybeSingle();

        // If not found with ilike, try exact lowercase match
        if (!streamerData) {
          console.log('[OBS Overlay] Not found with ilike, trying lowercase:', streamerParam.toLowerCase());
          const { data: lowerData, error: lowerError } = await supabase
            .from('streamers')
            .select('id, username, obs_overlay_token')
            .eq('username', streamerParam.toLowerCase())
            .maybeSingle();

          if (lowerData) {
            streamerData = lowerData;
            streamerError = lowerError;
          }
        }

        // If still not found, try exact match
        if (!streamerData) {
          console.log('[OBS Overlay] Not found with lowercase, trying exact match');
          const { data: exactData, error: exactError } = await supabase
            .from('streamers')
            .select('id, username, obs_overlay_token')
            .eq('username', streamerParam)
            .maybeSingle();

          if (exactData) {
            streamerData = exactData;
            streamerError = exactError;
          }
        }

        const streamer = streamerData;

        if (streamer) {
          console.log('[OBS Overlay] Found streamer:', streamer.username, 'ID:', streamer.id);
        } else {
          console.error('[OBS Overlay] Streamer not found after all attempts. Searched for:', streamerParam);
        }

        if (streamerError) {
          console.error('[OBS Overlay] Database error:', streamerError);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Database Error</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>⚠️ Database Error</h1>
              <p>Error: ${streamerError.message}</p>
              <p>Code: ${streamerError.code || 'unknown'}</p>
            </body>
          </html>
        `, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
          });
        }

        if (!streamer) {
          console.error('[OBS Overlay] Streamer not found:', streamerParam);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Streamer Not Found</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>⛔ Streamer Not Found</h1>
              <p>Streamer "${streamerParam}" not found in database.</p>
            </body>
          </html>
        `, {
            status: 404,
            headers: { 'Content-Type': 'text/html' }
          });
        }

        // Trim tokens to handle any whitespace issues
        const storedToken = (streamer.obs_overlay_token || '').trim();
        const providedToken = (tokenParam || '').trim();

        console.log('[OBS Overlay] Streamer:', streamer.username);
        console.log('[OBS Overlay] Stored token exists:', !!storedToken);
        console.log('[OBS Overlay] Stored token (first 8):', storedToken.substring(0, 8));
        console.log('[OBS Overlay] Provided token (first 8):', providedToken.substring(0, 8));
        console.log('[OBS Overlay] Tokens match:', storedToken === providedToken);

        if (!storedToken || storedToken !== providedToken) {
          console.error('[OBS Overlay] Token mismatch!');
          console.error('[OBS Overlay] Stored token length:', storedToken.length);
          console.error('[OBS Overlay] Provided token length:', providedToken.length);
          return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Access Denied</title></head>
            <body style="background:rgba(0,0,0,.9);color:white;padding:24px;font-family:sans-serif">
              <h1>⛔ Access Denied</h1>
              <p>Invalid token. Please regenerate your overlay URL from the creator dashboard.</p>
              <p style="font-size:12px;color:#888;margin-top:20px;">
                Debug: Streamer found: ${!!streamer}, Token exists: ${!!storedToken}, Token length: ${storedToken.length}
              </p>
            </body>
          </html>
        `, {
            status: 403,
            headers: { 'Content-Type': 'text/html' }
          });
        }

        // Serve obs.html
        try {
          const obsRes = await env.ASSETS?.fetch(new Request(`${url.origin}/obs.html`));
          if (obsRes && obsRes.ok) {
            return new Response(obsRes.body, {
              headers: {
                'Content-Type': 'text/html',
                ...corsHeaders
              }
            });
          }
        } catch (e) {
          console.error('[OBS Overlay] Error:', e);
        }

        return new Response('OBS overlay not found', { status: 404 });
      }

      // If NOT an API/Auth route, try serving from assets.
      // If asset not found and it's a GET, fallback to index.html (SPA routing).
      if (env.ASSETS && !path.startsWith('/api') && !path.startsWith('/auth') && path !== '/twitch/eventsub' && !path.startsWith('/api/obs') && path !== '/obs-overlay') {
        try {
          const assetRes = await env.ASSETS.fetch(request.clone());
          if (assetRes.status !== 404) return assetRes;

          if (method === 'GET') {
            const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
            if (indexRes.ok) return indexRes;
          }
        } catch (e) {
          console.error('[Assets] Error:', e);
        }
      }


      // Strict Environment Validation
      const requiredSecrets = [
        'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TWITCH_CLIENT_ID',
        'FRONTEND_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'
      ];
      const missing = requiredSecrets.filter(s => !(env as any)[s]);
      if (missing.length > 0) {
        return secureResponse(`Missing secrets: ${missing.join(', ')}`, 500, {}, true);
      }

      // Rate limiting
      const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
      const isAdminRoute = path.startsWith('/api/admin');
      const rateLimit = isAdminRoute ? 600 : 300;

      if (!checkRateLimit(clientIP, rateLimit)) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Retry-After': '60' }
        });
      }



      // Strict Environment Validation

      if (path === '/api/me') {
        console.log(`[Auth/Me] Request from: ${request.headers.get('Origin') || 'no-origin'}, Host: ${request.headers.get('Host')}`);

        try {
          const user = await getUserFromSession(request, env, supabase);

          if (!user) {
            console.warn(`[Auth/Me] Session invalid or user not found`);
            return secureResponse('Unauthorized', 401, corsHeaders, true);
          }

          // Check if user is a creator
          const { data: streamer } = await supabase.from('streamers').select('id').eq('twitch_id', user.twitch_id).maybeSingle();

          console.log(`[Auth/Me] Session verified for: ${user.username}`);
          return secureResponse({ ...user, is_creator: !!streamer }, 200, corsHeaders);
        } catch (e: any) {
          console.error(`[Auth/Me] Error: ${e.message}`);
          return secureResponse('Unauthorized', 401, corsHeaders, true);
        }
      }

      // Consolidatd Dashboard Bootstrap
      if (path === '/api/bootstrap') {
        try {
          const user = await getUserFromSession(request, env, supabase);

          const streamerParam = url.searchParams.get('streamer') || url.searchParams.get('streamer_id');
          const isGlobal = streamerParam === 'all';

          // Use a dummy "Hub" streamer if global view is requested
          const streamer = isGlobal
            ? { id: 'all', username: 'all', display_name: 'Creator Hub', brand_name: 'Global' }
            : await resolveStreamerContext(request, supabase, url);

          if (!streamer) {
            return secureResponse('Streamer context not found', 404, corsHeaders, true);
          }

          // Get creator record for logged-in user if exists
          let creatorRecord = null;
          if (user) {
            const { data } = await supabase.from('streamers').select('*').eq('twitch_id', user.twitch_id).maybeSingle();
            creatorRecord = data;
          }

          const fetchPromises: any[] = [];
          const targetTwitchId = user?.twitch_id;

          // 1. Stats (Total & Legendary)
          if (targetTwitchId) {
            let totalQuery = supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('twitch_id', targetTwitchId);
            let legendaryQuery = supabase.from('user_cards').select('*, cards!inner(rarity)', { count: 'exact', head: true }).eq('twitch_id', targetTwitchId);

            if (!isGlobal) {
              totalQuery = totalQuery.eq('streamer_id', streamer.id);
              legendaryQuery = legendaryQuery.eq('streamer_id', streamer.id);
            }

            // Check for both 'Legendary' and 'legendary' to be safe
            legendaryQuery = legendaryQuery.or('rarity.ilike.legendary', { foreignTable: 'cards' });

            fetchPromises.push(totalQuery);
            fetchPromises.push(legendaryQuery);
          } else {
            fetchPromises.push(Promise.resolve({ count: 0 }));
            fetchPromises.push(Promise.resolve({ count: 0 }));
          }

          // 2. Recent Drops (First 12)
          if (targetTwitchId) {
            let dropsQuery = supabase.from('enriched_user_cards').select('*').eq('twitch_id', targetTwitchId);
            if (!isGlobal) dropsQuery = dropsQuery.eq('streamer_id', streamer.id);
            fetchPromises.push(dropsQuery.order('created_at', { ascending: false }).limit(12));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }

          // 3. Binders
          if (targetTwitchId) {
            fetchPromises.push(supabase.from('user_binders').select('*').eq('user_id', targetTwitchId).order('sort_order', { ascending: true }));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }

          // 4. Achievements
          if (targetTwitchId) {
            let achQuery = supabase.from('user_achievements').select('achievement_id, achieved_at');
            if (!isGlobal) achQuery = achQuery.eq('streamer_id', streamer.id);
            fetchPromises.push(achQuery.eq('twitch_id', targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }

          // 5. Leaderboard (Direct from optimized view)
          let lbQuery = supabase.from('streamer_leaderboards').select('*');
          if (!isGlobal) lbQuery = lbQuery.eq('streamer_id', streamer.id);
          fetchPromises.push(lbQuery.order('total_cards', { ascending: false }).limit(100));

          // 6. Total Unique Cards Available
          let availQuery = supabase.from('cards').select('*', { count: 'exact', head: true });
          if (!isGlobal) availQuery = availQuery.eq('streamer_id', streamer.id);
          fetchPromises.push(availQuery);

          // 7. Creator Detail (If logged in user is a creator, get their cards/stats)
          if (creatorRecord) {
            fetchPromises.push(supabase.from('cards').select('*').eq('streamer_id', creatorRecord.id).order('created_at', { ascending: false }).limit(50));
            fetchPromises.push(supabase.from('streamer_leaderboards').select('*').eq('streamer_id', creatorRecord.id).maybeSingle());
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
            fetchPromises.push(Promise.resolve({ data: null }));
          }

          // 8. User Favorites
          if (targetTwitchId) {
            fetchPromises.push(supabase.from('user_favorites').select('streamer_id').eq('user_id', targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }

          // 9. Personal Connected Streamers (Streamers you have cards from)
          if (targetTwitchId) {
            fetchPromises.push(supabase.from('enriched_user_cards').select('streamer_id, brand_name, streamer_username, avatar_url, pack_image_url').eq('twitch_id', targetTwitchId));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }

          // 10. Global Active Streamers (For discovery)
          fetchPromises.push(supabase.from('streamers').select('id, username, display_name, avatar_url, brand_name, is_active').eq('is_active', true).limit(20));

          // 11. All Available Achievements
          fetchPromises.push(supabase.from('achievements').select('*'));

          const [
            statsTotalRes,
            statsLegendaryRes,
            recentDropsRes,
            bindersRes,
            achievementsRes,
            leaderboardRes,
            totalAvailRes,
            creatorCardsRes,
            creatorStatsRes,
            favoritesRes,
            personalConnectionsRes,
            activeStreamersRes,
            allAvailableAchievementsRes
          ] = await Promise.all(fetchPromises);

          const leaderboard = leaderboardRes.data || [];

          // Generate CSRF token for this session
          const csrfToken = crypto.randomUUID();
          const isHttps = request.url.startsWith('https');
          const secureFlag = isHttps ? '; Secure' : '';

          // 1. COLLECTED (Unique streamers from enriched_user_cards)
          const collectedMap = new Map();
          (personalConnectionsRes.data || []).forEach((c: any) => {
            if (!collectedMap.has(c.streamer_id)) {
              collectedMap.set(c.streamer_id, {
                id: c.streamer_id,
                username: c.streamer_username,
                display_name: c.brand_name || c.streamer_username,
                avatar_url: c.avatar_url,
                brand_name: c.brand_name,
                brand_logo_url: c.pack_image_url,
                is_active: true
              });
            }
          });

          // 2. FAVORITES
          const favoriteIds = new Set<string>((favoritesRes.data || []).map((f: any) => f.streamer_id));
          const favorites: any[] = [];

          // 3. FOLLOWED (Twitch API) - We'll attempt to fetch if user is logged in
          let followedStreamers: any[] = [];
          let debugFollowsCount = 0;
          let debugTokenValid = false;
          let debugFollowsRawIds = '';
          let debugAllStreamerIds = '';
          let debugAllStreamersDetail = '';
          let debugStreamersError = '';
          let debugMatchSource = 'none';
          let debugMatchDetails = '';

          // Fetch all streamers for matching (to bypass string/int or padding issues in .in() filter)
          const { data: allS, error: allStreamersErr } = await supabase
            .from('streamers')
            .select('id, username, display_name, avatar_url, brand_name, brand_tagline, binder_color, is_active, twitch_id');

          if (allStreamersErr) {
            debugStreamersError = `${allStreamersErr.code}: ${allStreamersErr.message}`;
            console.error('[Bootstrap/Twitch] streamers query failed:', allStreamersErr.message, allStreamersErr.code);
          }
          const allStreamersList = allS || [];
          debugAllStreamerIds = allStreamersList.map(s => s.twitch_id).join(',');
          debugAllStreamersDetail = allStreamersList.map(s => `${s.username}:${s.twitch_id ?? 'null'}`).slice(0, 20).join('; ');
          if (allStreamersList.length === 0) {
            console.warn('[Bootstrap/Twitch] No streamers in DB - cannot match follows. Run migrations?');
          }
          if (user && path === '/api/bootstrap') {
            // Get user's Twitch token from DB
            const { data: fullUser } = await supabase.from('users').select('twitch_access_token_encrypted').eq('twitch_id', user.twitch_id).single();
            if (fullUser?.twitch_access_token_encrypted) {
              // DECRYPT TOKEN
              let accessToken = '';
              try {
                accessToken = await decryptSensitive(fullUser.twitch_access_token_encrypted, env.SESSION_SECRET);
                debugTokenValid = true;
                console.log(`[Bootstrap/Twitch] Fetching follows for ${user.twitch_id}...`);
                const follows = await getTwitchFollows(user.twitch_id, accessToken, env.TWITCH_CLIENT_ID);
                debugFollowsCount = follows.length;

                if (follows.length > 0) {
                  const followTwitchIds = follows
                    .map((f: any) => String(f.broadcaster_id ?? '').replace(/\D/g, ''))
                    .filter((id: string) => id.length > 0);
                  const followLogins = (follows as any[]).map((f: any) => (f.broadcaster_login || '').toLowerCase()).filter(Boolean);
                  debugFollowsRawIds = followTwitchIds.join(',');

                  // 1) Match by twitch_id (normalize both sides: strip non-digits, trim)
                  const matchDebug: string[] = [];
                  followedStreamers = allStreamersList.filter(s => {
                    if (!s.twitch_id) return false;
                    const dbId = String(s.twitch_id).trim().replace(/\D/g, '');
                    const isMatch = followTwitchIds.includes(dbId);
                    matchDebug.push(`${s.username}:twitch_id=${s.twitch_id} dbId=${dbId} match=${isMatch}`);
                    return isMatch;
                  });

                  // 2) Fallback: match by Twitch username (broadcaster_login) so streamers in DB show up even if twitch_id missing or mismatched
                  const alreadyMatched = new Set(followedStreamers.map((s: any) => s.id));
                  for (const s of allStreamersList) {
                    if (alreadyMatched.has(s.id)) continue;
                    const login = (s.username || '').toLowerCase();
                    if (login && followLogins.includes(login)) {
                      followedStreamers.push(s);
                      alreadyMatched.add(s.id);
                      matchDebug.push(`${s.username}:by_login`);
                    }
                  }

                  debugMatchSource = followedStreamers.length > 0 ? 'js_match_success' : 'js_match_fail';
                  debugMatchDetails = matchDebug.slice(0, 8).join('; ');

                  console.log(`[Twitch Match] Twitch IDs: ${followTwitchIds.join(',')}; Logins: ${followLogins.slice(0, 5).join(',')}`);
                  console.log(`[Twitch Match] Platform Matches: ${followedStreamers.length}`);
                }
              } catch (tokenErr) {
                console.error('[Bootstrap/Twitch] Token handling or fetch failed:', tokenErr);
              }
            }
          }

          // Global Active / Discovery
          const discoveryStreamers = activeStreamersRes.data || [];

          // Map all streamers by ID for easy lookup
          const allStreamersMap = new Map();
          discoveryStreamers.forEach((s: any) => allStreamersMap.set(s.id, s));
          collectedMap.forEach((s: any, id: string) => allStreamersMap.set(id, s));
          followedStreamers.forEach((s: any) => allStreamersMap.set(s.id, s));

          // FETCH MISSING FAVORITES (If they aren't in discovery/collected/followed)
          const missingFavoriteIds = Array.from(favoriteIds).filter(id => !allStreamersMap.has(id));
          if (missingFavoriteIds.length > 0) {
            const { data: resolvedFavs } = await supabase
              .from('streamers')
              .select('id, username, display_name, avatar_url, brand_name, brand_tagline, binder_color, is_active')
              .in('id', missingFavoriteIds);

            if (resolvedFavs) {
              resolvedFavs.forEach((s: any) => {
                allStreamersMap.set(s.id, s);
              });
            }
          }

          // Populate favorites list from all matches
          favoriteIds.forEach((id: string) => {
            const s = allStreamersMap.get(id);
            if (s) favorites.push(s);
          });

          // Unique lists for each section
          const sections = {
            favorites: favorites,
            collected: Array.from(collectedMap.values()),
            followed: followedStreamers.filter((s: any) => !favoriteIds.has(s.id)), // Don't duplicate in followed if favorited
            discovery: discoveryStreamers.filter((s: any) => !favoriteIds.has(s.id) && !collectedMap.has(s.id))
          };

          console.log(`[DEBUG] Bootstrap for ${user?.username || 'Guest'}`);
          console.log(`[DEBUG]   Favorites: ${sections.favorites.length}`);
          console.log(`[DEBUG]   Collected: ${sections.collected.length}`);
          console.log(`[DEBUG]   Followed: ${sections.followed.length}`);
          console.log(`[DEBUG]   Discovery: ${sections.discovery.length}`);
          console.log(`[DEBUG]   CreatorRecord: ${creatorRecord ? 'YES' : 'NO'} (Active: ${creatorRecord?.is_active})`);

          // CRITICAL: Ensure self is included in discovery or favorites if creator (avoid duplicate if already in discovery)
          if (creatorRecord && creatorRecord.is_active) {
            const inFavorites = sections.favorites.some((s: any) => s.id === creatorRecord.id);
            const inCollected = sections.collected.some((s: any) => s.id === creatorRecord.id);
            const existingInDiscovery = sections.discovery.find((s: any) => s.id === creatorRecord.id);
            if (inFavorites || inCollected) {
              // Already in favorites or collected, nothing to do
            } else if (existingInDiscovery) {
              existingInDiscovery.is_self = true; // Mark existing entry as "Your Hub"
            } else {
              sections.discovery.unshift({
                id: creatorRecord.id,
                username: creatorRecord.username,
                display_name: creatorRecord.display_name,
                avatar_url: creatorRecord.avatar_url,
                brand_name: creatorRecord.brand_name,
                brand_logo_url: creatorRecord.avatar_url,
                is_active: true,
                is_self: true
              });
            }
          }

          return secureResponse({
            user: user ? { ...user, is_creator: !!creatorRecord, streamer: creatorRecord } : null,
            streamer: streamer,
            active_streamers: discoveryStreamers, // Legacy support
            sections: sections,
            favorite_ids: Array.from(favoriteIds),
            stats: {
              total: statsTotalRes.count || 0,
              legendary: statsLegendaryRes.count || 0,
              total_available: totalAvailRes.count || 0
            },
            recent_drops: recentDropsRes.data || [],
            binders: bindersRes.data || [],
            achievements: (() => {
              const customNames = streamer.achievement_names || {};
              const idToKeyMap: Record<string, string> = {
                'first_card': 'beginner',
                'collector_10': 'hoarder',
                'rare_finder': 'rare',
                'epic_moment': 'epic',
                'legendary_luck': 'legendary',
                'completionist': 'completionist',
                'set_collector': 'traveler',
                'rarity_streak_3': 'streak',
                'trader_debut': 'trader'
              };

              const unlockedData = achievementsRes.data || [];
              const unlockedIds = new Set(unlockedData.map((a: any) => a.achievement_id));

              return (allAvailableAchievementsRes.data || []).map((ach: any) => {
                const customKey = idToKeyMap[ach.id];
                const customName = customKey ? customNames[customKey] : null;
                return {
                  ...ach,
                  name: customName || ach.name,
                  unlocked: unlockedIds.has(ach.id),
                  unlocked_at: unlockedData.find((a: any) => a.achievement_id === ach.id)?.achieved_at
                };
              });
            })(),
            leaderboard: leaderboard,
            creator_cards: creatorCardsRes.data || [],
            creator_stats: creatorStatsRes.data || null,
            csrf_token: csrfToken
          }, 200, {
            ...corsHeaders,
            'x-debug-supabase-host': (() => { try { return new URL(env.SUPABASE_URL).hostname; } catch { return 'unknown'; } })(),
            'x-debug-follows-raw-count': debugFollowsCount.toString(),
            'x-debug-follows-raw-ids': debugFollowsRawIds || 'none',
            'x-debug-all-streamers': debugAllStreamerIds || 'none',
            'x-debug-streamers-detail': debugAllStreamersDetail || 'none',
            ...(debugStreamersError ? { 'x-debug-streamers-error': debugStreamersError } : {}),
            'x-debug-follows-platform-matches': followedStreamers.length.toString(),
            'x-debug-token-valid': debugTokenValid.toString(),
            'x-debug-match-source': debugMatchSource,
            'x-debug-match-details': debugMatchDetails || 'none',
            'x-debug-favorite-ids': Array.from(favoriteIds).join(','),
            'Set-Cookie': `csrf=${csrfToken}${secureFlag}; SameSite=Lax; Path=/`
          });
        } catch (e: any) {
          console.error('[Bootstrap] Error:', e);
          return secureResponse('Bootstrap failed', 500, corsHeaders, true);
        }
      }

      if (path === '/api/logout') {
        const isHttps = request.url.startsWith('https');
        const secureFlag = isHttps ? '; Secure' : '';
        return new Response('OK', {
          headers: {
            ...corsHeaders,
            'Set-Cookie': `session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
        });
      }

      if (
        method !== 'GET' &&
        path.startsWith('/api') &&
        path !== '/api/logout' &&
        path !== '/api/csrf' &&
        path !== '/api/admin/login' &&
        path !== '/api/admin/logout' &&
        path !== '/twitch/eventsub' &&
        !path.startsWith('/api/obs')
      ) {
        const cookie = request.headers.get('Cookie') || '';
        const csrfCookie = cookie.match(/csrf=([^;]+)/)?.[1];
        const csrfHeader = request.headers.get('X-CSRF-Token');

        if (!csrfCookie || csrfCookie !== csrfHeader) {
          console.warn(`[CSRF] Blocked: Cookie: ${!!csrfCookie}, Header: ${!!csrfHeader}`);
          return secureResponse('CSRF blocked', 403, corsHeaders, true);
        }
      }

      if (method === 'GET' && path === '/api/csrf') {
        const token = crypto.randomUUID();
        const isHttps = request.url.startsWith('https');
        const secureFlag = isHttps ? '; Secure' : '';

        return secureResponse({ token }, 200, {
          'Set-Cookie': `csrf=${token}${secureFlag}; SameSite=Lax; Path=/`
        });
      }



      // --- ONBOARDING ENDPOINTS ---

      if (path === '/api/onboarding/status') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const { data: streamer } = await supabase
          .from('streamers')
          .select('*')
          .eq('twitch_id', user.twitch_id)
          .maybeSingle();

        return secureResponse({
          user,
          streamer,
          step: streamer ? (streamer.onboarding_step || 1) : 1
        }, 200, corsHeaders);
      }

      if (path === '/api/onboarding/collector/status') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const { data: userData, error } = await supabase
          .from('users')
          .select('onboarding_collector_step, is_onboarding_complete')
          .eq('twitch_id', user.twitch_id)
          .single();

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(userData, 200, corsHeaders);
      }

      if (method === 'GET' && path === '/api/onboarding/collector/follows') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        // Fetch user's Twitch access token
        const { data: dbUser } = await supabase
          .from('users')
          .select('twitch_access_token_encrypted')
          .eq('twitch_id', user.twitch_id)
          .single();

        if (!dbUser?.twitch_access_token_encrypted) {
          return secureResponse('Twitch token not found', 400, corsHeaders, true);
        }

        try {
          // DECRYPT TOKEN
          let accessToken = '';
          try {
            accessToken = await decryptSensitive(dbUser.twitch_access_token_encrypted, env.SESSION_SECRET);
          } catch (decryptErr) {
            console.error('[Onboarding/Follows] Decryption failed:', decryptErr);
            return secureResponse('Failed to decrypt token', 500, corsHeaders, true);
          }

          // Fetch followed channels from Twitch
          const followsRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.twitch_id}`, {
            headers: {
              'Client-ID': env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (!followsRes.ok) {
            const err = await followsRes.json();
            throw new Error(`Twitch API Error: ${JSON.stringify(err)}`);
          }

          const followsData: any = await followsRes.json();
          const followedIds = followsData.data.map((f: any) => f.broadcaster_id);

          if (followedIds.length === 0) {
            return secureResponse([], 200, corsHeaders);
          }

          // Match followed IDs with streamers on our platform
          // We'll show ALL streamers they follow who have a record, regardless of is_active status
          // as they might be in onboarding themselves.
          const { data: streamers, error: sErr } = await supabase
            .from('streamers')
            .select('id, username, display_name, avatar_url, brand_name, brand_tagline, is_active')
            .in('twitch_id', followedIds);

          if (sErr) throw sErr;

          // Fetch user's current favorites to show status
          const { data: favorites } = await supabase
            .from('user_favorites')
            .select('streamer_id')
            .eq('user_id', user.twitch_id);

          const favoriteIds = new Set((favorites || []).map((f: any) => f.streamer_id));

          // Enhance streamer records with favorited status
          const enhancedStreamers = (streamers || []).map((s: any) => ({
            ...s,
            is_favorited: favoriteIds.has(s.id)
          }));

          // If no follows on the platform, return ALL active creators to help testing
          if (enhancedStreamers.length === 0) {
            console.log('[Onboarding/Follows] No follows on platform, returning all active creators for discovery support');
            const { data: allActive } = await supabase
              .from('streamers')
              .select('id, username, display_name, avatar_url, brand_name, brand_tagline, is_active')
              .eq('is_active', true)
              .limit(20);

            return secureResponse((allActive || []).map((s: any) => ({ ...s, is_favorited: favoriteIds.has(s.id) })), 200, corsHeaders);
          }

          return secureResponse(enhancedStreamers, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Onboarding/Follows] Error:', e);
          return secureResponse(e.message || 'Failed to fetch follows', 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/onboarding/collector/complete') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const { error } = await supabase
          .from('users')
          .update({ is_onboarding_complete: true, onboarding_collector_step: 3 })
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/collector/step') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { step: number };
        const { error } = await supabase
          .from('users')
          .update({ onboarding_collector_step: body.step })
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/identity') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as any;
        if (!body.brand_name) return secureResponse('Brand name required', 400, corsHeaders, true);

        // Fetch existing streamer to check for token
        const { data: existing } = await supabase
          .from('streamers')
          .select('obs_overlay_token')
          .eq('twitch_id', user.twitch_id)
          .maybeSingle();

        const token = existing?.obs_overlay_token || crypto.randomUUID().replace(/-/g, '');

        const { data: streamer, error } = await supabase
          .from('streamers')
          .upsert({
            twitch_id: user.twitch_id,
            username: user.username.toLowerCase(),
            display_name: user.username,
            avatar_url: user.avatar_url,
            brand_name: body.brand_name,
            brand_tagline: body.brand_tagline,
            binder_color: body.binder_color || '#00ffcc',
            battles_enabled: body.battles_enabled !== undefined ? body.battles_enabled : true,
            trading_enabled: body.trading_enabled !== undefined ? body.trading_enabled : true,
            onboarding_step: 4,
            obs_overlay_token: token
          }, { onConflict: 'twitch_id' })
          .select()
          .single();

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(streamer, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/tos') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { accepted: boolean };
        const { error } = await supabase
          .from('streamers')
          .update({ tos_accepted: body.accepted, onboarding_step: 3 })
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/obs-style') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { pack_style: string };
        const { error } = await supabase
          .from('streamers')
          .update({ pack_animation_style: body.pack_style, onboarding_step: 9 })
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/collection-methods') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { methods: any };
        const { error: collErr } = await supabase
          .from('streamers')
          .update({ collection_methods: body.methods, onboarding_step: 6 })
          .eq('twitch_id', user.twitch_id);

        if (collErr) return secureResponse(collErr.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/step') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { step: number };
        const { error } = await supabase
          .from('streamers')
          .update({ onboarding_step: body.step })
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/onboarding/reset-test') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        // Reset Creator State
        await supabase
          .from('streamers')
          .update({
            onboarding_step: 1,
            is_active: false,
            tos_accepted: false,
            collection_methods: {}
          })
          .eq('twitch_id', user.twitch_id);

        // Reset Collector State
        const { error: userError } = await supabase
          .from('users')
          .update({
            onboarding_collector_step: 1,
            is_onboarding_complete: false
          })
          .eq('twitch_id', user.twitch_id);

        if (userError) return secureResponse(userError.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // Achievement Customization
      if (method === 'POST' && path === '/api/onboarding/achievements') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json() as { achievement_names: any };

          const { data, error } = await supabase
            .from('streamers')
            .update({ achievement_names: body.achievement_names })
            .eq('id', streamer.id)
            .select()
            .single();

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/onboarding/activate') {
        const { user, streamer } = await checkCreator(request, supabase);

        const { error } = await supabase
          .from('streamers')
          .update({ is_active: true })
          .eq('id', streamer.id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'POST' && path === '/api/favorites/toggle') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body = await request.json() as { streamer_id: string };
        if (!body.streamer_id) return secureResponse('Streamer ID required', 400, corsHeaders, true);

        // Check if exists
        const { data: existing } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.twitch_id)
          .eq('streamer_id', body.streamer_id)
          .maybeSingle();

        if (existing) {
          // Unfavorite
          console.log(`[Favorites] Unfavoriting for user ${user.twitch_id}, streamer ${body.streamer_id}`);
          const { error } = await supabase.from('user_favorites').delete().eq('id', existing.id);
          if (error) {
            console.error('[Favorites] Delete error:', error);
            return secureResponse(error.message, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, favorited: false }, 200, corsHeaders);
        } else {
          // Favorite
          console.log(`[Favorites] Favoriting for user ${user.twitch_id}, streamer ${body.streamer_id}`);
          const { error } = await supabase.from('user_favorites').insert({
            user_id: user.twitch_id,
            streamer_id: body.streamer_id
          });
          if (error) {
            console.error('[Favorites] Insert error:', error);
            return secureResponse(error.message, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, favorited: true }, 200, corsHeaders);
        }
      }

      if (method === 'GET' && path === '/api/onboarding/cards') {
        const { user, streamer } = await checkCreator(request, supabase);
        const { data, error } = await supabase.from('cards').select('*').eq('streamer_id', streamer.id);
        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(data, 200, corsHeaders);
      }

      // 1. Get/Generate Trade Code
      if (method === 'GET' && path === '/api/trade/code') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const { data, error: dbError } = await supabase
          .from('users')
          .select('trade_code')
          .eq('twitch_id', user.twitch_id)
          .single();

        if (dbError || !data?.trade_code) {
          // Force generate if missing
          const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
            .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
            .join('');

          await supabase.from('users').update({ trade_code: newCode }).eq('twitch_id', user.twitch_id);
          return secureResponse({ trade_code: newCode }, 200, corsHeaders);
        }

        return secureResponse({ trade_code: data.trade_code }, 200, corsHeaders);
      }

      // 2. Reset Trade Code
      if (method === 'POST' && path === '/api/trade/code/reset') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const newCode = Array.from(crypto.getRandomValues(new Uint8Array(8)))
          .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
          .join('');

        const { error: dbError } = await supabase
          .from('users')
          .update({ trade_code: newCode })
          .eq('twitch_id', user.twitch_id);

        if (dbError) return secureResponse('Failed to reset code', 500, corsHeaders, true);
        return secureResponse({ trade_code: newCode }, 200, corsHeaders);
      }

      // 2b. Update Binder Config (Layout & Theme)
      if (method === 'PATCH' && path === '/api/user/binder-config') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as { layout?: any, theme?: string };
          const updates: any = {};
          if (body.layout) updates.binder_layout = body.layout;
          if (body.theme) updates.binder_theme = body.theme;

          if (Object.keys(updates).length === 0) {
            return secureResponse('No changes provided', 400, corsHeaders, true);
          }

          const { error: dbError } = await supabase
            .from('users')
            .update(updates)
            .eq('twitch_id', user.twitch_id);

          if (dbError) throw dbError;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Update failed', 500, corsHeaders, true);
        }
      }

      // 2c. Custom Binders
      if (method === 'GET' && path === '/api/binders') {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

          // Check if user_binders table exists, if not return empty array
          const { data, error } = await supabase
            .from('user_binders')
            .select('*, user_binder_cards(user_card_id, sort_order)')
            .eq('user_id', user.twitch_id)
            .order('sort_order', { ascending: true });

          if (error) {
            // If table doesn't exist or permission denied, return empty array (binders are optional)
            if (error.code === '42P01' || error.code === '42501' ||
              error.message?.includes('does not exist') ||
              error.message?.includes('permission denied')) {
              console.warn('[Binders] Table does not exist or permission denied, returning empty array');
              return secureResponse([], 200, corsHeaders);
            }
            console.error('[Binders] Database error:', error);
            return secureResponse([], 200, corsHeaders); // Return empty on error instead of 500
          }
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e: any) {
          console.error('[Binders] Exception:', e);
          return secureResponse([], 200, corsHeaders); // Return empty on error
        }
      }

      if (method === 'POST' && path === '/api/binders') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const { name } = await request.json() as { name: string };
          if (!name) return secureResponse('Name is required', 400, corsHeaders, true);

          const { data, error } = await supabase
            .from('user_binders')
            .insert({ user_id: user.twitch_id, name })
            .select()
            .single();

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to create binder', 500, corsHeaders, true);
        }
      }

      if (method === 'PATCH' && path === '/api/binders') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const { id, name } = await request.json() as { id: string, name: string };
          if (!id || !name) return secureResponse('ID and name required', 400, corsHeaders, true);

          const { error } = await supabase
            .from('user_binders')
            .update({ name })
            .eq('id', id)
            .eq('user_id', user.twitch_id);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to rename binder', 500, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/binders') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const id = url.searchParams.get('id');
        if (!id) return secureResponse('Missing binder ID', 400, corsHeaders, true);

        const { error } = await supabase
          .from('user_binders')
          .delete()
          .eq('id', id)
          .eq('user_id', user.twitch_id);

        if (error) return secureResponse('Failed to delete binder', 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // 2d. Binder Cards
      if (method === 'POST' && path === '/api/binders/cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const { binder_id, user_card_ids, start_slot } = await request.json() as { binder_id: string, user_card_ids: string[], start_slot?: number };
          if (!binder_id || !user_card_ids || !Array.isArray(user_card_ids)) {
            return secureResponse('Invalid request', 400, corsHeaders, true);
          }

          // Verify binder ownership
          const { data: binder } = await supabase
            .from('user_binders')
            .select('id')
            .eq('id', binder_id)
            .eq('user_id', user.twitch_id)
            .single();

          if (!binder) return secureResponse('Binder not found', 404, corsHeaders, true);

          let nextSlot: number;
          if (typeof start_slot === 'number') {
            nextSlot = start_slot;
          } else {
            // Get current max sort_order to append
            const { data: maxOrderData } = await supabase
              .from('user_binder_cards')
              .select('sort_order')
              .eq('binder_id', binder_id)
              .order('sort_order', { ascending: false })
              .limit(1)
              .maybeSingle();

            nextSlot = (maxOrderData?.sort_order ?? -1) + 1;
          }

          const items = user_card_ids.map((id) => {
            const item = {
              binder_id,
              user_card_id: id,
              sort_order: nextSlot
            };
            nextSlot++;
            return item;
          });

          // Using upsert with onConflict to allow re-ordering or re-adding (though usually new IDs)
          const { error } = await supabase.from('user_binder_cards').upsert(items, { onConflict: 'binder_id,user_card_id' });
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to add cards', 500, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/binders/cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const binder_id = url.searchParams.get('binder_id');
        const user_card_id = url.searchParams.get('user_card_id');

        if (!binder_id || !user_card_id) return secureResponse('Missing parameters', 400, corsHeaders, true);

        // Verify binder ownership
        const { data: binder } = await supabase
          .from('user_binders')
          .select('id')
          .eq('id', binder_id)
          .eq('user_id', user.twitch_id)
          .single();

        if (!binder) return secureResponse('Binder not found', 404, corsHeaders, true);

        const { error } = await supabase
          .from('user_binder_cards')
          .delete()
          .eq('binder_id', binder_id)
          .eq('user_card_id', user_card_id);

        if (error) return secureResponse('Failed to remove card', 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      if (method === 'PATCH' && path === '/api/binders/cards/sort') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const { binder_id, order } = await request.json() as { binder_id: string, order: { user_card_id: string, sort_order: number }[] };
          if (!binder_id || !order || !Array.isArray(order)) return secureResponse('Missing params', 400, corsHeaders, true);

          // Verify ownership
          const { data: binder } = await supabase
            .from('user_binders')
            .select('id')
            .eq('id', binder_id)
            .eq('user_id', user.twitch_id)
            .single();

          if (!binder) return secureResponse('Binder not found', 404, corsHeaders, true);

          // Update sort_order for each card
          const updates = order.map(item => ({
            binder_id: binder_id,
            user_card_id: item.user_card_id,
            sort_order: item.sort_order
          }));

          const { error } = await supabase.from('user_binder_cards').upsert(updates, { onConflict: 'binder_id,user_card_id' });
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Sort update failed', 500, corsHeaders, true);
        }
      }

      if (method === 'PATCH' && path === '/api/binders/sort') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const { order } = await request.json() as { order: { id: string, sort_order: number }[] };
          if (!order || !Array.isArray(order)) return secureResponse('Missing params', 400, corsHeaders, true);

          const updates = order.map(item => ({
            id: item.id,
            user_id: user.twitch_id,
            sort_order: item.sort_order
          }));

          const { error } = await supabase.from('user_binders').upsert(updates, { onConflict: 'id' });
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Binder sort failed', 500, corsHeaders, true);
        }
      }



      // 3. Initiate Offer
      if (method === 'POST' && path === '/api/trade/offer') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as TradeOfferBody;

          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          // Find receiver by code
          const { data: receiver, error: rError } = await supabase
            .from('users')
            .select('twitch_id, username')
            .eq('trade_code', body.target_code)
            .single();

          if (rError || !receiver) {
            await logSystem(supabase, 'warn', 'system', `Invalid trade code attempt by ${user.username}: ${body.target_code}`, streamer.id, { user_id: user.twitch_id });
            return secureResponse('Invalid trade code', 404, corsHeaders, true);
          }
          if (receiver.twitch_id === user.twitch_id) {
            await logSystem(supabase, 'warn', 'system', `User ${user.username} tried to trade with themselves`, streamer.id, { user_id: user.twitch_id, username: user.username });
            return secureResponse('You cannot trade with yourself', 400, corsHeaders, true);
          }

          // Create trade record
          const { data: trade, error: tError } = await supabase
            .from('trades')
            .insert({
              streamer_id: streamer.id,
              sender_id: user.twitch_id,
              receiver_id: receiver.twitch_id,
              status: 'pending'
            })
            .select()
            .single();

          if (tError) throw tError;

          // Add items (Only sender items for now in Step 1)
          const items = body.sender_items.map(id => ({
            trade_id: trade.id,
            user_card_id: id,
            owner_id: user.twitch_id
          }));

          const { error: iError } = await supabase.from('trade_items').insert(items);
          if (iError) throw iError;

          // Notify receiver
          await supabase.from('notifications').insert({
            twitch_id: receiver.twitch_id,
            streamer_id: streamer.id,
            type: 'trade_request',
            message: `You received a trade offer from ${user.username} in @${streamer.username}'s stream!`,
            data: { trade_id: trade.id, sender_name: user.username }
          });

          await logSystem(supabase, 'info', 'trade', `Trade ${trade.id} initiated: ${user.username} -> ${receiver.username} (${items.length} cards) (@${streamer.username})`, streamer.id, { trade_id: trade.id, sender: user.username, receiver: receiver.username });

          return secureResponse({ success: true, trade_id: trade.id }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Trade failed', 500, corsHeaders, true);
        }
      }

      // 4. List Trades
      if (method === 'GET' && path === '/api/trades') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

        const { data: trades, error: tError } = await supabase
          .from('trades')
          .select(`
            *,
            sender:users!trades_sender_id_fkey(username, avatar_url),
            receiver:users!trades_receiver_id_fkey(username, avatar_url),
            items:trade_items(
              *,
              card:enriched_user_cards(*)
            )
          `)
          .eq('streamer_id', streamer.id)
          .or(`sender_id.eq.${user.twitch_id},receiver_id.eq.${user.twitch_id}`)
          .order('created_at', { ascending: false });

        if (tError) return secureResponse(tError.message, 500, corsHeaders, true);
        return secureResponse(trades, 200, corsHeaders);
      }

      // 4b. Reply to offer (Add receiver items - Step 2)
      if (method === 'POST' && path === '/api/trade/offer-reply') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as TradeReplyBody;
          console.log(`[TradeReply] Processing trade ${body.trade_id} from ${user.username}`);

          // 1. Get trade and verify user is receiver
          const { data: trade, error: tError } = await supabase
            .from('trades')
            .select('*')
            .eq('id', body.trade_id)
            .single();

          if (tError || !trade) {
            console.error(`[TradeReply] Trade not found: ${body.trade_id}`);
            return secureResponse('Trade not found', 404, corsHeaders, true);
          }
          if (trade.receiver_id !== user.twitch_id) return secureResponse('Unauthorized', 403, corsHeaders, true);
          if (trade.status !== 'pending') return secureResponse('Trade no longer pending counter-offer', 400, corsHeaders, true);

          // 2. Add receiver items
          const items = body.receiver_items.map(id => ({
            trade_id: trade.id,
            user_card_id: id,
            owner_id: user.twitch_id
          }));

          const { error: iError } = await supabase.from('trade_items').insert(items);
          if (iError) throw iError;

          // 3. Update status to 'offered'
          await supabase.from('trades').update({ status: 'offered' }).eq('id', trade.id);

          // 4. Notify original sender (A)
          const { data: sender } = await supabase.from('users').select('username').eq('twitch_id', trade.sender_id).single();
          await supabase.from('notifications').insert({
            twitch_id: trade.sender_id,
            streamer_id: trade.streamer_id,
            type: 'trade_offered',
            message: `${user.username} has offered card(s) back for your trade!`,
            data: { trade_id: trade.id, receiver_name: user.username }
          });

          await logSystem(supabase, 'info', 'trade', `Trade ${trade.id} counter-offered by ${user.username} (${items.length} cards)`, trade.streamer_id, { trade_id: trade.id, responder: user.username });

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Offer reply failed', 500, corsHeaders, true);
        }
      }

      // 5. Respond to offer
      if (method === 'POST' && path === '/api/trade/respond') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as TradeRespondBody;

          const { data: trade, error: tError } = await supabase
            .from('trades')
            .select('*')
            .eq('id', body.trade_id)
            .single();

          if (tError || !trade) return secureResponse('Trade not found', 404, corsHeaders, true);

          if (body.action === 'accept') {
            console.log(`[TradeRespond] Accept attempt by ${user.username} for trade ${trade.id}`);
            // ONLY the original SENDER can accept the final offer in this 3-step flow
            if (trade.sender_id !== user.twitch_id) return secureResponse('Only the initiator can accept the final trade offer', 403, corsHeaders, true);
            if (trade.status !== 'offered') return secureResponse('Trade must be in "offered" status to be accepted', 400, corsHeaders, true);

            // Call the atomic swap RPC
            const { data: success, error: rpcError } = await supabase.rpc('accept_trade', { trade_uuid: trade.id });

            if (rpcError || !success) {
              console.error(`[TradeRespond] RPC failed:`, rpcError);
              await logSystem(supabase, 'error', 'system', `Trade completion failed for Trade ID: ${trade.id}`, undefined, {
                user_id: user.twitch_id,
                username: user.username,
                error: rpcError?.message || 'RPC failed'
              });
              return secureResponse('Trade failed. Items might have moved or been traded already.', 400, corsHeaders, true);
            }

            // Notify sender
            await supabase.from('notifications').insert({
              twitch_id: trade.sender_id,
              streamer_id: trade.streamer_id,
              type: 'trade_completed',
              message: `Your trade with ${user.username} was successful!`,
              data: { trade_id: trade.id }
            });

            // Unlock Trading Achievement for both parties
            const unlockAchievement = async (tid: string, sid: string) => {
              const { data: hasIt } = await supabase.from('user_achievements').select('*').eq('twitch_id', tid).eq('achievement_id', 'trader_debut').eq('streamer_id', sid).maybeSingle();
              if (!hasIt) {
                await supabase.from('user_achievements').insert({ twitch_id: tid, achievement_id: 'trader_debut', streamer_id: sid });
                await supabase.from('notifications').insert({
                  twitch_id: tid,
                  streamer_id: sid,
                  type: 'achievement_unlock',
                  message: `🏆 Achievement Unlocked: TRADER DEBUT! 🤝`,
                  data: { achievement_id: 'trader_debut' }
                });
              }
            };
            await unlockAchievement(trade.sender_id, trade.streamer_id);
            await unlockAchievement(trade.receiver_id, trade.streamer_id);

            await logSystem(supabase, 'info', 'trade', `Trade ${trade.id} COMPLETED: ${user.username} accepted counter-offer.`, undefined, { trade_id: trade.id });

            return secureResponse({ success: true }, 200, corsHeaders);
          } else {
            // Reject or Cancel
            const newStatus = body.action === 'reject' ? 'rejected' : 'cancelled';

            // Security check
            if (body.action === 'reject' && trade.receiver_id !== user.twitch_id) {
              await logSystem(supabase, 'warn', 'auth', `Unauthorized trade rejection attempt by ${user.username}`, undefined, { user_id: user.twitch_id, trade_id: trade.id });
              return secureResponse('Unauthorized', 403, corsHeaders, true);
            }
            if (body.action === 'cancel' && trade.sender_id !== user.twitch_id) {
              await logSystem(supabase, 'warn', 'auth', `Unauthorized trade cancellation attempt by ${user.username}`, undefined, { user_id: user.twitch_id, trade_id: trade.id });
              return secureResponse('Unauthorized', 403, corsHeaders, true);
            }

            await supabase.from('trades').update({ status: newStatus }).eq('id', trade.id);

            // Notify other party if rejected
            if (body.action === 'reject') {
              await supabase.from('notifications').insert({
                twitch_id: trade.sender_id,
                streamer_id: trade.streamer_id,
                type: 'trade_rejected',
                message: `${user.username} rejected your trade offer.`,
                data: { trade_id: trade.id }
              });
            }

            await logSystem(supabase, 'info', 'trade', `Trade ${trade.id} ${newStatus} by ${user.username}`, undefined, { trade_id: trade.id, action: body.action });

            return secureResponse({ success: true, status: newStatus }, 200, corsHeaders);
          }
        } catch (e: any) {
          return secureResponse(e.message || 'Operation failed', 500, corsHeaders, true);
        }
      }

      // 6. Trade-IN (Burn 3 for 1)
      if (method === 'POST' && path === '/api/trade/in') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as TradeInBody;
          if (!body.user_card_ids || body.user_card_ids.length !== 5) {
            await logSystem(supabase, 'warn', 'system', `Invalid trade-in attempt by ${user.username}: Exactly 5 cards required`, undefined, { user_id: user.twitch_id, count: body.user_card_ids?.length });
            return secureResponse('Exactly 5 cards required for trade-in', 400, corsHeaders, true);
          }

          // 1. Verify ownership and get rarity
          console.log(`[TradeIn] Request from ${user.username} (${user.twitch_id}) for IDs:`, body.user_card_ids);

          const { data: cards, error: fetchError } = await supabase
            .from('enriched_user_cards')
            .select('*')
            .eq('twitch_id', user.twitch_id)
            .in('user_card_id', body.user_card_ids);

          if (fetchError || !cards || cards.length !== 5) {
            const errorMsg = fetchError ? fetchError.message : `Only found ${cards?.length || 0} of 5 cards requested`;
            await logSystem(supabase, 'error', 'system', `Trade-in verification failed for ${user.username}: ${errorMsg}`, undefined, {
              user_id: user.twitch_id,
              error: errorMsg,
              requested_ids: body.user_card_ids,
              found_count: cards?.length || 0
            });
            return secureResponse(errorMsg || 'Could not find all 5 cards in your collection', 404, corsHeaders, true);
          }

          // 2. Verify all same rarity
          const rawRarity = cards[0].rarity;
          const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary'];
          const currentIndex = rarityOrder.findIndex(r => r.toLowerCase() === rawRarity.toLowerCase());

          if (currentIndex === -1) {
            await logSystem(supabase, 'error', 'system', `Invalid rarity found in trade-in: ${rawRarity}`, undefined, { user_id: user.twitch_id });
            return secureResponse(`Invalid rarity: ${rawRarity}`, 400, corsHeaders, true);
          }

          if (!cards.every((c: any) => c.rarity.toLowerCase() === rawRarity.toLowerCase())) {
            await logSystem(supabase, 'warn', 'system', `Trade-in rarity mismatch for ${user.username}`, undefined, { user_id: user.twitch_id });
            return secureResponse('All cards must be of the same rarity', 400, corsHeaders, true);
          }

          // 3. Determine next rarity
          if (currentIndex === rarityOrder.length - 1) {
            return secureResponse('Cannot upgrade Legendary cards!', 400, corsHeaders, true);
          }
          const nextRarity = rarityOrder[currentIndex + 1];

          // 4. Random card from next tier
          const { data: pool, error: poolError } = await supabase.from('cards').select('*').eq('rarity', nextRarity);
          if (poolError || !pool || pool.length === 0) {
            await logSystem(supabase, 'error', 'system', `No cards found for upgrade tier: ${nextRarity}`, undefined, { error: poolError?.message });
            return secureResponse('No available cards in next rarity tier', 500, corsHeaders, true);
          }
          const newCard = pool[Math.floor(Math.random() * pool.length)];

          // 5. Atomic Transaction (Delete 5, Add 1)
          const { error: delError } = await supabase.from('user_cards').delete().in('id', body.user_card_ids).eq('twitch_id', user.twitch_id);
          if (delError) {
            await logSystem(supabase, 'error', 'system', `Trade-in delete failed for ${user.username}`, undefined, { error: delError.message });
            throw delError;
          }

          const { data: granted, error: insError } = await supabase.from('user_cards').insert({
            twitch_id: user.twitch_id,
            card_id: newCard.id,
            streamer_id: newCard.streamer_id,
            granted_by_streamer: newCard.streamer_id,
            is_obs_consumed: true,
            attack: newCard.attack,
            defense: newCard.defense,
            max_hp: newCard.defense,
            mechanic_id: newCard.mechanic_id
          }).select().single();

          if (insError) {
            await logSystem(supabase, 'error', 'system', `Trade-in insert failed for ${user.username}`, undefined, { error: insError.message });
            throw insError;
          }

          // Fetch the flattened version for the UI
          const { data: flatCard } = await supabase
            .from('enriched_user_cards')
            .select('*')
            .eq('user_card_id', (granted as any).id)
            .single();

          await logSystem(supabase, 'info', 'grant', `User ${user.username} traded in 5 ${rawRarity}s for a ${nextRarity}: ${newCard.name}`, undefined, { user_id: user.twitch_id });

          return secureResponse({ success: true, card: flatCard }, 200, corsHeaders);
        } catch (e: any) {
          await logSystem(supabase, 'error', 'system', `Fatal trade-in error for ${user.username}`, undefined, {
            user_id: user.twitch_id,
            error: e.message
          });
          return secureResponse(e.message || 'Trade-in failed', 500, corsHeaders, true);
        }
      }

      // 6. Get Public Collection by Trade Code
      if (method === 'GET' && path.startsWith('/api/public/collection/')) {
        const code = path.split('/').pop();
        if (!code) return secureResponse('Invalid code', 400, corsHeaders, true);

        const { data: targetUser, error: uError } = await supabase
          .from('users')
          .select('twitch_id')
          .eq('trade_code', code)
          .single();

        if (uError || !targetUser) return secureResponse('User not found', 404, corsHeaders, true);

        const { data: cards, error: cError } = await supabase
          .from('enriched_user_cards')
          .select('*')
          .eq('twitch_id', targetUser.twitch_id);

        if (cError) return secureResponse(cError.message, 500, corsHeaders, true);
        return secureResponse(cards, 200, corsHeaders);
      }

      // --- ADMIN AUTH ENDPOINTS ---

      // Admin Login
      if (method === 'POST' && path === '/api/admin/login') {
        let username = 'unknown';
        try {
          const body = await request.json() as LoginBody;
          username = body.username;
          const password = body.password;

          // Check credentials
          if (username !== 'codeoce' || password !== env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
              status: 401,
              headers: corsHeaders
            });
          }


          // Create admin session token
          const adminToken = await new SignJWT({ admin: true, username })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('12h')
            .sign(new TextEncoder().encode(env.SESSION_SECRET));

          const isHttps = request.url.startsWith('https');
          const secureFlag = isHttps ? '; Secure' : '';

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Set-Cookie': `admin_session=${adminToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=43200`
            }
          });
        } catch (e: any) {
          const msg = e instanceof Error ? ((e as any).message || String(e)) : String(e);
          await logSystem(supabase, 'warn', 'auth', `Admin login failed for user: ${username}. Error: ${msg}`, undefined, { username });
          return new Response(JSON.stringify({ error: 'Login failed' }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Admin Logout
      if (method === 'POST' && path === '/api/admin/logout') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'
          }
        });
      }

      // Check Admin Session
      if (method === 'GET' && path === '/api/admin/check') {
        const cookie = request.headers.get('Cookie');
        const token = cookie?.match(/admin_session=([^;]+)/)?.[1];

        if (!token) {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: corsHeaders
          });
        }

        try {
          const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(env.SESSION_SECRET)
          );

          return new Response(JSON.stringify({
            authenticated: true,
            username: payload.username
          }), {
            status: 200,
            headers: corsHeaders
          });
        } catch {
          return new Response(JSON.stringify({ authenticated: false }), {
            status: 200,
            headers: corsHeaders
          });
        }
      }



      // --- ADMIN ROUTES ---

      // 1. Add Card
      if (method === 'POST' && path === '/api/admin/cards') {
        try {
          await checkAdmin(request);
          const body = await request.json() as AdminCardBody;

          const { error } = await supabase.from('cards').upsert({
            id: body.id,
            streamer_id: body.streamer_id || body.creator_id, // Backward compatibility
            name: body.name,
            image_url: body.image_url,
            rarity: body.rarity,
            type: body.type || 'Unit',
            set_id: body.set_id,
            card_number: body.card_number,
            description: body.description,
            attack: body.attack || 0,
            defense: body.defense || 0
          });

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // 1a. Upload Image
      if (method === 'POST' && path === '/api/admin/upload') {
        try {
          await checkAdmin(request);
          const formData = await request.formData();
          const file = formData.get('file') as File;

          if (!file) {
            return secureResponse('No file uploaded', 400, corsHeaders, true);
          }

          if (file.size > CARD_IMAGE_MAX_BYTES) {
            return secureResponse(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 413, corsHeaders, true);
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const ext = (file.type === 'image/webp' ? '.webp' : (file.name.match(/\.[^/.]+$/) || ['.webp'])[0]);
          const fileName = `${Date.now()}-${baseName}${ext}`;
          const filePath = `${fileName}`;

          const { data, error } = await supabase.storage
            .from('card-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('card-images')
            .getPublicUrl(filePath);

          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Server error', 500, corsHeaders, true);
        }
      }

      // 1b. Bulk Add Cards
      if (method === 'POST' && path === '/api/admin/cards/bulk') {
        try {
          await checkAdmin(request);
          const body = await request.json() as BulkCardsBody;
          const cards = body.cards;

          if (!Array.isArray(cards) || cards.length === 0) {
            throw new Error("Invalid cards array");
          }

          const cardsToInsert = cards.map(card => ({
            id: card.id,
            streamer_id: card.streamer_id || card.creator_id,
            name: card.name,
            image_url: card.image_url,
            rarity: card.rarity,
            type: card.type || 'Unit',
            set_id: card.set_id,
            card_number: card.card_number,
            description: card.description,
            attack: card.attack || 0,
            defense: card.defense || 0
          }));

          const { error } = await supabase.from('cards').upsert(cardsToInsert);
          if (error) throw error;

          return secureResponse({ success: true, count: cards.length }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Batch failed', 400, corsHeaders, true);
        }
      }

      // 2. Get Users (for moderation)
      if (method === 'GET' && path === '/api/admin/users') {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // 3. Wipe User (Moderation)
      if (method === 'DELETE' && path === '/api/admin/users') {
        try {
          await checkAdmin(request);
          const targetId = url.searchParams.get('target_id');
          if (!targetId) throw new Error("Missing target_id");

          const { error } = await supabase.from('user_cards').delete().eq('twitch_id', targetId);
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // 6. Grant Card to User
      if (method === 'POST' && path === '/api/admin/grant') {
        try {
          await checkAdmin(request);
          const body = await request.json() as GrantBody;

          const { data: user, error: userError } = await supabase
            .from('users')
            .select('twitch_id')
            .ilike('username', body.username)
            .single();

          if (userError || !user) throw new Error("User not found");

          const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('id, name, rarity, image_url, streamer_id, attack, defense, mechanic_id')
            .eq('id', body.card_id)
            .single();

          if (cardError || !card) throw new Error("Card not found");

          const quantity = body.quantity || 1;
          const grants: any[] = [];
          for (let i = 0; i < quantity; i++) {
            grants.push({
              twitch_id: user.twitch_id,
              card_id: card.id,
              streamer_id: card.streamer_id,
              granted_by_streamer: card.streamer_id,
              attack: card.attack,
              defense: card.defense,
              max_hp: card.defense,
              mechanic_id: card.mechanic_id
            });
          }

          const { error: insertError } = await supabase.from('user_cards').insert(grants);
          if (insertError) throw insertError;

          const notifications: any[] = grants.map(g => ({
            twitch_id: g.twitch_id,
            streamer_id: card.streamer_id,
            type: 'card_drop',
            message: `You received a new card: ${card.name} (${card.rarity})!`,
            data: { card_id: card.id, rarity: card.rarity, image_url: card.image_url }
          }));
          await supabase.from('notifications').insert(notifications);

          await checkAndUnlockAchievements(supabase, user.twitch_id, card, card.streamer_id);

          await logSystem(supabase, 'info', 'grant', `Manually granted ${quantity} x ${card.name} to ${body.username}`, card.streamer_id, { target_username: body.username, card_id: card.id });

          return secureResponse({ success: true, count: quantity }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Grant failed', 400, corsHeaders, true);
        }
      }

      // --- NOTIFICATIONS API ---

      // 7. Get Notifications
      if (method === 'GET' && path === '/api/notifications') {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

          const userId = user.twitch_id;
          console.log(`[Notifications] Fetching for user: ${userId}`);

          const { data: notifications, error: dbError } = await supabase
            .from('notifications')
            .select('*')
            .eq('twitch_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(50);

          if (dbError) {
            // If table doesn't exist, return empty array (notifications are optional)
            if (dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('permission denied')) {
              console.warn('[Notifications] Table does not exist or permission denied, returning empty array');
              return secureResponse([], 200, corsHeaders);
            }
            console.error('[Notifications] DB Error:', dbError);
            return secureResponse([], 200, corsHeaders); // Return empty on error instead of 500
          }

          return secureResponse(notifications || [], 200, corsHeaders);
        } catch (e: any) {
          console.error('[Notifications] Exception:', e);
          return secureResponse([], 200, corsHeaders); // Return empty on error
        }
      }

      // 8. Dismiss Notifications (Delete)
      if (method === 'POST' && path === '/api/notifications') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const userId = user.twitch_id;

        let body: NotificationBody;
        try {
          body = await request.json() as NotificationBody;
        } catch {
          return secureResponse('Invalid JSON', 400, corsHeaders, true);
        }

        if (!body.ids || !Array.isArray(body.ids)) {
          return secureResponse('Missing ids array', 400, corsHeaders, true);
        }

        const { error: updateError } = await supabase
          .from('notifications')
          .delete()
          .eq('twitch_id', userId)
          .in('id', body.ids);

        if (updateError) {
          console.error('[Notifications] Update Error:', updateError);
          return secureResponse('Database error', 500, corsHeaders, true);
        }

        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // --- CREATOR DASHBOARD API ---


      // Creator Onboarding
      if (method === 'POST' && path === '/api/creator/onboard') {
        try {
          const u = await getUserFromSession(request, env, supabase);
          if (!u) return secureResponse('Unauthorized', 401, corsHeaders, true);

          console.log('[Onboard] Creating streamer for user:', u.username, 'twitch_id:', u.twitch_id);

          // Check if already exists
          const { data: existing } = await supabase
            .from('streamers')
            .select('id')
            .eq('twitch_id', u.twitch_id)
            .maybeSingle();

          if (existing) {
            console.log('[Onboard] Streamer already exists');
            return secureResponse({ success: true, message: 'Already a creator' }, 200, corsHeaders);
          }

          // Insert new streamer (id is UUID, not twitch_id)
          const { data: newStreamer, error: onboardErr } = await supabase
            .from('streamers')
            .insert({
              twitch_id: u.twitch_id,
              username: u.username.toLowerCase(),
              display_name: u.username,
              brand_name: u.username,
              avatar_url: u.avatar_url,
              is_active: false // Start inactive until setup is complete
            })
            .select()
            .single();

          if (onboardErr) {
            console.error('[Onboard] Error:', onboardErr);
            return secureResponse('Failed to onboard: ' + onboardErr.message, 500, corsHeaders, true);
          }

          console.log('[Onboard] Successfully created streamer:', newStreamer?.id);
          return secureResponse({ success: true, streamer_id: newStreamer?.id }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Onboard] Exception:', e);
          return secureResponse('Error: ' + e.message, 500, corsHeaders, true);
        }
      }

      // Get Creator Profile & Stats
      if (method === 'GET' && path === '/api/creator/profile') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          const { count: cardCount } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamer.id);
          const { count: setCount } = await supabase.from('streamer_sets').select('*', { count: 'exact', head: true }).eq('streamer_id', streamer.id);

          return secureResponse({
            ...streamer,
            stats: { cardCount: cardCount || 0, setCount: setCount || 0 }
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Get Setup Status
      if (method === 'GET' && path === '/api/creator/setup-status') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // Check if setup is complete
          // Setup is complete if: has reward_id, has at least 10 cards, has rarity config
          const { count: cardCount } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          const { data: rarityConfig } = await supabase
            .from('streamer_rarity_configs')
            .select('*')
            .eq('streamer_id', streamer.id)
            .maybeSingle();

          const setupComplete = !!(
            streamer.brand_name &&
            streamer.is_active
          );

          return secureResponse({ setup_complete: setupComplete }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Creator: Get OBS Overlay Token
      if (method === 'GET' && path === '/api/creator/obs-token') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          console.log('[OBS Token] Streamer ID:', streamer.id);
          console.log('[OBS Token] Streamer username:', streamer.username);
          console.log('[OBS Token] Current token exists:', !!streamer.obs_overlay_token);
          console.log('[OBS Token] Current token value:', streamer.obs_overlay_token || 'null');

          // Always generate a new token (or return existing)
          let token = streamer.obs_overlay_token;

          if (!token) {
            // Generate a secure random token (32 hex characters from 16 bytes = 128 bits of entropy)
            const randomBytes = new Uint8Array(16);
            crypto.getRandomValues(randomBytes);
            token = Array.from(randomBytes)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

            console.log('[OBS Token] Generated new token:', token.substring(0, 8) + '...');
            console.log('[OBS Token] Full token:', token);
            console.log('[OBS Token] Attempting to save to database...');

            // Try to update the database
            const { data: updated, error: updateError } = await supabase
              .from('streamers')
              .update({ obs_overlay_token: token })
              .eq('id', streamer.id)
              .select('obs_overlay_token')
              .single();

            if (updateError) {
              console.error('[OBS Token] Database update error:', updateError);
              console.error('[OBS Token] Error code:', updateError.code);
              console.error('[OBS Token] Error message:', updateError.message);
              console.error('[OBS Token] Error details:', updateError.details);
              console.error('[OBS Token] Error hint:', updateError.hint);

              // Check if column doesn't exist
              if (updateError.code === '42703' || updateError.message?.includes('column') || updateError.message?.includes('obs_overlay_token')) {
                return secureResponse({
                  error: 'Database column missing',
                  message: 'The obs_overlay_token column does not exist. Please run migration 004_obs_overlay_token.sql in your Supabase SQL editor.',
                  migration_hint: 'Run: ALTER TABLE streamers ADD COLUMN IF NOT EXISTS obs_overlay_token TEXT;'
                }, 500, corsHeaders);
              }

              return secureResponse({
                error: 'Failed to save token to database',
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                hint: updateError.hint
              }, 500, corsHeaders);
            }

            if (!updated || !updated.obs_overlay_token) {
              console.error('[OBS Token] Update returned no data or empty token');
              return secureResponse({
                error: 'Token was not saved',
                message: 'Database update succeeded but token was not returned. Please try again.'
              }, 500, corsHeaders);
            }

            console.log('[OBS Token] Token saved successfully!');
            console.log('[OBS Token] Verified token in DB:', updated.obs_overlay_token.substring(0, 8) + '...');
          }

          console.log('[OBS Token] Returning token to client');
          return secureResponse({ token }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[OBS Token] Exception:', e);
          console.error('[OBS Token] Stack:', e.stack);
          return secureResponse({
            error: e.message || 'Failed to get token',
            type: e.constructor?.name || 'Unknown'
          }, 400, corsHeaders);
        }
      }

      // Creator: Regenerate OBS Overlay Token
      if (method === 'POST' && path === '/api/creator/obs-token/regenerate') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          console.log('[OBS Token Regenerate] Streamer ID:', streamer.id);
          console.log('[OBS Token Regenerate] Current token exists:', !!streamer.obs_overlay_token);

          // Generate a new secure random token (32 hex characters from 16 bytes = 128 bits of entropy)
          const randomBytes = new Uint8Array(16);
          crypto.getRandomValues(randomBytes);
          const token = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          console.log('[OBS Token Regenerate] Generated new token:', token.substring(0, 8) + '...');
          console.log('[OBS Token Regenerate] Full token:', token);
          console.log('[OBS Token Regenerate] Attempting to save to database...');

          const { data: updated, error: updateError } = await supabase
            .from('streamers')
            .update({ obs_overlay_token: token })
            .eq('id', streamer.id)
            .select('obs_overlay_token')
            .single();

          if (updateError) {
            console.error('[OBS Token Regenerate] Database update error:', updateError);
            console.error('[OBS Token Regenerate] Error code:', updateError.code);
            console.error('[OBS Token Regenerate] Error message:', updateError.message);
            console.error('[OBS Token Regenerate] Error details:', updateError.details);
            console.error('[OBS Token Regenerate] Error hint:', updateError.hint);

            // Check if column doesn't exist
            if (updateError.code === '42703' || updateError.message?.includes('column') || updateError.message?.includes('obs_overlay_token')) {
              return secureResponse({
                error: 'Database column missing',
                message: 'The obs_overlay_token column does not exist. Please run migration 004_obs_overlay_token.sql in your Supabase SQL editor.',
                migration_hint: 'Run: ALTER TABLE streamers ADD COLUMN IF NOT EXISTS obs_overlay_token TEXT;'
              }, 500, corsHeaders);
            }

            return secureResponse({
              error: 'Failed to regenerate token',
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint
            }, 500, corsHeaders);
          }

          if (!updated || !updated.obs_overlay_token) {
            console.error('[OBS Token Regenerate] Update returned no data or empty token');
            return secureResponse({
              error: 'Token was not saved',
              message: 'Database update succeeded but token was not returned. Please try again.'
            }, 500, corsHeaders);
          }

          console.log('[OBS Token Regenerate] Token regenerated successfully!');
          console.log('[OBS Token Regenerate] Verified token in DB:', updated.obs_overlay_token.substring(0, 8) + '...');

          return secureResponse({ token }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[OBS Token Regenerate] Exception:', e);
          console.error('[OBS Token Regenerate] Stack:', e.stack);
          return secureResponse({
            error: e.message || 'Failed to regenerate token',
            type: e.constructor?.name || 'Unknown'
          }, 400, corsHeaders);
        }
      }

      // Update Creator Settings (Reward IDS, SE, Branding)
      if (method === 'PATCH' && path === '/api/creator/settings') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          const updateData: any = {};
          if (b.reward_id !== undefined) updateData.twitch_reward_id = b.reward_id;
          if (b.battle_reward_id !== undefined) updateData.twitch_battle_reward_id = b.battle_reward_id;
          if (b.streamelements_jwt !== undefined) updateData.streamelements_jwt_encrypted = b.streamelements_jwt;
          if (b.streamelements_id !== undefined) updateData.streamelements_channel_id = b.streamelements_id;

          // Handle branding settings (support both old nested format and new flat format)
          if (b.settings && b.settings.branding) {
            const branding = b.settings.branding;
            if (branding.tagline !== undefined) updateData.brand_tagline = branding.tagline;
          }

          // Direct branding fields (new format)
          if (b.brand_name !== undefined) updateData.brand_name = b.brand_name;
          if (b.brand_tagline !== undefined) updateData.brand_tagline = b.brand_tagline;
          // brand_logo_url column may not exist in all deployments; skip if not in schema
          if (b.brand_banner_url !== undefined) updateData.brand_banner_url = b.brand_banner_url;

          // Pack customization
          if (b.pack_image_url !== undefined) updateData.pack_image_url = b.pack_image_url;
          if (b.pack_image !== undefined) updateData.pack_image_url = b.pack_image; // Backward compatibility
          if (b.card_back_url !== undefined) updateData.card_back_url = b.card_back_url;
          if (b.pack_open_sound_url !== undefined) updateData.pack_open_sound_url = b.pack_open_sound_url;

          // Twitch settings (direct)
          if (b.twitch_reward_id !== undefined) updateData.twitch_reward_id = b.twitch_reward_id;
          if (b.twitch_battle_reward_id !== undefined) updateData.twitch_battle_reward_id = b.twitch_battle_reward_id;

          // Battle/Trading Toggles
          if (b.battles_enabled !== undefined) updateData.battles_enabled = b.battles_enabled;
          if (b.trading_enabled !== undefined) updateData.trading_enabled = b.trading_enabled;
          if (b.binder_color !== undefined) updateData.binder_color = b.binder_color;

          const { error: updateErr } = await supabase.from('streamers').update(updateData).eq('id', streamer.id);

          if (updateErr) throw updateErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Auto-create Twitch Channel Points reward for creator (optional convenience)
      if (method === 'POST' && path === '/api/creator/twitch/auto-reward') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json().catch(() => ({})) as any;

          if (!streamer.twitch_access_token_encrypted) {
            throw new Error('Twitch is not fully connected with Channel Points permissions. Please reconnect as a creator.');
          }

          const cost = typeof body.cost === 'number' && body.cost > 0 ? body.cost : 500;
          const title = (body.title && String(body.title).trim()) || 'Open a Card Pack';
          const mode = body.mode === 'once_per_stream' ? 'once_per_stream' : 'unlimited';

          const isMaxPerStreamEnabled = mode === 'once_per_stream';
          const maxPerStream = isMaxPerStreamEnabled ? 1 : null;

          const twitchAccessToken = await decryptSensitive(streamer.twitch_access_token_encrypted, env.SESSION_SECRET);

          const twitchResp = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamer.twitch_id}`, {
            method: 'POST',
            headers: {
              'Client-ID': env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${twitchAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title,
              cost,
              is_enabled: true,
              is_max_per_stream_enabled: isMaxPerStreamEnabled,
              max_per_stream: maxPerStream,
              // Keep other limits unlimited; creators can refine in Twitch dashboard if desired
              is_max_per_user_per_stream_enabled: false,
              is_global_cooldown_enabled: false
            })
          });

          const data = await twitchResp.json();
          if (!twitchResp.ok) {
            console.error('[Twitch Auto Reward] Failed:', twitchResp.status, data);
            throw new Error(data.message || 'Failed to create Channel Points reward via Twitch API');
          }

          const reward = data.data && data.data[0];
          const rewardId = reward?.id;

          if (rewardId) {
            const { error: updErr } = await supabase
              .from('streamers')
              .update({ twitch_reward_id: rewardId })
              .eq('id', streamer.id);
            if (updErr) throw updErr;
          }

          return secureResponse({ success: true, reward_id: rewardId, reward }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Twitch Auto Reward] Error:', e);
          return secureResponse({ error: e.message || 'Failed to auto-create reward' }, 400, corsHeaders);
        }
      }

      // Save Rarity Configuration
      if (method === 'POST' && path === '/api/creator/rarity-config') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          const { error: configErr } = await supabase.from('streamer_rarity_configs').upsert({
            streamer_id: streamer.id,
            common_weight: b.common || 70,
            rare_weight: b.rare || 20,
            epic_weight: b.epic || 8,
            legendary_weight: b.legendary || 2
          }, { onConflict: 'streamer_id' });

          if (configErr) throw configErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Activate Streamer
      if (method === 'POST' && path === '/api/creator/activate') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          console.log(`[Creator/Activate] Checking activation for streamer: ${streamer.id}`);
          console.log(`[Creator/Activate] Current reward_id: ${streamer.twitch_reward_id}`);
          console.log(`[Creator/Activate] Current is_active: ${streamer.is_active}`);

          // Check current card count (for info only; no hard requirement)
          const { count: cardCount, error: countError } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          if (countError) {
            console.error(`[Creator/Activate] Error counting cards:`, countError);
          } else {
            console.log(`[Creator/Activate] Card count: ${cardCount || 0}`);
          }

          // Activate regardless of reward/cards – Twitch and cards can be added later
          const { error: activateErr } = await supabase
            .from('streamers')
            .update({ is_active: true })
            .eq('id', streamer.id);

          if (activateErr) {
            console.error(`[Creator/Activate] Error activating:`, activateErr);
            throw activateErr;
          }

          return secureResponse({
            success: true,
            message: 'Streamer activated successfully',
            hints: {
              has_reward: !!streamer.twitch_reward_id,
              card_count: cardCount || 0
            }
          }, 200, corsHeaders);
        } catch (e: any) {
          console.error(`[Creator/Activate] Exception:`, e);
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get own cards
      if (method === 'GET' && path === '/api/creator/cards') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data: cData, error: cErr } = await supabase
            .from('cards')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false });
          if (cErr) throw cErr;
          return secureResponse(cData, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Creator: Create/Update own card
      if (method === 'POST' && path === '/api/creator/cards') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          // Validate set_id if provided
          if (b.set_id) {
            const { data: setCheck, error: setCheckErr } = await supabase
              .from('streamer_sets')
              .select('id')
              .eq('id', b.set_id)
              .eq('streamer_id', streamer.id)
              .maybeSingle();

            if (setCheckErr || !setCheck) {
              return secureResponse('Invalid Set ID or you do not have permission to use this set', 400, corsHeaders, true);
            }
          }

          const isUpdate = !!b.id;
          let cardData: any = {};

          if (isUpdate) {
            const { data: existingCard, error: fetchErr } = await supabase
              .from('cards')
              .select('*')
              .eq('id', b.id)
              .eq('streamer_id', streamer.id)
              .maybeSingle();

            if (fetchErr) throw fetchErr;
            if (!existingCard) return secureResponse('Card not found', 404, corsHeaders, true);

            // Handle R2 cleanup if image is changing
            if (b.image_url && b.image_url !== existingCard.image_url) {
              const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
              if (r2Key && env.CARD_IMAGES) {
                try { await env.CARD_IMAGES.delete(r2Key); } catch (_) {}
              }
            }

            // Merge: existing + provided
            cardData = {
              ...existingCard,
              ...b,
              streamer_id: streamer.id, // Ensure ownership
            };
            delete cardData.updated_at; // cards table has no updated_at column
          } else {
            // Create mode
            const cardId = `${streamer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            cardData = {
              id: cardId,
              streamer_id: streamer.id,
              name: b.name || 'Untitled Card',
              rarity: b.rarity || 'Common',
              type: b.type || 'Unit',
              description: b.description || '',
              attack: b.attack || 0,
              defense: b.defense || 0,
              image_url: b.image_url || '/pack.png',
              is_approved: true,
              set_id: b.set_id || null,
              card_number: b.card_number || null,
              created_at: new Date().toISOString()
            };
          }

          const { data, error: upsertErr } = await supabase.from('cards').upsert(cardData).select().single();
          if (upsertErr) throw upsertErr;

          // Global Stat Sync: Update all existing user card instances if stats changed
          if (b.attack !== undefined || b.defense !== undefined) {
              await supabase.from('user_cards')
                .update({
                  attack: cardData.attack,
                  defense: cardData.defense,
                  max_hp: cardData.defense
                })
                .eq('card_id', cardData.id);
          }

          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          console.error("[Creator Cards POST] Error:", e);
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get all card backs
      if (method === 'GET' && path === '/api/creator/card-backs') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('streamer_card_backs')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

          if (error) throw error;
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Create card back
      if (method === 'POST' && path === '/api/creator/card-backs') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          const cardBackData: any = {
            streamer_id: streamer.id,
            name: b.name || 'Card Back',
            image_url: b.image_url,
            description: b.description || null,
            is_default: b.is_default || false,
            is_active: true
          };

          const { data, error } = await supabase
            .from('streamer_card_backs')
            .insert(cardBackData)
            .select()
            .single();

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Update card back
      if (method === 'PUT' && path.startsWith('/api/creator/card-backs/')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split('/').pop();

          // Verify ownership
          const { data: existing, error: checkErr } = await supabase
            .from('streamer_card_backs')
            .select('id')
            .eq('id', cardBackId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existing) {
            return secureResponse('Card back not found or access denied', 404, corsHeaders, true);
          }

          const b = await request.json() as any;
          const updateData: any = {};
          if (b.name) updateData.name = b.name;
          if (b.image_url) updateData.image_url = b.image_url;
          if (b.description !== undefined) updateData.description = b.description;
          if (b.is_default !== undefined) updateData.is_default = b.is_default;
          if (b.is_active !== undefined) updateData.is_active = b.is_active;
          updateData.updated_at = new Date().toISOString();

          const { data, error } = await supabase
            .from('streamer_card_backs')
            .update(updateData)
            .eq('id', cardBackId)
            .select()
            .single();

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Delete card back
      if (method === 'DELETE' && path.startsWith('/api/creator/card-backs/')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split('/').pop();

          // Verify ownership
          const { data: existing, error: checkErr } = await supabase
            .from('streamer_card_backs')
            .select('id')
            .eq('id', cardBackId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existing) {
            return secureResponse('Card back not found or access denied', 404, corsHeaders, true);
          }

          const { error } = await supabase
            .from('streamer_card_backs')
            .delete()
            .eq('id', cardBackId);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Set default card back
      if (method === 'POST' && path.startsWith('/api/creator/card-backs/') && path.endsWith('/set-default')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardBackId = path.split('/')[4]; // /api/creator/card-backs/:id/set-default

          // Verify ownership
          const { data: existing, error: checkErr } = await supabase
            .from('streamer_card_backs')
            .select('id')
            .eq('id', cardBackId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existing) {
            return secureResponse('Card back not found or access denied', 404, corsHeaders, true);
          }

          // Unset all other defaults
          await supabase
            .from('streamer_card_backs')
            .update({ is_default: false })
            .eq('streamer_id', streamer.id)
            .neq('id', cardBackId);

          // Set this one as default
          const { data, error } = await supabase
            .from('streamer_card_backs')
            .update({ is_default: true })
            .eq('id', cardBackId)
            .select()
            .single();

          // Also update streamers.card_back_url for backward compatibility
          if (data) {
            await supabase
              .from('streamers')
              .update({ card_back_url: data.image_url })
              .eq('id', streamer.id);
          }

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Analytics Overview
      if (method === 'GET' && path === '/api/creator/analytics/overview') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');

          // Get current stats
          const { data: streamerData } = await supabase
            .from('streamers')
            .select('total_cards, total_collectors, total_packs_opened')
            .eq('id', streamer.id)
            .single();

          // Get stats from previous period for comparison
          const previousPeriodStart = new Date();
          previousPeriodStart.setDate(previousPeriodStart.getDate() - (days * 2));
          const previousPeriodEnd = new Date();
          previousPeriodEnd.setDate(previousPeriodEnd.getDate() - days);

          // Get collector growth data
          const { data: collectorGrowth } = await supabase
            .from('user_cards')
            .select('granted_at, twitch_id')
            .eq('streamer_id', streamer.id)
            .gte('granted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('granted_at', { ascending: true });

          // Calculate growth data points (daily)
          const growthData: any[] = [];
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            const dayCollectors = new Set(
              collectorGrowth?.filter(c => c.granted_at?.startsWith(dateStr)).map(c => c.twitch_id) || []
            );

            growthData.push({
              date: dateStr,
              count: dayCollectors.size
            });
          }

          // Calculate changes
          const previousCollectors = await supabase
            .from('user_cards')
            .select('twitch_id', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id)
            .gte('granted_at', previousPeriodStart.toISOString())
            .lte('granted_at', previousPeriodEnd.toISOString());

          const currentCollectors = await supabase
            .from('user_cards')
            .select('twitch_id', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id)
            .gte('granted_at', previousPeriodEnd.toISOString());

          return secureResponse({
            total_cards: streamerData?.total_cards || 0,
            total_collectors: streamerData?.total_collectors || 0,
            total_packs_opened: streamerData?.total_packs_opened || 0,
            cards_change: 0, // Would calculate from previous period
            collectors_change: (currentCollectors.count || 0) - (previousCollectors.count || 0),
            packs_change: 0, // Would calculate from previous period
            growth_data: growthData
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Card Analytics
      if (method === 'GET' && path === '/api/creator/analytics/cards') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');

          // Get most collected cards
          const { data: mostCollected } = await supabase
            .from('user_cards')
            .select('card_id, cards(name, image_url, rarity)')
            .eq('streamer_id', streamer.id)
            .gte('granted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

          // Count collections per card
          const cardCounts: any = {};
          mostCollected?.forEach(uc => {
            const cardId = uc.card_id;
            if (!cardCounts[cardId]) {
              cardCounts[cardId] = {
                id: cardId,
                name: (uc.cards as any)?.name || 'Unknown',
                image_url: (uc.cards as any)?.image_url || '/pack.png',
                rarity: (uc.cards as any)?.rarity || 'common',
                collection_count: 0
              };
            }
            cardCounts[cardId].collection_count++;
          });

          const mostCollectedList = Object.values(cardCounts)
            .sort((a: any, b: any) => b.collection_count - a.collection_count)
            .slice(0, 10);

          // Get rarest cards (least collected)
          const { data: allCards } = await supabase
            .from('cards')
            .select('id, name, image_url, rarity')
            .eq('streamer_id', streamer.id);

          const allCardIds = allCards?.map(c => c.id) || [];
          const { data: allCollections } = await supabase
            .from('user_cards')
            .select('card_id')
            .eq('streamer_id', streamer.id)
            .in('card_id', allCardIds);

          const collectionCounts: any = {};
          allCollections?.forEach(uc => {
            collectionCounts[uc.card_id] = (collectionCounts[uc.card_id] || 0) + 1;
          });

          const rarestList = allCards
            ?.map(card => ({
              id: card.id,
              name: card.name,
              image_url: card.image_url,
              rarity: card.rarity,
              collection_count: collectionCounts[card.id] || 0
            }))
            .sort((a, b) => a.collection_count - b.collection_count)
            .slice(0, 10) || [];

          // Community Discovery Progress
          const communityDiscovery: any = { common: { total: 0, found: 0 }, rare: { total: 0, found: 0 }, epic: { total: 0, found: 0 }, legendary: { total: 0, found: 0 } };

          allCards?.forEach(card => {
            const rarity = card.rarity?.toLowerCase() || 'common';
            if (!communityDiscovery[rarity]) communityDiscovery[rarity] = { total: 0, found: 0 };
            communityDiscovery[rarity].total++;

            if (collectionCounts[card.id] > 0) {
              communityDiscovery[rarity].found++;
            }
          });

          return secureResponse({
            most_collected: mostCollectedList,
            rarest: rarestList,
            community_discovery: communityDiscovery
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Collector Analytics
      if (method === 'GET' && path === '/api/creator/analytics/collectors') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');

          // Get top collectors
          const { data: userCards } = await supabase
            .from('user_cards')
            .select('twitch_id, card_id, users(username)')
            .eq('streamer_id', streamer.id);

          const collectorStats: any = {};
          userCards?.forEach(uc => {
            const twitchId = uc.twitch_id;
            if (!collectorStats[twitchId]) {
              collectorStats[twitchId] = {
                twitch_id: twitchId,
                username: (uc.users as any)?.username || 'Unknown',
                total_cards: 0,
                unique_cards: new Set()
              };
            }
            collectorStats[twitchId].total_cards++;
            collectorStats[twitchId].unique_cards.add(uc.card_id);
          });

          const collectorsArray = Object.values(collectorStats);
          const topCollectors = collectorsArray
            .map((stat: any) => ({
              twitch_id: stat.twitch_id,
              username: stat.username,
              total_cards: stat.total_cards,
              unique_cards: stat.unique_cards.size
            }))
            .sort((a: any, b: any) => b.total_cards - a.total_cards)
            .slice(0, 10);

          // Calculate binder completion
          const { count: totalUniqueCards } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          const totalCards = totalUniqueCards || 1; // Prevent division by zero
          const totalCollectorsNum = collectorsArray.length;

          let avgCompletionRaw = 0;
          let top10CompletionRaw = 0;

          if (totalCollectorsNum > 0) {
            const sumUnique = collectorsArray.reduce((sum: number, stat: any) => sum + stat.unique_cards.size, 0);
            const avgUnique = sumUnique / totalCollectorsNum;
            avgCompletionRaw = (avgUnique / totalCards) * 100;

            // Top 10%
            const sortedByUnique = [...collectorsArray].sort((a: any, b: any) => b.unique_cards.size - a.unique_cards.size);
            const top10Count = Math.max(1, Math.ceil(totalCollectorsNum * 0.1));
            const top10Unique = sortedByUnique.slice(0, top10Count).reduce((sum: number, stat: any) => sum + stat.unique_cards.size, 0);
            top10CompletionRaw = ((top10Unique / top10Count) / totalCards) * 100;
          }

          return secureResponse({
            top_collectors: topCollectors,
            total_collectors: totalCollectorsNum,
            binder_completion: {
              average_completion_pct: Math.round(avgCompletionRaw),
              top_10_completion_pct: Math.round(top10CompletionRaw)
            }
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Validate Reward ID
      if (method === 'GET' && path === '/api/creator/validate-reward') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const rewardId = url.searchParams.get('reward_id');

          if (!rewardId) {
            return secureResponse({ valid: false, error: 'No reward ID provided' }, 400, corsHeaders);
          }

          // Validate with Twitch API (would need Twitch client credentials)
          // For now, just check format
          const isValidFormat = /^[a-f0-9]{36}$/i.test(rewardId);

          return secureResponse({
            valid: isValidFormat,
            error: isValidFormat ? null : 'Invalid reward ID format'
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ valid: false, error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Get Webhook Status
      if (method === 'GET' && path === '/api/creator/webhook-status') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // Check if webhook secret exists and is configured
          const hasWebhook = !!streamer.webhook_secret;
          const hasRewardId = !!streamer.twitch_reward_id;

          return secureResponse({
            status: hasWebhook && hasRewardId ? 'active' : 'inactive',
            has_webhook: hasWebhook,
            has_reward_id: hasRewardId
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ status: 'error', error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Test Webhook
      if (method === 'POST' && path === '/api/creator/test-webhook') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // In a real implementation, this would send a test webhook event
          // For now, just log it
          await logSystem(supabase, 'info', 'webhook', `Test webhook triggered for ${streamer.username}`, streamer.id);

          return secureResponse({ success: true, message: 'Test webhook sent' }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ success: false, error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Get Webhook Events
      if (method === 'GET' && path === '/api/creator/webhook-events') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // system_logs table has been removed for optimization. 
          // Native logging or console logs should be used instead.
          return secureResponse([], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse([], 200, corsHeaders);
        }
      }

      // Creator: Get Automation Settings
      if (method === 'GET' && path === '/api/creator/automation') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // Return default automation settings (would be stored in database)
          return secureResponse({
            scheduled_drops_enabled: false,
            milestone_rewards_enabled: false,
            chat_command_enabled: false,
            chat_command: '!drop',
            scheduled_drops: []
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Save Automation Settings
      if (method === 'POST' && path === '/api/creator/automation') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          // Store automation settings (would be in a separate table or JSON column)
          await logSystem(supabase, 'info', 'system', `Automation settings updated for ${streamer.username}`, streamer.id);

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Get Analytics Overview
      if (method === 'GET' && path === '/api/creator/analytics/overview') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');

          // 1. Total Pulls (Cards granted)
          const { count: totalPulls } = await supabase
            .from('user_cards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id)
            .gte('granted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

          // 2. New Collectors
          const { count: newCollectors } = await supabase
            .from('user_cards')
            .select('twitch_id', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id)
            .gte('granted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

          // 3. Active Sets
          const { count: activeSets } = await supabase
            .from('streamer_sets')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id)
            .eq('is_active', true);

          return secureResponse({
            total_pulls: totalPulls || 0,
            new_collectors: newCollectors || 0, // This is simplified, should be distinct twitch_id
            active_sets: activeSets || 0,
            completion_rate: 0 // Placeholder
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Save Milestone Reward
      if (method === 'POST' && path === '/api/creator/automation/milestone') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          // Store milestone configuration
          await logSystem(supabase, 'info', 'system', `Milestone reward set at ${b.followers} followers for ${streamer.username}`, streamer.id);

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Get Settings
      if (method === 'GET' && path === '/api/creator/settings') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          return secureResponse(streamer, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Creator: Update Settings (PATCH)
      if (method === 'PATCH' && path === '/api/creator/settings') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          const updateData: any = {};
          if (b.brand_name) updateData.brand_name = b.brand_name;
          if (b.brand_tagline !== undefined) updateData.brand_tagline = b.brand_tagline;
          if (b.pack_image_url) updateData.pack_image_url = b.pack_image_url;
          if (b.card_back_url) updateData.card_back_url = b.card_back_url;
          if (b.pack_open_sound_url) updateData.pack_open_sound_url = b.pack_open_sound_url;
          if (b.twitch_reward_id !== undefined) updateData.twitch_reward_id = b.twitch_reward_id;
          if (b.twitch_battle_reward_id !== undefined) updateData.twitch_battle_reward_id = b.twitch_battle_reward_id;
          if (b.battles_enabled !== undefined) updateData.battles_enabled = b.battles_enabled;
          if (b.trading_enabled !== undefined) updateData.trading_enabled = b.trading_enabled;
          if (b.binder_color !== undefined) updateData.binder_color = b.binder_color;

          const { data, error } = await supabase
            .from('streamers')
            .update(updateData)
            .eq('id', streamer.id)
            .select()
            .single();

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Stats
      if (method === 'GET' && path === '/api/creator/stats') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          const { count: cardCount } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          // Get unique collectors from the leaderboard view
          const { count: collectorCount } = await supabase
            .from('streamer_leaderboards')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          return secureResponse({
            total_cards: cardCount || 0,
            community: collectorCount || 0,
            is_active: streamer.is_active
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Pack Analytics
      if (method === 'GET' && path === '/api/creator/analytics/packs') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');

          // Get pack opening activity (simplified - would need pack tracking)
          const { data: recentOpenings } = await supabase
            .from('user_cards')
            .select('granted_at')
            .eq('streamer_id', streamer.id)
            .gte('granted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('granted_at', { ascending: true });

          // Group by day
          const activityData: any[] = [];
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            const dayOpenings = recentOpenings?.filter(o => o.granted_at?.startsWith(dateStr)).length || 0;

            activityData.push({
              date: dateStr,
              count: dayOpenings
            });
          }

          return secureResponse({
            total_openings: recentOpenings?.length || 0,
            activity_data: activityData
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Assign card to set (must come before other card operations)
      if (method === 'POST' && path.startsWith('/api/creator/cards/') && path.endsWith('/assign-set')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split('/')[4]; // /api/creator/cards/:id/assign-set
          const b = await request.json() as any;

          // Verify card ownership
          const { data: existingCard, error: cardErr } = await supabase
            .from('cards')
            .select('id, streamer_id')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .single();

          if (cardErr || !existingCard) {
            return secureResponse('Card not found or access denied', 404, corsHeaders, true);
          }

          // Verify set ownership if set_id provided
          if (b.set_id) {
            const { data: existingSet, error: setErr } = await supabase
              .from('streamer_sets')
              .select('id')
              .eq('id', b.set_id)
              .eq('streamer_id', streamer.id)
              .single();

            if (setErr || !existingSet) {
              return secureResponse('Set not found or access denied', 404, corsHeaders, true);
            }
          }

          // Update card set_id
          const { data, error: updateErr } = await supabase
            .from('cards')
            .update({ set_id: b.set_id || null })
            .eq('id', cardId)
            .select()
            .single();

          if (updateErr) throw updateErr;

          // Update set total_cards count
          if (b.set_id) {
            const { count } = await supabase
              .from('cards')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', b.set_id);

            await supabase
              .from('streamer_sets')
              .update({ total_cards: count || 0 })
              .eq('id', b.set_id);
          }

          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Trigger Special Event (Rarity Boost)
      if (method === 'POST' && path === '/api/creator/events') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;
          
          const durationHrs = Math.max(1, parseInt(b.duration || '1'));
          const startsAt = new Date();
          const endsAt = new Date(startsAt.getTime() + durationHrs * 60 * 60 * 1000);
          
          const rarity = b.target_rarity || 'rare';
          const multiplier = parseFloat(b.multiplier || '2');
          
          // Default weights as base: common: 70, rare: 20, epic: 8, legendary: 2
          const config = { common: 70, rare: 20, epic: 8, legendary: 2 };
          const baseWeight = (config as any)[rarity];
          const newWeight = Math.min(baseWeight * multiplier, 50); 
          const diff = newWeight - baseWeight;
          
          config.common = Math.max(10, config.common - diff); 
          (config as any)[rarity] = newWeight;

          const { data, error } = await supabase.from('streamer_events').insert({
            streamer_id: streamer.id,
            type: b.type || 'rarity_boost',
            name: `${rarity.toUpperCase()} Protocol Boost`,
            config,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString()
          }).select().single();

          if (error) throw error;
          
          await logSystem(supabase, 'info', 'admin', `Special Event initiated: ${data.name}`, streamer.id);
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Active Event
      if (method === 'GET' && path === '/api/creator/events/active') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const now = new Date().toISOString();
          const { data, error } = await supabase
            .from('streamer_events')
            .select('*')
            .eq('streamer_id', streamer.id)
            .eq('is_active', true)
            .lte('starts_at', now)
            .gte('ends_at', now)
            .maybeSingle();

          if (error) throw error;
          return secureResponse(data || null, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'PUT' && path.startsWith('/api/creator/cards/')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split('/').pop();
          const b = await request.json() as any;

          // Verify ownership and get current image_url for optional R2 cleanup
          const { data: existingCard, error: checkErr } = await supabase
            .from('cards')
            .select('id, streamer_id, image_url')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingCard) {
            return secureResponse('Card not found or access denied', 404, corsHeaders, true);
          }

          // When re-uploading art, remove old image from R2 to avoid orphaned objects
          if (b.image_url && existingCard.image_url !== b.image_url) {
            const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
            if (r2Key && env.CARD_IMAGES) {
              try {
                await env.CARD_IMAGES.delete(r2Key);
              } catch (_) {
                // ignore delete errors (object may already be gone)
              }
            }
          }

          const updateData: any = {};
          if (b.name) updateData.name = b.name;
          if (b.rarity) updateData.rarity = b.rarity;
          if (b.description !== undefined) updateData.description = b.description;
          if (b.attack !== undefined) updateData.attack = b.attack;
          if (b.defense !== undefined) updateData.defense = b.defense;
          if (b.image_url) updateData.image_url = b.image_url;
          if (b.set_id !== undefined) updateData.set_id = b.set_id;
          if (b.card_number !== undefined) updateData.card_number = b.card_number;
          if (b.is_battle_eligible !== undefined) updateData.is_battle_eligible = b.is_battle_eligible;
          if (b.is_trading_eligible !== undefined) updateData.is_trading_eligible = b.is_trading_eligible;
          // mechanic_id removed (now random on grant)

          const { data, error: updateErr } = await supabase
            .from('cards')
            .update(updateData)
            .eq('id', cardId)
            .select()
            .single();

          if (updateErr) throw updateErr;

          // Global Stat Sync: Update user collection if attack or defense changed
          if (b.attack !== undefined || b.defense !== undefined) {
            const syncData: any = {};
            if (b.attack !== undefined) syncData.attack = b.attack;
            if (b.defense !== undefined) {
              syncData.defense = b.defense;
              syncData.max_hp = b.defense;
            }
            await supabase.from('user_cards').update(syncData).eq('card_id', cardId);
          }

          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Delete own card
      if (method === 'DELETE' && path.startsWith('/api/creator/cards/') && !path.endsWith('/assign-set')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const cardId = path.split('/').pop();

          // Verify ownership and get image_url for R2 cleanup
          const { data: existingCard, error: checkErr } = await supabase
            .from('cards')
            .select('id, streamer_id, image_url')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingCard) {
            return secureResponse('Card not found or access denied', 404, corsHeaders, true);
          }

          // Remove card art from R2 so we don't leave orphaned objects
          const r2Key = getR2KeyFromImageUrl(existingCard.image_url);
          if (r2Key && env.CARD_IMAGES) {
            try {
              await env.CARD_IMAGES.delete(r2Key);
            } catch (_) {
              // ignore
            }
          }

          // Delete card
          const { error: deleteErr } = await supabase
            .from('cards')
            .delete()
            .eq('id', cardId);

          if (deleteErr) throw deleteErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get own sets
      if (method === 'GET' && path === '/api/creator/sets') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data: sData, error: sErr } = await supabase
            .from('streamer_sets')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false });
          if (sErr) throw sErr;
          return secureResponse(sData, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Creator: Get own cards
      if (method === 'GET' && path === '/api/creator/cards') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('cards')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('name', { ascending: true });
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Grant card to user
      if (method === 'POST' && path === '/api/creator/grant') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;
          if (!b.twitch_id) throw new Error('Missing twitch_id');
          if (!b.card_id && !b.random_rarity) throw new Error('Missing card_id or random_rarity');

          const isRandom = b.card_id === 'random';
          const forcedCardId = isRandom ? undefined : b.card_id;
          const forcedRarity = isRandom ? b.random_rarity : undefined;

          // Call updated grantRandomCard
          await grantRandomCard(supabase, b.twitch_id, b.username || 'System Grant', streamer.id, null, env, {
            forcedCardId,
            forcedRarity,
            isSilent: b.is_silent
          });
          
          const logMsg = forcedCardId ? `Creator granted specific card ${forcedCardId} to ${b.twitch_id}` : `Creator granted random ${forcedRarity || 'any'} card to ${b.twitch_id}`;
          await logSystem(supabase, 'info', 'grant', logMsg, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Create/Update own set
      if (method === 'POST' && path === '/api/creator/sets') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;

          // streamer_sets has UUID id with default, but we should only set it if provided
          const setData: any = {
            streamer_id: streamer.id,
            name: b.name,
            code: b.code || b.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10),
            description: b.description || null,
            total_cards: b.total_cards || 0
          };

          // Only set id if provided (otherwise let DB generate it)
          if (b.id) setData.id = b.id;
          if (b.icon_url) setData.icon_url = b.icon_url;
          if (b.release_date) setData.release_date = b.release_date;
          if (b.end_date) setData.end_date = b.end_date;
          if (b.is_active !== undefined) setData.is_active = b.is_active;

          const { data, error: setErr } = await supabase.from('streamer_sets').upsert(setData).select().single();

          if (setErr) throw setErr;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Update own set
      if (method === 'PUT' && path.startsWith('/api/creator/sets/')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split('/').pop();
          const b = await request.json() as any;

          // Verify ownership
          const { data: existingSet, error: checkErr } = await supabase
            .from('streamer_sets')
            .select('id')
            .eq('id', setId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingSet) {
            return secureResponse('Set not found or access denied', 404, corsHeaders, true);
          }

          const updateData: any = {};
          if (b.name) updateData.name = b.name;
          if (b.code) updateData.code = b.code;
          if (b.description !== undefined) updateData.description = b.description;
          if (b.icon_url !== undefined) updateData.icon_url = b.icon_url;
          if (b.release_date !== undefined) updateData.release_date = b.release_date;
          if (b.end_date !== undefined) updateData.end_date = b.end_date;
          if (b.is_active !== undefined) updateData.is_active = b.is_active;

          const { data, error: updateErr } = await supabase
            .from('streamer_sets')
            .update(updateData)
            .eq('id', setId)
            .select()
            .single();

          if (updateErr) throw updateErr;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Delete own set
      if (method === 'DELETE' && path.startsWith('/api/creator/sets/')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split('/').pop();

          // Verify ownership
          const { data: existingSet, error: checkErr } = await supabase
            .from('streamer_sets')
            .select('id')
            .eq('id', setId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingSet) {
            return secureResponse('Set not found or access denied', 404, corsHeaders, true);
          }

          // Delete set (cascade will handle cards)
          const { error: deleteErr } = await supabase
            .from('streamer_sets')
            .delete()
            .eq('id', setId);

          if (deleteErr) throw deleteErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get set statistics
      if (method === 'GET' && path.startsWith('/api/creator/sets/') && path.endsWith('/stats')) {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const setId = path.split('/')[4]; // /api/creator/sets/:id/stats

          // Verify ownership
          const { data: existingSet, error: checkErr } = await supabase
            .from('streamer_sets')
            .select('id')
            .eq('id', setId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingSet) {
            return secureResponse('Set not found or access denied', 404, corsHeaders, true);
          }

          // Get card count in set
          const { count: cardCount } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('set_id', setId);

          // Get collector count (users who have cards from this set)
          // First get all card IDs in this set
          const { data: setCards } = await supabase
            .from('cards')
            .select('id')
            .eq('set_id', setId);

          const cardIds = setCards?.map(c => c.id) || [];
          let collectorCount = 0;

          if (cardIds.length > 0) {
            const { count } = await supabase
              .from('user_cards')
              .select('twitch_id', { count: 'exact', head: true })
              .in('card_id', cardIds);
            collectorCount = count || 0;
          }

          return secureResponse({
            card_count: cardCount || 0,
            collector_count: collectorCount || 0
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }


      // 7. Get All Cards
      if (method === 'GET' && path === '/api/admin/cards') {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase
            .from('cards')
            .select('*')
            .order('id', { ascending: true });

          if (error) throw error;
          return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      // 8. Delete Card
      if (method === 'DELETE' && path === '/api/admin/cards') {
        try {
          await checkAdmin(request);
          const cardId = url.searchParams.get('card_id');
          if (!cardId) throw new Error("Missing card_id");

          const { error } = await supabase.from('cards').delete().eq('id', cardId);
          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      // 9. Admin Stats
      if (method === 'GET' && path === '/api/admin/stats') {
        try {
          await checkAdmin(request);

          const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { count: cardCount } = await supabase.from('user_cards').select('*', { count: 'exact', head: true });
          const { count: uniqueCount } = await supabase.from('cards').select('*', { count: 'exact', head: true });

          const { data: legendaryCards } = await supabase.from('cards').select('id').eq('rarity', 'Legendary');
          const legendaryIds = legendaryCards?.map(c => c.id) || [];
          const { count: legendaryCount } = await supabase
            .from('user_cards')
            .select('*', { count: 'exact', head: true })
            .in('card_id', legendaryIds);

          return new Response(JSON.stringify({
            total_users: userCount || 0,
            total_cards: cardCount || 0,
            unique_cards: uniqueCount || 0,
            legendary_count: legendaryCount || 0
          }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      // --- SETS MANAGEMENT ---

      // Public: Get all sets (for progress tracking)
      if (method === 'GET' && path === '/api/sets') {
        try {
          const { data, error } = await supabase
            .from('streamer_sets')
            .select('*')
            .order('release_date', { ascending: false });

          if (error) throw error;
          return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 500, headers: corsHeaders });
        }
      }

      // Get all sets
      if (method === 'GET' && path === '/api/admin/sets') {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase
            .from('streamer_sets')
            .select('*')
            .order('release_date', { ascending: false });

          if (error) throw error;
          return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      // Create set
      if (method === 'POST' && path === '/api/admin/sets') {
        try {
          await checkAdmin(request);
          const body = await request.json() as AdminSetBody;

          const { error } = await supabase.from('streamer_sets').upsert({
            id: body.id,
            name: body.name,
            code: body.code,
            icon_url: body.icon_url,
            release_date: body.release_date,
            description: body.description,
            total_cards: body.total_cards || 0,
            card_back_url: body.card_back_url || null
          });

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Validation failed', 400, corsHeaders, true);
        }
      }

      // Update set
      if (method === 'PUT' && path.startsWith('/api/admin/sets/')) {
        try {
          await checkAdmin(request);
          const setId = url.pathname.split('/').pop();
          const body = await request.json() as AdminSetBody;

          const { error } = await supabase
            .from('streamer_sets')
            .update({
              name: body.name,
              code: body.code,
              icon_url: body.icon_url,
              release_date: body.release_date,
              description: body.description,
              total_cards: body.total_cards,
              card_back_url: body.card_back_url
            })
            .eq('id', setId);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Update failed', 400, corsHeaders, true);
        }
      }

      // Delete set
      if (method === 'DELETE' && path.startsWith('/api/admin/sets/')) {
        try {
          await checkAdmin(request);
          const setId = url.pathname.split('/').pop();

          // Check if any cards use this set
          const { count } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('set_id', setId);

          if (count && count > 0) {
            return secureResponse('Cannot delete set with existing cards', 400, corsHeaders, true);
          }

          const { error } = await supabase.from('streamer_sets').delete().eq('id', setId);
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Delete failed', 400, corsHeaders, true);
        }
      }

      // 10. Bulk Delete
      if (method === 'DELETE' && path === '/api/admin/bulk/delete-all-cards') {
        try {
          await checkAdmin(request);
          const { error } = await supabase.from('user_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      if (method === 'DELETE' && path === '/api/admin/bulk/delete-all-trades') {
        try {
          await checkAdmin(request);
          // Delete trade items first due to foreign key
          await supabase.from('trade_items').delete().neq('trade_id', '00000000-0000-0000-0000-000000000000');
          const { error } = await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      // 11. Export
      if (method === 'GET' && path === '/api/admin/export') {
        try {
          await checkAdmin(request);

          const { data: users } = await supabase.from('users').select('*');
          const { data: cards } = await supabase.from('cards').select('*');
          const { data: userCards } = await supabase.from('user_cards').select('*');

          return secureResponse({
            exported_at: new Date().toISOString(),
            users,
            cards,
            user_cards: userCards
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // --- VIEWER API (Account level) ---

      // Get all streamers I have cards from
      if (method === 'GET' && path === '/api/me/streamers') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const { data, error } = await supabase
          .from('user_collection_by_streamer')
          .select('*')
          .eq('twitch_id', user.twitch_id);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(data, 200, corsHeaders);
      }

      // --- CREATOR API (Multi-Tenant) ---

      // 6.1 Get Creator Profile/Settings
      if (method === 'GET' && path === '/api/creator/profile') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Forbidden: No streamer record found for your Twitch account', 403, corsHeaders, true);

        return secureResponse(streamer, 200, corsHeaders);
      }

      // 6.2 Update Creator Settings
      if (method === 'POST' && path === '/api/creator/settings') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Forbidden', 403, corsHeaders, true);

        try {
          const body = await request.json() as any;
          // Whitelist allowed fields
          const allowedFields = [
            'brand_name', 'brand_tagline', 'pack_image_url', 'card_back_url',
            'pack_open_sound_url', 'twitch_client_secret', 'streamelements_jwt',
            'twitch_reward_id', 'twitch_battle_reward_id'
          ];

          const updates: any = {};
          for (const field of allowedFields) {
            if (body[field] !== undefined) {
              if (['twitch_client_secret', 'streamelements_jwt'].includes(field) && body[field]) {
                updates[field] = await encryptSensitive(body[field], env.SESSION_SECRET);
              } else {
                updates[field] = body[field];
              }
            }
          }
          updates.updated_at = new Date().toISOString();

          const { error } = await supabase
            .from('streamers')
            .update(updates)
            .eq('id', streamer.id);

          if (error) throw error;
          await logSystem(supabase, 'info', 'admin', `Streamer @${streamer.username} updated brand settings`, streamer.id);

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Update failed', 500, corsHeaders, true);
        }
      }

      // 6.3 Get Creator Analytics
      if (method === 'GET' && path === '/api/creator/analytics') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Forbidden', 403, corsHeaders, true);

        const { data: analytics, error } = await supabase
          .from('streamer_analytics')
          .select('*')
          .eq('streamer_id', streamer.id)
          .order('date', { ascending: false })
          .limit(30);

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(analytics, 200, corsHeaders);
      }

      // 6.4 Get Creator Cards
      if (method === 'GET' && path === '/api/creator/cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Forbidden', 403, corsHeaders, true);

        const { data: cards, error } = await supabase
          .from('cards')
          .select('*')
          .eq('streamer_id', streamer.id)
          .order('card_number', { ascending: true });

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        return secureResponse(cards, 200, corsHeaders);
      }



      // 6.8 Creator: Upload Image
      if (method === 'POST' && path === '/api/creator/upload') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const formData = await request.formData();
          const file = formData.get('file') as File;

          if (!file) return secureResponse('No file uploaded', 400, corsHeaders, true);

          if (file.size > CARD_IMAGE_MAX_BYTES) {
            return secureResponse(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 413, corsHeaders, true);
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const ext = file.type === 'image/webp' ? '.webp' : (file.name.match(/\.[^/.]+$/) || ['.png'])[0];
          const fileName = `${streamer.id}/${Date.now()}-${baseName}${ext}`;
          const filePath = `${fileName}`;

          await env.CARD_IMAGES.put(filePath, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type || 'image/webp' }
          });

          const publicUrl = `https://cdn.codeoce.com/${filePath}`;

          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Upload failed', 500, corsHeaders, true);
        }
      }

      // 6.9 Creator: Onboarding Complete
      if (method === 'POST' && path === '/api/creator/onboarding/complete') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const body = await request.json() as any;
          const { identity, twitch, genesis } = body;

          // 1. Update Streamer Branding & Twitch
          const streamerUpdates: any = {
            brand_name: identity.collectionName,
            brand_tagline: identity.tagline,
            achievement_names: body.achievements || streamer.achievement_names,
            twitch_reward_id: twitch.rewardId || null,
            twitch_battle_reward_id: twitch.battleRewardId || null,
            is_active: true,
            updated_at: new Date().toISOString()
          };

          const { error: streamerErr } = await supabase
            .from('streamers')
            .update(streamerUpdates)
            .eq('id', streamer.id);

          if (streamerErr) throw streamerErr;

          // 2. Create Genesis Set
          const { data: genSet, error: setErr } = await supabase
            .from('streamer_sets')
            .upsert({
              streamer_id: streamer.id,
              name: 'Genesis Set',
              code: 'GENESIS',
              description: 'The inaugural collection.',
              is_active: true
            }, { onConflict: 'streamer_id, code' })
            .select()
            .single();

          if (setErr) throw setErr;

          // 3. Create Genesis Cards (if provided)
          if (genesis && Array.isArray(genesis)) {
            const cardsToInsert = genesis.map((card: any, idx: number) => ({
              id: `${streamer.id}-genesis-${card.rarity}`,
              streamer_id: streamer.id,
              set_id: genSet.id,
              name: card.name,
              rarity: card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1),
              image_url: card.image_url || '/pack.png',
              is_approved: true,
              card_number: (idx + 1).toString()
            }));

            const { error: cardErr } = await supabase.from('cards').upsert(cardsToInsert);
            if (cardErr) throw cardErr;
          }

          await logSystem(supabase, 'info', 'admin', `Creator @${streamer.username} completed onboarding!`, streamer.id);
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Onboarding Complete] Error:', e);
          return secureResponse(e.message || 'Onboarding completion failed', 500, corsHeaders, true);
        }
      }

      // --- PUBLIC DATA ---

      // Get all active streamers
      if (method === 'GET' && path === '/api/streamers') {
        const { data: streamers, error: sErr } = await supabase
          .from('streamers')
          .select('id, username, display_name, avatar_url')
          .eq('is_active', true);
        if (sErr) return secureResponse('Database error', 500, corsHeaders, true);
        return secureResponse(streamers, 200, corsHeaders);
      }

      // Get public config for a specific streamer
      if (method === 'GET' && path === '/api/streamer/config') {
        const streamerParam = url.searchParams.get('streamer');
        if (!streamerParam) return secureResponse('Missing streamer parameter', 400, corsHeaders, true);

        // Try lookup by ID (UUID) or Username
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerParam);

        let query = supabase.from('streamers').select('id, username, display_name, avatar_url');
        if (isUuid) {
          query = query.or(`id.eq.${streamerParam},username.eq.${streamerParam}`);
        } else {
          query = query.eq('username', streamerParam);
        }

        const { data: streamer, error } = await query.maybeSingle();

        if (error) return secureResponse(error.message, 500, corsHeaders, true);
        if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

        return secureResponse(streamer, 200, corsHeaders);
      }


      // 1. Get Collection
      if (method === 'GET' && path === '/api/collection') {
        const user = await getUserFromSession(request, env, supabase);
        const streamerParam = url.searchParams.get('streamer') || url.searchParams.get('streamer_id');

        let targetTwitchId = user?.twitch_id;

        // If no user, we might still serve public data if a streamer is provided
        if (!user) {
          if (!streamerParam) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

          // Fetch the streamer's OWN cards for public view
          const { data: stUser } = await supabase.from('users').select('twitch_id').ilike('username', streamerParam).single();
          if (!stUser) return secureResponse('Streamer user not found', 404, corsHeaders, true);
          targetTwitchId = stUser.twitch_id;
        }

        let query = supabase.from('enriched_user_cards').select('*').eq('twitch_id', targetTwitchId);

        if (streamerParam !== 'all') {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);
          query = query.eq('streamer_id', streamer.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error("DB Error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }

      // 1.5 Get Total Card Count (Public)
      if (method === 'GET' && path === '/api/cards/count') {
        const streamer = await resolveStreamerContext(request, supabase, url);
        let query = supabase.from('cards').select('*', { count: 'exact', head: true });

        if (streamer) {
          query = query.eq('streamer_id', streamer.id);
        }

        const { count, error } = await query;

        if (error) {
          console.error("DB Error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ count: count || 0 }), { status: 200, headers: corsHeaders });
      }

      // --- BATTLE SYSTEM API ---

      // Initiate Battle (Temporary for custom command testing)
      if (method === 'GET' && path === '/api/public/battle/initiate') {
        const challengerRaw = url.searchParams.get('challenger');
        const targetRaw = url.searchParams.get('target');

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response('Streamer context not found', { status: 404 });

        console.log(`[BATTLE INIT] [${streamer.username}] Raw: challenger=${challengerRaw}, target=${targetRaw}`);

        if (!challengerRaw || !targetRaw) return new Response('Missing challenger or target', { status: 400 });

        const challenger = challengerRaw.replace(/^@/, '').trim();
        const target = targetRaw.replace(/^@/, '').trim();

        // 1. Verify target has cards for THIS streamer
        const { data: targetData } = await supabase
          .from('users')
          .select('username, twitch_id')
          .ilike('username', target)
          .maybeSingle();

        if (!targetData) {
          return new Response(`@${challenger}, @${target} hasn't played streamcards tcg yet!`, { status: 200 });
        }

        const { count: tCardsCount } = await supabase
          .from('user_cards')
          .select('*', { count: 'exact', head: true })
          .eq('twitch_id', targetData.twitch_id)
          .eq('streamer_id', streamer.id);

        if (!tCardsCount || tCardsCount < 3) {
          return new Response(`@${challenger}, @${targetData.username} doesn't have enough cards in @${streamer.username}'s collection to battle!`, { status: 200 });
        }

        // 2. Verify challenger exists and has cards
        const { data: challengerData } = await supabase
          .from('users')
          .select('twitch_id, username')
          .ilike('username', challenger)
          .maybeSingle();

        if (!challengerData) {
          return new Response(`@${challenger}, you need to play streamcards tcg first!`, { status: 200 });
        }

        const { count: cCardsCount } = await supabase
          .from('user_cards')
          .select('*', { count: 'exact', head: true })
          .eq('twitch_id', challengerData.twitch_id)
          .eq('streamer_id', streamer.id);

        if (!cCardsCount || cCardsCount < 3) {
          return new Response(`@${challengerData.username}, you need at least 3 cards from @${streamer.username} to battle!`, { status: 200 });
        }

        console.log(`[BATTLE INIT] Inserting: ${challengerData.username} vs ${targetData.username} for streamer ${streamer.username}`);

        // 3. Insert Pending Battle
        const { error: insertError } = await supabase.from('battles').insert({
          streamer_id: streamer.id,
          challenger_id: challengerData.twitch_id,
          challenger_name: challengerData.username || challenger,
          target_name: targetData.username,
          status: 'pending'
        });

        if (insertError) {
          console.error("Battle Init Error:", insertError);
          return new Response('Failed to initiate battle. Try again later.', { status: 500 });
        }

        return new Response(`@${targetData.username}, ${challengerData.username || challenger} has challenged you to a battle in @${streamer.username}'s stream! Type !accept in chat to fight!`, { status: 200 });
      }

      // --- BATTLE SYSTEM API ---

      // Accept Battle
      if (method === 'GET' && path === '/api/public/battle/accept') {
        const userRaw = url.searchParams.get('user');
        if (!userRaw) return new Response('Missing user data', { status: 400 });
        const username = userRaw.replace('@', '').trim();

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response('Streamer context not found', { status: 404 });

        // 1. Find oldest pending battle for this target in THIS streamer's stream
        const { data: battle, error: bErr } = await supabase
          .from('battles')
          .select('*')
          .ilike('target_name', username)
          .eq('status', 'pending')
          .eq('streamer_id', streamer.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!battle) {
          console.log(`[BATTLE ACCEPT] [${streamer.username}] No pending battle for ${username}`);
          return new Response(`@${username}, you don't have any pending battles in @${streamer.username}'s stream!`, { status: 200 });
        }

        console.log(`[BATTLE ACCEPT] Found battle: ID=${battle.id}, ChallengerID=${battle.challenger_id}, TargetName=${battle.target_name}`);

        // 2. Fetch users and avatars
        const [{ data: targetUser }, { data: challengerUser }] = await Promise.all([
          supabase.from('users').select('username, twitch_id, avatar_url').ilike('username', username).single(),
          supabase.from('users').select('username, avatar_url').eq('twitch_id', battle.challenger_id).single()
        ]);
        if (!targetUser) return new Response(`@${username}, you aren't registered.`, { status: 200 });

        console.log(`[BATTLE ACCEPT] Users ready: Challenger=${challengerUser?.username}, Target=${targetUser.username}`);

        // 3. Fetch 3 random cards for Challenger & Target from THIS streamer's collection
        const [cDeck, tDeck] = await Promise.all([
          supabase.from('enriched_user_cards').select('name, image_url, attack, defense').eq('twitch_id', battle.challenger_id).eq('streamer_id', streamer.id).limit(100),
          supabase.from('enriched_user_cards').select('name, image_url, attack, defense').eq('twitch_id', targetUser.twitch_id).eq('streamer_id', streamer.id).limit(100)
        ]);

        if (!cDeck.data || !tDeck.data || cDeck.data.length < 3 || tDeck.data.length < 3) {
          await supabase.from('battles').update({ status: 'rejected' }).eq('id', battle.id);
          return new Response(`Battle cancelled: Someone doesn't have enough cards.`, { status: 200 });
        }

        const mapCard = (c: any) => ({
          name: c.name,
          image_url: c.image_url,
          attack: c.attack || 0,
          defense: c.defense || 0
        });

        // Shuffle and pick 3
        const shuffle = (arr: any[]) => arr.sort(() => 0.5 - Math.random());
        const challengerCards = shuffle(cDeck.data).slice(0, 3).map(mapCard);
        const targetCards = shuffle(tDeck.data).slice(0, 3).map(mapCard);

        let challengerWins = 0;
        let targetWins = 0;
        const rounds: string[] = [];
        const battleDataRounds: any[] = [];

        // 4. Combat Logic (Hearthstone style simultaneous strike)
        for (let i = 0; i < 3; i++) {
          const cCard = challengerCards[i];
          const tCard = targetCards[i];

          const cAtk = cCard.attack || 0;
          const cDef = cCard.defense || 0;
          const tAtk = tCard.attack || 0;
          const tDef = tCard.defense || 0;

          const cRemainingHealth = cDef - tAtk;
          const tRemainingHealth = tDef - cAtk;

          const cSurvived = cRemainingHealth > 0;
          const tSurvived = tRemainingHealth > 0;

          if (cSurvived && !tSurvived) challengerWins++;
          else if (tSurvived && !cSurvived) targetWins++;
          // If both die or both survive, it's a draw for that round (no points)

          // Format short summary for round: [C1] vs [T1] = [Winner]
          if (cSurvived && !tSurvived) (rounds as any[]).push(`${cCard.name} beat ${tCard.name}`);
          else if (tSurvived && !cSurvived) (rounds as any[]).push(`${tCard.name} beat ${cCard.name}`);
          else (rounds as any[]).push(`${cCard.name} tied ${tCard.name}`);

          (battleDataRounds as any[]).push({
            round: i + 1,
            challengerCard: cCard,
            targetCard: tCard,
            challengerDamageTaken: tAtk,
            targetDamageTaken: cAtk,
            challengerSurvived: cSurvived,
            targetSurvived: tSurvived,
            winner: (cSurvived && !tSurvived) ? 'challenger' : ((tSurvived && !cSurvived) ? 'target' : 'draw')
          });
        }

        let resultMsg = "";
        let overallWinner = 'draw';
        if (challengerWins > targetWins) {
          resultMsg = `@${battle.challenger_name} WINS ${challengerWins}-${targetWins}!`;
          overallWinner = 'challenger';
        } else if (targetWins > challengerWins) {
          resultMsg = `@${battle.target_name} WINS ${targetWins}-${challengerWins}!`;
          overallWinner = 'target';
        } else {
          resultMsg = `It's a TIE ${challengerWins}-${targetWins}!`;
        }

        const battleData = {
          challenger: {
            id: battle.challenger_id,
            name: battle.challenger_name,
            avatar: challengerUser?.avatar_url,
            wins: challengerWins
          },
          target: {
            id: targetUser.twitch_id,
            name: battle.target_name,
            avatar: targetUser?.avatar_url,
            wins: targetWins
          },
          rounds: battleDataRounds,
          winner: overallWinner
        };

        // 5. Update battle status and save battle_data
        await supabase.from('battles').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          battle_data: battleData
        }).eq('id', battle.id);

        // 6. Update Stats
        const initStats = async (tId: string, uName: string) => {
          const { data } = await supabase.from('battle_stats').select('twitch_id').eq('twitch_id', tId).eq('streamer_id', streamer.id).maybeSingle();
          if (!data) await supabase.from('battle_stats').insert({ twitch_id: tId, username: uName, streamer_id: streamer.id });
        };
        await Promise.all([initStats(battle.challenger_id, battle.challenger_name), initStats(targetUser.twitch_id, battle.target_name)]);

        if (challengerWins > targetWins) {
          await supabase.rpc('increment_battle_stats', { p_winner_id: battle.challenger_id, p_loser_id: targetUser.twitch_id, p_streamer_id: streamer.id });
        } else if (targetWins > challengerWins) {
          await supabase.rpc('increment_battle_stats', { p_winner_id: targetUser.twitch_id, p_loser_id: battle.challenger_id, p_streamer_id: streamer.id });
        } else {
          // Draw logic
          await supabase.rpc('increment_battle_draws', { p_user1_id: battle.challenger_id, p_user2_id: targetUser.twitch_id, p_streamer_id: streamer.id });
        }

        const summary = `💥 BATTLE! ${resultMsg} (${rounds.join(' | ')})`;
        return new Response(summary, { status: 200 });
      }

      // Battle Stats
      if (method === 'GET' && path === '/api/public/battle/stats') {
        const userRaw = url.searchParams.get('user');
        if (!userRaw) return new Response('Missing user data', { status: 400 });
        const username = userRaw.replace('@', '').trim();

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return new Response('Streamer context not found', { status: 404 });

        const { data, error } = await supabase
          .from('battle_leaderboard')
          .select('wins, losses, draws, win_rate')
          .ilike('username', username)
          .eq('streamer_id', streamer.id)
          .maybeSingle();

        if (error || !data) {
          return new Response(`🏆 @${username} hasn't fought any battles in @${streamer.username}'s stream yet!`, { status: 200 });
        }

        return new Response(`🏆 @${username} Battle Record (@${streamer.username}): ${data.wins}W - ${data.losses}L - ${data.draws}D. (Win Rate: ${data.win_rate}%)`, { status: 200 });
      }

      // Latest Battle Data for OBS
      if (method === 'GET' && path === '/api/public/battle/latest') {
        const { data, error } = await supabase
          .from('battles')
          .select('id, battle_data, completed_at')
          .eq('status', 'completed')
          .not('battle_data', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        if (!data) return new Response(JSON.stringify(null), { status: 200, headers: corsHeaders });

        return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
      }


      // 2. Get Stats
      if (method === 'GET' && path === '/api/stats') {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

          const streamerParam = url.searchParams.get('streamer');
          const isGlobal = streamerParam === 'all';

          let streamer = null;
          if (!isGlobal) {
            streamer = await resolveStreamerContext(request, supabase, url);
            if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);
          }

          const twitchId = user.twitch_id;

          // Compute stats directly from user_cards instead of using RPC
          let totalQuery = supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('twitch_id', twitchId);

          // Get legendary count by joining with cards table
          let legQuery = supabase.from('user_cards').select('card_id, cards!inner(rarity)').eq('twitch_id', twitchId);

          if (!isGlobal) {
            totalQuery = totalQuery.eq('streamer_id', streamer.id);
            legQuery = legQuery.eq('streamer_id', streamer.id);
          }

          const [{ count: totalCount, error: totalError }, { data: legendaryCards, error: legendaryError }] = await Promise.all([totalQuery, legQuery]);

          const legendaryCount = legendaryCards?.filter((card: any) =>
            card.cards?.rarity?.toLowerCase() === 'legendary'
          ).length || 0;

          if (totalError || legendaryError) {
            console.error('[Stats] Error:', totalError || legendaryError);
            return secureResponse({ total: 0, legendary: 0 }, 200, corsHeaders);
          }

          const stats = {
            total: totalCount || 0,
            legendary: legendaryCount || 0
          };

          return secureResponse(stats, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Stats] Exception:', e);
          return secureResponse({ total: 0, legendary: 0 }, 200, corsHeaders);
        }
      }

      // 3. Get Leaderboard
      if (method === 'GET' && path === '/api/leaderboard') {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

          // Compute leaderboard from user_cards aggregated by twitch_id
          const { data, error } = await supabase
            .from('user_cards')
            .select('twitch_id, users!inner(username, avatar_url)')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error("Leaderboard Error:", error.message);
            return secureResponse('Database error: ' + error.message, 500, corsHeaders, true);
          }

          // Aggregate by user
          const leaderboardMap = new Map();
          data?.forEach((card: any) => {
            const twitchId = card.twitch_id;
            if (!leaderboardMap.has(twitchId)) {
              leaderboardMap.set(twitchId, {
                twitch_id: twitchId,
                username: card.users?.username || 'Unknown',
                avatar_url: card.users?.avatar_url || null,
                total_cards: 0
              });
            }
            leaderboardMap.get(twitchId).total_cards++;
          });

          const leaderboard = Array.from(leaderboardMap.values())
            .sort((a, b) => b.total_cards - a.total_cards)
            .slice(0, 100);

          return secureResponse(leaderboard, 200, corsHeaders);
        } catch (e: any) {
          console.error("Leaderboard Exception:", e);
          return secureResponse('Error: ' + e.message, 500, corsHeaders, true);
        }
      }

      // 3.5. Get Achievements
      if (method === 'GET' && path === '/api/achievements') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

        const twitchId = user.twitch_id;
        const customNames = streamer.achievement_names || {};

        const { data: allAchievements } = await supabase.from('achievements').select('*');
        const { data: userAchievements } = await supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('twitch_id', twitchId)
          .eq('streamer_id', streamer.id);

        const unlockedIds = new Set(userAchievements?.map((a: any) => a.achievement_id) || []);

        // Auto-sync: If they have cards but 0 achievements, trigger a sync in the background
        if (unlockedIds.size === 0) {
          const { count: cardCount } = await supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('twitch_id', twitchId).eq('streamer_id', streamer.id);
          if (cardCount && cardCount > 0) {
            console.log(`[Achievements] Auto-syncing for ${twitchId} (0 achievements but ${cardCount} cards)`);
            // We don't await this to keep the GET call fast, but it will fire off the notifications
            syncUserAchievements(supabase, twitchId, streamer.id);
          }
        }

        // Mapping of achievement IDs to streamer custom name keys
        const idToKeyMap: Record<string, string> = {
          'first_card': 'beginner',
          'collector_10': 'hoarder',
          'rare_finder': 'rare',
          'epic_moment': 'epic',
          'legendary_luck': 'legendary',
          'completionist': 'completionist',
          'set_collector': 'traveler',
          'rarity_streak_3': 'streak',
          'trader_debut': 'trader'
        };

        const result = allAchievements?.map((ach: any) => {
          const customKey = idToKeyMap[ach.id];
          const customName = customKey ? customNames[customKey] : null;

          return {
            ...ach,
            name: customName || ach.name, // Use custom name if exists, else default
            unlocked: unlockedIds.has(ach.id),
            unlocked_at: userAchievements?.find((ua: any) => ua.achievement_id === ach.id)?.unlocked_at
          };
        }) || [];

        return secureResponse(result, 200, corsHeaders);
      }

      // 3.5b Sync Achievements
      if (method === 'POST' && path === '/api/achievements/sync') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

        const result = await syncUserAchievements(supabase, user.twitch_id, streamer.id);
        return secureResponse(result, 200, corsHeaders);
      }

      // 3.6 Creator Stats Dashboard
      if (method === 'GET' && path === '/api/creator/stats') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Not a registered creator', 403, corsHeaders, true);

        // TODO: Replace with complex RPC aggregations when pack schema is finalized
        const stats = {
          minted: 1337,
          packs: 0,
          community: 420
        };

        return new Response(JSON.stringify(stats), { status: 200, headers: corsHeaders });
      }

      // 3.7 Creator Mint Card
      if (method === 'POST' && path === '/api/creator/cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Not a registered creator', 403, corsHeaders, true);

        const body = await request.json() as any;
        if (!body.name || !body.rarity) return secureResponse('Missing card data', 400, corsHeaders, true);

        // In a real app, handle image uploads and store in `cards` table
        // For now, we mock success for the dashboard UI
        return secureResponse({ success: true, message: `Card ${body.name} minted!` }, 200, corsHeaders);
      }

      // 3.8 Creator Assemble Pack
      if (method === 'POST' && path === '/api/creator/packs') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Not a registered creator', 403, corsHeaders, true);

        const body = await request.json() as any;
        if (!body.name) return secureResponse('Missing pack data', 400, corsHeaders, true);

        // Mock success for assembling packs in UI
        return secureResponse({ success: true, message: `Pack ${body.name} assembled!` }, 200, corsHeaders);
      }

      // 3.9 Creator Trigger Live Drop
      if (method === 'POST' && path === '/api/creator/drops') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        const streamer = await getStreamerForCreator(user, supabase);
        if (!streamer) return secureResponse('Not a registered creator', 403, corsHeaders, true);

        // In a fully integrated system, this would emit a WebSocket event or Twitch PubSub message to the overlay/bot
        // to announce a live drop in chat.
        return secureResponse({ success: true, message: `Live Drop sequence initiated in Twitch Chat!` }, 200, corsHeaders);
      }

      // 12. Get System Audit Logs
      if (method === 'GET' && path === '/api/admin/audit') {
        try {
          await checkAdmin(request);
          const search = url.searchParams.get('search')?.toLowerCase();
          const category = url.searchParams.get('category');

          // system_logs table removed. Return empty for now to avoid breaking UI.
          return secureResponse([], 200, corsHeaders);
        } catch (e: any) {
          console.error('[Logs] Fatal Error:', e);
          const msg = e instanceof Error ? ((e as any).message || String(e)) : String(e);
          const isAuth = msg.includes('Unauthorized');
          return secureResponse(msg || 'Server error', isAuth ? 401 : 500, corsHeaders, true);
        }
      }

      // 4. Auth Start
      if (method === 'GET' && path === '/auth/twitch') {
        const role = url.searchParams.get('role') || 'viewer';
        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/auth/callback`;
        const state = encodeURIComponent(JSON.stringify({ role }));

        // Request minimal scope for viewers, expanded scope for creators so we can manage Channel Point rewards
        const baseScopes = ['user:read:email', 'user:read:follows'];
        const creatorScopes = ['channel:manage:redemptions', 'channel:read:redemptions'];
        const scopes = role === 'creator' ? [...baseScopes, ...creatorScopes] : baseScopes;
        const scopeParam = encodeURIComponent(scopes.join(' '));

        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeParam}&state=${state}`;
        return Response.redirect(authUrl, 302);
      }

      // --- ADMIN CONFIG API ---

      // Get Config
      if (method === 'GET' && path === '/api/admin/config') {
        try {
          await checkAdmin(request);
          const { data, error } = await supabase.from('system_config').select('*');
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // Update Config
      if (method === 'POST' && path === '/api/admin/config') {
        try {
          await checkAdmin(request);
          const body = await request.json() as ConfigBody;
          const { error } = await supabase.from('system_config').upsert({
            id: body.id,
            data: body.data,
            updated_at: new Date().toISOString()
          });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // Public Config (Visuals only)
      if (method === 'GET' && path === '/api/config/visuals') {
        const { data, error } = await supabase.from('system_config').select('data').eq('id', 'visuals').single();
        if (error) return secureResponse({ error: error.message }, 500, corsHeaders);
        return secureResponse(data?.data || {}, 200, corsHeaders);
      }

      // 5. Auth Callback
      if (method === 'GET' && path === '/auth/callback') {
        const code = url.searchParams.get('code');
        const stateParam = url.searchParams.get('state');
        if (!code) return new Response('No code', { status: 400 });

        let role = 'viewer';
        try {
          if (stateParam) {
            const parsed = JSON.parse(decodeURIComponent(stateParam));
            if (parsed.role) role = parsed.role;
          }
        } catch (e) { }

        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/auth/callback`;

        // Token Exchange
        const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.TWITCH_CLIENT_ID,
            client_secret: env.TWITCH_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });
        const tokenData: any = await tokenResp.json();
        console.log(`[Auth/Callback] Token exchange status: ${tokenResp.status}, Has Access Token: ${!!tokenData.access_token}`);

        if (!tokenData.access_token) {
          console.error('[Auth/Callback] Exchange failed:', tokenData);
          return new Response('Auth Failed: No Access Token', { status: 401 });
        }

        // Get User
        const userResp = await fetch('https://api.twitch.tv/helix/users', {
          headers: { 'Client-ID': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        const userData: any = await userResp.json();
        const user = userData.data[0];

        // 1. Mark User as Linked and store tokens (ENCRYPTED)
        const encryptedAccess = await encryptSensitive(tokenData.access_token, env.SESSION_SECRET);
        const encryptedRefresh = tokenData.refresh_token
          ? await encryptSensitive(tokenData.refresh_token, env.SESSION_SECRET)
          : null;

        const tokenScope = Array.isArray(tokenData.scope)
          ? tokenData.scope.join(' ')
          : (tokenData.scope || null);

        const { error: userErr } = await supabase.from('users').upsert({
          twitch_id: user.id,
          username: user.display_name,
          avatar_url: user.profile_image_url,
          is_linked: true,
          twitch_access_token_encrypted: encryptedAccess,
          twitch_refresh_token_encrypted: encryptedRefresh,
          twitch_token_scope: tokenScope
        }, { onConflict: 'twitch_id' });
        if (userErr) console.error("[Auth/Callback] Users Upsert Error:", userErr);

        // 1b. Provision Streamer record if Creator role
        if (role === 'creator') {
          const { error: streamerErr } = await supabase.from('streamers').upsert({
            twitch_id: user.id,
            username: user.display_name.toLowerCase(),
            display_name: user.display_name,
            avatar_url: user.profile_image_url,
            brand_name: user.display_name,
            twitch_access_token_encrypted: encryptedAccess,
            twitch_refresh_token_encrypted: encryptedRefresh,
            twitch_token_scope: tokenScope
          }, { onConflict: 'twitch_id' });
          if (streamerErr) console.error("[Auth/Callback] Streamers Upsert Error:", streamerErr);
        }

        // 2. Claim Pending Rewards
        const { data: pending } = await supabase
          .from('pending_rewards')
          .select('card_id, streamer_id, is_obs_consumed, cards!inner(rarity, attack, defense, mechanic_id)')
          .eq('twitch_id', user.id);

        if (pending && pending.length > 0) {
          console.log(`[Auth] Claiming ${pending.length} cards for ${user.display_name}`);

          const toInsert = [];
          for (const p of pending) {
            const cardData = Array.isArray(p.cards) ? p.cards[0] : (p.cards as any);
            toInsert.push({
              twitch_id: user.id,
              card_id: p.card_id,
              streamer_id: p.streamer_id,
              granted_by_streamer: p.streamer_id,
              is_obs_consumed: p.is_obs_consumed,
              attack: cardData?.attack || 0,
              defense: cardData?.defense || 0,
              max_hp: cardData?.defense || 0,
              mechanic_id: cardData?.mechanic_id || null
            });
          }

          await supabase.from('user_cards').insert(toInsert);

          // Delete from pending
          await supabase.from('pending_rewards').delete().eq('twitch_id', user.id);
        }

        if (!user || !user.id) {
          console.error('[Auth/Callback] User data missing ID:', user);
          return new Response('Auth Failed: No User ID', { status: 401 });
        }

        // Check if user is a streamer
        const { data: streamer } = await supabase
          .from('streamers')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        const sessionToken = await new SignJWT({
          sub: user.id,
          twitch_id: user.id,
          username: user.display_name,
          is_creator: !!streamer
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(user.id.toString())
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(new TextEncoder().encode(env.SESSION_SECRET));

        console.log(`[Auth/Callback] Token generated for ${user.display_name} (ID: ${user.id})`);

        const isHttps = request.url.startsWith('https');
        const secureFlag = isHttps ? '; Secure' : '';

        // Determine correct redirect URL
        // Always redirect back to the origin that hit the callback to ensure cookie consistency
        const requestOrigin = new URL(request.url).origin;
        console.log(`[Auth/Callback] User authenticated: ${user.display_name} (${user.id}), Role: ${role}`);

        let destination = requestOrigin;
        if (role === 'creator') {
          destination = `${requestOrigin}/onboarding?role=creator`;
        } else {
          // Check if collector onboarding is complete
          const { data: dbUser } = await supabase
            .from('users')
            .select('is_onboarding_complete')
            .eq('twitch_id', user.id)
            .maybeSingle();

          if (!dbUser || !dbUser.is_onboarding_complete) {
            destination = `${requestOrigin}/onboarding?role=collector`;
          }
        }

        console.log(`[Auth/Callback] Redirecting to: ${destination}`);

        return new Response(null, {
          status: 302,
          headers: {
            'Location': destination,
            'Set-Cookie': `session=${sessionToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=604800`
          }
        });
      }

      // --- OBS OVERLAY API ---

      // Verify token for OBS API endpoints
      async function verifyOBSToken(streamerParam: string, tokenParam: string) {
        if (!streamerParam || !tokenParam) {
          console.log('[verifyOBSToken] Missing params:', { streamerParam: !!streamerParam, tokenParam: !!tokenParam });
          return null;
        }

        console.log('[verifyOBSToken] Verifying token for streamer:', streamerParam);

        // Use case-insensitive matching like the overlay route
        let { data: streamer, error: streamerError } = await supabase
          .from('streamers')
          .select('id, username, obs_overlay_token')
          .ilike('username', streamerParam)
          .maybeSingle();

        // If not found with ilike, try lowercase
        if (!streamer && streamerParam !== streamerParam.toLowerCase()) {
          const { data: lowerData } = await supabase
            .from('streamers')
            .select('id, username, obs_overlay_token')
            .eq('username', streamerParam.toLowerCase())
            .maybeSingle();
          if (lowerData) streamer = lowerData;
        }

        if (streamerError) {
          console.error('[verifyOBSToken] Database error:', streamerError);
          return null;
        }

        if (!streamer) {
          console.error('[verifyOBSToken] Streamer not found:', streamerParam);
          return null;
        }

        // Trim tokens to handle whitespace
        const storedToken = (streamer.obs_overlay_token || '').trim();
        const providedToken = (tokenParam || '').trim();

        console.log('[verifyOBSToken] Stored token (first 8):', storedToken.substring(0, 8));
        console.log('[verifyOBSToken] Provided token (first 8):', providedToken.substring(0, 8));
        console.log('[verifyOBSToken] Tokens match:', storedToken === providedToken);

        if (!storedToken || storedToken !== providedToken) {
          console.error('[verifyOBSToken] Token mismatch!');
          return null;
        }

        console.log('[verifyOBSToken] Token verified successfully');
        return streamer;
      }

      // 1. Get Next Card for OBS
      if (method === 'GET' && url.pathname === '/api/obs/next') {
        // Support both old (twitch_id) and new (streamer+token) formats for backward compatibility
        const twitchId = url.searchParams.get('twitch_id');
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam = url.searchParams.get('token');

        let streamer: any = null;

        if (streamerParam && tokenParam) {
          // New token-based authentication
          streamer = await verifyOBSToken(streamerParam, tokenParam);
          if (!streamer) {
            return new Response(JSON.stringify({ error: 'Invalid token or streamer' }), { status: 403, headers: corsHeaders });
          }
        } else if (twitchId) {
          // Old format - backward compatibility
          const { data: s } = await supabase
            .from('streamers')
            .select('id')
            .eq('twitch_id', twitchId)
            .single();
          if (!s) {
            return new Response(JSON.stringify({ error: 'Streamer not found' }), { status: 404, headers: corsHeaders });
          }
          streamer = s;
        } else {
          return new Response(JSON.stringify({ error: 'Missing streamer/token or twitch_id' }), { status: 400, headers: corsHeaders });
        }

        // Fetch the oldest unconsumed card for this streamer
        const { data: userCard, error } = await supabase
          .from('user_cards')
          .select('id, card_id, twitch_id, cards(id, name, rarity, image_url), users(username)')
          .eq('streamer_id', streamer.id)
          .eq('is_obs_consumed', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('[OBS] DB Error:', error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }

        if (!userCard) return new Response(JSON.stringify({ cards: null }), { status: 200, headers: corsHeaders });

        const card = userCard.cards as any;
        const user = userCard.users as any;

        const payload = {
          user_card_id: userCard.id,
          card_id: card?.id,
          name: card?.name,
          rarity: card?.rarity,
          image_url: card?.image_url,
          username: user?.username || null,
        };

        return new Response(JSON.stringify({ cards: payload }), { status: 200, headers: corsHeaders });
      }


      // 2. Consume OBS Card
      if (method === 'POST' && url.pathname === '/api/obs/consume') {
        const twitchId = url.searchParams.get('twitch_id');
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam = url.searchParams.get('token');
        const cardId = url.searchParams.get('id'); // specific user_card_id (preferred)

        let streamer: any = null;

        if (streamerParam && tokenParam) {
          // New token-based authentication
          streamer = await verifyOBSToken(streamerParam, tokenParam);
          if (!streamer) {
            return new Response(JSON.stringify({ error: 'Invalid token or streamer' }), { status: 403, headers: corsHeaders });
          }
        } else if (twitchId) {
          // Old format - backward compatibility
          const { data: s } = await supabase
            .from('streamers')
            .select('id')
            .eq('twitch_id', twitchId)
            .single();
          if (!s) {
            return new Response(JSON.stringify({ error: 'Streamer not found' }), { status: 404, headers: corsHeaders });
          }
          streamer = s;
        } else {
          return new Response(JSON.stringify({ error: 'Missing streamer/token or twitch_id' }), { status: 400, headers: corsHeaders });
        }

        let targetId = cardId;

        if (!targetId) {
          // Fallback: find oldest unconsumed for this user
          const { data: oldest, error: findError } = await supabase
            .from('user_cards')
            .select('id')
            .eq('streamer_id', streamer.id)
            .eq('is_obs_consumed', false)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (findError || !oldest) {
            return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
          }
          targetId = oldest.id;
        }

        console.log(`[OBS] Consume requested — streamer=${streamer.id} id=${cardId} → targetId=${targetId}`);

        const { data: updateData, error: updateError, count } = await supabase
          .from('user_cards')
          .update({ is_obs_consumed: true })
          .eq('id', targetId)
          .select('id'); // return updated rows so we can confirm

        if (updateError) {
          console.error('[OBS] Update Error:', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });
        }

        console.log(`[OBS] Consumed ${updateData?.length ?? 0} row(s) for id=${targetId}`);
        return new Response(JSON.stringify({ success: true, consumed: updateData?.length ?? 0 }), { status: 200, headers: corsHeaders });
      }

      // ============================================================
      // BATTLE SYSTEM ROUTES
      // ============================================================

      // --- GET /api/public/battle/latest?streamer=xxx ---
      // Arena.js polls this every 3 seconds for new battles to animate
      if (method === 'GET' && path === '/api/public/battle/latest') {
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const { data: battle, error } = await supabase
          .from('battles')
          .select('id, battle_data, completed_at, challenger_name, target_name, winner_id')
          .eq('streamer_id', streamer.id)
          .not('battle_data', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse(battle || null, 200, corsHeaders);
      }

      // --- GET /api/battle/saved-decks ---
      // Returns the user's saved decks for this streamer
      if (method === 'GET' && path === '/api/battle/saved-decks') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const { data: savedDecks, error } = await supabase
          .from('user_saved_decks')
          .select(`
            id, name,
            slot_1_card_id, slot_2_card_id, slot_3_card_id,
            slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
          `)
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id)
          .order('name');

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ decks: savedDecks || [] }, 200, corsHeaders);
      }

      // --- GET /api/battle/deck ---
      // Returns the logged-in user's current deck for their streamer context
      if (method === 'GET' && path === '/api/battle/deck') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const { data: deck, error } = await supabase
          .from('user_saved_decks')
          .select(`
            id, name, is_active,
            slot_1_card_id, slot_2_card_id, slot_3_card_id,
            slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
          `)
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ deck: deck || null }, 200, corsHeaders);
      }

      // --- POST /api/battle/deck ---
      // Set deck slots. Body: { streamer_id?, slot_1, slot_2, slot_3 } (user_card_ids)
      if (method === 'POST' && path === '/api/battle/deck') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const body: any = await request.json();
        const { slot_1, slot_2, slot_3 } = body;

        // Verify the user actually owns these cards for this streamer
        const slotIds = [slot_1, slot_2, slot_3].filter(Boolean);
        if (slotIds.length === 0) return secureResponse({ error: 'Provide at least one card slot' }, 400, corsHeaders, true);

        if (slotIds.length > 0) {
          const { data: owned } = await supabase
            .from('user_cards')
            .select('id')
            .in('id', slotIds)
            .eq('twitch_id', user.twitch_id)
            .eq('streamer_id', streamer.id);

          if (!owned || owned.length !== slotIds.length) {
            return secureResponse({ error: 'One or more cards do not belong to you' }, 403, corsHeaders, true);
          }
        }

        // Reset active flag for all other decks
        await supabase
          .from('user_saved_decks')
          .update({ is_active: false })
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id);

        const { data: deck, error } = await supabase
          .from('user_saved_decks')
          .upsert({
            twitch_id: user.twitch_id,
            streamer_id: streamer.id,
            name: 'Current Deck',
            slot_1_card_id: slot_1 || null,
            slot_2_card_id: slot_2 || null,
            slot_3_card_id: slot_3 || null,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'twitch_id,streamer_id,name' })
          .select()
          .single();

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ deck }, 200, corsHeaders);
      }

      // --- POST /api/battle/saved-decks ---
      // Saves a new deck, or deletes an existing one if action='delete'
      if (method === 'POST' && path === '/api/battle/saved-decks') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const body: any = await request.json();

        if (body.action === 'delete') {
          if (!body.id) return secureResponse({ error: 'Deck ID required for deletion' }, 400, corsHeaders, true);
          const { error: delError } = await supabase
            .from('user_saved_decks')
            .delete()
            .eq('id', body.id)
            .eq('twitch_id', user.twitch_id);

          if (delError) return secureResponse({ error: delError.message }, 500, corsHeaders, true);
          return secureResponse({ success: true }, 200, corsHeaders);
        }

        // Action: Save New Deck
        const { name, slot_1, slot_2, slot_3 } = body;
        if (!name || name.trim() === '') return secureResponse({ error: 'Deck name is required' }, 400, corsHeaders, true);

        const slotIds = [slot_1, slot_2, slot_3].filter(Boolean);
        if (slotIds.length === 0) return secureResponse({ error: 'Provide at least one card slot' }, 400, corsHeaders, true);

        // Verify ownership
        const { data: owned } = await supabase
          .from('user_cards')
          .select('id')
          .in('id', slotIds)
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id);

        if (!owned || owned.length !== slotIds.length) {
          return secureResponse({ error: 'One or more cards do not belong to you' }, 403, corsHeaders, true);
        }

        const { data: newDeck, error: saveError } = await supabase
          .from('user_saved_decks')
          .insert({
            twitch_id: user.twitch_id,
            streamer_id: streamer.id,
            name: name.trim(),
            slot_1_card_id: slot_1 || null,
            slot_2_card_id: slot_2 || null,
            slot_3_card_id: slot_3 || null,
          })
          .select()
          .single();

        if (saveError) {
          if (saveError.code === '23505') { // Unique violation
            return secureResponse({ error: 'A deck with this name already exists' }, 400, corsHeaders, true);
          }
          return secureResponse({ error: saveError.message }, 500, corsHeaders, true);
        }

        return secureResponse({ deck: newDeck }, 200, corsHeaders);
      }

      // --- POST /api/battle/saved-decks/activate ---
      // Sets a specific saved deck as the active one
      if (method === 'POST' && path === '/api/battle/saved-decks/activate') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const body: any = await request.json();
        const { id } = body;
        if (!id) return secureResponse({ error: 'Deck ID required' }, 400, corsHeaders, true);

        // Reset all
        await supabase
          .from('user_saved_decks')
          .update({ is_active: false })
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id);

        // Set new active
        const { data: deck, error } = await supabase
          .from('user_saved_decks')
          .update({ is_active: true })
          .eq('id', id)
          .eq('twitch_id', user.twitch_id)
          .select()
          .single();

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true, deck }, 200, corsHeaders);
      }

      // ============================================================
      // END BATTLE SYSTEM ROUTES
      // ============================================================

      // --- POST /api/battle/initiate ---
      // Triggers a test battle against a random opponent
      // --- POST /api/battle/initiate ---
      // Triggers a test battle against a random opponent
      if (method === 'POST' && path === '/api/battle/initiate') {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

          // 1. Get challenger deck
          const { data: deck, error: deckErr } = await supabase
            .from('user_saved_decks')
            .select(`
              slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
              slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
              slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
            `)
            .eq('twitch_id', user.twitch_id)
            .eq('streamer_id', streamer.id)
            .eq('is_active', true)
            .maybeSingle();

          if (deckErr) {
            console.error('[BattleInitiate] Deck retrieval error:', deckErr.message);
            return secureResponse({ error: `Deck Error: ${deckErr.message}` }, 500, corsHeaders, true);
          }
          if (!deck || (!deck.slot_1 && !deck.slot_2 && !deck.slot_3)) {
            return secureResponse({ error: 'Your deck is empty! Add cards first.' }, 400, corsHeaders, true);
          }

          // 2. Find a random opponent with 3 cards
          const { data: opponentDeck } = await supabase
            .from('user_saved_decks')
            .select(`
              *, users!inner(username, avatar_url)
            `)
            .not('slot_1', 'is', null)
            .not('slot_2', 'is', null)
            .not('slot_3', 'is', null)
            .neq('twitch_id', user.twitch_id)
            .eq('streamer_id', streamer.id)
            .limit(10);

          let targetDeck = null;
          let opponent = null;

          if (opponentDeck && opponentDeck.length > 0) {
            const randOpp = opponentDeck[Math.floor(Math.random() * opponentDeck.length)];
            targetDeck = randOpp;
            opponent = {
              id: randOpp.twitch_id,
              username: (randOpp.users as any)?.username || 'Random Trainer',
              avatar: (randOpp.users as any)?.avatar_url || null
            };
            console.log(`[BATTLE] Using user deck from ${opponent.username}`);
          } else {
            // Fallback: Bot deck (3 Cards Guaranteed using genuine minted user_cards)
            let { data: globalPool } = await supabase.from('user_cards')
              .select('*, card:cards(*), mechanic:mechanics(*)')
              .limit(100);

            if (!globalPool || globalPool.length === 0) {
              // Extreme fallback if NO user_cards exist yet
              const { data: fallbackPool } = await supabase.from('cards').select('*').limit(20);
              globalPool = (fallbackPool || []).map(c => ({
                id: c.id,
                card: c,
                attack: c.attack || c.base_attack || Math.floor(Math.random() * 5) + 1,
                defense: c.defense || c.base_defense || Math.floor(Math.random() * 5) + 2,
                max_hp: c.max_hp || c.defense || 5
              }));
            }

            const cardsPool = globalPool || [];
            console.log(`[BATTLE] Generating Bot Master deck from user_cards. Pool size: ${cardsPool.length}`);

            const { data: allMechanics } = await supabase.from('mechanics').select('*');
            const getRandMech = () => {
              if (!allMechanics || allMechanics.length === 0) return null;
              return allMechanics[Math.floor(Math.random() * allMechanics.length)];
            };

            const getRandCard = () => {
              if (!cardsPool || cardsPool.length === 0) return null;
              const rc = cardsPool[Math.floor(Math.random() * cardsPool.length)];
              // If the user card doesn't have a mechanic yet, fake one for the battle
              if (!rc.mechanic && !rc.mechanic_name) {
                const m = getRandMech();
                rc.mechanic = m;
                rc.mechanic_name = m?.name;
                rc.mechanic_icon = m?.icon;
              }
              return rc;
            };

            const card1 = getRandCard();
            const card2 = getRandCard() || card1;
            const card3 = getRandCard() || card1;

            // user_cards already have attack, defense, max_hp, card data, and mechanic nested, 
            // so we skip mkBotSlot entirely and let mapToEngine do its job!
            targetDeck = {
              slot_1: card1,
              slot_2: card2,
              slot_3: card3
            };


            opponent = {
              id: null,
              username: `Bot Master`,
              avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=BotMaster`
            };
            console.log(`[BATTLE] Bot Master deck slots:`, { s1: !!targetDeck.slot_1, s2: !!targetDeck.slot_2, s3: !!targetDeck.slot_3 });
          }

          // 3. Run Battle Engine
          // Robustly resolve mechanic data from any slot shape
          const mapToEngine = (s: any, slotNum: number) => {
            const mechName = s.mechanic_name        // flat stored (from bots/fallback)
              || s.mechanic?.name                   // nested join (saved_decks)
              || s.mechanic?.display_name           // fallback display
              || null;
            const mechIcon = s.mechanic_icon
              || s.mechanic?.icon
              || '';
            
            // Genesis Trait
            const genesisMechName = s.genesis_mechanic?.name || null;
            const genesisMechIcon = s.genesis_mechanic?.icon || '';

            return {
              id: s.id,
              name: s.card?.name || 'Unknown',
              image_url: s.card?.image_url || '',
              mechanic_name: mechName,
              mechanic_icon: mechIcon,
              genesis_mechanic_name: genesisMechName,
              genesis_mechanic_icon: genesisMechIcon,
              attack: s.attack || 0,
              defense: s.defense || 0,
              max_hp: s.max_hp || s.defense || 0,
              slot: slotNum,
            };
          };

          const cDeck = [deck.slot_1, deck.slot_2, deck.slot_3]
            .filter(Boolean)
            .map((s, i) => mapToEngine(s, i + 1));
          const tDeck = [targetDeck.slot_1, targetDeck.slot_2, targetDeck.slot_3]
            .filter(Boolean)
            .map((s, i) => mapToEngine(s, i + 1));

          console.log(`[BATTLE] Challenger: ${cDeck.length} cards | Target: ${tDeck.length} cards`);

          const battle_data = runBattleEngine(
            { name: user.username, avatar: user.avatar_url, twitch_id: user.twitch_id },
            { name: opponent.username, avatar: opponent.avatar, twitch_id: opponent.id || 'bot' },
            cDeck,
            tDeck
          );

          // 4. Save Battle
          const { data: battle, error: bErr } = await supabase.from('battles').insert({
            streamer_id: streamer.id,
            challenger_id: user.twitch_id,
            target_id: opponent.id, // now null for bots to avoid FK violation
            challenger_name: user.username,
            target_name: opponent.username,
            winner_id: battle_data.winner === 'challenger' ? user.twitch_id : (battle_data.winner === 'target' ? opponent.id : null),
            battle_data,
            completed_at: new Date().toISOString(),
            status: 'completed'
          }).select().single();

          if (bErr) {
            console.error('[BattleInitiate] Save battle error:', bErr.message);
            return secureResponse({ error: `Save Battle Error: ${bErr.message}` }, 500, corsHeaders, true);
          }

          return secureResponse({ success: true, battle }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[BattleInitiate] Fatal error:', e.message);
          return secureResponse({ error: `Server Error: ${e.message}` }, 500, corsHeaders, true);
        }
      }

      // 6. Twitch EventSub
      if (method === 'POST' && path === '/twitch/eventsub') {
        return handleTwitchWebhook(request, env);
      }

      // 7. SPA Routing Fallback
      // If not an API/Auth route, and not a static asset, serve index.html
      if (env.ASSETS) {
        // Try serving the specific path first (for .js, .css, .png, etc.)
        const assetRes = await env.ASSETS.fetch(request.clone());
        if (assetRes.ok) return assetRes;

        // If not found and doesn't look like a file (no extension), serve index.html
        if (!path.includes('.')) {
          // Special Test Route
          if (path === '/onboarding/test') {
            const testRes = await env.ASSETS.fetch(new Request(`${url.origin}/onboarding-test.html`));
            if (testRes.ok) {
              return new Response(testRes.body, {
                status: 200,
                headers: { 'Content-Type': 'text/html', ...corsHeaders }
              });
            }
          }

          if (path === '/dashboard') {
            const dashRes = await env.ASSETS.fetch(new Request(`${url.origin}/dashboard.html`));
            if (dashRes.ok) {
              return new Response(dashRes.body, {
                status: 200,
                headers: { 'Content-Type': 'text/html', ...corsHeaders }
              });
            }
          }

          const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
          if (indexRes.ok) {
            return new Response(indexRes.body, {
              status: 200,
              headers: { 'Content-Type': 'text/html', ...corsHeaders }
            });
          }
        }
      }

      return secureResponse({ status: 'online', message: 'Ready' }, 200, corsHeaders);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Fatal Error] ${url.pathname}:`, message);
      return secureResponse(message, 500, corsHeaders, true);
    }
  },
};


