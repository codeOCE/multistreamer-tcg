import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import { Redis } from '@upstash/redis/cloudflare';
import Stripe from 'stripe';

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
  /** Lookup: Castle code (trade_code) or username (case-insensitive) */
  username: string;
  castle_code?: string;
  card_id: string;
  quantity?: number;
}
const SESSION_COOKIE_NAME = '__Host-castle-session';
const CSRF_COOKIE_NAME = 'castle_csrf_token';
const GLOBAL_PACK_PRICE_CENTS = 500; // $5.00 for 5-card pack
const BITS_PER_CARD = 100;

/** Built-in Channel Point “slots” (event cards). Keys stored on streamer_channel_point_fixed_cards.preset_key */
const CHANNEL_POINT_PRESET_DEFS: { key: string; label: string; default_title: string; default_cost: number }[] = [
  { key: 'i_was_here', label: 'I was here', default_title: 'I was here', default_cost: 1 },
  { key: 'collab', label: 'Collab / guest', default_title: 'Collab night card', default_cost: 100 },
  { key: 'special', label: 'Special stream', default_title: 'Special stream drop', default_cost: 50 },
];

/** Twitch expects #RRGGBB (caps recommended in docs) */
function normalizeTwitchRewardBackgroundColor(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (!s.startsWith('#')) s = `#${s}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return `#${s.slice(1).toUpperCase()}`;
}

/** Helix uses the same URL for 1x/2x/4x when we only have one uploaded asset */
function helixRewardImageFromPublicUrl(url: string): { url_1x: string; url_2x: string; url_4x: string } | null {
  const u = String(url || '').trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) return null;
  return { url_1x: u, url_2x: u, url_4x: u };
}

/** Public URL for an object stored under CARD_IMAGES (must match CREATOR_CDN_BASE in production). */
function creatorCdnPublicUrl(env: Env, filePath: string): string {
  const base = (env.CREATOR_CDN_BASE || 'https://cdn.codeoce.com').replace(/\/$/, '');
  const path = String(filePath || '').replace(/^\//, '');
  return `${base}/${path}`;
}

function applyHelixCustomRewardVisualFields(b: Record<string, any>, out: Record<string, any>): void {
  const bg = normalizeTwitchRewardBackgroundColor(b.background_color);
  if (bg) out.background_color = bg;

  if (b.is_paused === true || b.is_paused === false) out.is_paused = b.is_paused;
  if (b.should_redemptions_skip_request_queue === true || b.should_redemptions_skip_request_queue === false) {
    out.should_redemptions_skip_request_queue = b.should_redemptions_skip_request_queue;
  }

  if (b.clear_custom_image === true) {
    out.image = null;
  } else {
    const url =
      (typeof b.icon_image_url === 'string' && b.icon_image_url.trim()) ||
      (b.image &&
        typeof b.image === 'object' &&
        typeof (b.image as any).url_1x === 'string' &&
        String((b.image as any).url_1x).trim()) ||
      '';
    const img = helixRewardImageFromPublicUrl(url);
    if (img) out.image = img;
  }
}

/** Flatten GET reward shape for dashboard forms */
function normalizeHelixCustomRewardForClient(r: Record<string, any>): Record<string, unknown> {
  if (!r || typeof r !== 'object') return {};
  const mps = r.max_per_stream_setting;
  const mpu = r.max_per_user_per_stream_setting;
  const gcd = r.global_cooldown_setting;
  const img = r.image;
  return {
    id: r.id,
    title: r.title,
    cost: r.cost,
    background_color: r.background_color || '',
    is_enabled: !!r.is_enabled,
    is_paused: !!r.is_paused,
    is_user_input_required: !!r.is_user_input_required,
    prompt: String(r.prompt || ''),
    should_redemptions_skip_request_queue: !!r.should_redemptions_skip_request_queue,
    is_max_per_stream_enabled: !!(mps && mps.is_enabled),
    max_per_stream: mps?.max_per_stream ?? 1,
    is_max_per_user_per_stream_enabled: !!(mpu && mpu.is_enabled),
    max_per_user_per_stream: mpu?.max_per_user_per_stream ?? 1,
    is_global_cooldown_enabled: !!(gcd && gcd.is_enabled),
    global_cooldown_seconds: gcd?.global_cooldown_seconds ?? 60,
    icon_image_url: (img && (img.url_1x || img.url_2x || img.url_4x)) || '',
  };
}

async function helixListCustomRewards(
  env: Env,
  broadcasterId: string,
  userAccessToken: string
): Promise<any[]> {
  const u = new URL('https://api.twitch.tv/helix/channel_points/custom_rewards');
  u.searchParams.set('broadcaster_id', broadcasterId);
  u.searchParams.set('only_manageable_rewards', 'true');
  const res = await fetch(u.toString(), {
    headers: { 'Client-ID': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${userAccessToken}` },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[Helix] List custom rewards failed:', res.status, json);
    return [];
  }
  return Array.isArray(json.data) ? json.data : [];
}

function buildHelixCustomRewardBody(b: Record<string, any>): Record<string, any> {
  const cost = Math.max(1, Math.min(2000000, parseInt(String(b.cost ?? 500), 10) || 500));
  const title = String(b.title || 'Reward').trim().slice(0, 45) || 'Reward';
  const mpsEnabled = !!b.is_max_per_stream_enabled;
  const mpuEnabled = !!b.is_max_per_user_per_stream_enabled;
  const gcdEnabled = !!b.is_global_cooldown_enabled;
  const out: Record<string, any> = {
    title,
    cost,
    is_enabled: b.is_enabled !== false,
    is_user_input_required: !!b.is_user_input_required,
    is_max_per_stream_enabled: mpsEnabled,
    /** Helix requires max_per_stream whenever is_max_per_stream_enabled is present (and vice versa). */
    max_per_stream: Math.max(1, Math.min(1000000, parseInt(String(b.max_per_stream ?? 1), 10) || 1)),
    is_max_per_user_per_stream_enabled: mpuEnabled,
    /** Same pairing rule as max_per_stream. */
    max_per_user_per_stream: Math.max(1, Math.min(1000000, parseInt(String(b.max_per_user_per_stream ?? 1), 10) || 1)),
    is_global_cooldown_enabled: gcdEnabled,
    global_cooldown_seconds: Math.max(1, Math.min(1209600, parseInt(String(b.global_cooldown_seconds ?? 60), 10) || 60)),
  };
  const prompt = b.prompt != null ? String(b.prompt).trim().slice(0, 200) : '';
  if (out.is_user_input_required) {
    out.prompt = prompt || ' ';
  } else if (prompt) {
    out.prompt = prompt;
  }
  applyHelixCustomRewardVisualFields(b, out);
  return out;
}

async function helixCreateCustomReward(
  env: Env,
  broadcasterId: string,
  userAccessToken: string,
  body: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any }> {
  const twitchResp = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
    {
      method: 'POST',
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const data = await twitchResp.json().catch(() => ({}));
  return { ok: twitchResp.ok, status: twitchResp.status, data };
}

async function helixUpdateCustomReward(
  env: Env,
  broadcasterId: string,
  rewardId: string,
  userAccessToken: string,
  body: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any }> {
  const u = new URL('https://api.twitch.tv/helix/channel_points/custom_rewards');
  u.searchParams.set('broadcaster_id', broadcasterId);
  u.searchParams.set('id', rewardId);
  const twitchResp = await fetch(u.toString(), {
    method: 'PATCH',
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await twitchResp.json().catch(() => ({}));
  return { ok: twitchResp.ok, status: twitchResp.status, data };
}

async function helixDeleteCustomReward(
  env: Env,
  broadcasterId: string,
  rewardId: string,
  userAccessToken: string
): Promise<{ ok: boolean; status: number; data: any }> {
  const u = new URL('https://api.twitch.tv/helix/channel_points/custom_rewards');
  u.searchParams.set('broadcaster_id', broadcasterId);
  u.searchParams.set('id', rewardId);
  const twitchResp = await fetch(u.toString(), {
    method: 'DELETE',
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${userAccessToken}`,
    },
  });
  let data: any = {};
  if (twitchResp.status !== 204) {
    data = await twitchResp.json().catch(() => ({}));
  }
  return { ok: twitchResp.ok, status: twitchResp.status, data };
}

/** ISO 3166-1 alpha-2 — Stripe Connect Express; keep in sync with dashboard.js STRIPE_CONNECT_COUNTRY_OPTIONS */
const STRIPE_EXPRESS_CONNECT_COUNTRIES = new Set([
  'AE', 'AT', 'AU', 'BE', 'BG', 'CA', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GI', 'GR', 'HK',
  'HR', 'HU', 'IE', 'IT', 'JP', 'LT', 'LU', 'LV', 'MT', 'MX', 'MY', 'NL', 'NO', 'NZ', 'PL', 'PT', 'RO', 'SE', 'SG',
  'SI', 'SK', 'TH', 'US',
]);

/** After Connect verification, move platform-held creator share to their Express account ([deferred onboarding](https://github.com/razz1000/stripe-connect-deferred-onboarding-example-repo)). */
async function transferDeferredPendingToCreator(
  stripe: Stripe,
  supabase: any,
  streamerId: string,
  destinationAccountId: string,
  amountCents: number
): Promise<void> {
  if (amountCents <= 0) return;
  await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: destinationAccountId,
    metadata: { streamer_id: streamerId, source: 'deferred_onboarding' },
  });
  const { error } = await supabase
    .from('streamers')
    .update({ stripe_pending_payout_cents: 0 })
    .eq('id', streamerId);
  if (error) console.error('[Stripe] Failed to clear pending payout after transfer:', error);
}

/** Kick user id stored in users.twitch_id / streamers.twitch_id for FK compatibility */
function kickCanonicalUserId(kickUserId: number | string): string {
  return `kick_${String(kickUserId)}`;
}

function base64UrlEncodeBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function generateKickPkce(): Promise<{ verifier: string; challenge: string }> {
  const v = new Uint8Array(32);
  crypto.getRandomValues(v);
  const verifier = base64UrlEncodeBytes(v.buffer);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncodeBytes(hash);
  return { verifier, challenge };
}

/** https://docs.kick.com/getting-started/generating-tokens-oauth2-flow */
const KICK_OAUTH_SCOPES = [
  'user:read',
  'channel:read',
  'channel:rewards:read',
  'channel:rewards:write',
  'events:subscribe',
].join(' ');

/** Events our /api/kick/webhook handler uses — registered via POST /public/v1/events/subscriptions after OAuth. */
const KICK_EVENTS_TO_SUBSCRIBE: { name: string; version: number }[] = [
  { name: 'channel.subscription.new', version: 1 },
  { name: 'channel.subscription.renewal', version: 1 },
  { name: 'channel.subscription.gifts', version: 1 },
  { name: 'kicks.gifted', version: 1 },
  { name: 'channel.reward.redemption.updated', version: 1 },
];

/**
 * Register Kick webhook event subscriptions for the authorized Kick channel (broadcaster inferred from user token).
 * https://docs.kick.com/events/subscribe-to-events
 * Idempotent enough for our purposes: duplicate subscriptions may error — we log and continue.
 */
async function ensureKickEventSubscriptions(accessToken: string): Promise<void> {
  try {
    const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'webhook',
        events: KICK_EVENTS_TO_SUBSCRIBE,
      }),
    });
    const raw = await res.text();
    let j: any = {};
    try {
      j = raw ? JSON.parse(raw) : {};
    } catch {
      j = { raw: raw.slice(0, 200) };
    }
    if (res.ok) {
      console.log('[Kick/Subscribe] OK:', JSON.stringify(j?.data ?? j).slice(0, 800));
      return;
    }
    const msg = String(j?.message || j?.error || raw || res.status);
    if (res.status === 409 || /duplicate|already|exist/i.test(msg)) {
      console.log('[Kick/Subscribe] Already subscribed (ignored):', msg.slice(0, 200));
      return;
    }
    console.warn('[Kick/Subscribe] Failed:', res.status, msg.slice(0, 400));
  } catch (e: any) {
    console.warn('[Kick/Subscribe] Error:', e?.message || e);
  }
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  KICK_CLIENT_ID?: string;
  KICK_CLIENT_SECRET?: string;
  TWITCH_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  /** Set to "1" only in local/dev to skip Kick RSA signature verification (never in production). */
  KICK_WEBHOOK_SKIP_VERIFY?: string;
  FRONTEND_URL: string;
  SESSION_SECRET: string;
  ENCRYPTION_SECRET?: string; // Dedicated key for AES-GCM token encryption (separate from JWT signing)
  CREATOR_CDN_BASE: string; // The URL for serve R2 assets
  PLATFORM_ADMIN_IDS?: string; // Comma-separated Twitch IDs
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  AI: any; // Cloudflare AI binding
  CARD_IMAGES: any; // R2Bucket (Main bucket: assets) — canonical binding; IMAGE_ASSETS alias removed
  multistreamer_tcg_cards?: any; // R2Bucket (Old bucket: multistreamer-tcg-cards)
  WORKER_DEV_URL?: string; // Specific workers.dev URL for CORS — avoids .workers.dev wildcard
  /** Set to "1" or "true" to enable bootstrap Server-Timing, x-debug-* headers, and verbose logs. */
  DEBUG_BOOTSTRAP?: string;
  ENVIRONMENT?: string;
  // --- LAYERED CACHE & STATE (EXTRA) ---
  KV_CACHE: any; // KVNamespace
  PACK_OPENING_SESSIONS: any; // DurableObjectNamespace
  OBS_QUEUE_SESSIONS: any; // DurableObjectNamespace — OBSQueueSession (push-based signal model)
}

function isDebugBootstrap(env: Env): boolean {
  const v = String((env as any).DEBUG_BOOTSTRAP ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isProdEnvironment(env: Env): boolean {
  return String((env as any).ENVIRONMENT ?? '').toLowerCase() === 'production';
}

function shouldLogBootstrapVerbose(env: Env): boolean {
  return isDebugBootstrap(env) || !isProdEnvironment(env);
}

/** mechanics:list — public read cache (Upstash JSON). */
const CACHE_KEY_MECHANICS_LIST = 'v2:mechanics_list';
const CACHE_KEY_STREAMERS_ACTIVE = 'cache:v1:streamers:active';
const CACHE_TTL_MECHANICS_SEC = 600;
const CACHE_TTL_STREAMERS_SEC = 90;
const CACHE_TTL_STREAMER_CONFIG_SEC = 120;
const CACHE_TTL_ANALYTICS_SEC = 3600; // 1 hour for analytics

async function bustStreamersPublicCache(redis: Redis | null, streamer: { id: string; username?: string | null }) {
  if (!redis) return;
  try {
    await redis.del(CACHE_KEY_STREAMERS_ACTIVE);
    const u = String(streamer.username || '').trim().toLowerCase();
    if (u) await redis.del(`cache:v1:streamer:config:${u}`);
    await redis.del(`cache:v1:streamer:config:${String(streamer.id).toLowerCase()}`);
  } catch {
    /* ignore */
  }
}

async function bustMechanicsListCache(redis: Redis | null) {
  if (!redis) return;
  try {
    await redis.del(CACHE_KEY_MECHANICS_LIST);
  } catch {
    /* ignore */
  }
}

/** Default max rows for GET /api/collection (override with ?limit=). */
const COLLECTION_DEFAULT_LIMIT = 500;
const COLLECTION_MAX_LIMIT = 2000;

/** Columns needed for binder/collection UI (avoids select * on enriched_user_cards). */
const ENRICHED_USER_CARDS_COLLECTION_SELECT =
  'user_card_id, twitch_id, card_id, streamer_id, attack, defense, max_hp, current_hp, mechanic_id, genesis_mechanic_id, is_dead, revive_used, granted_by_streamer, is_obs_consumed, granted_at, created_at, trait_list, baked_image_url, name, rarity, image_url, foil_mask_url, type, description, card_number, template_id, streamer_username, brand_name, brand_emoji, brand_color_primary, brand_color_secondary, pack_image_url, set_name, set_code, mechanic_name, mechanic_display_name, mechanic_icon, mechanic_description, genesis_mechanic_name, genesis_mechanic_display_name, genesis_mechanic_icon, genesis_mechanic_description';

// ─── Lazy Redis Singleton ────────────────────────────────────────────────────
// Replaces ALL new Redis(...) calls. Allocated at most once per Worker
// invocation, on first use — zero cost for requests that never need Redis.
let _redisInstance: Redis | null | undefined = undefined;
function getRedis(env: Env): Redis | null {
  if (_redisInstance !== undefined) return _redisInstance;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    _redisInstance = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    _redisInstance = null;
  }
  return _redisInstance;
}

// Helper to wrap database queries in a cache check
async function fetchWithCache(env: Env, redis: Redis | null, key: string, ttlSeconds: number, fetcher: () => Promise<any>, ctx?: any) {
  // 1. Layer 1: Edge KV Cache (Fastest)
  if (env && (env as any).KV_CACHE) {
    try {
      const kvVal = await (env as any).KV_CACHE.get(key);
      if (kvVal) {
        console.log(`[Cache/Hit] KV hit for ${key.slice(0, 32)}...`);
        return JSON.parse(kvVal);
      }
    } catch {}
  }

  // 2. Layer 2: Redis Cache (Hot Backup)
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached != null) {
        console.log(`[Cache/Hit] Redis hit for ${key.slice(0, 32)}...`);
        let finalVal = cached;
        if (typeof cached === 'string') {
          try { finalVal = JSON.parse(cached); } catch {}
        }
        
        // Background refresh KV if missing
        if (env && (env as any).KV_CACHE && ctx) {
          ctx.waitUntil((env as any).KV_CACHE.put(key, JSON.stringify(finalVal), { expirationTtl: ttlSeconds }));
        }
        return finalVal;
      }
    } catch {}
  }

  console.log(`[Cache/Miss] Layer 1+2 miss for ${key.slice(0, 32)}... calling fetcher`);
  const t0 = Date.now();
  // 3. Layer 3: Origin Database (Slowest)
  const data = await fetcher();
  console.log(`[Cache/Fetcher] ${key.slice(0, 32)}... fetched in ${Date.now() - t0}ms`);
  
  // Persist to caches in background
  if (ctx) {
    ctx.waitUntil((async () => {
      try {
        if (env && (env as any).KV_CACHE) {
          await (env as any).KV_CACHE.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
        }
        if (redis) {
          await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
        }
      } catch (e) {
        console.error(`[Cache/Persist] Error for ${key}:`, e);
      }
    })());
  }

  return data;
}

/**
 * Invalidate the collection ETag for a user so their next GET /api/collection
 * returns fresh data instead of a 304. Call this in ctx.waitUntil() after any
 * mutation that changes the collection (grant, consume, trade, accept).
 */
async function invalidateCollectionEtag(env: Env, twitchId: string, streamerId?: string | null): Promise<void> {
  if (!(env as any).KV_CACHE) return;
  const scopes = ['all', 'default'];
  if (streamerId) scopes.push(streamerId);
  await Promise.all(
    scopes.map(scope =>
      (env as any).KV_CACHE.delete(`collection:etag:v1:${twitchId}:${scope}`).catch(() => {})
    )
  );
}

/** Specific helper to fetch achievements with multi-layer caching. */
async function fetchAchievementsWithCache(env: Env, supabase: any, redis: Redis | null, twitchId: string, streamerId: string, customNames: any, ctx?: any) {
  const cacheKey = `achv:v1:${twitchId}:${streamerId}`;
  
  return await fetchWithCache(env || {} as Env, redis, cacheKey, 600, async () => {
    const { data: allAchievements } = await supabase.from('achievements').select('*');
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId);

    const unlockedIds = new Set(userAchievements?.map((a: any) => a.achievement_id) || []);

    return allAchievements?.map((ach: any) => {
      const customKey = ACHIEVEMENT_ID_TO_CUSTOM_NAME_KEY[ach.id];
      return {
        ...ach,
        name: resolveAchievementDisplayName(ach.name, customKey, customNames),
        unlocked: unlockedIds.has(ach.id),
        unlocked_at: userAchievements?.find((ua: any) => ua.achievement_id === ach.id)?.unlocked_at
      };
    }) || [];
  }, ctx);
}

const BRANDING_CACHE_TTL_SEC = 600;
const brandingCacheKeySid = (id: string) => `branding:v1:sid:${id}`;
const brandingCacheKeyTwitch = (twitchId: string) => `branding:v1:twitch:${twitchId}`;

type BrandingCachePayload = {
  binder_color?: string | null;
  brand_name?: string | null;
  brand_tagline?: string | null;
};

function pickBrandingForCache(row: any): BrandingCachePayload {
  return {
    binder_color: row?.binder_color ?? null,
    brand_name: row?.brand_name ?? null,
    brand_tagline: row?.brand_tagline ?? null,
  };
}

/** Warm Upstash with compact branding for fast repeat reads (dashboard bootstrap / edges). */
async function warmStreamerBrandingCache(redis: Redis | null, streamer: any) {
  if (!redis || !streamer?.id) return;
  try {
    const payload = JSON.stringify(pickBrandingForCache(streamer));
    const ttl = BRANDING_CACHE_TTL_SEC;
    await redis.setex(brandingCacheKeySid(String(streamer.id)), ttl, payload);
    if (streamer.twitch_id) {
      await redis.setex(brandingCacheKeyTwitch(String(streamer.twitch_id)), ttl, payload);
    }
  } catch (e) {
    console.warn('[BrandingCache] warm failed', e);
  }
}

const CARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8MB
const CARD_IMAGE_MAX_EDGE_PX = 2000;

function getR2KeyFromImageUrl(imageUrl: string | null | undefined, cdnBase: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const base = (cdnBase || '').replace(/\/$/, '');
  if (!base) return null;
  const urlNoQuery = imageUrl.split('?')[0];
  if (!urlNoQuery.startsWith(base + '/') && urlNoQuery !== base) return null;
  const key = urlNoQuery.slice(base.length).replace(/^\//, '').trim();
  return key.length > 0 ? key : null;
}

/** Delete a CDN-backed R2 object when a URL field is replaced (same rules as card art). Ignores failures. */
async function deleteReplacedCdnObject(
  env: Env,
  previousUrl: string | null | undefined,
  nextUrl: string | null | undefined
): Promise<void> {
  const prev = (previousUrl || '').trim();
  if (!prev) return;
  const next = (nextUrl ?? '').trim();
  if (prev === next) return;
  const prevNorm = prev.split('?')[0];
  const nextNorm = next.split('?')[0];
  if (next && prevNorm === nextNorm) return;
  const r2Key = getR2KeyFromImageUrl(prev, env.CREATOR_CDN_BASE || '');
  if (!r2Key || !env.CARD_IMAGES) return;
  try {
    await env.CARD_IMAGES.delete(r2Key);
  } catch (_) {
    /* object may already be gone */
  }
}

/** SSRF-safe allowlist for binder share export (server-side image fetch). */
function isAllowedShareImageUrl(u: URL, env: Env): boolean {
  const isLocalHttp = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (u.protocol !== 'https:' && !isLocalHttp) return false;

  const cdn = (env.CREATOR_CDN_BASE || '').replace(/\/$/, '');
  if (cdn && (u.href.startsWith(cdn + '/') || u.href.split('?')[0] === cdn)) return true;

  let supaHost = '';
  try {
    supaHost = new URL(env.SUPABASE_URL).hostname;
  } catch { /* ignore */ }
  if (supaHost && u.hostname === supaHost && u.pathname.includes('/storage/v1/object/')) return true;
  if (u.hostname.endsWith('.supabase.co') && u.pathname.includes('/storage/v1/object/')) return true;

  return false;
}

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

interface DustSellBody {
  user_card_id: string;
}

interface DustBuyBody {
  user_card_id: string;
  mechanic_id: string;
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

    const tid = String(twitchId).trim();
    const { data: user, error } = await supabase
      .from('users')
      .select(
        'twitch_id, username, avatar_url, role, binder_layout, binder_theme, onboarding_collector_step, is_onboarding_complete, last_logout_at, kick_user_id, kick_access_token_encrypted, trade_code'
      )
      .eq('twitch_id', tid)
      .single();

    if (error || !user) {
      if (error) console.error('[Auth] Database error in getUserFromSession:', error.message);
      return null;
    }

    // Session revocation check: reject tokens issued before the last logout
    if (user.last_logout_at && payload.iat) {
      const logoutTime = new Date(user.last_logout_at).getTime() / 1000;
      if (payload.iat < logoutTime) {
        console.warn(`[Auth] Session revoked for user ${twitchId} (iat: ${payload.iat}, logout: ${logoutTime})`);
        return null;
      }
    }

    const kickLinked =
      !!(user as any).kick_user_id || !!(user as any).kick_access_token_encrypted;
    delete (user as any).kick_access_token_encrypted;

    return { ...user, kick_linked: kickLinked };
  } catch (e: any) {
    if (e.code === 'ERR_JWT_EXPIRED') {
      // Silent — normal for expired session
    } else {
      console.error('[Auth] JWT verification failed:', e.message);
    }
  }
}

/** Result of Helix channels/followed — includes error when token is invalid or scope missing */
async function getTwitchFollows(
  twitchId: string,
  accessToken: string,
  clientId: string
): Promise<{ follows: any[]; errorStatus?: number; errorBody?: string }> {
  if (!accessToken) return { follows: [] };

  const allFollows: any[] = [];
  let cursor = '';
  let pagesFetched = 0;
  const MAX_PAGES = 10; // Up to 1000 follows (was 500)

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
        console.error(`[Twitch] Follows fetch failed on page ${pagesFetched + 1}:`, resp.status, errorText);
        return { follows: allFollows, errorStatus: resp.status, errorBody: errorText.slice(0, 400) };
      }

      const data: any = await resp.json();
      const pageData = data.data || [];
      allFollows.push(...pageData);

      cursor = data.pagination?.cursor || '';
      pagesFetched++;

      if (!cursor) break;
    } while (pagesFetched < MAX_PAGES);

    console.log(`[Twitch] Follows summary for ${twitchId}: Total ${allFollows.length} across ${pagesFetched} pages.`);
    return { follows: allFollows };
  } catch (e) {
    console.error('[Twitch] Follows fatal fetch error:', e);
    return { follows: allFollows };
  }
}

/** Same secret as /auth/callback — must match for encrypt/decrypt of Twitch user tokens */
function twitchTokenEncryptSecret(env: Env): string {
  return env.ENCRYPTION_SECRET ?? env.SESSION_SECRET;
}

/** OAuth refresh; persists new tokens on users and streamers (Channel Points Helix reads refreshed row) */
async function refreshTwitchUserAccessToken(
  supabase: any,
  twitchId: string,
  refreshTokenPlain: string,
  env: Env
): Promise<string | null> {
  try {
    const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshTokenPlain
      })
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[Twitch] Token refresh failed:', tokenResp.status, tokenData);
      return null;
    }

    const encKey = twitchTokenEncryptSecret(env);
    const encryptedAccess = await encryptSensitive(tokenData.access_token, encKey);
    const encryptedRefresh = tokenData.refresh_token
      ? await encryptSensitive(tokenData.refresh_token, encKey)
      : null;

    const tokenScope = Array.isArray(tokenData.scope)
      ? tokenData.scope.join(' ')
      : (tokenData.scope || null);

    const tokenUpdate = {
      twitch_access_token_encrypted: encryptedAccess,
      ...(encryptedRefresh ? { twitch_refresh_token_encrypted: encryptedRefresh } : {}),
      ...(tokenScope ? { twitch_token_scope: tokenScope } : {}),
    };

    await supabase.from('users').update(tokenUpdate).eq('twitch_id', twitchId);
    await supabase.from('streamers').update(tokenUpdate).eq('twitch_id', twitchId);

    return tokenData.access_token as string;
  } catch (e) {
    console.error('[Twitch] refreshTwitchUserAccessToken error:', e);
    return null;
  }
}

/** OAuth refresh for Kick; persists new tokens on users row */
async function refreshKickUserAccessToken(
  supabase: any,
  twitchId: string,
  refreshTokenPlain: string,
  env: Env
): Promise<string | null> {
  try {
    const tokenResp = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(env.KICK_CLIENT_ID || ''),
        client_secret: String(env.KICK_CLIENT_SECRET || ''),
        grant_type: 'refresh_token',
        refresh_token: refreshTokenPlain
      })
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[Kick] Token refresh failed:', tokenResp.status, tokenData);
      return null;
    }

    const encKey = env.ENCRYPTION_SECRET ?? env.SESSION_SECRET;
    const encryptedAccess = await encryptSensitive(tokenData.access_token, encKey);
    const encryptedRefresh = tokenData.refresh_token
      ? await encryptSensitive(tokenData.refresh_token, encKey)
      : null;

    const tokenScope = Array.isArray(tokenData.scope)
      ? tokenData.scope.join(' ')
      : (tokenData.scope || null);

    const tokenUpdate = {
      kick_access_token_encrypted: encryptedAccess,
      ...(encryptedRefresh ? { kick_refresh_token_encrypted: encryptedRefresh } : {}),
      ...(tokenScope ? { kick_token_scope: tokenScope } : {}),
    };

    await supabase.from('users').update(tokenUpdate).eq('twitch_id', twitchId);

    return tokenData.access_token as string;
  } catch (e) {
    console.error('[Kick] refreshKickUserAccessToken error:', e);
    return null;
  }
}

/** Must match scopes requested in /auth/twitch for viewer vs creator. */
const TWITCH_VIEWER_SCOPES = ['user:read:email', 'user:read:follows'];
const TWITCH_CREATOR_EXTRA_SCOPES = [
  'channel:manage:redemptions',
  'channel:read:redemptions',
  'channel:read:subscriptions',
];

function twitchScopesRequiredForCreator(isCreator: boolean): string[] {
  return isCreator
    ? [...TWITCH_VIEWER_SCOPES, ...TWITCH_CREATOR_EXTRA_SCOPES]
    : [...TWITCH_VIEWER_SCOPES];
}

async function computeTwitchAuthHealth(
  supabase: any,
  env: Env,
  twitchId: string,
  isCreator: boolean
): Promise<{
  token_valid: boolean;
  token_error?: string;
  scopes_granted: string[];
  scopes_required: string[];
  scopes_missing: string[];
  needs_reauth: boolean;
}> {
  const required = twitchScopesRequiredForCreator(isCreator);
  const failSafe = (): {
    token_valid: boolean;
    token_error: string;
    scopes_granted: string[];
    scopes_required: string[];
    scopes_missing: string[];
    needs_reauth: boolean;
  } => ({
    token_valid: false,
    token_error: 'health_check_failed',
    scopes_granted: [],
    scopes_required: required,
    scopes_missing: required,
    needs_reauth: true,
  });

  try {
    const { data: row } = await supabase
      .from('users')
      .select('twitch_access_token_encrypted, twitch_refresh_token_encrypted, twitch_token_scope')
      .eq('twitch_id', twitchId)
      .maybeSingle();

    if (!row?.twitch_access_token_encrypted) {
      return {
        token_valid: false,
        token_error: 'no_twitch_token',
        scopes_granted: [],
        scopes_required: required,
        scopes_missing: required,
        needs_reauth: true,
      };
    }

    const twSecret = twitchTokenEncryptSecret(env);
    let accessToken: string;
    try {
      accessToken = await decryptSensitive(row.twitch_access_token_encrypted, twSecret);
    } catch (decErr) {
      console.error('[TwitchAuthHealth] decrypt access failed:', decErr);
      return failSafe();
    }
    let scopeStr = row.twitch_token_scope || '';
    let granted = scopeStr.split(/\s+/).filter(Boolean);

    let tokenValid = false;
    try {
      let r = await fetch('https://api.twitch.tv/helix/users', {
        headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        tokenValid = true;
      } else if (r.status === 401 && row.twitch_refresh_token_encrypted) {
        let refreshPlain: string;
        try {
          refreshPlain = await decryptSensitive(row.twitch_refresh_token_encrypted, twSecret);
        } catch (refDecErr) {
          console.error('[TwitchAuthHealth] decrypt refresh failed:', refDecErr);
          tokenValid = false;
          refreshPlain = '';
        }
        if (refreshPlain) {
          const refreshed = await refreshTwitchUserAccessToken(supabase, twitchId, refreshPlain, env);
          if (refreshed) {
            accessToken = refreshed;
            const { data: row2 } = await supabase
              .from('users')
              .select('twitch_token_scope')
              .eq('twitch_id', twitchId)
              .maybeSingle();
            scopeStr = row2?.twitch_token_scope || scopeStr;
            granted = scopeStr.split(/\s+/).filter(Boolean);
            r = await fetch('https://api.twitch.tv/helix/users', {
              headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${accessToken}` },
            });
            tokenValid = r.ok;
          }
        }
      }
    } catch {
      tokenValid = false;
    }

    const grantedSet = new Set(granted);
    const missing = required.filter((s) => !grantedSet.has(s));
    const needsReauth = !tokenValid || missing.length > 0;

    return {
      token_valid: tokenValid,
      token_error: tokenValid ? undefined : 'twitch_token_invalid_or_revoked',
      scopes_granted: granted,
      scopes_required: required,
      scopes_missing: missing,
      needs_reauth: needsReauth,
    };
  } catch (e) {
    console.error('[TwitchAuthHealth] unexpected:', e);
    return failSafe();
  }
}

/**
 * Broadcaster Helix user token for Channel Points APIs. Canonical row is `users`; token refresh updates both `users` and `streamers`.
 * Pass the channel owner's Twitch id (e.g. streamer.twitch_id) so team act-as uses the broadcaster's OAuth.
 */
async function getBroadcasterTwitchHelixAccessToken(
  supabase: any,
  env: Env,
  broadcasterTwitchId: string
): Promise<string | null> {
  const encKey = twitchTokenEncryptSecret(env);

  async function tryPair(
    accessEnc: string | null | undefined,
    refreshEnc: string | null | undefined
  ): Promise<string | null> {
    if (!accessEnc) return null;
    try {
      const accessToken = await decryptSensitive(accessEnc, encKey);
      const r = await fetch('https://api.twitch.tv/helix/users', {
        headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) return accessToken;
      if (r.status === 401 && refreshEnc) {
        const refreshPlain = await decryptSensitive(refreshEnc, encKey);
        return await refreshTwitchUserAccessToken(supabase, broadcasterTwitchId, refreshPlain, env);
      }
    } catch (e) {
      console.error('[Twitch] getBroadcasterTwitchHelixAccessToken:', e);
    }
    return null;
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('twitch_access_token_encrypted, twitch_refresh_token_encrypted')
    .eq('twitch_id', broadcasterTwitchId)
    .maybeSingle();

  const fromUser = await tryPair(userRow?.twitch_access_token_encrypted, userRow?.twitch_refresh_token_encrypted);
  if (fromUser) return fromUser;

  const { data: streamerRow } = await supabase
    .from('streamers')
    .select('twitch_access_token_encrypted, twitch_refresh_token_encrypted')
    .eq('twitch_id', broadcasterTwitchId)
    .maybeSingle();

  return tryPair(streamerRow?.twitch_access_token_encrypted, streamerRow?.twitch_refresh_token_encrypted);
}

async function computeKickAuthHealth(
  supabase: any,
  env: Env,
  canonicalId: string
): Promise<{ token_valid: boolean; needs_reauth: boolean; token_error?: string }> {
  const encKey = env.ENCRYPTION_SECRET ?? env.SESSION_SECRET;
  const { data: row } = await supabase
    .from('users')
    .select('kick_access_token_encrypted, kick_refresh_token_encrypted')
    .eq('twitch_id', canonicalId)
    .maybeSingle();

  if (!row?.kick_access_token_encrypted) {
    return { token_valid: false, needs_reauth: true, token_error: 'no_kick_token' };
  }

  const checkToken = async (token: string) => {
    const r = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r;
  };

  try {
    let accessToken = await decryptSensitive(row.kick_access_token_encrypted, encKey);
    let r = await checkToken(accessToken);

    if (r.ok) return { token_valid: true, needs_reauth: false };

    // If 401 and we have a refresh token, try to refresh
    if (r.status === 401 && row.kick_refresh_token_encrypted) {
      console.log(`[Kick] Token expired for ${canonicalId}, attempting refresh...`);
      const refreshPlain = await decryptSensitive(row.kick_refresh_token_encrypted, encKey);
      const newAccess = await refreshKickUserAccessToken(supabase, canonicalId, refreshPlain, env);
      if (newAccess) {
        r = await checkToken(newAccess);
        if (r.ok) return { token_valid: true, needs_reauth: false };
      }
    }

    return { token_valid: false, needs_reauth: true, token_error: 'kick_token_invalid' };
  } catch (e) {
    console.error('[Kick] computeKickAuthHealth error:', e);
    return { token_valid: false, needs_reauth: true, token_error: 'kick_error' };
  }
}

function getBaseUrl(request: Request, env: Env): string {
  if (env.FRONTEND_URL && env.FRONTEND_URL.trim().startsWith('http')) {
    return env.FRONTEND_URL.trim();
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
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
// Derive a 256-bit key from a raw secret string via SHA-256 hashing
async function deriveKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, usage);
}

// AES-GCM encryption (authenticated) — output is prefixed with 'gcm:' to distinguish from legacy AES-CBC
async function encryptSensitive(text: string, secret: string): Promise<string> {
  const key = await deriveKey(secret, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM uses 12-byte IV
  const data = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return 'gcm:' + btoa(String.fromCharCode(...combined));
}

// AES-GCM decryption with AES-CBC fallback for tokens encrypted before this upgrade
async function decryptSensitive(encryptedBase64: string, secret: string): Promise<string> {
  // New format: prefixed with 'gcm:'
  if (encryptedBase64.startsWith('gcm:')) {
    const b64 = encryptedBase64.slice(4);
    const combined = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const key = await deriveKey(secret, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  }

  // Legacy fallback: AES-CBC (for tokens stored before this upgrade)
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerId);
    if (isUuid) {
      const { data: streamer } = await supabase.from('streamers').select('*').eq('id', streamerId).maybeSingle();
      if (streamer) return streamer;
    }
    const { data: streamerByNick } = await supabase.from('streamers').select('*').ilike('username', streamerId).maybeSingle();
    if (streamerByNick) return streamerByNick;
  }
  return null;
}

async function resolveStreamerContextWithCache(
  request: Request,
  env: Env,
  ctx: any,
  supabase: any,
  url: URL
): Promise<any | null> {
  const rawParam = url.searchParams.get('streamer_id') || url.searchParams.get('creator_id') || url.searchParams.get('streamer');
  if (!rawParam) return null;

  const cacheKey = `streamer:branding:v1:${rawParam.toLowerCase()}`;
  const cached = await (env as any).KV_CACHE?.get(cacheKey);
  if (cached) {
    console.log(`[Perf] Streamer context CACHE HIT for ${rawParam}`);
    return JSON.parse(cached);
  }

  console.log(`[Perf] Streamer context CACHE MISS for ${rawParam}`);
  const streamer = await resolveStreamerContext(request, supabase, url);
  if (streamer && (env as any).KV_CACHE) {
    ctx.waitUntil((env as any).KV_CACHE.put(cacheKey, JSON.stringify(streamer), { expirationTtl: 3600 })); // 1 hour
  }
  return streamer;
}

// --- TWITCH SIGNATURE VERIFIER ---
async function verifyTwitchSignature(secret: string, signature: string, id: string, timestamp: string, body: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigPart = signature.includes('=') ? signature.split('=')[1] : '';
    if (!sigPart) return false;
    const signatureBytes = new Uint8Array(sigPart.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(id + timestamp + body));
  } catch {
    return false;
  }
}

/** Twitch signs with the secret passed when the EventSub subscription was created — try all candidates (global + per-streamer). */
async function verifyTwitchSignatureAny(
  secrets: string[],
  signature: string,
  id: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const unique = Array.from(new Set(secrets.filter((s) => typeof s === 'string' && s.length > 0)));
  for (const s of unique) {
    if (await verifyTwitchSignature(s, signature, id, timestamp, body)) return true;
  }
  return false;
}

/** App access token (client_credentials) — list/delete/create EventSub webhook subscriptions (Twitch requires app token for webhook create). */
async function getTwitchAppAccessToken(env: Env): Promise<string | null> {
  try {
    const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[EventSub] App token failed:', tokenResp.status, tokenData);
      return null;
    }
    return tokenData.access_token as string;
  } catch (e) {
    console.error('[EventSub] getTwitchAppAccessToken:', e);
    return null;
  }
}

/** Paginated GET /helix/eventsub/subscriptions (app token). */
async function helixListAllEventSubSubscriptions(env: Env, appToken: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const u = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
    u.searchParams.set('first', '100');
    if (cursor) u.searchParams.set('after', cursor);
    const res = await fetch(u.toString(), {
      headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${appToken}` },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[EventSub] List subscriptions failed:', res.status, json);
      break;
    }
    if (Array.isArray(json.data)) out.push(...json.data);
    cursor = json.pagination?.cursor;
  } while (cursor);
  return out;
}

function normalizeWebhookCallbackUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function eventSubAlreadyEnabled(
  existing: any[],
  eventType: string,
  version: string,
  broadcasterUserId: string,
  callbackUrl: string
): boolean {
  const wantCb = normalizeWebhookCallbackUrl(callbackUrl);
  const bid = String(broadcasterUserId);
  return existing.some((s) => {
    if (s.type !== eventType || String(s.version) !== String(version)) return false;
    if (s.status !== 'enabled') return false;
    const cBid = s.condition?.broadcaster_user_id;
    if (cBid == null || String(cBid) !== bid) return false;
    const cb = normalizeWebhookCallbackUrl(s.transport?.callback || '');
    return cb === wantCb && s.transport?.method === 'webhook';
  });
}

const EVENTSUB_WEBHOOK_TYPES: { type: string; version: string }[] = [
  { type: 'channel.subscribe', version: '1' },
  { type: 'channel.subscription.message', version: '1' },
  { type: 'channel.subscription.gift', version: '1' },
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1' },
  { type: 'channel.cheer', version: '1' },
];

async function helixCreateEventSub(
  env: Env,
  appAccessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-Id': env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Register EventSub webhook subscriptions for a broadcaster (idempotent). Used by manual reconnect and creator OAuth callback. */
async function ensureEventSubSubscriptionsForBroadcaster(
  env: Env,
  opts: { broadcasterTwitchId: string; callbackOrigin: string }
): Promise<{
  callbackUrl: string;
  created: string[];
  skipped: string[];
  errors: { type: string; message: string }[];
  skippedReason?: 'bad_webhook_secret' | 'no_app_token';
}> {
  const whSecret = env.TWITCH_WEBHOOK_SECRET || '';
  if (whSecret.length < 10 || whSecret.length > 100) {
    return {
      callbackUrl: '',
      created: [],
      skipped: [],
      errors: [],
      skippedReason: 'bad_webhook_secret',
    };
  }

  const normalizedBase = normalizeWebhookCallbackUrl(opts.callbackOrigin.trim());
  const callbackUrl = `${normalizedBase}/api/twitch/webhook`;

  const appToken = await getTwitchAppAccessToken(env);
  if (!appToken) {
    return {
      callbackUrl,
      created: [],
      skipped: [],
      errors: [],
      skippedReason: 'no_app_token',
    };
  }

  const existing = await helixListAllEventSubSubscriptions(env, appToken);
  const broadcasterId = String(opts.broadcasterTwitchId);

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { type: string; message: string }[] = [];

  for (const spec of EVENTSUB_WEBHOOK_TYPES) {
    if (eventSubAlreadyEnabled(existing, spec.type, spec.version, broadcasterId, callbackUrl)) {
      skipped.push(spec.type);
      continue;
    }

    const payload = {
      type: spec.type,
      version: spec.version,
      condition: { broadcaster_user_id: broadcasterId },
      transport: {
        method: 'webhook',
        callback: callbackUrl,
        secret: whSecret,
      },
    };

    const result = await helixCreateEventSub(env, appToken, payload);

    if (result.ok) {
      created.push(spec.type);
      const subRow = result.data?.data?.[0];
      if (subRow) existing.push(subRow);
      continue;
    }

    const msg =
      result.data?.message ||
      result.data?.error ||
      (typeof result.data === 'string' ? result.data : JSON.stringify(result.data || {}).slice(0, 400));

    const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (
      result.status === 409 ||
      msgStr.toLowerCase().includes('duplicate') ||
      msgStr.toLowerCase().includes('already exists')
    ) {
      skipped.push(spec.type);
      continue;
    }

    errors.push({ type: spec.type, message: msgStr || `HTTP ${result.status}` });
  }

  return { callbackUrl, created, skipped, errors };
}

// --- Roles: platform staff + per-streamer team (see migrations/039_roles_system.sql) ---

type PlatformStaffRole = 'staff' | 'card_editor' | 'support';

function isEnvPlatformAdmin(env: Env, twitchId: string): boolean {
  return (env.PLATFORM_ADMIN_IDS || '').split(',').map((id) => id.trim()).includes(twitchId);
}

async function getPlatformStaffRole(supabase: any, twitchId: string): Promise<PlatformStaffRole | null> {
  const { data } = await supabase.from('platform_staff').select('role').eq('twitch_id', twitchId).maybeSingle();
  if (!data?.role) return null;
  return data.role as PlatformStaffRole;
}

async function getStreamerTeamRole(
  supabase: any,
  memberTwitchId: string,
  streamerId: string
): Promise<'moderator' | 'editor' | null> {
  const { data } = await supabase
    .from('streamer_team_members')
    .select('role')
    .eq('streamer_id', streamerId)
    .eq('member_twitch_id', memberTwitchId)
    .maybeSingle();
  if (!data?.role) return null;
  return data.role as 'moderator' | 'editor';
}

/** Resolve a grant recipient by Castle code (users.trade_code) or Twitch/Kick username. */
async function resolveUserByCastleCodeOrUsername(
  supabase: any,
  raw: string
): Promise<{ twitch_id: string; username: string }> {
  const q = String(raw || '').trim();
  if (!q) throw new Error('Missing recipient');

  const { data: byCode } = await supabase
    .from('users')
    .select('twitch_id, username')
    .ilike('trade_code', q)
    .maybeSingle();
  if (byCode?.twitch_id) return { twitch_id: byCode.twitch_id, username: byCode.username };

  const { data: byName } = await supabase
    .from('users')
    .select('twitch_id, username')
    .ilike('username', q)
    .maybeSingle();
  if (byName?.twitch_id) return { twitch_id: byName.twitch_id, username: byName.username };

  throw new Error('User not found — check Castle code or username');
}

/** Card catalog write for any streamer (admin UI /api/admin/*) */
function canWritePlatformCardCatalog(isPlatformAdmin: boolean, staffRole: PlatformStaffRole | null): boolean {
  if (isPlatformAdmin) return true;
  if (staffRole === 'card_editor' || staffRole === 'staff') return true;
  return false;
}

/** Read-only admin views (stats, card list) */
function canReadPlatformAdminViews(isPlatformAdmin: boolean, staffRole: PlatformStaffRole | null): boolean {
  if (isPlatformAdmin) return true;
  if (staffRole === 'support' || staffRole === 'staff' || staffRole === 'card_editor') return true;
  return false;
}

/** Team member: moderators cannot edit card catalog / sets / branding — only editors + owner */
function assertTeamCanEditCatalog(teamRole: 'moderator' | 'editor' | null | undefined) {
  if (teamRole === 'moderator') throw new Error('Forbidden: Editor role required for this action');
}

/** Moderators may PATCH only these pack-related fields (pack editor + direct pack art upload). */
const MODERATOR_PACK_SETTINGS_KEYS = new Set(['pack_image_url', 'pack_image', 'pack_design_url', 'pack_foil_color', 'collection_methods']);

function assertModeratorPackSettingsOnly(body: Record<string, any>) {
  if (body.settings !== undefined) {
    throw new Error('Forbidden: Moderators may only update pack image, pack design, and foil color.');
  }
  const keys = Object.keys(body).filter((k) => body[k] !== undefined);
  const bad = keys.filter((k) => !MODERATOR_PACK_SETTINGS_KEYS.has(k));
  if (bad.length > 0) {
    throw new Error('Forbidden: Moderators may only update pack image, pack design, and foil color.');
  }
  if (keys.length === 0) {
    throw new Error('Forbidden: No pack fields to update.');
  }
}

// --- HELPER FUNCTIONS ---


async function handleTwitchWebhook(req: Request, env: Env, ctx?: any): Promise<Response> {
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

  let json: any;
  try {
    json = JSON.parse(body);
  } catch (e: any) {
    console.error('[Webhook] Failed to parse JSON:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  // --- RESOLVE STREAMER & SECRET ---
  const broadcasterIdRaw =
    json.subscription?.condition?.broadcaster_user_id ?? json.event?.broadcaster_user_id;
  const broadcasterId = broadcasterIdRaw != null ? String(broadcasterIdRaw) : '';
  let resolvedStreamer = null;

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  if (broadcasterId) {
    const { data: streamer } = await supabase
      .from('streamers')
      .select('*')
      .eq('twitch_id', broadcasterId)
      .maybeSingle();

    if (streamer) {
      resolvedStreamer = streamer;
      if (streamer.webhook_secret) {
        console.log(`[Webhook] Streamer row has webhook_secret for broadcaster ${broadcasterId} (signature will accept global or per-streamer)`);
      }
    }
  }

  const secretCandidates = [env.TWITCH_WEBHOOK_SECRET, resolvedStreamer?.webhook_secret].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
  if (secretCandidates.length === 0) {
    console.error('[Webhook] No verification secret available (set TWITCH_WEBHOOK_SECRET or streamer.webhook_secret)');
    return new Response('Configuration Error', { status: 500 });
  }

  // --- VERIFY SIGNATURE (must match the secret used when the EventSub subscription was created) ---
  const isValidSignature = await verifyTwitchSignatureAny(secretCandidates, signature, id, timestamp, body);
  if (!isValidSignature) {
    console.error('[Webhook] Invalid signature (tried global + streamer webhook_secret if present)');
    return new Response('Invalid Signature', { status: 403 });
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

  // --- TWITCH EVENTSUB HANDLERS ---
  const type = json.subscription?.type;
  const event = json.event;
  const userId = event.user_id;
  const userName = event.user_name || event.user_login;

  if (messageType === 'notification' && type) {
    console.log(`[Webhook] notification type=${type} broadcaster=${broadcasterId} user=${userName || userId || '?'}`);
  }

  if (!resolvedStreamer) {
    console.error(`[Webhook] Streamer not found for broadcaster_id: ${broadcasterId}`);
    return new Response('Streamer not found', { status: 200 });
  }
  const streamer = resolvedStreamer;

  if (messageType !== 'notification') {
    return new Response('OK', { status: 200 });
  }

  const processNotificationGrants = async () => {
    /** Fewer Worker subrequests (no Upstash) + one sync instead of heavy per-card achievement queries. */
    const twitchGrantOpts: GrantRandomCardOptions = {
      preferSupabaseOverRedis: true,
      skipAchievementCheck: true,
    };

    // 1. Handle Channel Points Redemption
    if (type === 'channel.channel_points_custom_reward_redemption.add') {
    const redeemedRewardId = event.reward.id;
    console.log(`[Webhook] Reward redemption: ${event.reward.title} by ${userName}`);

    // Grant Card
    if (redeemedRewardId === streamer.twitch_reward_id) {
      console.log(`[Webhook] Granting card for ${userName} in ${streamer.username}'s stream`);
      const g = await grantRandomCard(
        supabase,
        userId,
        userName,
        streamer.id,
        `🏰 Redemption: ${event.reward.title}!`,
        env,
        twitchGrantOpts
      );
      await logTwitchGrantToActivity(supabase, streamer.id, g, 'Channel Points');
    const gAny = g as any;
    if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, userId, streamer.id));
    else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, userId, streamer.id);
    }

    // Battle Initiation
    if (streamer.twitch_battle_reward_id && redeemedRewardId === streamer.twitch_battle_reward_id) {
      console.log(`[Webhook] Battle redemption by ${userName}`);
      const userInput = event.user_input || '';
      const targetUser = userInput.replace('@', '').trim();
      if (targetUser) {
        console.log(`[Webhook] Battle: ${userName} vs ${targetUser}`);
      }
    }

    // Event / "I was here" — extra Channel Points rewards → one specific card each
    const isPackReward = redeemedRewardId === streamer.twitch_reward_id;
    const isBattleReward =
      streamer.twitch_battle_reward_id && redeemedRewardId === streamer.twitch_battle_reward_id;
    if (!isPackReward && !isBattleReward) {
      const { data: fixedRow } = await supabase
        .from('streamer_channel_point_fixed_cards')
        .select('card_id, hide_from_overlay')
        .eq('streamer_id', streamer.id)
        .eq('twitch_reward_id', redeemedRewardId)
        .eq('is_enabled', true)
        .maybeSingle();
      if (fixedRow?.card_id) {
        const silent = fixedRow.hide_from_overlay !== false;
        console.log(`[Webhook] Fixed event card grant for ${userName} (reward ${redeemedRewardId})`);
        const g = await grantRandomCard(
          supabase,
          userId,
          userName,
          streamer.id,
          `🎟️ Event drop: ${event.reward.title}!`,
          env,
          { ...twitchGrantOpts, forcedCardId: fixedRow.card_id, isSilent: silent }
        );
        await logTwitchGrantToActivity(supabase, streamer.id, g, 'Channel Points (event card)');
      const gAny = g as any;
    if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, userId, streamer.id));
    else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, userId, streamer.id);
      }
    }
  }

  // 2. Handle Subscriptions (Recipients)
  // We only reward recipients if it's NOT a gift (standard subs)
  if (type === 'channel.subscribe') {
    if (event.is_gift === true || event.is_gift === 'true') {
      console.log(`[Webhook] Sub received by ${userName} (GIFT) - No reward granted to recipient per settings.`);
    } else {
      console.log(`[Webhook] New sub by ${userName} - Granting card!`);
      const g = await grantRandomCard(
        supabase,
        userId,
        userName,
        streamer.id,
        `💜 Welcome to the community! (Sub Reward)`,
        env,
        twitchGrantOpts
      );
      await logTwitchGrantToActivity(supabase, streamer.id, g, 'New subscription');
    const gAny = g as any;
    if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, userId, streamer.id));
    else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, userId, streamer.id);
    }
  }

  // 3. Handle Subscription Messages (Re-subs)
  if (type === 'channel.subscription.message') {
    console.log(`[Webhook] Re-sub message by ${userName} - Granting card!`);
    const g = await grantRandomCard(
      supabase,
      userId,
      userName,
      streamer.id,
      `✨ Thanks for staying with us! (Re-sub Reward)`,
      env,
      twitchGrantOpts
    );
    await logTwitchGrantToActivity(supabase, streamer.id, g, 'Resub');
    const gAny = g as any;
    if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, userId, streamer.id));
    else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, userId, streamer.id);
  }

  // 4. Handle Gift Multiplier (The Gifter gets the reward) — batched like dashboard bulk (Worker subrequest limit).
  if (type === 'channel.subscription.gift') {
    const giftCount = Math.min(200, Math.max(1, parseInt(String(event.total ?? 1), 10) || 1));
    console.log(`[Webhook] ${userName} gifted ${giftCount} subs! Granting ${giftCount} cards to gifter (batch).`);

    try {
      const { granted, lastResult } = await bulkGrantRandomCardsToTwitchUser(
        supabase,
        env,
        streamer.id,
        userId,
        userName,
        giftCount,
        {
          skipRedis: true,
          isObsConsumedForIndex: (i) => i > 0,
          buildNotification: (i, total, randomCard, isGenesis) => ({
            message: isGenesis
              ? `🌌 GENESIS CARD! 🎁 Gift Expansion! (${i + 1}/${total})`
              : `🎁 Gift Expansion! (${i + 1}/${total})`,
            data: {
              card_id: randomCard.id,
              name: randomCard.name,
              rarity: randomCard.rarity,
              image_url: randomCard.image_url,
              is_genesis: isGenesis,
            },
          }),
        }
      );
      await logTwitchGrantToActivity(
        supabase,
        streamer.id,
        lastResult,
        granted > 1 ? `Gift ×${granted} subs` : 'Gift sub 1/1'
      );
    } catch (e: any) {
      console.error('[Webhook] Gift batch grant failed:', e?.message || e);
      logGrantIssueCopyPaste('channel.subscription.gift batch failed', {
        step: 'twitch_webhook.gift',
        streamer_id: streamer.id,
        gifter_twitch_id: userId,
        gift_count: giftCount,
        message: e?.message,
      });
    }
  }

  // 5. Handle Cheers (Bits)
  if (type === 'channel.cheer') {
    // Skip anonymous cheers as we can't grant cards to an unknown user
    if (event.is_anonymous) {
      console.log(`[Webhook] Anonymous cheer in ${streamer.username}'s stream - skipping reward.`);
      return;
    }

    // Check if bits are enabled for this streamer
    const collectionMethods = streamer.collection_methods || {};
    if (collectionMethods.bits === false) {
      console.log(`[Webhook] Bits are disabled for streamer ${streamer.id} (collection_methods.bits=false)`);
      return;
    }

    const bits = parseInt(String(event.bits ?? 0), 10) || 0;
    const cardCount = Math.floor(bits / BITS_PER_CARD);

    if (cardCount > 0) {
      console.log(`[Webhook] ${userName} cheered ${bits} bits! Granting ${cardCount} cards.`);
      try {
        const { granted, lastResult } = await bulkGrantRandomCardsToTwitchUser(
          supabase,
          env,
          streamer.id,
          userId,
          userName,
          cardCount,
          {
            skipRedis: true,
            isObsConsumedForIndex: (i) => i > 0,
            buildNotification: (i, total, randomCard, isGenesis) => ({
              message: isGenesis
                ? `🌌 GENESIS! Bits Cheer Reward! (${i + 1}/${total})`
                : `💎 Bits Cheer Reward! (${i + 1}/${total})`,
              data: {
                card_id: randomCard.id,
                name: randomCard.name,
                rarity: randomCard.rarity,
                image_url: randomCard.image_url,
                is_genesis: isGenesis,
              },
            }),
          },
          ctx
        );
        await logTwitchGrantToActivity(
          supabase,
          streamer.id,
          lastResult,
          granted > 1 ? `Cheer ×${bits} bits (${granted} cards)` : `Cheer ×${bits} bits (1 card)`
        );
        if (ctx) ctx.waitUntil(syncUserAchievements(supabase, userId, streamer.id));
        else await syncUserAchievements(supabase, userId, streamer.id);
      } catch (e: any) {
        console.error('[Webhook] Cheer grant failed:', e?.message || e);
        logGrantIssueCopyPaste('channel.cheer grant failed', {
          step: 'twitch_webhook.cheer',
          streamer_id: streamer.id,
          twitch_id: userId,
          bits: bits,
          message: e?.message,
        });
      }
    } else {
      console.log(`[Webhook] ${userName} cheered ${bits} bits (less than threshold ${BITS_PER_CARD}) - No cards granted.`);
    }
  }

  if (
    messageType === 'notification' &&
    type &&
    type !== 'channel.channel_points_custom_reward_redemption.add' &&
    type !== 'channel.subscribe' &&
    type !== 'channel.subscription.message' &&
    type !== 'channel.subscription.gift' &&
    type !== 'channel.cheer'
  ) {
    console.log(`[Webhook] No card grant handler for type=${type} (add EventSub subscription in Twitch console if needed)`);
  }
  };

  if (ctx) {
    ctx.waitUntil(
      processNotificationGrants().catch((e: any) =>
        console.error('[Webhook] deferred notification handler error:', e?.message || e)
      )
    );
    return new Response('OK', { status: 200 });
  }

  await processNotificationGrants();
  return new Response('OK', { status: 200 });
}

/** https://docs.kick.com/events/webhook-security — also available at GET https://api.kick.com/public/v1/public-key */
const KICK_WEBHOOK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

async function verifyKickWebhookRsaSignature(
  env: Env,
  messageId: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !messageId || !timestamp) return false;
  if (env.KICK_WEBHOOK_SKIP_VERIFY === '1') {
    console.warn('[KickWebhook] KICK_WEBHOOK_SKIP_VERIFY=1 — signature not verified');
    return true;
  }
  try {
    const pem = KICK_WEBHOOK_PUBLIC_KEY_PEM;
    const b64 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    let pad = signatureHeader.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (pad.length % 4 !== 0) pad += '=';
    const bin = atob(pad);
    const sigBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sigBytes[i] = bin.charCodeAt(i);
    const data = new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`);
    return await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sigBytes, data);
  } catch (e: any) {
    console.error('[KickWebhook] RSA verify error:', e?.message || e);
    return false;
  }
}

function kickCollectionMethodEnabled(streamer: any, key: 'kick_subscriptions' | 'kick_gifts' | 'kick_rewards'): boolean {
  const cm = streamer?.collection_methods;
  if (!cm || typeof cm !== 'object') return false;
  return cm[key] === true;
}

async function resolveStreamerByKickBroadcasterId(supabase: any, broadcasterUserId: unknown): Promise<any | null> {
  if (broadcasterUserId == null || broadcasterUserId === '') return null;
  const kid = String(broadcasterUserId);
  const { data: u } = await supabase.from('users').select('twitch_id').eq('kick_user_id', kid).maybeSingle();
  if (!u?.twitch_id) return null;
  const { data: s } = await supabase.from('streamers').select('*').eq('twitch_id', u.twitch_id).maybeSingle();
  return s || null;
}

/** Returns true if this message_id should be processed (first time); false if duplicate. */
async function tryConsumeKickWebhookMessage(supabase: any, messageId: string): Promise<boolean> {
  if (!messageId) return true;
  const { error } = await supabase.from('kick_webhook_events').insert({ message_id: messageId });
  if (error) {
    if (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
      return false;
    }
    console.error('[KickWebhook] idempotency insert failed:', error.message);
    return true;
  }
  return true;
}

async function logKickGrantToActivity(
  supabase: any,
  streamerId: string,
  summary: GrantActivitySummary | null | undefined,
  context: string
) {
  if (!summary) return;
  await logSystem(
    supabase,
    'info',
    'grant',
    `"${summary.card_name}" → ${summary.recipient_username} · Kick (${context})`,
    streamerId,
    {
      card_id: summary.card_id,
      card_name: summary.card_name,
      rarity: summary.rarity,
      recipient_twitch_id: summary.recipient_twitch_id,
      recipient_username: summary.recipient_username,
      platform: 'kick',
      kick_context: context,
    }
  );
}

async function handleKickWebhook(req: Request, env: Env, ctx?: any): Promise<Response> {
  const rawBody = await req.text();
  const messageId = req.headers.get('Kick-Event-Message-Id') || '';
  const ts = req.headers.get('Kick-Event-Message-Timestamp') || '';
  const sig = req.headers.get('Kick-Event-Signature') || '';
  const eventType = (req.headers.get('Kick-Event-Type') || '').replace(/^["']|["']$/g, '').trim();

  if (!(await verifyKickWebhookRsaSignature(env, messageId, ts, rawBody, sig))) {
    return new Response('Invalid signature', { status: 403 });
  }

  let json: any = {};
  try {
    if (rawBody) json = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  if (!(await tryConsumeKickWebhookMessage(supabase, messageId))) {
    return new Response('OK', { status: 200 });
  }

  const kickGrantOpts: GrantRandomCardOptions = {
    preferSupabaseOverRedis: true,
    skipAchievementCheck: true,
  };

  const runKickEvents = async () => {
    try {
      if (eventType === 'channel.subscription.new' || eventType === 'channel.subscription.renewal') {
      const broadcasterId = json.broadcaster?.user_id;
      const sub = json.subscriber;
      if (!sub?.user_id || sub.is_anonymous) {
        console.log('[KickWebhook] subscription event: missing subscriber or anonymous — skip');
        return new Response('OK', { status: 200 });
      }
      const streamer = await resolveStreamerByKickBroadcasterId(supabase, broadcasterId);
      if (!streamer) {
        console.log(`[KickWebhook] no streamer for Kick broadcaster user_id=${broadcasterId}`);
        return new Response('OK', { status: 200 });
      }
      if (!kickCollectionMethodEnabled(streamer, 'kick_subscriptions')) {
        console.log(`[KickWebhook] kick_subscriptions disabled for streamer ${streamer.id}`);
        return new Response('OK', { status: 200 });
      }
      const uid = kickCanonicalUserId(sub.user_id);
      const uname = String(sub.username || sub.user_id || 'viewer');
      const label = eventType === 'channel.subscription.new' ? 'New Kick sub' : 'Kick sub renewal';
      const g = await grantRandomCard(
        supabase,
        uid,
        uname,
        streamer.id,
        eventType === 'channel.subscription.new'
          ? `💚 Welcome! (Kick subscription)`
          : `💚 Thanks for resubscribing! (Kick)`,
        env,
        kickGrantOpts
      );
      await logKickGrantToActivity(supabase, streamer.id, g, label);
      const gAny = g as any;
      if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, uid, streamer.id));
      else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, uid, streamer.id);
      return new Response('OK', { status: 200 });
    }

    if (eventType === 'channel.subscription.gifts') {
      const broadcasterId = json.broadcaster?.user_id;
      const gifter = json.gifter;
      const giftees = Array.isArray(json.giftees) ? json.giftees : [];
      const qty = giftees.length;
      if (!gifter?.user_id || gifter.is_anonymous || qty < 1) {
        console.log('[KickWebhook] subscription.gifts: anonymous gifter or no giftees — skip');
        return new Response('OK', { status: 200 });
      }
      const streamer = await resolveStreamerByKickBroadcasterId(supabase, broadcasterId);
      if (!streamer) {
        console.log(`[KickWebhook] gifts: no streamer for broadcaster ${broadcasterId}`);
        return new Response('OK', { status: 200 });
      }
      if (!kickCollectionMethodEnabled(streamer, 'kick_gifts')) {
        console.log(`[KickWebhook] kick_gifts disabled for streamer ${streamer.id}`);
        return new Response('OK', { status: 200 });
      }
      const uid = kickCanonicalUserId(gifter.user_id);
      const uname = String(gifter.username || gifter.user_id);
      try {
        const { granted, lastResult } = await bulkGrantRandomCardsToTwitchUser(
          supabase,
          env,
          streamer.id,
          uid,
          uname,
          Math.min(200, qty),
          {
            skipRedis: true,
            isObsConsumedForIndex: (i) => i > 0,
            buildNotification: (i, total, randomCard, isGenesis) => ({
              message: isGenesis
                ? `🌌 GENESIS! Kick gift reward (${i + 1}/${total})`
                : `🎁 Kick gift reward (${i + 1}/${total})`,
              data: {
                card_id: randomCard.id,
                name: randomCard.name,
                rarity: randomCard.rarity,
                image_url: randomCard.image_url,
                is_genesis: isGenesis,
              },
            }),
          }
        );
        await logKickGrantToActivity(
          supabase,
          streamer.id,
          lastResult,
          granted > 1 ? `Kick sub gifts ×${granted}` : 'Kick sub gift'
        );
        if (ctx) ctx.waitUntil(syncUserAchievements(supabase, uid, streamer.id));
        else await syncUserAchievements(supabase, uid, streamer.id);
      } catch (e: any) {
        console.error('[KickWebhook] bulk gift grant failed:', e?.message || e);
      }
      return new Response('OK', { status: 200 });
    }

    if (eventType === 'kicks.gifted') {
      const broadcasterId = json.broadcaster?.user_id;
      const sender = json.sender;
      if (!sender?.user_id) {
        console.log('[KickWebhook] kicks.gifted: no sender');
        return new Response('OK', { status: 200 });
      }
      const streamer = await resolveStreamerByKickBroadcasterId(supabase, broadcasterId);
      if (!streamer) {
        console.log(`[KickWebhook] kicks.gifted: no streamer for broadcaster ${broadcasterId}`);
        return new Response('OK', { status: 200 });
      }
      if (!kickCollectionMethodEnabled(streamer, 'kick_gifts')) {
        console.log(`[KickWebhook] kick_gifts disabled (kicks.gifted) for ${streamer.id}`);
        return new Response('OK', { status: 200 });
      }
      const uid = kickCanonicalUserId(sender.user_id);
      const uname = String(sender.username || sender.user_id);
      const g = await grantRandomCard(
        supabase,
        uid,
        uname,
        streamer.id,
        `🎁 Thanks for the Kick!`,
        env,
        kickGrantOpts
      );
      await logKickGrantToActivity(supabase, streamer.id, g, 'Kicks gifted');
      const gAny = g as any;
      if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, uid, streamer.id));
      else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, uid, streamer.id);
      return new Response('OK', { status: 200 });
    }

    if (eventType === 'channel.reward.redemption.updated') {
      const status = String(json.status || '').toLowerCase();
      if (status !== 'accepted') {
        return new Response('OK', { status: 200 });
      }
      const broadcasterId = json.broadcaster?.user_id;
      const redeemer = json.redeemer;
      if (!redeemer?.user_id) {
        return new Response('OK', { status: 200 });
      }
      const streamer = await resolveStreamerByKickBroadcasterId(supabase, broadcasterId);
      if (!streamer) {
        return new Response('OK', { status: 200 });
      }
      if (!kickCollectionMethodEnabled(streamer, 'kick_rewards')) {
        console.log(`[KickWebhook] kick_rewards disabled for ${streamer.id}`);
        return new Response('OK', { status: 200 });
      }
      const uid = kickCanonicalUserId(redeemer.user_id);
      const uname = String(redeemer.username || redeemer.user_id);
      const rewardTitle = json.reward?.title || 'Reward';
      const g = await grantRandomCard(
        supabase,
        uid,
        uname,
        streamer.id,
        `🏰 Kick reward: ${rewardTitle}`,
        env,
        kickGrantOpts
      );
      await logKickGrantToActivity(supabase, streamer.id, g, `Reward: ${rewardTitle}`);
      const gAny = g as any;
      if (gAny?._deferAchievementSync && ctx) ctx.waitUntil(syncUserAchievements(supabase, uid, streamer.id));
      else if (gAny?._deferAchievementSync) await syncUserAchievements(supabase, uid, streamer.id);
      return new Response('OK', { status: 200 });
    }

    console.log(`[KickWebhook] unhandled event type: ${eventType}`);
    } catch (e: any) {
      console.error('[KickWebhook] handler error:', e?.message || e);
    }
  };

  if (ctx) {
    ctx.waitUntil(runKickEvents().catch((e: any) => console.error('[KickWebhook] deferred:', e?.message || e)));
    return new Response('OK', { status: 200 });
  }

  await runKickEvents();
  return new Response('OK', { status: 200 });
}

// ── CARD GRADING ─────────────────────────────────────────────────────────────
//
// Grade distribution (mirrors the weightings table):
//   Grades 1-3  → 5.00% each  (damaged / poor)
//   Grades 4-5  → 8.33% each  (heavily played / moderately played)
//   Grades 6-8  → 18.33% each (lightly played / near mint range)
//   Grade  9    → 8.33%       (near mint+)
//   Grade  10   → 5.00%       (gem mint)
//
// Genesis Mint: a 1-in-100 special that overrides the grade to 10 and is
//   flagged separately (comparable to CGC Black Label / PSA Pristine).

const GRADE_WEIGHTS: { grade: number; weight: number }[] = [
  { grade: 1,  weight: 5.00  },
  { grade: 2,  weight: 5.00  },
  { grade: 3,  weight: 5.00  },
  { grade: 4,  weight: 8.33  },
  { grade: 5,  weight: 8.33  },
  { grade: 6,  weight: 18.33 },
  { grade: 7,  weight: 18.33 },
  { grade: 8,  weight: 18.33 },
  { grade: 9,  weight: 8.33  },
  { grade: 10, weight: 5.00  },
];

const GRADE_WEIGHT_TOTAL = GRADE_WEIGHTS.reduce((s, w) => s + w.weight, 0);

function generateGrade(): { grade: number; isGenesisMint: boolean } {
  // 1-in-100 chance of Genesis Mint.
  // Stored as grade 11 internally so it sorts above a standard gem-mint 10.
  // Frontend should render 11 as "10 Genesis Mint".
  if (Math.random() < 0.01) {
    return { grade: 11, isGenesisMint: true };
  }

  let rand = Math.random() * GRADE_WEIGHT_TOTAL;
  for (const { grade, weight } of GRADE_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) return { grade, isGenesisMint: false };
  }
  return { grade: 10, isGenesisMint: false }; // floating-point safety fallback
}

// --- BATTLE SYSTEM HELPERS ---

/**
 * Assigns a weighted-random mechanic to a card at grant time.
 * Uses reservoir sampling: ORDER BY -log(random()) / rarity_weight.
 * Returns the mechanic UUID or null if the table is empty.
 */
async function assignMechanic(env: Env, supabase: any, redis?: Redis | null, ctx?: any): Promise<string | null> {
  try {
    const fetcher = async () => {
      const { data } = await supabase
        .from('mechanics')
        .select('id, rarity_weight')
        .eq('is_active', true);
      return data;
    };
    
    const mechanics = await fetchWithCache(env || {} as Env, redis as Redis | null, 'cache_active_mechanics', 3600, fetcher, ctx);

    if (!mechanics || mechanics.length === 0) return null;

    // Weighted random using Efraimidis-Spirakis reservoir sampling.
    // Key = random() ^ (1 / weight). Higher weight → key closer to 1.0 → wins more often.
    // Guard=32 & Absorb=32 & Revive=33 each win ~32%. Mimic=3 wins ~3%.
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
 * Helper to roll a set of traits for a card based on its status.
 * Returns an array of mechanic IDs.
 * Design Rule: All cards get 1 trait. Genesis cards get 2 traits.
 * Prioritizes original primaryId and secondaryId if provided (legacy preservation).
 */
async function rollTraitsForCard(
  supabase: any,
  card: any,
  preFetchedMechanics?: any[],
  primaryId?: string | null,
  secondaryId?: string | null
): Promise<string[]> {
  const traitList: string[] = [];
  if (!card || !card.template_id || (card.auto_roll_traits === false)) return [];

  // 1 trait by default, 2 if genesis status detected
  const isGenesis = card.is_genesis || card.is_genesis_mint || !!secondaryId;
  const traitCount = isGenesis ? 2 : 1;

  // Prioritize provided legacy mechanics (Put Genesis/Secondary FIRST if it exists)
  if (secondaryId && traitCount > 1) traitList.push(secondaryId);
  if (primaryId) traitList.push(primaryId);

  // Fill remaining slots if needed
  if (traitList.length < traitCount) {
    let mechanicsList = preFetchedMechanics;
    if (!mechanicsList) {
      const { data: mechanicsRows } = await supabase
        .from('mechanics')
        .select('id, name, display_name, rarity_weight')
        .eq('is_active', true);
      mechanicsList = mechanicsRows || [];
    }

    while (traitList.length < traitCount) {
      const mid = pickWeightedMechanicFromList(mechanicsList);
      if (mid && !traitList.includes(mid)) {
        traitList.push(mid);
      } else if (mechanicsList?.length === traitList.length) {
        // Edge case: not enough active mechanics to fulfill count
        break;
      }
    }
  }

  return traitList.slice(0, traitCount);
}

/** Same distribution as assignMechanic, in-process (single mechanics fetch for bulk grants). */
function pickWeightedMechanicFromList(mechanics: { id: string; rarity_weight?: number }[] | null | undefined): string | null {
  if (!mechanics || mechanics.length === 0) return null;
  let best: { id: string; rarity_weight?: number } | null = null;
  let bestScore = -Infinity;
  for (const m of mechanics) {
    const score = Math.random() ** (1.0 / Math.max(m.rarity_weight || 1, 1));
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best?.id ?? null;
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
      status_effects: [] as any[], // { type: 'freeze' | 'frostbite' | 'bounty', value?: number }
      oncePerCombatUsed: false,
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

  // --- Start of Combat Logic (Mirror, Bounty Hunter) ---
  const handleMirror = (cards: any[], opponents: any[], side: string) => {
    cards.forEach(card => {
      if (card.traits.some((t: any) => t.name.toLowerCase() === 'mirror')) {
        const opp = opponents.find(o => o.slot === card.slot);
        if (opp) {
          card.attack = opp.attack;
          card.defense = opp.defense;
          card.max_defense = opp.max_defense;
          card.traits = [...opp.traits];
          exchanges.push({
            type: 'mirror_transform',
            side,
            card: card.name,
            targetCard: opp.name,
          });
        }
      }
    });
  };

  const applyInitialBounty = (cards: any[], opponents: any[], side: string) => {
    cards.forEach(card => {
      if (card.traits.some((t: any) => t.name.toLowerCase() === 'bounty hunter')) {
        const aliveOpponents = opponents.filter(o => o.alive);
        if (aliveOpponents.length > 0) {
          const target = aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)];
          target.status_effects.push({ type: 'bounty' });
          exchanges.push({
            type: 'bounty_placed',
            side,
            card: card.name,
            targetCard: target.name,
          });
        }
      }
    });
  };

  const exchanges: any[] = [];
  handleMirror(cCards, tCards, 'challenger');
  handleMirror(tCards, cCards, 'target');
  applyInitialBounty(cCards, tCards, 'challenger');
  applyInitialBounty(tCards, cCards, 'target');
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
    if (!activeDefender) break;

    const attackerLabel = attackerSide === 'challenger' ? 'attacker' : 'defender';
    const defenderLabel = attackerSide === 'challenger' ? 'defender' : 'attacker';

    const exchangeData: any = {
      exchange: exchangeCount,
      side: attackerSide,
      challengerCard: null,
      targetCard: null,
      events: []
    };

    const cActive = attackers === cCards ? activeAttacker : activeDefender;
    const tActive = attackers === tCards ? activeAttacker : activeDefender;

    // --- Cleanse (Enemy +2/2, Remove Traits) ---
    if (activeAttacker.traits.some((t: any) => t.name.toLowerCase() === 'cleanse') && !activeAttacker.oncePerCombatUsed) {
      activeAttacker.oncePerCombatUsed = true;
      activeDefender.attack += 2;
      activeDefender.defense += 2;
      activeDefender.max_defense += 2;
      activeDefender.traits = []; // Remove traits
      exchangeData.events.push({ type: 'cleanse_trigger', card: activeAttacker.name, target: activeDefender.name, side: attackerSide });
    }

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

    const applyDamage = (attacker: any, defender: any, damage: number, eventSide: string) => {
      // Rule 4: Freeze check
      const freezeIdx = attacker.status_effects.findIndex((se: any) => se.type === 'freeze');
      if (freezeIdx !== -1) {
        attacker.status_effects.splice(freezeIdx, 1);
        exchangeData.events.push({ type: 'frozen_skip', card: attacker.name, side: eventSide });
        return 0;
      }

      // Rule: Frostbite damage increase
      const frostbiteStacks = defender.status_effects.filter((se: any) => se.type === 'frostbite').length;
      const finalDmg = Math.floor(damage * (1 + (frostbiteStacks * 0.1)));

      defender.defense -= finalDmg;

      // Rule: Rage (+1 ATK on dmg)
      if (defender.traits.some((t: any) => t.name.toLowerCase() === 'rage')) {
        defender.attack += 1;
        exchangeData.events.push({ type: 'rage_gain', card: defender.name, side: eventSide === 'attacker' ? 'defender' : 'attacker' });
      }

      // Rule: Frost (Apply Freeze/Frostbite on hit)
      if (attacker.traits.some((t: any) => t.name.toLowerCase() === 'frost')) {
        const isFreeze = Math.random() > 0.5;
        if (isFreeze) {
          defender.status_effects.push({ type: 'freeze' });
          exchangeData.events.push({ type: 'freeze_applied', card: attacker.name, target: defender.name, side: eventSide });
        } else {
          defender.status_effects.push({ type: 'frostbite' });
          exchangeData.events.push({ type: 'frostbite_applied', card: attacker.name, target: defender.name, side: eventSide });
        }
      }

      return finalDmg;
    };

    const finalAtkDmg = applyDamage(activeAttacker, activeDefender, atkDmg, attackerLabel);
    const finalDefDmg = applyDamage(activeDefender, activeAttacker, defDmg, defenderLabel);

    console.log(`[BATTLE RESULT] ${activeDefender.name} now has ${Math.max(0, activeDefender.defense)} DEF`);
    console.log(`[BATTLE RESULT] ${activeAttacker.name} now has ${Math.max(0, activeAttacker.defense)} DEF`);

    // --- On-Kill Logic (Bounty Hunter, Echo, Absorb) ---
    const handleOnKill = (killer: any, victim: any, side: string) => {
      if (killer.alive && !victim.alive) {
        // Echo (Attack again)
        if (killer.traits.some((t: any) => t.name.toLowerCase() === 'echo')) {
          exchangeData.events.push({ type: 'echo_trigger', card: killer.name, side });
          // In a simple system we just trigger another hit here
          applyDamage(killer, victim, killer.attack, side); // Re-apply to a dead shell just for logic? No, find NEW target.
          // For simplicity in this engine we'll just log it and perhaps the next round handles it
          // OR we recurse slightly? Actually the turn alternates, so we'll just let it hit again if we can.
          // Better: just do one extra damage instance to the next available defender
          const nextDefender = side === 'attacker' ? defenders.find(c => c.alive) : attackers.find(c => c.alive);
          if (nextDefender) {
            applyDamage(killer, nextDefender, killer.attack, side);
          }
        }

        // Bounty Hunter
        if (killer.traits.some((t: any) => t.name.toLowerCase() === 'bounty hunter') && victim.status_effects.some((se: any) => se.type === 'bounty')) {
          killer.attack += victim.base_attack;
          killer.defense += victim.base_defense;
          killer.max_defense += victim.base_defense;
          exchangeData.events.push({ type: 'bounty_claimed', card: killer.name, side });
        }

        // Absorb (+25% victim max HP)
        if (killer.traits.some((t: any) => t.name.toLowerCase() === 'absorb')) {
          const gain = Math.floor(victim.max_defense * 0.25);
          killer.defense += gain;
          killer.max_defense += gain; // Absorb increases max HP
          exchangeData.events.push({ type: 'absorb_gain', amount: gain, card: killer.name, side });
        }
      }
    };

    handleOnKill(activeAttacker, activeDefender, attackerLabel);
    handleOnKill(activeDefender, activeAttacker, defenderLabel);

    exchangeData.challengerCard = snapshot(cActive);
    exchangeData.targetCard = snapshot(tActive);

    // Rule 4: Death Check Phase
    const processDeaths = (cards: any[], sideLabel: string) => {
      cards.forEach(card => {
        if (card.alive && card.defense <= 0) {
          // 4.1 Revive
          if (
            card.traits.some((t: any) => t.name === 'revive' || t.name === 'reanimate') &&
            !card.reviveUsed
          ) {
          card.defense = 1;
            card.reviveUsed = true;
            exchangeData.events.push({ type: 'revive', card: card.name, side: sideLabel });
          } else {
            // 4.2 Final Death
            card.defense = 0;
            card.alive = false;
            exchangeData.events.push({ type: 'death', card: card.name, side: sideLabel });
          }
        }
      });
    };

    processDeaths(defenders, defenderLabel);

    // Rule 5: On-Kill Effects (Absorb)
    const handleAbsorb = (killer: any, victim: any, side: string) => {
      if (killer.alive && !victim.alive && killer.traits.some((t: any) => t.name.toLowerCase() === 'absorb')) {
        const gain = Math.floor(victim.max_defense * 0.25);
        killer.defense += gain;
        killer.max_defense += gain; // Absorb increases max HP
        exchangeData.events.push({ type: 'absorb_gain', amount: gain, card: killer.name, side });
      }
    };

    handleAbsorb(activeAttacker, activeDefender, attackerLabel);
    handleAbsorb(activeDefender, activeAttacker, defenderLabel);

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


/** PostgREST / Supabase client error shape → safe JSON for logs. */
function supabaseErrSnapshot(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { raw: String(err) };
  const e = err as Record<string, unknown>;
  return {
    message: e.message,
    code: e.code,
    details: e.details,
    hint: e.hint,
  };
}

/** One block per failure — copy from `wrangler tail` / Worker logs and paste for debugging. */
function logGrantIssueCopyPaste(title: string, fields: Record<string, unknown>) {
  const payload = {
    tag: 'GRANT_ISSUE_COPY_PASTE',
    title,
    time: new Date().toISOString(),
    ...fields,
  };
  console.error('\n========== GRANT ISSUE (copy JSON below) ==========');
  console.error(JSON.stringify(payload, null, 2));
  console.error('========== END GRANT ISSUE ==========\n');
}

/** Reuse set + card-pool rows across iterations of a single bulk grant (avoids hammering Supabase). */
type GrantPoolRequestCache = {
  activeSets?: any[];
  rarityPools: Map<string, any[]>;
};

type GrantRandomCardOptions = {
  forcedCardId?: string;
  forcedRarity?: string;
  isSilent?: boolean;
  /** When true, skip checkAndUnlockAchievements (caller should sync once after bulk). */
  skipAchievementCheck?: boolean;
  /** When true, do not use Redis for streamer sets / per-rarity card pools (avoids stale cache during bulk grants). */
  skipRedisForGrantPool?: boolean;
  /** When set (e.g. bulk dashboard grant), active sets and each rarity pool are fetched at most once per request. */
  grantPoolRequestCache?: GrantPoolRequestCache;
  /** Optional; on failure, `failReason` is set before returning null. */
  grantDiagnostic?: { failReason?: string };
  /**
   * Twitch webhooks / one-off grants: skip Upstash entirely (each Redis call = extra Worker subrequest + Upstash usage).
   * Dashboard and repeat traffic keep Redis for cache hits.
   */
  preferSupabaseOverRedis?: boolean;
};

type GrantActivitySummary = {
  card_id: string;
  card_name: string;
  rarity: string;
  recipient_twitch_id: string;
  recipient_username: string;
  /** Twitch webhooks: grant used skipAchievementCheck — run syncUserAchievements once after logging. */
  _deferAchievementSync?: boolean;
};

type BulkGrantPickState = {
  creatorId: string;
  forcedRarity?: string;
  grantPoolRequestCache: GrantPoolRequestCache;
  rarityWeights: Record<string, number>;
  activeSetIds: string[];
};

async function loadBulkGrantRarityWeights(
  env: Env,
  supabase: any,
  creatorId: string,
  now: string,
  redis: Redis | null,
  ctx?: any
): Promise<Record<string, number>> {
  let rarityWeights: any = null;
  const { data: activeEvent } = await supabase
    .from('streamer_events')
    .select('config')
    .eq('streamer_id', creatorId)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  rarityWeights = activeEvent?.config;
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
        legendary: customConfig.legendary_weight,
      };
    }
  }
  if (!rarityWeights) {
    const fetcher = async () => {
      const { data: configData } = await supabase.from('platform_config').select('*');
      return configData;
    };
    const configData = await fetchWithCache(env || {} as Env, redis as Redis | null, 'cache_platform_config', 3600, fetcher, ctx);
    const weightingConfig = configData?.find((c: any) => c.id === 'rarity_weights')?.data;
    rarityWeights = weightingConfig || { common: 70, rare: 20, epic: 8, legendary: 2 };
  }
  return rarityWeights;
}

async function ensureBulkRarityPool(
  supabase: any,
  creatorId: string,
  selectedRarity: string,
  reqCache: GrantPoolRequestCache
): Promise<any[]> {
  const rarityKey = `${creatorId}:${selectedRarity.toLowerCase()}`;
  if (reqCache.rarityPools.has(rarityKey)) return reqCache.rarityPools.get(rarityKey)!;
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .ilike('rarity', selectedRarity)
    .eq('streamer_id', creatorId);
  if (error) {
    console.error('[Grant] Card fetch error (bulk):', error.message);
    logGrantIssueCopyPaste('cards pool fetch failed', {
      step: 'cards_select',
      streamer_id: creatorId,
      selected_rarity: selectedRarity,
      rarity_key: rarityKey,
      used_request_cache: true,
      bulk: true,
      supabase_error: supabaseErrSnapshot(error),
    });
    throw new Error(`Database error during card fetch: ${error.message}`);
  }
  const rows = data ?? [];
  reqCache.rarityPools.set(rarityKey, rows);
  return rows;
}

async function pickOneRandomCardBulk(
  supabase: any,
  state: BulkGrantPickState,
  depth: number
): Promise<any | null> {
  if (depth > 12) return null;
  const { creatorId, forcedRarity, grantPoolRequestCache, rarityWeights, activeSetIds } = state;
  let selectedRarity = 'Common';
  if (forcedRarity) {
    selectedRarity = forcedRarity.charAt(0).toUpperCase() + forcedRarity.slice(1);
  } else {
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (const r of ['common', 'rare', 'epic', 'legendary']) {
      cumulative += rarityWeights[r] || 0;
      if (roll <= cumulative) {
        selectedRarity = r.charAt(0).toUpperCase() + r.slice(1);
        break;
      }
    }
  }
  const allCardsInRarity = await ensureBulkRarityPool(supabase, creatorId, selectedRarity, grantPoolRequestCache);
  const pool = (allCardsInRarity || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));
  if (!pool || pool.length === 0) {
    if (forcedRarity) {
      const { data: anyPoolRaw } = await supabase.from('cards').select('*').eq('streamer_id', creatorId);
      const anyPool = (anyPoolRaw || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));
      if (!anyPool?.length) return null;
      return anyPool[Math.floor(Math.random() * anyPool.length)];
    }
    if (selectedRarity.toLowerCase() === 'common') {
      const { data: allCards } = await supabase.from('cards').select('*').eq('streamer_id', creatorId).limit(10);
      const fallbackPool = (allCards || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));
      if (fallbackPool.length > 0) return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      return null;
    }
    return pickOneRandomCardBulk(supabase, state, depth + 1);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Picks N catalog rows with minimal subrequests (one Worker invocation), then caller batch-inserts. */
async function creatorBulkPickRandomCards(
  supabase: any,
  env: Env | undefined,
  creatorId: string,
  count: number,
  forcedCardId: string | undefined,
  forcedRarity: string | undefined,
  grantPoolRequestCache: GrantPoolRequestCache,
  pickOpts: { skipRedis?: boolean } = {},
  ctx?: any
): Promise<any[]> {
  if (forcedCardId) {
    const { data: c, error: cErr } = await supabase
      .from('cards')
      .select('*')
      .eq('id', forcedCardId)
      .eq('streamer_id', creatorId)
      .maybeSingle();
    if (cErr || !c) {
      throw new Error(
        'Card not found in this channel catalog (wrong ID, another streamer’s card, or it was deleted).'
      );
    }
    return Array.from({ length: count }, () => c);
  }
  let redis: Redis | null = null;
  if (!pickOpts?.skipRedis && env) {
    redis = getRedis(env);
  }
  const now = new Date().toISOString();
  const rarityWeights = await loadBulkGrantRarityWeights(env, supabase, creatorId, now, redis, ctx);
  if (!('activeSets' in grantPoolRequestCache)) {
    const { data, error } = await supabase
      .from('streamer_sets')
      .select('id, is_active, is_always_active')
      .eq('streamer_id', creatorId);
    if (error) {
      console.error('[Grant] Set fetch error (bulk):', error.message);
      logGrantIssueCopyPaste('streamer_sets fetch failed', {
        step: 'streamer_sets',
        streamer_id: creatorId,
        bulk: true,
        supabase_error: supabaseErrSnapshot(error),
      });
      throw new Error(`Database error during streamer_sets fetch: ${error.message}`);
    }
    grantPoolRequestCache.activeSets = data ?? [];
  }
  const activeSets = grantPoolRequestCache.activeSets!;
  const activeSetIds = activeSets.filter((s: any) => s.is_active || s.is_always_active).map((s: any) => s.id);
  const bulkState: BulkGrantPickState = {
    creatorId,
    forcedRarity,
    grantPoolRequestCache,
    rarityWeights,
    activeSetIds,
  };
  const picks: any[] = [];
  for (let i = 0; i < count; i++) {
    const card = await pickOneRandomCardBulk(supabase, bulkState, 0);
    if (!card?.id) {
      throw new Error('No cards available for this streamer (bulk pick exhausted).');
    }
    picks.push(card);
  }
  return picks;
}

type BulkGrantToRecipientOptions = {
  forcedCardId?: string;
  forcedRarity?: string;
  /** Per-row OBS consumption (e.g. gift subs: only first shows on overlay). */
  isObsConsumedForIndex?: (index: number) => boolean;
  /** Override card_drop notification text/data per row. */
  buildNotification?: (
    index: number,
    total: number,
    randomCard: any,
    isGenesis: boolean,
    userCardId: string
  ) => { message: string; data: Record<string, unknown> };
  /** Skip Upstash for this batch (Twitch webhooks — fewer Worker subrequests). */
  skipRedis?: boolean;
};

/**
 * Batch random catalog grants (dashboard bulk, Twitch mass gift, etc.) — minimal Worker subrequests.
 */
async function bulkGrantRandomCardsToTwitchUser(
  supabase: any,
  env: Env | undefined,
  streamerId: string,
  twitchId: string,
  username: string,
  qty: number,
  options: BulkGrantToRecipientOptions = {},
  ctx?: any
): Promise<{ granted: number; lastResult: GrantActivitySummary; userCardIds: string[] }> {
  const { forcedCardId, forcedRarity, skipRedis: bulkSkipRedis } = options;
  const isObsFor = options.isObsConsumedForIndex ?? (() => false);
  const total = qty;
  const buildNotif =
    options.buildNotification ??
    ((index: number, tot: number, randomCard: any, isGenesis: boolean, userCardId: string) => ({
      message: isGenesis
        ? `🌌 GENESIS CARD! You got a dual-trait card: ${randomCard.name}!`
        : `🏰 You got a new card: ${randomCard.name}!`,
      data: {
        card_id: randomCard.id,
        user_card_id: userCardId,
        name: randomCard.name,
        rarity: randomCard.rarity,
        image_url: randomCard.image_url,
        has_template: !!randomCard.template_id,
        is_genesis: isGenesis,
      },
    }));

  const { data: blockedRowBulk } = await supabase
    .from('streamer_collector_blocks')
    .select('blocked_twitch_id')
    .eq('streamer_id', streamerId)
    .eq('blocked_twitch_id', twitchId)
    .maybeSingle();
  if (blockedRowBulk) {
    throw new Error('This user is blocked from receiving cards on this channel');
  }
  const { data: userRowBulk } = await supabase
    .from('users')
    .select('is_linked')
    .eq('twitch_id', twitchId)
    .maybeSingle();

  const bulkCache: GrantPoolRequestCache = { rarityPools: new Map<string, any[]>() };
  const picked = await creatorBulkPickRandomCards(
    supabase,
    env as Env,
    streamerId,
    qty,
    forcedCardId,
    forcedRarity,
    bulkCache,
    { skipRedis: !!bulkSkipRedis },
    ctx
  );

  const _grantedUserCardIds: string[] = [];

  const { data: mechanicsRows } = await supabase
    .from('mechanics')
    .select('id, name, display_name, rarity_weight')
    .eq('is_active', true);
  const mechanicsList = mechanicsRows || [];

  // Pre-fetch templates for all picked cards in one query (deduped by template_id).
  // This avoids N individual fetches inside the forEach and supplies the template
  // data needed for pull-time image baking.
  const pickedTemplateIds = [...new Set(
    picked.filter((c: any) => c.template_id).map((c: any) => c.template_id as string)
  )];
  const templateMap = new Map<string, any>();
  if (pickedTemplateIds.length > 0) {
    const { data: templateRows } = await supabase
      .from('card_templates')
      .select('*')
      .in('id', pickedTemplateIds);
    templateRows?.forEach((t: any) => templateMap.set(t.id, t));
  }

  if (userRowBulk?.is_linked) {
    const userCardRows: any[] = [];
    const notifRows: any[] = [];
    const total = picked.length;
    for (const [idx, randomCard] of (picked as any[]).entries()) {
      const { grade: cardGrade, isGenesisMint } = generateGrade();
      const isGenesis = Math.random() < 0.01;
      let primaryMechanicId = pickWeightedMechanicFromList(mechanicsList);
      let secondaryMechanicId: string | null = null;
      if (isGenesis) {
        let retries = 0;
        while (retries < 5) {
          secondaryMechanicId = pickWeightedMechanicFromList(mechanicsList);
          if (secondaryMechanicId !== primaryMechanicId) break;
          retries++;
        }
      }
      const traitList = await rollTraitsForCard(supabase, randomCard, mechanicsList, primaryMechanicId, secondaryMechanicId);

      const userCardId = crypto.randomUUID();
      userCardRows.push({
        id: userCardId,
        twitch_id: twitchId,
        card_id: randomCard.id,
        streamer_id: streamerId,
        granted_by_streamer: streamerId,
        is_obs_consumed: isObsFor(idx),
        attack: randomCard.attack,
        defense: randomCard.defense,
        max_hp: randomCard.defense,
        mechanic_id: isGenesis ? secondaryMechanicId : primaryMechanicId,
        genesis_mechanic_id: isGenesis ? primaryMechanicId : null,
        grade: cardGrade,
        is_genesis_mint: isGenesisMint,
        trait_list: traitList,
        granted_at: new Date().toISOString(),
      });
      const { message, data } = buildNotif(idx, total, randomCard, isGenesis, userCardId);
      notifRows.push({
        twitch_id: twitchId,
        streamer_id: streamerId,
        type: 'card_drop',
        message,
        data,
      });
    }
    _grantedUserCardIds.push(...userCardRows.map((r: any) => r.id as string));

    const { error: cardErrBulk } = await supabase.from('user_cards').insert(userCardRows);
    if (cardErrBulk) {
      logGrantIssueCopyPaste('user_cards batch insert failed', {
        step: 'user_cards.insert.batch',
        streamer_id: streamerId,
        recipient_twitch_id: twitchId,
        count: userCardRows.length,
        supabase_error: supabaseErrSnapshot(cardErrBulk),
      });
      throw new Error(cardErrBulk.message || 'user_cards batch insert failed');
    }
    if (notifRows.length > 0) {
      const { error: notifErrBulk } = await supabase.from('notifications').insert(notifRows);
      if (notifErrBulk) console.error('[Grant] Batch notification insert:', notifErrBulk.message);
    }

    // Kick off image baking asynchronously — doesn't block the pack-open response.
    // Each card with a template_id and rolled traits gets its image generated,
    // uploaded to R2 (deduped by traitHash), and its baked_image_url persisted.
    if (ctx && env) {
      const bakingTasks = userCardRows
        .map((uc: any, idx: number) => {
          const randomCard = picked[idx];
          const template = randomCard.template_id ? templateMap.get(randomCard.template_id) : null;
          // Skip: no template, no traits, or already baked (URL is immutable once set)
          if (!template || !uc.trait_list?.length || uc.baked_image_url) return null;
          return bakeCardImage(env as Env, supabase, uc.id, randomCard, template, uc.trait_list, 'user_cards', !!uc.is_genesis_mint || !!uc.genesis_mechanic_id);
        })
        .filter(Boolean) as Promise<string | null>[];
      if (bakingTasks.length > 0) {
        ctx.waitUntil(Promise.all(bakingTasks));
      }
    }

    if (ctx) ctx.waitUntil(syncUserAchievements(supabase, twitchId, streamerId));
    else await syncUserAchievements(supabase, twitchId, streamerId);
    // Invalidate collection ETag so next GET returns fresh data
    if (ctx && env) ctx.waitUntil(invalidateCollectionEtag(env as Env, twitchId, streamerId));
  } else {
    if (!userRowBulk) {
      await supabase
        .from('users')
        .upsert({ twitch_id: twitchId, username, is_linked: false }, { onConflict: 'twitch_id' });
    }
    const pendingRows: any[] = [];
    for (const [idx, randomCard] of (picked as any[]).entries()) {
      const { grade: pendingGrade, isGenesisMint: pendingIsGenesisMint } = generateGrade();
      
      const isGenesis = Math.random() < 0.01;
      let primaryMechanicId = pickWeightedMechanicFromList(mechanicsList);
      let secondaryMechanicId: string | null = null;
      if (isGenesis) {
        let retries = 0;
        while (retries < 5) {
          secondaryMechanicId = pickWeightedMechanicFromList(mechanicsList);
          if (secondaryMechanicId !== primaryMechanicId) break;
          retries++;
        }
      }

      // Automatic Trait Rolling
      const traitList = await rollTraitsForCard(supabase, randomCard, mechanicsList, primaryMechanicId, secondaryMechanicId);


      const rewardId = crypto.randomUUID();
      pendingRows.push({
        id: rewardId,
        twitch_id: twitchId,
        card_id: randomCard.id,
        streamer_id: streamerId,
        is_obs_consumed: isObsFor(idx),
        grade: pendingGrade,
        is_genesis_mint: pendingIsGenesisMint,
        attack: randomCard.attack,
        defense: randomCard.defense,
        max_hp: randomCard.defense,
        mechanic_id: isGenesis ? secondaryMechanicId : primaryMechanicId,
        genesis_mechanic_id: isGenesis ? primaryMechanicId : null,
        trait_list: traitList,
      });
    }

    _grantedUserCardIds.push(...pendingRows.map((r: any) => r.id as string));

    const { error: rewardErrBulk } = await supabase.from('pending_rewards').insert(pendingRows);
    if (rewardErrBulk) {
      logGrantIssueCopyPaste('pending_rewards batch insert failed', {
        step: 'pending_rewards.insert.batch',
        streamer_id: streamerId,
        recipient_twitch_id: twitchId,
        count: pendingRows.length,
        supabase_error: supabaseErrSnapshot(rewardErrBulk),
      });
      throw new Error(rewardErrBulk.message || 'pending_rewards batch insert failed');
    }

    // Kick off image baking asynchronously for pending rewards.
    if (ctx && env) {
      const bakingTasksRewards = pendingRows
        .map((pr: any, idx: number) => {
          const randomCard = picked[idx];
          const template = randomCard.template_id ? templateMap.get(randomCard.template_id) : null;
          // Skip: no template, no traits, or already baked
          if (!template || !pr.trait_list?.length || pr.baked_image_url) return null;
          return bakeCardImage(env as Env, supabase, pr.id, randomCard, template, pr.trait_list, 'pending_rewards', !!pr.is_genesis_mint || !!pr.genesis_mechanic_id);
        })
        .filter(Boolean) as Promise<string | null>[];
      if (bakingTasksRewards.length > 0) {
        ctx.waitUntil(Promise.all(bakingTasksRewards));
      }
    }
    // Invalidate collection ETag for the recipient (pending rewards become user_cards on link)
    if (ctx && env) ctx.waitUntil(invalidateCollectionEtag(env as Env, twitchId, streamerId));
  }

  const lastCard = picked[picked.length - 1];
  return {
    granted: picked.length,
    lastResult: {
      card_id: String(lastCard.id),
      card_name: String(lastCard.name || 'Card'),
      rarity: String(lastCard.rarity || ''),
      recipient_twitch_id: twitchId,
      recipient_username: username,
    },
    userCardIds: _grantedUserCardIds,
  };
}

async function grantRandomCard(
  supabase: any,
  userId: string,
  userName: string,
  creatorId: string,
  customMessage?: string | null,
  env?: Env,
  options: GrantRandomCardOptions = {},
  ctx?: any
) {
  const setGrantFail = (reason: string) => {
    if (options.grantDiagnostic) options.grantDiagnostic.failReason = reason;
  };
  try {
    let redis: Redis | null = null;
    if (!options.preferSupabaseOverRedis && env) {
      redis = getRedis(env as Env);
    }
    const poolRedis = options.skipRedisForGrantPool ? null : redis;

    const { data: blockedRow } = await supabase
      .from('streamer_collector_blocks')
      .select('blocked_twitch_id')
      .eq('streamer_id', creatorId)
      .eq('blocked_twitch_id', userId)
      .maybeSingle();
    if (blockedRow) {
      throw new Error('This user is blocked from receiving cards on this channel');
    }

    const { forcedCardId, forcedRarity, isSilent } = options;
    const now = new Date().toISOString();

    let randomCard: any = null;
    let selectedRarity = 'Common';

    if (forcedCardId) {
      const { data: c, error: cErr } = await supabase
        .from('cards')
        .select('*')
        .eq('id', forcedCardId)
        .eq('streamer_id', creatorId)
        .maybeSingle();
      if (cErr || !c) {
        throw new Error(
          'Card not found in this channel catalog (wrong ID, another streamer’s card, or it was deleted).'
        );
      }
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
          .order('ends_at', { ascending: false })
          .limit(1)
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
          const fetcher = async () => {
            const { data: configData } = await supabase.from('platform_config').select('*');
            return configData;
          };
          const configData = await fetchWithCache(env ?? {} as Env, redis, 'cache_platform_config', 3600, fetcher, ctx);
          const weightingConfig = configData?.find((c: any) => c.id === 'rarity_weights')?.data;
          rarityWeights = weightingConfig || { common: 70, rare: 20, epic: 8, legendary: 2 };
        }

        const roll = Math.random() * 100;
        let cumulative = 0;
        for (const r of ['common', 'rare', 'epic', 'legendary']) {
          cumulative += rarityWeights[r] || 0;
          if (roll <= cumulative) { selectedRarity = r.charAt(0).toUpperCase() + r.slice(1); break; }
        }
      }

      const reqCache = options.grantPoolRequestCache;

      // Fetch active sets to filter the card pool (Redis TTL cache, or once per HTTP request for bulk)
      let activeSets: any[] | null | undefined;
      if (reqCache) {
        if (!('activeSets' in reqCache)) {
          const { data, error } = await supabase
            .from('streamer_sets')
            .select('id, is_active, is_always_active')
            .eq('streamer_id', creatorId);
          if (error) {
            console.error('[Grant] Set fetch error:', error.message);
            logGrantIssueCopyPaste('streamer_sets fetch failed', {
              step: 'streamer_sets',
              streamer_id: creatorId,
              supabase_error: supabaseErrSnapshot(error),
            });
            throw new Error(`Database error during streamer_sets fetch: ${error.message}`);
          }
          reqCache.activeSets = data ?? [];
        }
        activeSets = reqCache.activeSets;
      } else {
        activeSets = await fetchWithCache(
          env ?? {} as Env,
          poolRedis,
          `cache_streamer_sets:${creatorId}`,
          300,
          async () => {
            const { data, error } = await supabase
              .from('streamer_sets')
              .select('id, is_active, is_always_active')
              .eq('streamer_id', creatorId);
            if (error) {
              console.error('[Grant] Set fetch error:', error.message);
              logGrantIssueCopyPaste('streamer_sets fetch failed (cached path)', {
                step: 'streamer_sets',
                streamer_id: creatorId,
                supabase_error: supabaseErrSnapshot(error),
              });
            }
            return data;
          },
          ctx
        );
      }

      const activeSetIds = activeSets?.filter((s: any) => s.is_active || s.is_always_active).map((s: any) => s.id) || [];

      // Query cards with case-insensitive rarity check (Redis TTL, or once per rarity per bulk request)
      const rarityKey = `${creatorId}:${selectedRarity.toLowerCase()}`;
      let allCardsInRarity: any[] | null | undefined;
      if (reqCache) {
        if (reqCache.rarityPools.has(rarityKey)) {
          allCardsInRarity = reqCache.rarityPools.get(rarityKey);
        } else {
          const { data, error } = await supabase
            .from('cards')
            .select('*')
            .ilike('rarity', selectedRarity)
            .eq('streamer_id', creatorId);
          if (error) {
            console.error('[Grant] Card fetch error:', error.message);
            logGrantIssueCopyPaste('cards pool fetch failed', {
              step: 'cards_select',
              streamer_id: creatorId,
              selected_rarity: selectedRarity,
              rarity_key: rarityKey,
              used_request_cache: true,
              supabase_error: supabaseErrSnapshot(error),
            });
            throw new Error(`Database error during card fetch: ${error.message}`);
          }
          const rows = data ?? [];
          reqCache.rarityPools.set(rarityKey, rows);
          allCardsInRarity = rows;
        }
      } else {
        const cacheKey = `cache_cards_pool:${creatorId}:${selectedRarity.toLowerCase()}`;
        allCardsInRarity = await fetchWithCache(
          env as Env,
          poolRedis as Redis | null,
          cacheKey,
          300,
          async () => {
            const { data, error } = await supabase
              .from('cards')
              .select('*')
              .ilike('rarity', selectedRarity)
              .eq('streamer_id', creatorId);
            if (error) {
              console.error('[Grant] Card fetch error:', error.message);
              logGrantIssueCopyPaste('cards pool fetch failed', {
                step: 'cards_select',
                streamer_id: creatorId,
                selected_rarity: selectedRarity,
                rarity_key: `${creatorId}:${selectedRarity.toLowerCase()}`,
                used_request_cache: false,
                supabase_error: supabaseErrSnapshot(error),
              });
              throw new Error(`Database error during card fetch: ${error.message}`);
            }
            return data;
          },
          ctx
        );
      }

      // A card is eligible if it has no set OR its set is active (or always active)
      let pool = (allCardsInRarity || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));

      if (!pool || pool.length === 0) {
        console.log(`[Grant] Pool empty for ${selectedRarity} (Streamer: ${creatorId})`);
        // If we forced a rarity that doesn't exist, we fallback
        if (forcedRarity) {
          const { data: anyPoolRaw } = await supabase.from('cards').select('*').eq('streamer_id', creatorId);
          const anyPool = (anyPoolRaw || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));

          if (!anyPool || anyPool.length === 0) throw new Error('No cards available for this streamer');
          randomCard = anyPool[Math.floor(Math.random() * anyPool.length)];
        } else {
          // If common is empty, try to find ANY card before giving up
          if (selectedRarity.toLowerCase() === 'common') {
            const { data: allCards } = await supabase.from('cards').select('*').eq('streamer_id', creatorId).limit(10);
            const fallbackPool = (allCards || []).filter((c: any) => !c.set_id || activeSetIds.includes(c.set_id));
            if (fallbackPool.length > 0) {
              randomCard = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
            } else {
              console.error('[Grant] Completely empty card pool for streamer:', creatorId);
              setGrantFail('No cards available in pool for this streamer');
              return null;
            }
          } else {
            // Fallback to common roll
            return await grantRandomCard(supabase, userId, userName, creatorId, customMessage, env, options, ctx);
          }
        }
      } else {
        randomCard = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (!randomCard?.id) {
      console.error('[Grant] No card selected after pool resolution');
      setGrantFail('No card selected after pool resolution');
      return null;
    }

    const grantSummary = {
      card_id: String(randomCard.id),
      card_name: String(randomCard.name || 'Card'),
      rarity: String(randomCard.rarity || ''),
      recipient_twitch_id: userId,
      recipient_username: userName,
    };

    const { data: user } = await supabase.from('users').select('is_linked').eq('twitch_id', userId).maybeSingle();

    if (user?.is_linked) {
      // Generate card grade (independent of genesis trait roll)
      const { grade: cardGrade, isGenesisMint } = generateGrade();

      // Genesis Trait System (1% chance for dual traits)
      const isGenesis = Math.random() < 0.01;
      const primaryMechanicId = await assignMechanic(env || {} as Env, supabase, redis, ctx);
      let secondaryMechanicId = null;

      if (isGenesis) {
        // Roll for a second distinct mechanic
        let retries = 0;
        while (retries < 5) {
          secondaryMechanicId = await assignMechanic(env || {} as Env, supabase, redis, ctx);
          if (secondaryMechanicId !== primaryMechanicId) break;
          retries++;
        }
      }

      // Roll dynamic traits if this card has a template configured
      let traitList: string[] = [];
      if (randomCard.template_id && (randomCard.auto_roll_traits || true)) {
        const rarityKey = (randomCard.rarity || 'common').toLowerCase();
        let traitCount = 1;
        if (rarityKey === 'rare') traitCount = 2;
        else if (rarityKey === 'epic') traitCount = 3;
        else if (rarityKey === 'legendary') traitCount = 4;

        const { data: mechanicsRows } = await supabase
          .from('mechanics')
          .select('id, name, display_name, rarity_weight')
          .eq('is_active', true);
        const mechanicsList = mechanicsRows || [];
        for (let i = 0; i < traitCount; i++) {
          const mid = pickWeightedMechanicFromList(mechanicsList);
          if (mid) traitList.push(mid);
        }
      }

      // Pre-generate UUID so the notification and DB row share the same ID
      const userCardId = crypto.randomUUID();

      const { error: cardErr } = await supabase.from('user_cards').insert({
        id: userCardId,
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
        grade: cardGrade,
        is_genesis_mint: isGenesisMint,
        trait_list: traitList,
        granted_at: new Date().toISOString(),
      });

      if (cardErr) {
        console.error('[Grant] Error inserting user_card:', cardErr.message);
        logGrantIssueCopyPaste('user_cards insert failed', {
          step: 'user_cards.insert',
          streamer_id: creatorId,
          recipient_twitch_id: userId,
          card_id: randomCard?.id,
          supabase_error: supabaseErrSnapshot(cardErr),
        });
        setGrantFail(cardErr.message || 'user_cards insert failed');
        return null;
      }

      // Kick off image baking async — doesn't block the grant response
      // Skip if baked_image_url is already set (userCard was just inserted so it won't be,
      // but guard here in case this path is ever called on an existing card row)
      if (env && ctx && randomCard.template_id && traitList.length > 0) {
        const { data: tmpl } = await supabase
          .from('card_templates')
          .select('*')
          .eq('id', randomCard.template_id)
          .maybeSingle();
        if (tmpl) {
          ctx.waitUntil(
            bakeCardImage(env, supabase, userCardId, randomCard, tmpl, traitList)
          );
        }
      }

      const notificationMsg = isGenesis
        ? `🌌 GENESIS CARD! ${customMessage || `You got a dual-trait card: ${randomCard.name}!`}`
        : customMessage || `🏰 You got a new card: ${randomCard.name}!`;

      const { error: notifErr } = await supabase.from('notifications').insert({
        twitch_id: userId,
        streamer_id: creatorId,
        type: 'card_drop',
        message: notificationMsg,
        data: {
          card_id: randomCard.id,
          user_card_id: userCardId,
          name: randomCard.name,
          rarity: randomCard.rarity,
          image_url: randomCard.image_url,
          has_template: !!randomCard.template_id,
          is_genesis: isGenesis,
        }
      });

      if (notifErr) {
        console.error('[Grant] Error inserting notification:', notifErr.message);
      }

      if (!options.skipAchievementCheck) {
        await checkAndUnlockAchievements(supabase, userId, randomCard, creatorId);
      }
      // Invalidate collection ETag so viewer's next load reflects this new card
      if (ctx && env) ctx.waitUntil(invalidateCollectionEtag(env as Env, userId, creatorId));
      return options.skipAchievementCheck
        ? { ...grantSummary, _deferAchievementSync: true }
        : grantSummary;
    } else {
      // Ensure the user row exists before inserting into pending_rewards (FK constraint)
      if (!user) {
        await supabase.from('users').upsert({ twitch_id: userId, username: userName, is_linked: false }, { onConflict: 'twitch_id' });
      }

      // Generate grade at reward time so it's locked in before account linking
      const { grade: pendingGrade, isGenesisMint: pendingIsGenesisMint } = generateGrade();

      // Genesis Trait System (1% chance for dual traits)
      const isGenesisStatus = Math.random() < 0.01;
      const primaryMechId = await assignMechanic(env || {} as Env, supabase, redis, ctx);
      let secondaryMechId = null;

      if (isGenesisStatus) {
        let retriesCount = 0;
        while (retriesCount < 5) {
          secondaryMechId = await assignMechanic(env || {} as Env, supabase, redis, ctx);
          if (secondaryMechId !== primaryMechId) break;
          retriesCount++;
        }
      }

      // Roll dynamic traits if template is present
      let rolledTraitList: string[] = [];
      if (randomCard.template_id && (randomCard.auto_roll_traits || true)) {
        const rarityKey = (randomCard.rarity || 'common').toLowerCase();
        let tCount = 1;
        if (rarityKey === 'rare') tCount = 2;
        else if (rarityKey === 'epic') tCount = 3;
        else if (rarityKey === 'legendary') tCount = 4;

        const { data: mechRows } = await supabase
          .from('mechanics')
          .select('id, name, display_name, rarity_weight')
          .eq('is_active', true);
        const mechList = mechRows || [];
        for (let i = 0; i < tCount; i++) {
          const mid = pickWeightedMechanicFromList(mechList);
          if (mid) rolledTraitList.push(mid);
        }
      }

      const rewardId = crypto.randomUUID();

      const { error: rewardErr } = await supabase.from('pending_rewards').insert({
        id: rewardId,
        twitch_id: userId,
        card_id: randomCard.id,
        streamer_id: creatorId,
        is_obs_consumed: isSilent || false,
        grade: pendingGrade,
        is_genesis_mint: pendingIsGenesisMint,
        attack: randomCard.attack,
        defense: randomCard.defense,
        max_hp: randomCard.defense,
        mechanic_id: isGenesisStatus ? secondaryMechId : primaryMechId,
        genesis_mechanic_id: isGenesisStatus ? primaryMechId : null,
        trait_list: rolledTraitList,
      });

      if (rewardErr) {
        console.error('[Grant] Error inserting pending_reward:', rewardErr.message);
        logGrantIssueCopyPaste('pending_rewards insert failed', {
          step: 'pending_rewards.insert',
          streamer_id: creatorId,
          recipient_twitch_id: userId,
          card_id: randomCard?.id,
          supabase_error: supabaseErrSnapshot(rewardErr),
        });
        setGrantFail(rewardErr.message || 'pending_rewards insert failed');
        return null;
      }

      // Kick off image baking async for pending reward
      if (env && ctx && randomCard.template_id && rolledTraitList.length > 0) {
        const { data: tmplRow } = await supabase
          .from('card_templates')
          .select('*')
          .eq('id', randomCard.template_id)
          .maybeSingle();
        if (tmplRow) {
          ctx.waitUntil(
            bakeCardImage(env, supabase, rewardId, randomCard, tmplRow, rolledTraitList, 'pending_rewards')
          );
        }
      }


      // Notification for unlinked user (they can see it later when they link)
      const pendingNotifMsg = isGenesisStatus
        ? `🌌 GENESIS CARD! ${customMessage || `You got a dual-trait card: ${randomCard.name}!`}`
        : customMessage || `🏰 You got a new card: ${randomCard.name}!`;

      await supabase.from('notifications').insert({
        twitch_id: userId,
        streamer_id: creatorId,
        type: 'card_drop',
        message: pendingNotifMsg,
        data: {
          card_id: randomCard.id,
          user_card_id: rewardId,
          name: randomCard.name,
          rarity: randomCard.rarity,
          image_url: randomCard.image_url,
          has_template: !!randomCard.template_id,
          is_genesis: isGenesisStatus,
        }
      });

      return grantSummary;
    }
  } catch (e: any) {
    console.error('[Grant] Error:', e.message);
    const msg = e?.message || 'Grant threw an unexpected error';
    // Thrown DB fetch errors already emitted GRANT_ISSUE_COPY_PASTE above.
    if (!(typeof msg === 'string' && msg.startsWith('Database error during'))) {
      logGrantIssueCopyPaste('grantRandomCard uncaught exception', {
        step: 'grantRandomCard.catch',
        streamer_id: creatorId,
        recipient_twitch_id: userId,
        message: msg,
        stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 12).join('\n') : undefined,
      });
    }
    setGrantFail(msg);
    return null;
  }
}

async function logTwitchGrantToActivity(
  supabase: any,
  streamerId: string,
  summary: GrantActivitySummary | null | undefined,
  context: string
) {
  if (!summary) return;
  await logSystem(
    supabase,
    'info',
    'grant',
    `"${summary.card_name}" → ${summary.recipient_username} · Twitch (${context})`,
    streamerId,
    {
      card_id: summary.card_id,
      card_name: summary.card_name,
      rarity: summary.rarity,
      recipient_twitch_id: summary.recipient_twitch_id,
      recipient_username: summary.recipient_username,
      platform: 'twitch',
      twitch_context: context,
    }
  );
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
function secureResponse(
  data: any,
  status: number,
  corsHeaders: any,
  isError: boolean = false,
  extraHeaders?: Record<string, string>
): Response {
  const securityHeaders: Record<string, string> = {
    ...corsHeaders,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob:;",
    'Content-Type': 'application/json',
    ...(extraHeaders || {})
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

function sanitizeMetadata(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const sanitized = { ...data };
  const sensitiveKeys = ['email', 'token', 'secret', 'password', 'jwt', 'code', 'access_token', 'refresh_token', 'obs_overlay_token', 'webhook_secret'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeMetadata(sanitized[key]);
    }
  }
  return sanitized;
}

async function logSystem(
  supabase: any,
  level: 'info' | 'warn' | 'error',
  category: string,
  message: string,
  streamerId?: string,
  metadata: any = {}
) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${category.toUpperCase()}] [${level.toUpperCase()}]`;
  const streamerInfo = streamerId ? ` [${streamerId}]` : '';

  console.log(`${logPrefix}${streamerInfo} ${message}`, Object.keys(metadata).length ? sanitizeMetadata(metadata) : '');

  try {
    const meta = sanitizeMetadata(metadata);
    const { error } = await supabase.from('streamer_activity_logs').insert({
      streamer_id: streamerId || null,
      level,
      category,
      message,
      metadata: meta && typeof meta === 'object' ? meta : {},
      created_at: timestamp,
    });
    if (error) console.error('[logSystem] streamer_activity_logs insert:', error.message);
  } catch (e: any) {
    console.error('[logSystem] persist failed:', e?.message || e);
  }
}

// Rate limiting - Redis-backed global sliding window (works across all CF edge nodes)
// Falls back to allowing the request if Redis is unavailable.
async function checkRateLimit(ip: string, limit: number = 60, redis: Redis | null): Promise<boolean> {
  if (!redis) return true; // Fail open if Redis not configured

  const windowSeconds = 60;
  const key = `rl:${ip}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First request in this window — set expiry
      await redis.expire(key, windowSeconds * 2); // 2x window so key outlives the window
    }
    return count <= limit;
  } catch (e) {
    console.error('[Redis] Rate limit check failed, failing open:', e);
    return true; // Fail open on Redis error — better than blocking all users
  }
}

/** Legacy defaults from migration 003 — treated as "no override" so achievements.name (seeded) is shown. */
const LEGACY_STREAMER_ACHIEVEMENT_DEFAULT_NAMES: Record<string, string> = {
  beginner: 'Beginner Collector',
  hoarder: 'Card Hoarder',
  rare: 'Rare Find',
  epic: 'Epic Moment',
  legendary: 'Legendary Luck',
  completionist: 'Completionist',
  traveler: 'World Traveler',
  streak: 'Hot Streak',
  trader: 'Trader Debut',
};

function resolveAchievementDisplayName(
  canonicalName: string,
  customKey: string | undefined,
  customNames: Record<string, unknown> | null | undefined
): string {
  if (!customKey) return canonicalName;
  const raw = customNames?.[customKey];
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return canonicalName;
  const legacy = LEGACY_STREAMER_ACHIEVEMENT_DEFAULT_NAMES[customKey];
  if (legacy && s === legacy) return canonicalName;
  return s;
}

const ACHIEVEMENT_ID_TO_CUSTOM_NAME_KEY: Record<string, string> = {
  first_card: 'beginner',
  collector_10: 'hoarder',
  collector_50: 'master_collector',
  rare_finder: 'rare',
  epic_moment: 'epic',
  legendary_luck: 'legendary',
  completionist: 'completionist',
  set_collector: 'traveler',
  rarity_streak_3: 'streak',
  trader_debut: 'trader',
};

// Achievement check function
async function checkAndUnlockAchievements(supabase: any, twitchId: string, card: any, streamerId: string) {
  try {
    console.log('[Achievements] ========== CHECKING ACHIEVEMENTS ==========');
    console.log('[Achievements] User:', twitchId);
    console.log('[Achievements] Streamer:', streamerId);
    console.log('[Achievements] Card:', card.id, card.name, card.rarity);

    const [
      { count: cardCount },
      { data: unlocked },
      { count: totalCards },
      { count: uniqueCardsOwned },
      { data: setResults },
      { data: lastPulls }
    ] = await Promise.all([
      supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('twitch_id', twitchId).eq('streamer_id', streamerId),
      supabase.from('user_achievements').select('achievement_id').eq('twitch_id', twitchId).eq('streamer_id', streamerId),
      supabase.from('cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamerId),
      supabase.from('user_cards').select('card_id', { count: 'exact', head: true }).eq('twitch_id', twitchId).eq('streamer_id', streamerId),
      supabase.from('enriched_user_cards').select('set_id').eq('twitch_id', twitchId).eq('streamer_id', streamerId),
      supabase.from('enriched_user_cards').select('rarity').eq('twitch_id', twitchId).eq('streamer_id', streamerId).order('created_at', { ascending: false }).limit(3)
    ]);

    const unlockedIds = new Set(unlocked?.map((a: any) => a.achievement_id) || []);
    console.log('[Achievements] Total cards:', cardCount, 'Owned unique:', uniqueCardsOwned, '/', totalCards);
    
    const toUnlock: string[] = [];

    // Milestone Logic
    if (cardCount === 1 && !unlockedIds.has('first_card')) toUnlock.push('first_card');
    if (cardCount >= 10 && !unlockedIds.has('collector_10')) toUnlock.push('collector_10');
    if (cardCount >= 50 && !unlockedIds.has('collector_50')) toUnlock.push('collector_50');

    // Rarity Logic
    const rarity = card.rarity?.toLowerCase();
    if (rarity === 'rare' && !unlockedIds.has('rare_finder')) toUnlock.push('rare_finder');
    if (rarity === 'epic' && !unlockedIds.has('epic_moment')) toUnlock.push('epic_moment');
    if (rarity === 'legendary' && !unlockedIds.has('legendary_luck')) toUnlock.push('legendary_luck');

    // Completionist
    if (uniqueCardsOwned >= totalCards && !unlockedIds.has('completionist')) toUnlock.push('completionist');

    // Set Collector
    if (!unlockedIds.has('set_collector')) {
      const distinctSets = new Set(setResults?.map((c: any) => c.set_id).filter(Boolean) || []);
      if (distinctSets.size >= 2) toUnlock.push('set_collector');
    }

    // Rarity Streak
    if (!unlockedIds.has('rarity_streak_3')) {
      if (lastPulls && lastPulls.length === 3) {
        const streakStats = lastPulls.every((p: any) => ['rare', 'epic', 'legendary'].includes(p.rarity?.toLowerCase()));
        if (streakStats) toUnlock.push('rarity_streak_3');
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

    // 1. Get ALL user cards for this streamer, ordered by latest first
    const { data: userCards, error: cardsError } = await supabase
      .from('user_cards')
      .select('card_id, attack, defense, created_at, cards(rarity, set_id)')
      .eq('twitch_id', twitchId)
      .eq('streamer_id', streamerId)
      .order('created_at', { ascending: false });

    if (cardsError || !userCards) {
      console.error('[Achievements] Sync failed: error fetching cards', cardsError);
      return { success: false, error: 'Failed to fetch cards' };
    }

    const cardCount = userCards.length;
    if (cardCount === 0) return { success: true, count: 0 };

    const [
      { data: unlocked },
      { count: totalCardsInPool }
    ] = await Promise.all([
      supabase.from('user_achievements').select('achievement_id').eq('twitch_id', twitchId).eq('streamer_id', streamerId),
      supabase.from('cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamerId)
    ]);

    const unlockedIds = new Set(unlocked?.map((a: any) => a.achievement_id) || []);
    const toUnlock: string[] = [];

    // Criteria using in-memory userCards
    if (cardCount >= 1 && !unlockedIds.has('first_card')) toUnlock.push('first_card');
    if (cardCount >= 10 && !unlockedIds.has('collector_10')) toUnlock.push('collector_10');
    if (cardCount >= 50 && !unlockedIds.has('collector_50')) toUnlock.push('collector_50');

    const rarities = new Set(userCards.map((c: any) => c.cards?.rarity?.toLowerCase()));
    if (rarities.has('rare') && !unlockedIds.has('rare_finder')) toUnlock.push('rare_finder');
    if (rarities.has('epic') && !unlockedIds.has('epic_moment')) toUnlock.push('epic_moment');
    if (rarities.has('legendary') && !unlockedIds.has('legendary_luck')) toUnlock.push('legendary_luck');

    if (!unlockedIds.has('set_collector')) {
      const distinctSets = new Set(userCards.map((c: any) => c.cards?.set_id).filter(Boolean));
      if (distinctSets.size >= 2) toUnlock.push('set_collector');
    }

    if (!unlockedIds.has('completionist')) {
      const uniqueOwned = new Set(userCards.map((c: any) => c.card_id)).size;
      if (uniqueOwned >= (totalCardsInPool || 999)) toUnlock.push('completionist');
    }

    if (!unlockedIds.has('rarity_streak_3')) {
      const last3 = userCards.slice(0, 3);
      if (last3.length === 3 && last3.every((c: any) => ['rare', 'epic', 'legendary'].includes(c.cards?.rarity?.toLowerCase()))) {
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


/** Escapes characters that are unsafe in SVG text/attribute content. */
function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fetches a URL and returns a base64 data URI, or null on failure.
 * Used to inline images into SVG so they render correctly when the SVG
 * is loaded via an <img> tag (cross-origin <image href> is blocked by browsers).
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cf: { cacheEverything: true } } as any);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/**
 * Generates a fully self-contained SVG card with trait text overlaid.
 *
 * Uses pure SVG <text> and <image> elements (no <foreignObject>) so the SVG
 * renders correctly when loaded via an HTML <img> tag.
 * Inlines the base card art as a base64 data URI so there are no cross-origin
 * image requests inside the SVG (which browsers block in <img> context).
 */
async function generateCardSVG(template: any, traits: any[], isGenesis: boolean = false): Promise<string> {
  const { trait_area, font_size, font_color, text_align, image_url, icon_size } = template;
  const area = trait_area || { x: 60, y: 820, w: 630, h: 200 };

  const fSize  = Math.min(parseInt(font_size, 10) || 26, 42);
  const iSize  = Math.min(parseInt(icon_size, 10) || 32, 56);
  const color  = escapeXml(font_color || '#ffffff');
  const dFSize = Math.max(Math.round(fSize * 0.62), 14);

  const anchor = text_align === 'right' ? 'end' : text_align === 'center' ? 'middle' : 'start';
  const baseX  = text_align === 'right'  ? area.x + area.w - 10
               : text_align === 'center' ? area.x + area.w / 2
               : area.x + 10;

  // Collect all unique remote asset URLs upfront so we can fetch in parallel.
  // Icons that start with '/' are worker-relative — resolve using template.origin.
  const uniqueIconUrls = [...new Set(
    traits
      .map(t => (t.icon || '').trim())
      .filter(icon => icon.startsWith('/') || icon.startsWith('http'))
      .map(icon => icon.startsWith('/') ? `${template.origin || ''}${icon}` : icon)
  )];

  // Force-include the Genesis icon if this is a Genesis card
  const genesisIconUrl = `https://cdn.codeoce.com/traits/Genesis-Icon.png`;
  if (isGenesis) {
    uniqueIconUrls.push(genesisIconUrl);
  }

  // Fetch card art + all unique icon URLs concurrently
  const [artDataUri, ...iconResults] = await Promise.all([
    image_url ? fetchAsDataUri(image_url) : Promise.resolve(null),
    ...uniqueIconUrls.map(u => fetchAsDataUri(u)),
  ]);

  // Map absolute URL → inlined data URI (or null on failure)
  const iconDataUriMap = new Map<string, string | null>();
  uniqueIconUrls.forEach((u, i) => iconDataUriMap.set(u, iconResults[i]));

  const artHref = artDataUri ?? escapeXml(image_url || '');
  const genesisIconDataUri = iconDataUriMap.get(genesisIconUrl);

  // Build SVG trait rows
  let svgRows = '';
  let curY = area.y + iSize;

  for (let idx = 0; idx < traits.length; idx++) {
    const t = traits[idx];
    if (curY > area.y + area.h) break;

    const isGenesisTrait = isGenesis && idx === 0;
    let name = escapeXml((t.display_name || t.name || '').toUpperCase());
    if (isGenesisTrait) name = `GENESIS: ${name}`;

    const desc = (t.description || '').trim();
    const rawIcon = (t.icon || '').trim();
    const isUrlIcon = rawIcon.startsWith('/') || rawIcon.startsWith('http');

    if (template.icon_only) {
      // Icon-only mode: Perfectly center the icon(s) inside the bounding box and draw no text
      let totalIcons = (rawIcon ? 1 : 0) + (isGenesisTrait && genesisIconDataUri ? 1 : 0);
      let totalWidth = totalIcons * iSize + Math.max(0, totalIcons - 1) * 6;
      let iconX = area.x + (area.w / 2) - (totalWidth / 2);

      if (isGenesisTrait && genesisIconDataUri) {
         svgRows += `<image href="${genesisIconDataUri}" x="${Math.round(iconX)}" y="${Math.round(curY - iSize + 2)}" width="${iSize}" height="${iSize}" />`;
         iconX += iSize + 6;
      }
      if (rawIcon) {
        if (isUrlIcon) {
          const absUrl = rawIcon.startsWith('/') ? `${template.origin || ''}${rawIcon}` : rawIcon;
          const iconHref = iconDataUriMap.get(absUrl) ?? escapeXml(absUrl);
          svgRows += `<image href="${iconHref}" x="${Math.round(iconX)}" y="${Math.round(curY - iSize + 2)}" width="${iSize}" height="${iSize}" />`;
        } else {
          svgRows += `<text x="${Math.round(iconX + iSize / 2)}" y="${Math.round(curY - 4)}" font-size="${iSize}" text-anchor="middle">${escapeXml(rawIcon)}</text>`;
        }
      }
      curY += iSize + 4; // increment for next row if more than one trait
      continue; // Skip text rendering entirely
    }

    // Standard mode (Icon + Text)
    let iconX = text_align === 'right'  ? baseX - iSize
                : text_align === 'center' ? baseX - iSize / 2 - 4
                : area.x + 10;

    if (isGenesisTrait && genesisIconDataUri) {
       svgRows += `<image href="${genesisIconDataUri}" x="${Math.round(iconX)}" y="${Math.round(curY - iSize + 2)}" width="${iSize}" height="${iSize}" />`;
       iconX += iSize + 6; 
    }

    if (rawIcon) {
      if (isUrlIcon) {
        const absUrl = rawIcon.startsWith('/') ? `${template.origin || ''}${rawIcon}` : rawIcon;
        const iconHref = iconDataUriMap.get(absUrl) ?? escapeXml(absUrl);
        svgRows += `<image href="${iconHref}" x="${Math.round(iconX)}" y="${Math.round(curY - iSize + 2)}" width="${iSize}" height="${iSize}" />`;
      } else {
        svgRows += `<text x="${Math.round(iconX + iSize / 2)}" y="${Math.round(curY - 4)}" font-size="${iSize}" text-anchor="middle">${escapeXml(rawIcon)}</text>`;
      }
    }

    // Trait name — sits to the right of the icon(s)
    let nameX = rawIcon ? iconX + iSize + 16 : baseX;
    if (text_align === 'right') nameX = iconX - 8;
    if (text_align === 'center') nameX = iconX + iSize / 2 + 6;

    const nameAnchor = (rawIcon && text_align === 'center') ? 'start' : anchor;

    svgRows += `<text x="${Math.round(nameX)}" y="${Math.round(curY)}" `
      + `font-family="Arial Black, Arial, sans-serif" font-size="${fSize}" font-weight="900" `
      + `fill="${color}" text-anchor="${nameAnchor}" `
      + `style="text-transform:uppercase;letter-spacing:-0.5px">${name}</text>`;

    curY += dFSize + 6;

    // Description — simple word-wrap at ~36 chars per line
    if (desc) {
      const words = desc.split(/\s+/);
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > 36 && line) {
          svgRows += `<text x="${Math.round(baseX)}" y="${Math.round(curY)}" `
            + `font-family="Arial, sans-serif" font-size="${dFSize}" font-weight="400" `
            + `fill="${color}" opacity="0.78" text-anchor="${anchor}">${escapeXml(line)}</text>`;
          curY += dFSize + 3;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        svgRows += `<text x="${Math.round(baseX)}" y="${Math.round(curY)}" `
          + `font-family="Arial, sans-serif" font-size="${dFSize}" font-weight="400" `
          + `fill="${color}" opacity="0.78" text-anchor="${anchor}">${escapeXml(line)}</text>`;
        curY += dFSize + 3;
      }
    }

    curY += (traits.length > 2 ? 10 : 18); // tighter gap if many traits
  }

  return `<svg width="750" height="1050" viewBox="0 0 750 1050" xmlns="http://www.w3.org/2000/svg">
  <image href="${artHref}" width="750" height="1050" />
  ${svgRows}
</svg>`;
}

/**
 * Bakes a card image (SVG with traits overlaid) at pull-time and stores it in R2.
 *
 * Key design properties:
 * - Deterministic R2 key based on baseCardId + sorted trait IDs → deduplication.
 *   Two users who pull identical traits on the same card share one stored image.
 * - Fully self-contained SVG: card art and icons are base64-inlined, no external
 *   requests required when the SVG is served directly from the CDN.
 * - Writes the CDN URL back to user_cards.baked_image_url so subsequent collection
 *   fetches return the stable URL without hitting the worker endpoint.
 */
async function bakeCardImage(
  env: Env,
  supabase: any,
  userCardId: string,
  baseCard: { id: string; image_url: string },
  template: any,
  traitIds: string[],
  tableName: string = 'user_cards',
  isGenesis: boolean = false
): Promise<string | null> {
  try {
    if (!env.CARD_IMAGES) return null;

    // 1. Deterministic dedup key: hash(baseCardId + isGenesis + sorted trait IDs)
    const sortedTraits = [...traitIds].sort().join(',');
    const hashInput = new TextEncoder().encode(`${baseCard.id}:genesis=${isGenesis}:v3:${sortedTraits}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', hashInput);
    const traitHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    const r2Key = `card_images/baked/${baseCard.id}/${traitHash}.svg`;

    // 2. Dedup check — if already baked, just update the user_card URL and return
    const existing = await env.CARD_IMAGES.head(r2Key);
    if (existing) {
      const cdnUrl = creatorCdnPublicUrl(env, r2Key);
      await supabase.from(tableName).update({ baked_image_url: cdnUrl }).eq('id', userCardId);
      return cdnUrl;
    }

    // 3. Fetch full mechanic details for these trait IDs
    let fullTraits: any[] = [];
    if (traitIds.length > 0) {
      const { data: mechDetails } = await supabase
        .from('mechanics')
        .select('id, name, display_name, description, icon')
        .in('id', traitIds);
      fullTraits = traitIds.map(tid => mechDetails?.find((m: any) => m.id === tid)).filter(Boolean);
    }

    // 4. Generate fully self-contained SVG
    //    Use FRONTEND_URL as the origin for resolving relative icon paths (e.g. /icon.svg)
    const svgTemplate = {
      ...template,
      image_url: baseCard.image_url,
      origin: (env.FRONTEND_URL || '').replace(/\/$/, ''),
    };
    const svg = await generateCardSVG(svgTemplate, fullTraits, isGenesis);

    // 5. Upload to R2 with immutable cache headers (content never changes for this key)
    await env.CARD_IMAGES.put(r2Key, svg, {
      httpMetadata: {
        contentType: 'image/svg+xml',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const cdnUrl = creatorCdnPublicUrl(env, r2Key);

    // 6. Persist the CDN URL on the user_card instance
    await supabase.from(tableName).update({ baked_image_url: cdnUrl }).eq('id', userCardId);

    return cdnUrl;
  } catch (e: any) {
    console.error('[BakeCardImage] Failed for userCardId=%s: %s', userCardId, e.message);
    return null;
  }
}

/**
 * Invalidate all paged market listing KV cache keys for a streamer.
 * Uses a prefix scan via KV list (fast path: just delete the page-0 keys which
 * are the most commonly cached). Called in ctx.waitUntil() after mutations.
 */
async function bustMarketCache(env: Env, streamerId: string): Promise<void> {
  if (!(env as any).KV_CACHE || !streamerId) return;
  try {
    // Delete the first N pages with common sort/filter combos
    const sorts = ['recent', 'rarity_high', 'rarity_low'];
    const keys = sorts.map(s => `market:v1:${streamerId}:0:${s}::`)
      .concat(sorts.map(s => `market:v1:${streamerId}:1:${s}::`));
    await Promise.all(keys.map(k => (env as any).KV_CACHE.delete(k).catch(() => {})));
  } catch { /* non-critical */ }
}

// ─── Market Listings Helper ────────────────────────────────────────────────────
// Extracted from the GET /api/market/listings handler so it can be called from
// both the cached (public) and real-time (mine=1) paths without nesting inside try blocks.
async function fetchMarketListings(
  sb: any,
  streamerId: string,
  listerTwitchId: string | null,
  sort: string,
  search: string,
  trait: string,
  page: number,
  limit: number
): Promise<{ listings: any[]; total: number; has_more: boolean; page: number }> {
  // Step 1: fetch active listings
  let listingsQ = sb
    .from('market_listings')
    .select('id, lister_twitch_id, user_card_id, created_at')
    .eq('streamer_id', streamerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (listerTwitchId) listingsQ = listingsQ.eq('lister_twitch_id', listerTwitchId);
  const { data: listingRows, error: listingError } = await listingsQ;
  if (listingError) throw listingError;
  if (!listingRows?.length) return { listings: [], total: 0, has_more: false, page };

  // Step 2: hydrate card metadata from enriched_user_cards
  const userCardIds = [...new Set((listingRows as any[]).map((r: any) => r.user_card_id).filter(Boolean))];
  const { data: cardRows, error: cardsError } = await sb
    .from('enriched_user_cards')
    .select('user_card_id, name, rarity, image_url, baked_image_url, template_id, trait_list, streamer_id')
    .in('user_card_id', userCardIds);
  if (cardsError) throw cardsError;

  const cardById = new Map((cardRows as any[]).map((c: any) => [c.user_card_id, c]));
  const rarityRank: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0 };

  let hydrated: any[] = (listingRows as any[]).map((row: any) => {
    const card = cardById.get(row.user_card_id);
    return card
      ? { id: row.id, lister_twitch_id: row.lister_twitch_id, user_card_id: row.user_card_id, created_at: row.created_at, card: { ...card, user_card_id: card.user_card_id || row.user_card_id } }
      : null;
  }).filter(Boolean);

  if (search) hydrated = hydrated.filter((l: any) => String(l.card?.name || '').toLowerCase().includes(search));
  if (trait) hydrated = hydrated.filter((l: any) => {
    const list = Array.isArray(l.card?.trait_list) ? l.card.trait_list : [];
    return list.some((e: any) => {
      if (typeof e === 'string') return e.toLowerCase() === trait;
      return String(e?.name || '').toLowerCase() === trait || String(e?.display_name || '').toLowerCase() === trait;
    });
  });

  if (sort === 'rarity_high' || sort === 'rarity_low') {
    hydrated.sort((a: any, b: any) => {
      const aR = rarityRank[String(a.card?.rarity || '').toLowerCase()] ?? -1;
      const bR = rarityRank[String(b.card?.rarity || '').toLowerCase()] ?? -1;
      return sort === 'rarity_high' ? bR - aR : aR - bR;
    });
  } else {
    hydrated.sort((a: any, b: any) => (Date.parse(b.created_at || 0) || 0) - (Date.parse(a.created_at || 0) || 0));
  }

  const total = hydrated.length;
  const start = page * limit;
  const end = start + limit;
  return { listings: hydrated.slice(start, end), total, has_more: end < total, page };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/$/, '') || '/';

    // ── STATIC ASSET SHORT-CIRCUIT ────────────────────────────────────────────
    // Serve public/ files directly via the ASSETS binding before any Worker
    // logic runs (no Supabase client, no Redis, no env validation overhead).
    // Only API, auth, webhook, and special render paths need Worker processing.
    if (
      env.ASSETS &&
      method === 'GET' &&
      !path.startsWith('/api') &&
      !path.startsWith('/auth') &&
      !path.startsWith('/twitch') &&
      !path.startsWith('/traits') &&
      !path.startsWith('/core') &&
      !path.startsWith('/card_images') &&
      path !== '/obs-overlay' &&
      path !== '/queue-control'
    ) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) return assetRes;
      // 404 falls through to dynamic routing (SPA index.html fallback etc.)
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Strict Environment Validation (Must be first to prevent crashes)
    const requiredSecrets = [
      'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TWITCH_CLIENT_ID',
      'FRONTEND_URL', 'SESSION_SECRET', 'CREATOR_CDN_BASE'
    ];
    const missing = requiredSecrets.filter(s => !(env as any)[s]);
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        error: `Missing environment secrets: ${missing.join(', ')}`,
        help: "Please use 'npx wrangler secret put KEY' to set these for production."
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let supabase: any;
    try {
      supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: 'Failed to initialize database client: ' + e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const origin = request.headers.get('Origin') || '';
    let domainMatch = '';
    try {
      if (env.FRONTEND_URL) domainMatch = new URL(env.FRONTEND_URL).hostname.replace('www.', '');
    } catch {
      // FRONTEND_URL is not a valid URL — fall back to direct string matching only
    }

    const isAllowedOrigin = origin === env.FRONTEND_URL ||
      (domainMatch && origin.includes(domainMatch)) ||
      origin === 'http://localhost:8787' ||
      origin === 'http://localhost:3000' ||
      (env.WORKER_DEV_URL ? origin === env.WORKER_DEV_URL : false);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : env.FRONTEND_URL,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Twitch-ID, X-CSRF-Token',
    };

    // --- R2 ASSET SERVING ---
    // Specifically serving traits, core icons, and now card_images from the unified bucket.
    const isCdnRequest = url.hostname === 'cdn.codeoce.com' || path.startsWith('/traits') || path.startsWith('/core') || path.startsWith('/card_images');
    if (isCdnRequest && method === 'GET') {
      const key = url.pathname.replace(/^\//, '');
      try {
        const object = await env.CARD_IMAGES.get(key);
        if (object !== null) {
          const headers = new Headers(corsHeaders);
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(object.body, { headers });
        }
      } catch (e: any) {
        console.error('[R2 Servo] Error for', key, e);
      }
    }


    // --- EDGE CACHE LAYER (Layer 3) ---
    let cacheKeyUrl = url.toString();
    // /api/collection is NOT edge-cached — it's real-time user state (grants/trades/consumptions
    // must appear immediately). Performance comes from DB indexes, not edge cache.
    const cacheablePaths = [
      '/api/v2/bootstrap', '/api/mechanics', '/api/leaderboard', '/api/stats',
      '/api/cards/count', '/api/public/catalog', '/api/public/streamer',
      '/api/public/binder',   // public binder views — 60s shared edge cache
    ];
    const isCacheable = method === 'GET' && cacheablePaths.some(p => path.startsWith(p));
    let cache: any = null;

    if (isCacheable) {
      // For user-private data, append Twitch ID to cache key to prevent data leakage
      const isPrivate = path.startsWith('/api/v2/bootstrap');
      if (isPrivate) {
        const cookie = request.headers.get('Cookie') || '';
        const token = cookie.match(/(?:^|; )session=([^;]*)/)?.[1];
        if (token) {
          try {
            const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET));
            const twitchId = payload.sub || (payload as any).twitch_id;
            if (twitchId) cacheKeyUrl += `?_cache_user=${twitchId}`;
          } catch { /* if JWT invalid, let standard auth handle it later */ }
        }
      }

      cache = (caches as any).default;
      const cachedResponse = await cache.match(cacheKeyUrl);
      if (cachedResponse) {
        const response = new Response(cachedResponse.body, cachedResponse);
        response.headers.set('X-Cache', 'HIT-EDGE');
        // Add CORS headers to cached response
        Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }
    }

    const sharedRedis = getRedis(env);

    // Generic Rate Limiting for Public/Expensive Routes (50 requests per minute per IP)
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (path.startsWith('/api/onboarding') || path === '/api/bootstrap') {
      if (!await checkRateLimit(ip, 50, sharedRedis)) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Metadata Endpoint (cached at Redis; narrow columns)
    if (method === 'GET' && path === '/api/mechanics') {
      try {
        const rows = await fetchWithCache(
          env,
          sharedRedis,
          CACHE_KEY_MECHANICS_LIST,
          CACHE_TTL_MECHANICS_SEC,
          async () => {
            const { data, error } = await supabase
              .from('mechanics')
              .select(
                'id, name, display_name, description, icon, rarity_weight, is_active, dust_sell_value, dust_buy_cost, created_at'
              )
              .order('display_name');
            if (error) throw error;
            return data || [];
          },
          ctx
        );
        const response = secureResponse(rows, 200, corsHeaders, false, {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        });
        if (cache && cacheKeyUrl) {
          ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
        }
        return response;
      } catch (e: any) {
        return secureResponse(e?.message || 'Failed to fetch mechanics', 500, corsHeaders, true);
      }
    }

    try {
      // --- MIDDLEWARE HELPERS ---

      async function checkAdmin(req: Request) {
        const u = await getUserFromSession(req, env, supabase);
        if (!u) throw new Error("Unauthorized: Session missing");

        const isPlatformAdmin = isEnvPlatformAdmin(env, u.twitch_id);
        const staffRole = await getPlatformStaffRole(supabase, u.twitch_id);

        const { data: streamer } = await supabase
          .from('streamers')
          .select('*')
          .eq('twitch_id', u.twitch_id)
          .maybeSingle();

        const canAccess =
          isPlatformAdmin ||
          streamer ||
          staffRole;
        if (!canAccess) {
          throw new Error("Unauthorized: Insufficient privileges");
        }
        return { user: u, isPlatformAdmin, streamer, staffRole };
      }

      async function checkCreator(req: Request, sbase: any) {
        const u = await getUserFromSession(req, env, sbase);
        if (!u) throw new Error("Unauthorized");

        const actAs = (req.headers.get('X-Act-As-Streamer-Id') || '').trim();

        if (actAs) {
          const { data: target, error: actErr } = await sbase
            .from('streamers')
            .select('*, obs_overlay_token')
            .eq('id', actAs)
            .maybeSingle();
          if (actErr) {
            console.error('[checkCreator] Database error:', actErr);
            throw new Error("Database error: " + actErr.message);
          }
          if (!target) throw new Error("Streamer not found");

          if (target.twitch_id === u.twitch_id) {
            return { user: u, streamer: target, teamRole: null as 'moderator' | 'editor' | null };
          }

          const tr = await getStreamerTeamRole(sbase, u.twitch_id, target.id);
          if (!tr) throw new Error("Forbidden: Not a team member for this channel");

          console.log('[checkCreator] Acting as streamer', actAs, 'team role', tr);
          return { user: u, streamer: target, teamRole: tr };
        }

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
          const { count: teamOnlyCount } = await sbase
            .from('streamer_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('member_twitch_id', u.twitch_id);
          if (teamOnlyCount && teamOnlyCount > 0) {
            throw new Error(
              'Forbidden: You are a channel team member. Select a channel in the dashboard (act-as) or complete creator signup for your own channel.'
            );
          }

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
        return { user: u, streamer: s, teamRole: null as 'moderator' | 'editor' | null };
      }


      // GLOBAL LOGGER
      console.log(`[Request] ${method} ${url.pathname}`);
      console.log(`[CORS] Origin: ${origin || 'none'}, Allowed: ${isAllowedOrigin}, Final: ${corsHeaders['Access-Control-Allow-Origin']}`);
      const cookieHeader = request.headers.get('Cookie') || '';
      console.log(`[Cookies] ${cookieHeader ? 'Header present (' + cookieHeader.split(';').length + ' items)' : 'Header missing'}`);

      if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      // --- STRIPE PAYMENTS & ONBOARDING ---

      // 1. Creator Stripe — create Express account (deferred onboarding: country + manual payouts; full KYC later)
      if (method === 'POST' && path === '/api/creator/stripe/onboarding') {
        const { user, streamer } = await checkCreator(request, supabase);
        const onboardBody: any = await request.json().catch(() => ({}));
        const countryRaw = String(onboardBody.country || '')
          .trim()
          .toUpperCase();

        const existingId = streamer.stripe_connect_id as string | null | undefined;
        if (existingId) {
          return secureResponse(
            'Stripe is already linked. Use “Complete payout verification” if you still need to verify with Stripe.',
            400,
            corsHeaders,
            true
          );
        }

        if (!countryRaw || !STRIPE_EXPRESS_CONNECT_COUNTRIES.has(countryRaw)) {
          return secureResponse('Select a valid country for your Stripe account', 400, corsHeaders, true);
        }

        const account = await stripe.accounts.create({
          type: 'express',
          country: countryRaw,
          email: user.email || undefined,
          business_type: 'individual',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          settings: {
            payouts: {
              schedule: { interval: 'manual' },
            },
          },
          metadata: {
            twitch_id: user.twitch_id,
            streamer_id: streamer.id,
            onboarding_type: 'deferred',
          },
        });

        await supabase.from('streamers').update({ stripe_connect_id: account.id }).eq('id', streamer.id);

        return secureResponse(
          {
            deferred: true,
            stripe_connected: true,
            message:
              'Stripe account created. Pack sales can start now; complete payout verification when you are ready to receive funds.',
          },
          200,
          corsHeaders
        );
      }

      // 1a. Hosted Account Link — finish Stripe onboarding / verification (any time after connect)
      if (method === 'POST' && path === '/api/creator/stripe/onboarding-link') {
        const { streamer } = await checkCreator(request, supabase);
        if (!streamer.stripe_connect_id) {
          return secureResponse('No Stripe account linked', 400, corsHeaders, true);
        }
        const baseUrl = getBaseUrl(request, env);
        const accountLink = await stripe.accountLinks.create({
          account: streamer.stripe_connect_id,
          refresh_url: `${baseUrl}/dashboard?stripe=refresh`,
          return_url: `${baseUrl}/dashboard?stripe=success`,
          type: 'account_onboarding',
        });
        return secureResponse({ url: accountLink.url }, 200, corsHeaders);
      }

      // 1b. Stripe Connect status (pending balance + capability flags for dashboard)
      if (method === 'GET' && path === '/api/creator/stripe/status') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          if (!streamer.stripe_connect_id) {
            return secureResponse(
              { connected: false, pending_payout_cents: 0, transfers_active: false, charges_enabled: false },
              200,
              corsHeaders
            );
          }
          const acct = await stripe.accounts.retrieve(streamer.stripe_connect_id);
          const pending = Number(streamer.stripe_pending_payout_cents ?? 0);
          return secureResponse(
            {
              connected: true,
              pending_payout_cents: pending,
              transfers_active: acct.capabilities?.transfers === 'active',
              charges_enabled: !!acct.charges_enabled,
              details_submitted: !!acct.details_submitted,
            },
            200,
            corsHeaders
          );
        } catch (e: any) {
          return secureResponse(e.message || 'Forbidden', 403, corsHeaders, true);
        }
      }

      // 1b. Disconnect Stripe (clear linked account — reconnect creates a new Express account)
      if (method === 'POST' && path === '/api/creator/stripe/disconnect') {
        const { user, streamer } = await checkCreator(request, supabase);
        if (streamer.twitch_id !== user.twitch_id) {
          return secureResponse('Only the channel owner can disconnect Stripe', 403, corsHeaders, true);
        }
        if (!streamer.stripe_connect_id) {
          return secureResponse('No Stripe account linked', 400, corsHeaders, true);
        }
        const pending = Number((streamer as any).stripe_pending_payout_cents ?? 0);
        if (pending > 0) {
          return secureResponse(
            `You have $${(pending / 100).toFixed(2)} in pending payouts. Complete Stripe payout verification to receive funds before disconnecting, or contact support.`,
            400,
            corsHeaders,
            true
          );
        }
        const { error: discErr } = await supabase
          .from('streamers')
          .update({ stripe_connect_id: null, stripe_pending_payout_cents: 0 })
          .eq('id', streamer.id);
        if (discErr) {
          console.error('[Stripe] Disconnect DB error:', discErr);
          return secureResponse('Could not remove Stripe link', 500, corsHeaders, true);
        }
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // 2. Create Checkout Session for Viewer
      if (method === 'POST' && path === '/api/payment/create-checkout-session') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const body: any = await request.json().catch(() => ({}));
        const streamerId = body.streamer_id;
        
        if (!streamerId) return secureResponse('Missing streamer_id', 400, corsHeaders, true);

        const { data: streamer, error: sErr } = await supabase
          .from('streamers')
          .select('id, stripe_connect_id, username')
          .eq('id', streamerId)
          .single();

        if (sErr || !streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);
        if (!streamer.stripe_connect_id) return secureResponse('Streamer has not linked a payment account', 400, corsHeaders, true);

        let transfersActive = false;
        try {
          const stripeAccount = await stripe.accounts.retrieve(streamer.stripe_connect_id);
          transfersActive = stripeAccount.capabilities?.transfers === 'active';
        } catch (accErr) {
          console.error('[Stripe] Account retrieve error:', accErr);
          return secureResponse('Could not verify creator payment status', 500, corsHeaders, true);
        }

        const unitAmount = GLOBAL_PACK_PRICE_CENTS;
        const platformFee = Math.round(unitAmount * 0.20);
        const streamerShare = unitAmount - platformFee;

        const baseMeta: Record<string, string> = {
          userId: user.twitch_id,
          userName: user.username,
          streamerId: streamer.id,
          quantity: '5',
        };

        let session;
        if (transfersActive) {
          session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `5-Card Pack (${streamer.username})`,
                    description: 'Support the creator and expand your collection!',
                  },
                  unit_amount: unitAmount,
                },
                quantity: 1,
              },
            ],
            payment_intent_data: {
              application_fee_amount: platformFee,
              transfer_data: {
                destination: streamer.stripe_connect_id,
              },
            },
            metadata: { ...baseMeta, platform_held: 'false' },
            success_url: `${getBaseUrl(request, env)}/binder/${streamer.username}?payment=success`,
            cancel_url: `${getBaseUrl(request, env)}/binder/${streamer.username}?payment=cancel`,
          });
        } else {
          session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `5-Card Pack (${streamer.username})`,
                    description: 'Support the creator and expand your collection!',
                  },
                  unit_amount: unitAmount,
                },
                quantity: 1,
              },
            ],
            payment_intent_data: {
              metadata: {
                ...baseMeta,
                platform_held: 'true',
                seller_amount_cents: String(streamerShare),
                streamer_stripe_account: streamer.stripe_connect_id,
              },
            },
            metadata: {
              ...baseMeta,
              platform_held: 'true',
              seller_amount_cents: String(streamerShare),
            },
            success_url: `${getBaseUrl(request, env)}/binder/${streamer.username}?payment=success`,
            cancel_url: `${getBaseUrl(request, env)}/binder/${streamer.username}?payment=cancel`,
          });
        }

        return secureResponse({ url: session.url }, 200, corsHeaders);
      }

      // Twitch OAuth callback typo (must be /auth/callback — same as token exchange redirect_uri)
      if (method === 'GET' && path === '/oauth/callback') {
        const u = new URL(request.url);
        u.pathname = '/auth/callback';
        return Response.redirect(u.toString(), 302);
      }

      // Twitch EventSub — handle early (skip rate limits, assets, and heavy API routing)
      if (method === 'POST' && (path === '/api/twitch/webhook' || path === '/twitch/eventsub')) {
        return handleTwitchWebhook(request, env, ctx);
      }

      // Kick Events API webhooks — https://docs.kick.com/events/introduction
      if (method === 'POST' && path === '/api/kick/webhook') {
        return handleKickWebhook(request, env, ctx);
      }

      // Image proxy — serves CDN images with CORS headers for WebGL texture loading.
      // Bypasses R2 CORS configuration issues entirely.
      if (method === 'GET' && path === '/api/img-proxy') {
        const imgUrl = url.searchParams.get('url');
        if (!imgUrl) {
          return new Response('Missing ?url=', { status: 400 });
        }
        const allowedHosts = ['cdn.codeoce.com', 'cdn2.codeoce.com'];
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(imgUrl);
        } catch {
          return new Response('Invalid URL', { status: 400 });
        }
        if (!allowedHosts.includes(parsedUrl.hostname)) {
          return new Response('Forbidden host', { status: 403 });
        }
        try {
          const imgRes = await fetch(imgUrl, { cf: { cacheEverything: true, cacheTtl: 86400 } } as RequestInit);
          const headers = new Headers(imgRes.headers);
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Cache-Control', 'public, max-age=86400');
          return new Response(imgRes.body, { status: imgRes.status, headers });
        } catch (e: any) {
          return new Response(`Proxy error: ${e.message}`, { status: 502 });
        }
      }

      // Stripe Webhook — handle early (skip rate limits, assets, and heavy API routing)
      if (method === 'POST' && path === '/api/payment/webhook') {
        const stripeWebhook = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
        });
        const signature = request.headers.get('stripe-signature') || '';
        const body = await request.text();
        
        let event;
        try {
          event = await stripeWebhook.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
        } catch (err: any) {
          console.error(`[Stripe Webhook] Error: ${err.message}`);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata || {};
          const userId = metadata.userId;
          const userName = metadata.userName;
          const streamerId = metadata.streamerId;
          const quantity = parseInt(metadata.quantity || '5', 10);
          const platformHeld = metadata.platform_held === 'true';
          const sellerAmount = parseInt(metadata.seller_amount_cents || '0', 10);

          if (userId && streamerId) {
            console.log(`[Stripe Webhook] Payment completed for ${userName} (${userId}). Granting ${quantity} cards for streamer ${streamerId}.`);
            try {
              const { granted, userCardIds } = await bulkGrantRandomCardsToTwitchUser(
                supabase,
                env,
                streamerId,
                userId,
                userName,
                quantity,
                {
                  skipRedis: true,
                  buildNotification: (i, total, card) => ({
                    message: `🎁 Store Pack! (${i + 1}/${total})`,
                    data: { card_id: card.id, name: card.name, rarity: card.rarity, image_url: card.image_url }
                  })
                }
              );
              console.log(`[Stripe Webhook] Successfully granted ${granted} cards.`);
              if (userCardIds.length > 0) {
                await supabase.from('pack_sessions').insert({
                  twitch_id: userId,
                  streamer_id: streamerId,
                  user_card_ids: userCardIds,
                  source: 'stripe',
                }).catch((e: any) => console.warn('[Stripe Webhook] pack_sessions insert:', e?.message));
              }
              try {
                await logSystem(supabase, 'info', 'grant', `Store pack → ${userName} · ${quantity}× cards (Stripe)`, streamerId, {
                  platform: 'stripe',
                  castle_site: true,
                  card_quantity: quantity,
                  recipient_twitch_id: userId,
                  recipient_username: userName,
                });
              } catch (logE: any) {
                console.warn('[Stripe Webhook] activity log:', logE?.message || logE);
              }
            } catch (grantErr: any) {
              console.error(`[Stripe Webhook] Grant failed: ${grantErr.message}`);
            }

            if (platformHeld && sellerAmount > 0) {
              const { data: row } = await supabase
                .from('streamers')
                .select('stripe_pending_payout_cents')
                .eq('id', streamerId)
                .maybeSingle();
              const cur = Number(row?.stripe_pending_payout_cents ?? 0);
              const { error: pendErr } = await supabase
                .from('streamers')
                .update({ stripe_pending_payout_cents: cur + sellerAmount })
                .eq('id', streamerId);
              if (pendErr) {
                console.error('[Stripe Webhook] Pending payout increment failed:', pendErr);
              } else {
                console.log(`[Stripe Webhook] Platform-held creator share +${sellerAmount}c pending for streamer ${streamerId}`);
              }
              // Log revenue event for analytics time-series
              try {
                await supabase.from('streamer_activity_logs').insert({
                  streamer_id: streamerId,
                  level: 'info',
                  category: 'revenue',
                  message: 'Pack sale',
                  metadata: { amount_cents: sellerAmount, source: 'stripe' },
                });
              } catch (revLogE: any) {
                console.warn('[Stripe Webhook] revenue log:', revLogE?.message || revLogE);
              }
            }
          }
        }

        if (event.type === 'account.updated') {
          const acct = event.data.object as Stripe.Account;
          if (acct.capabilities?.transfers === 'active' && acct.charges_enabled) {
            const { data: st } = await supabase
              .from('streamers')
              .select('id, stripe_pending_payout_cents, stripe_connect_id')
              .eq('stripe_connect_id', acct.id)
              .maybeSingle();
            const pending = Number(st?.stripe_pending_payout_cents ?? 0);
            if (st && pending > 0) {
              try {
                await transferDeferredPendingToCreator(stripeWebhook, supabase, st.id, acct.id, pending);
                console.log(`[Stripe Webhook] Deferred payout transfer ${pending}c → ${acct.id}`);
              } catch (xferErr: any) {
                console.error('[Stripe Webhook] Deferred transfer failed:', xferErr?.message || xferErr);
              }
            }
          }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

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
                'Cache-Control': 'no-store',
                ...corsHeaders
              }
            });
          }
        } catch (e) {
          console.error('[OBS Overlay] Error:', e);
        }

        return new Response('OBS overlay not found', { status: 404 });
      }

      // --- QUEUE CONTROL POPOUT (OBS dockable) ---
      // Token validation is handled by the page's own API calls; just serve the HTML.
      if (method === 'GET' && path === '/queue-control') {
        try {
          const qcRes = await env.ASSETS?.fetch(new Request(`${url.origin}/queue-control.html`));
          if (qcRes && qcRes.ok) {
            return new Response(qcRes.body, {
              headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', ...corsHeaders }
            });
          }
        } catch (e) {
          console.error('[QueueControl] Error serving page:', e);
        }
        return new Response('Queue control page not found', { status: 404 });
      }

      // Try serving exact static assets BEFORE rate limiting to avoid blocking CSS/JS
      if (env.ASSETS && path !== '/' && !path.startsWith('/api') && !path.startsWith('/auth') && path !== '/twitch/eventsub' && !path.startsWith('/api/obs') && path !== '/obs-overlay' && path !== '/queue-control') {
        try {
          const assetRes = await env.ASSETS.fetch(request.clone());
          // If the asset exists exactly, serve it and bypass all further logic/rate limits
          if (assetRes.status !== 404) return assetRes;
        } catch (e) {
          console.error('[Assets Early] Error:', e);
        }
      }




      // Rate limiting (Redis-backed — global across all Cloudflare edge nodes)
      const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
      const isAdminRoute = path.startsWith('/api/admin');
      const isAdminLogin = method === 'POST' && path === '/api/admin/login';
      const rateLimit = isAdminLogin ? 10 : isAdminRoute ? 600 : 300;

      if (!await checkRateLimit(clientIP, rateLimit, sharedRedis)) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Retry-After': '60' }
        });
      }





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
          const userSafe: Record<string, unknown> = { ...(user as object) };
          delete userSafe.kick_user_id;
          return secureResponse({ ...userSafe, is_creator: !!streamer }, 200, corsHeaders);
        } catch (e: any) {
          console.error(`[Auth/Me] Error: ${e.message}`);
          return secureResponse('Unauthorized', 401, corsHeaders, true);
        }
      }

      // Twitch link health: valid access token (Helix) + required OAuth scopes for viewer vs creator
      if (method === 'GET' && path === '/api/auth/twitch-status') {
        const twitchStatusHdr = {
          ...corsHeaders,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        };
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) {
            return secureResponse(
              { authenticated: false, twitch: null, kick: null, kick_linked: false },
              200,
              twitchStatusHdr
            );
          }

          const { data: streamer } = await supabase
            .from('streamers')
            .select('id')
            .eq('twitch_id', user.twitch_id)
            .maybeSingle();
          const isCreator = !!streamer;

          if (String(user.twitch_id || '').startsWith('kick_')) {
            const kick = await computeKickAuthHealth(supabase, env, user.twitch_id);
            return secureResponse(
              {
                authenticated: true,
                username: user.username,
                is_creator: isCreator,
                auth_provider: 'kick',
                twitch: null,
                kick,
                kick_linked: true,
              },
              200,
              twitchStatusHdr
            );
          }

          const twitch = await computeTwitchAuthHealth(supabase, env, user.twitch_id, isCreator);

          const kickLinked = !!(user as { kick_linked?: boolean }).kick_linked;
          let kickHealth: { token_valid: boolean; needs_reauth: boolean; token_error?: string } | null = null;
          if (kickLinked) {
            kickHealth = await computeKickAuthHealth(supabase, env, user.twitch_id);
          }

          return secureResponse(
            {
              authenticated: true,
              username: user.username,
              is_creator: isCreator,
              auth_provider: 'twitch',
              twitch,
              kick: kickHealth,
              kick_linked: kickLinked,
            },
            200,
            twitchStatusHdr
          );
        } catch (e: any) {
          console.error('[twitch-status] fatal:', e);
          // Never 500: Connections UI expects JSON 200. Best-effort session for degraded fields.
          try {
            const u = await getUserFromSession(request, env, supabase);
            if (u) {
              const kickPrimary = String(u.twitch_id || '').startsWith('kick_');
              return secureResponse(
                {
                  authenticated: true,
                  username: u.username,
                  is_creator: false,
                  auth_provider: kickPrimary ? 'kick' : 'twitch',
                  twitch: kickPrimary
                    ? null
                    : {
                        token_valid: false,
                        needs_reauth: true,
                        scopes_granted: [],
                        scopes_required: [],
                        scopes_missing: [],
                        token_error: 'status_degraded',
                      },
                  kick: kickPrimary
                    ? { token_valid: false, needs_reauth: true, token_error: 'status_degraded' }
                    : null,
                  kick_linked: kickPrimary ? true : !!(u as { kick_linked?: boolean }).kick_linked,
                  status_degraded: true,
                },
                200,
                twitchStatusHdr
              );
            }
          } catch {
            /* fall through */
          }
          return secureResponse(
            {
              authenticated: false,
              twitch: null,
              kick: null,
              kick_linked: false,
              status_degraded: true,
              status_error: e?.message || 'status_check_failed',
            },
            200,
            twitchStatusHdr
          );
        }
      }

      // ── LEGACY BOOTSTRAP REDIRECT ─────────────────────────────────────────────
      // /api/bootstrap is retired in favour of the edge-cached /api/v2/bootstrap.
      // 308 Permanent Redirect — clients and CDN will update their request target.
      if (method === 'GET' && path === '/api/bootstrap') {
        const v2 = new URL('/api/v2/bootstrap', url.origin);
        url.searchParams.forEach((v, k) => v2.searchParams.set(k, v));
        return Response.redirect(v2.toString(), 308);
      }

      // Consolidatd Dashboard Bootstrap (legacy handler kept for non-GET and POST paths)
      if (path === '/api/bootstrap') {
        try {
          const bootstrapLite = url.searchParams.get('lite') === '1';
          const bootT0 = Date.now();
          let msRpc = 0;
          let msMatchQuery = 0;
          let msHelix = 0;

          const user = await getUserFromSession(request, env, supabase);

          const streamerParam = url.searchParams.get('streamer') || url.searchParams.get('streamer_id');
          let isGlobal = streamerParam === 'all';

          // Get creator record for logged-in user if exists (needed before defaulting streamer context)
          let creatorRecord = null;
          if (user) {
            const { data } = await supabase.from('streamers').select('*').eq('twitch_id', user.twitch_id).maybeSingle();
            creatorRecord = data;
            if (creatorRecord && sharedRedis) {
              await warmStreamerBrandingCache(sharedRedis, creatorRecord);
            }
          }

          // Use a dummy "Hub" streamer if global view is requested
          const explicitSlug =
            streamerParam && !isGlobal ? String(streamerParam).trim() : '';

          let streamer = isGlobal
            ? { id: 'all', username: 'all', display_name: 'Creator Hub', brand_name: 'Global' }
            : await resolveStreamerContextWithCache(request, env, ctx, supabase, url);

          // When URL has ?streamer=slug (e.g. /binder/mavro), never substitute the logged-in viewer's creator row
          if (!streamer && explicitSlug) {
            const { data: bySlug } = await supabase.from('streamers').select('*').ilike('username', explicitSlug).maybeSingle();
            streamer = bySlug;
          }

          // Default context when no ?streamer= (e.g. /dashboard SPA load): own creator hub or global collection
          if (!streamer) {
            if (creatorRecord) {
              streamer = creatorRecord;
            } else {
              streamer = { id: 'all', username: 'all', display_name: 'Creator Hub', brand_name: 'Global' };
            }
          }

          // ULTIMATE PERF FIX: Single RPC assembles the entire app state in one round-trip.
          isGlobal = (streamer.id === 'all');
          const targetTwitchId = (isGlobal && url.searchParams.get('inspect')) 
            ? url.searchParams.get('inspect') 
            : user?.twitch_id;

          const _rpcStart = Date.now();
          const { data: rpc, error: rpcErr } = await supabase.rpc('get_bootstrap_data_v4', {
            p_user_twitch_id: targetTwitchId || null,
            p_current_streamer_id: isGlobal ? null : streamer.id
          });
          msRpc = Date.now() - _rpcStart;

          if (rpcErr) {
            console.error('[Bootstrap] RPC Error:', rpcErr.message, rpcErr.hint || '', rpcErr.details || '');
            // Return a structured error response so the dashboard can show a helpful message
            // instead of crashing. Common cause: enriched_user_cards view is missing after
            // a partial migration — run migrations/058_fix_enriched_view_recovery.sql to fix.
            return secureResponse({
              error: 'bootstrap_rpc_failed',
              message: rpcErr.message,
              hint: 'If you see "relation does not exist", run migration 058_fix_enriched_view_recovery.sql in Supabase.',
            }, 503, corsHeaders, true);
          }

          // Map RPC results to the variables used downstream
          const statsTotalRes = { count: rpc.page_stats?.total_cards || 0 };
          const statsLegendaryRes = { count: rpc.page_stats?.legendary_count || 0 };
          const recentDropsRes = { data: rpc.recent_drops || [] };
          const bindersRes = { data: rpc.binders || [] };
          const achievementsRes = { data: rpc.user_achievements || [] };
          const leaderboardRes = { data: rpc.leaderboard || [] };
          const totalAvailRes = { count: rpc.total_avail_count || 0 };
          const creatorCardsRes = { data: rpc.creator_data?.cards || [] };
          const creatorStatsRes = { data: rpc.creator_data?.stats || null };
          const favoritesRes = { data: (rpc.favorites || []).map((id: string) => ({ streamer_id: id })) };
          const personalConnectionsRes = { data: rpc.personal_connections || [] };
          const activeStreamersRes = { data: rpc.discovery || [] };
          const allAvailableAchievementsRes = { data: rpc.achievements || [] };
          const userProfileData = rpc.user; // renamed to avoids collisions if needed

          let platformStaffRole: string | null = null;
          let teamMemberships: any[] = [];
          if (user?.twitch_id) {
            const { data: psRow } = await supabase
              .from('platform_staff')
              .select('role')
              .eq('twitch_id', user.twitch_id)
              .maybeSingle();
            platformStaffRole = psRow?.role || null;
            const { data: tmRows } = await supabase
              .from('streamer_team_members')
              .select('streamer_id, role')
              .eq('member_twitch_id', user.twitch_id);
            if (tmRows?.length) {
              const ids = [...new Set(tmRows.map((t: any) => t.streamer_id))];
              const { data: sm } = await supabase
                .from('streamers')
                .select('id, brand_name, username, avatar_url')
                .in('id', ids);
              const byId = new Map((sm || []).map((s: any) => [s.id, s]));
              teamMemberships = tmRows.map((t: any) => ({ ...t, streamer: byId.get(t.streamer_id) }));
            }
          }

          const leaderboard = leaderboardRes.data || [];

          // Generate CSRF token for this session
          const csrfToken = crypto.randomUUID();
          const isHttps = request.url.startsWith('https');
          const secureFlag = isHttps ? '; Secure' : '';

          const normalizeSid = (id: unknown) =>
            id == null || id === '' ? '' : String(id).trim().toLowerCase();

          // 1. COLLECTED (Unique streamers from enriched_user_cards)
          const collectedMap = new Map();
          (personalConnectionsRes.data || []).forEach((c: any) => {
            const sid = normalizeSid(c.streamer_id);
            if (sid && !collectedMap.has(sid)) {
              collectedMap.set(sid, {
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

          // 2. FAVORITES (normalize UUID strings so Set/Map lookups match Helix + DB consistently)
          const favoriteIds = new Set<string>(
            (favoritesRes.data || [])
              .map((f: any) => normalizeSid(f.streamer_id))
              .filter(Boolean)
          );
          const favorites: any[] = [];

          // 3. FOLLOWED (Twitch API) - We'll attempt to fetch if user is logged in
          const syncFollows = url.searchParams.get('sync_follows') === '1';
          const followsCacheKey = `cache:v1:follows:matched:${user?.twitch_id || 'guest'}`;
          let followedStreamers: any[] = [];
          let debugFollowsCount = 0;
          let debugTokenValid = false;
          let debugFollowsRawIds = '';
          let debugAllStreamerIds = '';
          let debugAllStreamersDetail = '';
          let debugStreamersError = '';
          let debugMatchSource = 'none';
          let debugMatchDetails = '';

          if (user && path === '/api/bootstrap' && !String(user.twitch_id || '').startsWith('kick_')) {
            const cachedStr = await sharedRedis?.get(followsCacheKey);
            if (cachedStr) {
              try {
                followedStreamers = typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr;
                debugMatchSource = 'redis_cache';
              } catch (e) {
                console.error('[Bootstrap/Cache] Parse error:', e);
              }
            }

            // Sync in background if missing from cache OR explicitly requested.
            // This prevents Helix latency from blocking the main bootstrap response.
            if (!cachedStr || syncFollows) {
              const runSync = async () => {
                const { data: fullUser } = await supabase
                  .from('users')
                  .select('twitch_access_token_encrypted, twitch_refresh_token_encrypted')
                  .eq('twitch_id', user.twitch_id as string)
                  .single();

                if (fullUser?.twitch_access_token_encrypted) {
                  try {
                    const twTokSecret = env ? twitchTokenEncryptSecret(env) : '';
                    let accessToken = await decryptSensitive(fullUser.twitch_access_token_encrypted, twTokSecret);
                    
                    let { follows, errorStatus, errorBody } = await getTwitchFollows(user.twitch_id, accessToken, env.TWITCH_CLIENT_ID);
                    if (errorStatus === 401 && fullUser.twitch_refresh_token_encrypted) {
                      const refreshPlain = await decryptSensitive(fullUser.twitch_refresh_token_encrypted, twTokSecret);
                      const newAccess = await refreshTwitchUserAccessToken(supabase, user.twitch_id, refreshPlain, env);
                      if (newAccess) {
                        accessToken = newAccess;
                        const retry = await getTwitchFollows(user.twitch_id, accessToken, env.TWITCH_CLIENT_ID);
                        follows = retry.follows;
                      }
                    }

                    if (follows?.length > 0) {
                      const followTwitchIds = follows.map((f: any) => String(f.broadcaster_id ?? '').replace(/\D/g, '')).filter(Boolean);
                      const followLogins = follows.map((f: any) => (f.broadcaster_login || '').toLowerCase()).filter(Boolean);
                      const uniqBnames = [...new Set(follows.map((f: any) => String(f.broadcaster_name || '').toLowerCase().trim()).filter(Boolean))];

                      const { data: matchRows, error: matchErr } = await supabase.rpc('match_streamers_for_bootstrap_follows', {
                        p_twitch_ids: followTwitchIds.length ? followTwitchIds : null,
                        p_logins: followLogins.length ? followLogins : null,
                        p_broadcaster_names: uniqBnames.length ? uniqBnames : null
                      });

                      if (!matchErr && matchRows) {
                        // Store in Redis for next load
                        if (sharedRedis) {
                          await sharedRedis.set(followsCacheKey, JSON.stringify(matchRows), { ex: 3600 });
                        }
                      }
                    }
                  } catch (syncErr) {
                    console.error('[Bootstrap/Sync] Deferred sync failed:', syncErr);
                  }
                }
              };
              ctx.waitUntil(runSync());
            }
          }

          // Global Active / Discovery
          const discoveryStreamers = activeStreamersRes.data || [];

          // Map all streamers by ID for easy lookup
          const allStreamersMap = new Map<string, any>();
          discoveryStreamers.forEach((s: any) => allStreamersMap.set(normalizeSid(s.id), s));
          collectedMap.forEach((s: any, id: string) => allStreamersMap.set(normalizeSid(id), s));
          followedStreamers.forEach((s: any) => allStreamersMap.set(normalizeSid(s.id), s));

          // FETCH MISSING FAVORITES (If they aren't in discovery/collected/followed)
          const missingFavoriteIds = Array.from(favoriteIds).filter(id => !allStreamersMap.has(id));
          if (missingFavoriteIds.length > 0) {
            const { data: resolvedFavs } = await supabase
              .from('streamers')
              .select('id, username, display_name, avatar_url, brand_name, brand_tagline, binder_color, is_active')
              .in('id', missingFavoriteIds);

            if (resolvedFavs) {
              resolvedFavs.forEach((s: any) => {
                allStreamersMap.set(normalizeSid(s.id), s);
              });
            }
          }

          // Populate favorites list from all matches
          favoriteIds.forEach((id: string) => {
            const s = allStreamersMap.get(id);
            if (s) favorites.push(s);
          });

          const followedIdSet = new Set(followedStreamers.map((s: any) => normalizeSid(s.id)));

          // Unique lists for each section
          const sections = {
            favorites: favorites,
            collected: Array.from(collectedMap.values()),
            followed: followedStreamers.filter((s: any) => !favoriteIds.has(normalizeSid(s.id))), // Don't duplicate in followed if favorited
            discovery: discoveryStreamers.filter(
              (s: any) =>
                !favoriteIds.has(normalizeSid(s.id)) &&
                !collectedMap.has(normalizeSid(s.id)) &&
                !followedIdSet.has(normalizeSid(s.id))
            ).slice(0, 24)
          };

          if (shouldLogBootstrapVerbose(env) && isDebugBootstrap(env)) {
            console.log(`[DEBUG] Bootstrap for ${user?.username || 'Guest'}`);
            console.log(`[DEBUG]   Favorites: ${sections.favorites.length}`);
            console.log(`[DEBUG]   Collected: ${sections.collected.length}`);
            console.log(`[DEBUG]   Followed: ${sections.followed.length}`);
            console.log(`[DEBUG]   Discovery: ${sections.discovery.length}`);
            console.log(`[DEBUG]   CreatorRecord: ${creatorRecord ? 'YES' : 'NO'} (Active: ${creatorRecord?.is_active})`);
          }

          // CRITICAL: Ensure self is included in discovery or favorites if creator (avoid duplicate if already in discovery)
          if (creatorRecord && creatorRecord.is_active !== false) {
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

          const isPlatformAdmin = (env.PLATFORM_ADMIN_IDS || '').split(',').map(id => id.trim()).includes(user?.twitch_id || '');
          const isAdmin = isPlatformAdmin || !!creatorRecord || !!platformStaffRole;

          // Consolidated metadata for Nav Menu & Achievements
          // Fetch in parallel to avoid multiple awaits slowing down bootstrap
          const [authStatus, achievements] = await Promise.all([
            user ? (async () => {
              const cacheKey = `auth:health:v2:${user.twitch_id}`;
              const tHealth0 = Date.now();
              const cached = await (env as any).KV_CACHE?.get(cacheKey);
              if (cached) {
                console.log(`[Bootstrap/Perf] Auth health CACHE HIT in ${Date.now() - tHealth0}ms`);
                return JSON.parse(cached);
              }

              console.log(`[Bootstrap/Perf] Auth health CACHE MISS, computing...`);
              const tCompute0 = Date.now();
              const status = {
                twitch: await computeTwitchAuthHealth(supabase, env, user.twitch_id, !!creatorRecord),
                kick: await computeKickAuthHealth(supabase, env, user.twitch_id),
                kick_linked: !!((user as any).kick_user_id || (user as any).kick_linked)
              };
              console.log(`[Bootstrap/Perf] Auth health compute took ${Date.now() - tCompute0}ms`);
              
              if (ctx && (env as any).KV_CACHE) {
                ctx.waitUntil((env as any).KV_CACHE.put(cacheKey, JSON.stringify(status), { expirationTtl: 300 })); // 5 min cache
              }
              return status;
            })() : Promise.resolve(null),
            user ? fetchAchievementsWithCache(
              env, 
              supabase, 
              sharedRedis, 
              user.twitch_id, 
              streamer.id, 
              streamer.achievement_names || {}, 
              ctx
            ) : Promise.resolve([])
          ]);

          const bootTotalMs = Date.now() - bootT0;

          const bootstrapBody: Record<string, unknown> = {
            user: user ? {
              ...user,
              is_creator: !!creatorRecord,
              is_admin: isAdmin,
              is_platform_admin: isPlatformAdmin,
              platform_staff_role: platformStaffRole,
              team_memberships: teamMemberships,
              streamer: creatorRecord,
              auth_status: authStatus
            } : null,
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
            achievements: achievements,
            leaderboard: leaderboard,
            creator_cards: bootstrapLite ? [] : creatorCardsRes.data || [],
            creator_stats: bootstrapLite ? null : creatorStatsRes.data || null,
            bootstrap_lite: bootstrapLite,
            csrf_token: csrfToken
          };

          const cookieHdr = `csrf=${csrfToken}${secureFlag}; SameSite=Lax; Path=/`;
          const timingParts = [
            `rpc;dur=${msRpc}`,
            `helix;dur=${msHelix}`,
            `match;dur=${msMatchQuery}`,
            `total;dur=${bootTotalMs}`
          ].join(', ');

          const debugHdr = isDebugBootstrap(env)
            ? {
                'x-debug-follows-raw-count': debugFollowsCount.toString(),
                'x-debug-follows-raw-ids': debugFollowsRawIds || 'none',
                'x-debug-all-streamers': debugAllStreamerIds || 'none',
                'x-debug-streamers-detail': debugAllStreamersDetail || 'none',
                ...(debugStreamersError ? { 'x-debug-streamers-error': debugStreamersError } : {}),
                'x-debug-follows-platform-matches': followedStreamers.length.toString(),
                'x-debug-token-valid': debugTokenValid.toString(),
                'x-debug-match-source': debugMatchSource,
                'x-debug-match-details': debugMatchDetails || 'none',
                'x-debug-favorite-ids': Array.from(favoriteIds).join(',')
              }
            : {};

          return secureResponse(bootstrapBody, 200, corsHeaders, false, {
            'Set-Cookie': cookieHdr,
            'Server-Timing': timingParts,
            ...debugHdr
          });
        } catch (e: any) {
          console.error('[Bootstrap] Error:', e);
          return secureResponse('Bootstrap failed', 500, corsHeaders, true);
        }
      }
      
      // V2 Consolidated Bootstrap: Includes User Collection (Page 1)
      if (path === '/api/v2/bootstrap') {
        try {
          const bootstrapLite = url.searchParams.get('lite') === '1';
          const bootT0 = Date.now();
          
          // 1. Run Standard Bootstrap Logic (Wait for session first)
          const user = await getUserFromSession(request, env, supabase);
          const streamerParam = url.searchParams.get('streamer') || url.searchParams.get('streamer_id');
          
          // Duplicate logic but consolidated for performance
          const streamer = await resolveStreamerContext(request, supabase, url);
          const isGlobal = !streamer || streamer.id === 'all';
          const targetTwitchId = (isGlobal && url.searchParams.get('inspect')) 
            ? url.searchParams.get('inspect') 
            : user?.twitch_id;

          // 2. Parallelize: Master RPC + User Collection Page 1 + Hydrated Achievements
          const [rpcRes, collectionRes, hydratedAchievements] = await Promise.all([
            supabase.rpc('get_bootstrap_data_v4', {
              p_user_twitch_id: targetTwitchId || null,
              p_current_streamer_id: isGlobal ? null : streamer?.id
            }),
            (targetTwitchId && !isGlobal) ? supabase
              .from('enriched_user_cards')
              .select(ENRICHED_USER_CARDS_COLLECTION_SELECT)
              .eq('twitch_id', targetTwitchId)
              .eq('streamer_id', streamer?.id)
              .order('created_at', { ascending: false })
              .limit(50) : Promise.resolve({ data: [] }),
            user ? fetchAchievementsWithCache(
              env,
              supabase,
              sharedRedis,
              user.twitch_id,
              streamer?.id || 'all',
              (streamer as any)?.achievement_names || {},
              ctx
            ) : Promise.resolve([])
          ]);

          if (rpcRes.error) {
            const rpcErr = rpcRes.error;
            console.error('[Bootstrap V2] RPC Error:', rpcErr.message, rpcErr.hint || '', rpcErr.details || '');
            return secureResponse({
              error: 'bootstrap_rpc_failed',
              message: rpcErr.message,
              hint: rpcErr.hint || 'Run migration 059_recreate_bootstrap_rpc.sql in Supabase to recreate the function.',
              details: rpcErr.details || null,
            }, 503, corsHeaders, true);
          }
          const rpc = rpcRes.data;
          if (rpc == null || typeof rpc !== 'object') {
            console.error('[Bootstrap V2] RPC returned empty data');
            return secureResponse(
              {
                error: 'bootstrap_no_data',
                message: 'get_bootstrap_data_v4 returned no payload — check RPC and migrations.',
              },
              503,
              corsHeaders,
              true
            );
          }

          // 3. Assemble Response (Sharing mostly with V1 logic)
          // [Note: In a real refactor we would extract the mapping logic to a helper]
          const sections = {
            favorites: [], // Simplified for V2 if desired, or keep V1 mapping
            collected: rpc.personal_connections || [],
            followed: [], 
            discovery: rpc.discovery || []
          };

          const isHttpsBoot = request.url.startsWith('https');
          const secureFlagBoot = isHttpsBoot ? '; Secure' : '';
          const csrfTokenV2 = crypto.randomUUID();

          // Null out baked_image_url for any card whose trait_list has more entries than expected
          // so the binder falls through to the dynamic endpoint, which runs the over-healing logic.
          const sanitizedCollection = (collectionRes.data || []).map((c: any) => {
            const isGenesisCard = c.is_genesis_mint || !!c.genesis_mechanic_id;
            const expectedCount = isGenesisCard ? 2 : 1;
            const tl: string[] = c.trait_list || [];
            if (tl.length > expectedCount && c.baked_image_url) {
              return { ...c, baked_image_url: null };
            }
            return c;
          });

          const bootstrapBody = {
            user: user ? { ...user, is_creator: !!rpc.creator_data?.stats } : null,
            streamer: streamer,
            stats: {
              total: rpc.page_stats?.total_cards || 0,
              legendary: rpc.page_stats?.legendary_count || 0,
              total_available: rpc.total_avail_count || 0
            },
            collection: sanitizedCollection,
            recent_drops: rpc.recent_drops || [],
             binders: rpc.binders || [],
             achievements: hydratedAchievements || [],
            leaderboard: rpc.leaderboard || [],
            bootstrap_lite: bootstrapLite,
            csrf_token: csrfTokenV2,
            timing: {
              total_ms: Date.now() - bootT0
            }
          };

          const response = secureResponse(bootstrapBody, 200, corsHeaders, false, {
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
            'X-Response-Version': 'V2',
            'Set-Cookie': `csrf=${csrfTokenV2}${secureFlagBoot}; SameSite=Lax; Path=/`
          });
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          console.error('[Bootstrap V2] Error:', e);
          return secureResponse('Bootstrap V2 failed', 500, corsHeaders, true);
        }
      }

      if (path === '/api/logout') {
        const isHttps = request.url.startsWith('https');
        const secureFlag = isHttps ? '; Secure' : '';

        // Stamp last_logout_at so existing JWTs for this user are immediately revoked
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (sessionUser?.twitch_id) {
            await supabase.from('users').update({ last_logout_at: new Date().toISOString() }).eq('twitch_id', sessionUser.twitch_id);
          }
        } catch { /* Non-blocking — proceed with cookie clear regardless */ }

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
        path !== '/twitch/eventsub' &&
        path !== '/api/twitch/webhook' &&
        path !== '/api/kick/webhook' &&
        path !== '/api/payment/webhook' &&
        !path.startsWith('/api/obs') &&
        !path.startsWith('/api/packs/')
      ) {
        const cookie = request.headers.get('Cookie') || '';
        const csrfCookie = cookie.match(/csrf=([^;]+)/)?.[1];
        const csrfHeader = request.headers.get('X-CSRF-Token');

        const origin = request.headers.get('Origin');
        const isTrustedOrigin = origin && (
          isAllowedOrigin ||
          [
            env.FRONTEND_URL,
            env.WORKER_DEV_URL,
            'http://localhost:3000', 'http://127.0.0.1:3000',
            'http://localhost:5500', 'http://127.0.0.1:5500'
          ].filter(Boolean).includes(origin)
        );

        if (!isTrustedOrigin && (!csrfCookie || csrfCookie !== csrfHeader)) {
          console.warn(`[CSRF] Blocked: Cookie: ${!!csrfCookie}, Header: ${!!csrfHeader}, Origin: ${origin}`);
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

      // --- Platform OAuth disconnect (user_cards / collection rows unchanged) ---
      if (method === 'POST' && path === '/api/auth/disconnect/kick') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const uid = sessionUser.twitch_id;
          const { error } = await supabase
            .from('users')
            .update({
              kick_access_token_encrypted: null,
              kick_refresh_token_encrypted: null,
              kick_token_scope: null,
              kick_user_id: null,
            })
            .eq('twitch_id', uid);
          if (error) throw error;
          const isKickOnly = String(uid).startsWith('kick_');
          if (isKickOnly) {
            await supabase.from('users').update({ last_logout_at: new Date().toISOString() }).eq('twitch_id', uid);
            const isHttps = request.url.startsWith('https');
            const secureFlag = isHttps ? '; Secure' : '';
            return new Response(JSON.stringify({ ok: true, logged_out: true }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Set-Cookie': `session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
              },
            });
          }
          return secureResponse({ ok: true, logged_out: false }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to disconnect Kick', 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/auth/disconnect/twitch') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const uid = sessionUser.twitch_id;
          if (String(uid).startsWith('kick_')) {
            return secureResponse('Not applicable for Kick-only accounts', 400, corsHeaders, true);
          }
          const { error: uErr } = await supabase
            .from('users')
            .update({
              twitch_access_token_encrypted: null,
              twitch_refresh_token_encrypted: null,
              twitch_token_scope: null,
            })
            .eq('twitch_id', uid);
          if (uErr) throw uErr;
          const { error: sErr } = await supabase
            .from('streamers')
            .update({
              twitch_access_token_encrypted: null,
              twitch_refresh_token_encrypted: null,
              twitch_token_scope: null,
            })
            .eq('twitch_id', uid);
          if (sErr) console.warn('[Disconnect/Twitch] streamers:', sErr);
          return secureResponse({ ok: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to disconnect Twitch', 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/auth/disconnect/all') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const uid = sessionUser.twitch_id;
          const { error: uErr } = await supabase
            .from('users')
            .update({
              twitch_access_token_encrypted: null,
              twitch_refresh_token_encrypted: null,
              twitch_token_scope: null,
              kick_access_token_encrypted: null,
              kick_refresh_token_encrypted: null,
              kick_token_scope: null,
              kick_user_id: null,
              last_logout_at: new Date().toISOString(),
            })
            .eq('twitch_id', uid);
          if (uErr) throw uErr;
          const { error: sErr } = await supabase
            .from('streamers')
            .update({
              twitch_access_token_encrypted: null,
              twitch_refresh_token_encrypted: null,
              twitch_token_scope: null,
            })
            .eq('twitch_id', uid);
          if (sErr) console.warn('[Disconnect/All] streamers:', sErr);
          const isHttps = request.url.startsWith('https');
          const secureFlag = isHttps ? '; Secure' : '';
          return new Response(JSON.stringify({ ok: true, logged_out: true }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Set-Cookie': `session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
            },
          });
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to disconnect all', 500, corsHeaders, true);
        }
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
            accessToken = await decryptSensitive(dbUser.twitch_access_token_encrypted, twitchTokenEncryptSecret(env));
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
        const streamerId = body.streamer_id ? String(body.streamer_id).trim().toLowerCase() : '';
        if (!streamerId) return secureResponse('Streamer ID required', 400, corsHeaders, true);

        // Check if exists
        const { data: existing } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.twitch_id)
          .eq('streamer_id', streamerId)
          .maybeSingle();

        if (existing) {
          // Unfavorite
          console.log(`[Favorites] Unfavoriting for user ${user.twitch_id}, streamer ${streamerId}`);
          const { error } = await supabase.from('user_favorites').delete().eq('id', existing.id);
          if (error) {
            console.error('[Favorites] Delete error:', error);
            return secureResponse(error.message, 500, corsHeaders, true);
          }
          return secureResponse({ success: true, favorited: false }, 200, corsHeaders);
        } else {
          // Favorite
          console.log(`[Favorites] Favoriting for user ${user.twitch_id}, streamer ${streamerId}`);
          const { error } = await supabase.from('user_favorites').insert({
            user_id: user.twitch_id,
            streamer_id: streamerId
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

      // Viewer: block future card grants from specific streamer channels
      if (method === 'GET' && path === '/api/user/blocked-streamers') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const { data: rows, error } = await supabase
            .from('user_streamer_card_blocks')
            .select('streamer_id, created_at')
            .eq('user_twitch_id', user.twitch_id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const ids = (rows || []).map((r: any) => r.streamer_id).filter(Boolean);
          if (ids.length === 0) return secureResponse([], 200, corsHeaders);
          const { data: streamers, error: sErr } = await supabase
            .from('streamers')
            .select('id, username, display_name, brand_name, avatar_url')
            .in('id', ids);
          if (sErr) throw sErr;
          const byId = new Map((streamers || []).map((s: any) => [s.id, s]));
          const out = (rows || []).map((r: any) => ({
            streamer_id: r.streamer_id,
            created_at: r.created_at,
            streamer: byId.get(r.streamer_id) || null
          }));
          return secureResponse(out, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to load blocks', 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/user/blocked-streamers') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const body = (await request.json()) as { streamer_id?: string; username?: string };
          let sid = String(body.streamer_id || '').trim();
          if (!sid) {
            const uname = String(body.username || '').trim();
            if (!uname) return secureResponse('Missing streamer_id or username', 400, corsHeaders, true);
            const { data: row, error: lookErr } = await supabase
              .from('streamers')
              .select('id')
              .ilike('username', uname)
              .maybeSingle();
            if (lookErr) throw lookErr;
            if (!row?.id) return secureResponse('Streamer not found', 404, corsHeaders, true);
            sid = row.id;
          }
          const { error } = await supabase.from('user_streamer_card_blocks').upsert(
            { user_twitch_id: user.twitch_id, streamer_id: sid },
            { onConflict: 'user_twitch_id,streamer_id' }
          );
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to save block', 500, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/user/blocked-streamers') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const sid = url.searchParams.get('streamer_id') || '';
          if (!sid.trim()) return secureResponse('Missing streamer_id', 400, corsHeaders, true);
          const { error } = await supabase
            .from('user_streamer_card_blocks')
            .delete()
            .eq('user_twitch_id', user.twitch_id)
            .eq('streamer_id', sid.trim());
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to remove block', 500, corsHeaders, true);
        }
      }

      // Irreversible account deletion (viewer / collector)
      if (method === 'POST' && path === '/api/user/delete-account') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const body = (await request.json()) as { confirmation?: string };
          if (body.confirmation !== 'DELETE MY CASTLE ACCOUNT') {
            return secureResponse('Type the confirmation phrase exactly.', 400, corsHeaders, true);
          }
          const { error: delErr } = await supabase.from('users').delete().eq('twitch_id', user.twitch_id);
          if (delErr) {
            console.error('[DeleteAccount]', delErr);
            return secureResponse(
              'Could not delete account. Contact support if this persists.',
              500,
              corsHeaders,
              true
            );
          }
          const isHttps = request.url.startsWith('https');
          const secureFlag = isHttps ? '; Secure' : '';
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
              'Set-Cookie': `session=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
            }
          });
        } catch (e: any) {
          return secureResponse(e.message || 'Delete failed', 500, corsHeaders, true);
        }
      }

      // Same-origin image fetch for html2canvas binder export (avoids CORS on CDN card art)
      if (method === 'GET' && path === '/api/share-image') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const raw = url.searchParams.get('url');
        if (!raw) return secureResponse('Missing url', 400, corsHeaders, true);

        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return secureResponse('Invalid url', 400, corsHeaders, true);
        }

        if (!isAllowedShareImageUrl(target, env)) {
          return secureResponse('URL not allowed', 403, corsHeaders, true);
        }

        try {
          const upstream = await fetch(target.href, {
            redirect: 'follow',
            headers: { 'User-Agent': 'CastleTCG-ShareExport/1.0' },
          });
          if (!upstream.ok) return secureResponse('Upstream failed', 502, corsHeaders, true);

          const ct = upstream.headers.get('Content-Type') || 'application/octet-stream';
          if (!ct.startsWith('image/')) {
            return secureResponse('Not an image', 415, corsHeaders, true);
          }

          const buf = await upstream.arrayBuffer();
          if (buf.byteLength > CARD_IMAGE_MAX_BYTES) {
            return secureResponse('Image too large', 413, corsHeaders, true);
          }

          return new Response(buf, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': ct,
              'Cache-Control': 'private, max-age=120',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } catch (e: any) {
          console.error('[ShareImage]', e);
          return secureResponse('Fetch failed', 502, corsHeaders, true);
        }
      }

      // ── Public Profile API (no auth required) ──────────────────────────────
      if (method === 'GET' && path.startsWith('/api/public/profile/')) {
        const profileUsername = path.slice('/api/public/profile/'.length).split('?')[0].trim().toLowerCase();
        if (!profileUsername) return secureResponse('Missing username', 400, corsHeaders, true);
        try {
          // 1. Resolve user
          const { data: userRow, error: userErr } = await supabase
            .from('users')
            .select('twitch_id, username, avatar_url, trade_code, profile_layout, profile_sections, featured_card_ids, wishlist_items')
            .ilike('username', profileUsername)
            .maybeSingle();
          if (userErr || !userRow) return secureResponse('Profile not found', 404, corsHeaders, true);

          // 2. Check if creator
          const { data: streamerRow } = await supabase
            .from('streamers')
            .select('id, is_active')
            .eq('twitch_id', userRow.twitch_id)
            .maybeSingle();
          const isCreator = !!(streamerRow && streamerRow.is_active);

          // 3. Aggregate card stats
          const selectCols = ENRICHED_USER_CARDS_COLLECTION_SELECT;
          const { data: allCards, error: cardsErr } = await supabase
            .from('enriched_user_cards')
            .select(selectCols)
            .eq('twitch_id', userRow.twitch_id)
            .order('granted_at', { ascending: false })
            .limit(2000);
          const cards = Array.isArray(allCards) ? allCards : [];

          // Aggregate stats
          const totalCards = cards.length;
          const uniqueStreamers = new Set(cards.map((c: any) => c.streamer_id).filter(Boolean)).size;
          const legendaryCount = cards.filter((c: any) => (c.rarity || '').toLowerCase() === 'legendary').length;
          const epicCount = cards.filter((c: any) => (c.rarity || '').toLowerCase() === 'epic').length;
          const rareCount = cards.filter((c: any) => (c.rarity || '').toLowerCase() === 'rare').length;

          // Battles
          let battlesWon = 0; let battlesLost = 0;
          try {
            const { data: battles } = await supabase
              .from('battles')
              .select('winner_id, loser_id')
              .or(`winner_id.eq.${userRow.twitch_id},loser_id.eq.${userRow.twitch_id}`);
            if (Array.isArray(battles)) {
              battlesWon = battles.filter((b: any) => b.winner_id === userRow.twitch_id).length;
              battlesLost = battles.filter((b: any) => b.loser_id === userRow.twitch_id).length;
            }
          } catch { /* battles table may not exist */ }

          // Trades completed
          let tradesCompleted = 0;
          try {
            const { count } = await supabase
              .from('trade_offers')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'accepted')
              .or(`sender_id.eq.${userRow.twitch_id},receiver_id.eq.${userRow.twitch_id}`);
            tradesCompleted = count ?? 0;
          } catch { /* trades table may not exist or use different col names */ }

          // 4. Rarity sort helper (for trophy + showcase)
          const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
          const rarityScore = (c: any) => RARITY_ORDER[(c.rarity || '').toLowerCase()] || 0;
          const sorted = [...cards].sort((a, b) => rarityScore(b) - rarityScore(a));

          // Latest 8 cards (already ordered by granted_at desc)
          const latestCards = cards.slice(0, 8).map((c: any) => ({
            user_card_id: c.user_card_id, name: c.name, rarity: c.rarity,
            image_url: c.image_url, granted_at: c.granted_at, brand_name: c.brand_name
          }));

          // Top 8 by rarity (trophy cabinet)
          const trophyCards = sorted.slice(0, 8).map((c: any) => ({
            user_card_id: c.user_card_id, name: c.name, rarity: c.rarity,
            image_url: c.image_url, mechanic_name: c.mechanic_name
          }));

          // 5. Showcase cards: priority to manually pinned ones, fallback to rarest
          const pinnedIds = Array.isArray(userRow.featured_card_ids) ? userRow.featured_card_ids as string[] : [];
          let showcaseCards: any[] = [];
          
          if (pinnedIds.length > 0) {
            // Find the pinned cards in the user's collection
            showcaseCards = pinnedIds.map(id => cards.find((c: any) => c.user_card_id === id)).filter(Boolean);
          }
          
          // Fallback/fill if less than 10 (user can pin up to 10)
          if (showcaseCards.length < 10) {
            const fallbackSorted = sorted.filter(c => !showcaseCards.some(s => s.user_card_id === c.user_card_id));
            const fillCount = 10 - showcaseCards.length;
            const uniqueFill = fallbackSorted
              .filter((c, i, arr) => arr.findIndex(x => x.card_id === c.card_id) === i)
              .slice(0, fillCount);
            showcaseCards = [...showcaseCards, ...uniqueFill];
          }

          const finalShowcase = showcaseCards.slice(0, 10).map((c: any) => ({
            user_card_id: c.user_card_id, name: c.name, rarity: c.rarity,
            image_url: c.image_url, streamer_username: c.streamer_username, brand_name: c.brand_name
          }));

          const payload = {
            user: {
              username: userRow.username,
              display_name: userRow.username,
              avatar_url: userRow.avatar_url,
              trade_code: userRow.trade_code,
              is_creator: isCreator,
              profile_layout: userRow.profile_layout,
              profile_sections: userRow.profile_sections,
              featured_card_ids: userRow.featured_card_ids,
              wishlist_items: userRow.wishlist_items,
            },
            stats: {
              total_cards: totalCards,
              unique_streamers: uniqueStreamers,
              legendary_count: legendaryCount,
              epic_count: epicCount,
              rare_count: rareCount,
              battles_won: battlesWon,
              battles_lost: battlesLost,
              trades_completed: tradesCompleted,
            },
            showcase_cards: finalShowcase,
            trophy_cards: trophyCards,
            latest_cards: latestCards,
          };
          return secureResponse(payload, 200, { ...corsHeaders, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' });
        } catch (e: any) {
          console.error('[PublicProfile]', e);
          return secureResponse('Internal error', 500, corsHeaders, true);
        }
      }

      // Save public profile widget layout
      if (method === 'POST' && path === '/api/viewer/profile-layout') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as any;
          if (!Array.isArray(body.layout)) return secureResponse('Invalid layout array', 400, corsHeaders, true);
          const allowedSections = ['widget-showcase', 'widget-stats', 'widget-trophy', 'widget-latest', 'widget-wishlist'];
          const normalizedLayout = body.layout
            .filter((id: any) => typeof id === 'string' && allowedSections.includes(id));
          const normalizedSections = Array.isArray(body.sections)
            ? body.sections.filter((id: any) => typeof id === 'string' && allowedSections.includes(id))
            : null;
          
          const { error } = await supabase
            .from('users')
            .update(
              normalizedSections
                ? { profile_layout: normalizedLayout, profile_sections: normalizedSections }
                : { profile_layout: normalizedLayout }
            )
            .eq('twitch_id', user.twitch_id);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to save layout', 500, corsHeaders, true);
        }
      }

      // Save public profile wishlist items
      if (method === 'POST' && path === '/api/viewer/profile/wishlist') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as any;
          if (!Array.isArray(body.items)) return secureResponse('Invalid wishlist array', 400, corsHeaders, true);
          const cleanedItems = body.items
            .map((v: any) => String(v || '').trim())
            .filter((v: string) => v.length > 0)
            .slice(0, 20)
            .map((v: string) => v.slice(0, 80));

          const { error } = await supabase
            .from('users')
            .update({ wishlist_items: cleanedItems })
            .eq('twitch_id', user.twitch_id);

          if (error) throw error;
          return secureResponse({ success: true, items: cleanedItems }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to save wishlist', 500, corsHeaders, true);
        }
      }

      // Save public profile featured cards
      if (method === 'POST' && path === '/api/viewer/profile/featured-cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as any;
          if (!Array.isArray(body.featured_card_ids)) return secureResponse('Invalid array', 400, corsHeaders, true);
          
          const { error } = await supabase
            .from('users')
            .update({ featured_card_ids: body.featured_card_ids.slice(0, 10) }) // Limit to 10
            .eq('twitch_id', user.twitch_id);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to save featured cards', 500, corsHeaders, true);
        }
      }

      // 2c. Custom Binders
      if (method === 'GET' && path === '/api/binders') {
        try {
          const user = await getUserFromSession(request, env, supabase);
          if (!user) return secureResponse('Unauthorized', 41, corsHeaders, true);

          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          // Check if user_binders table exists, if not return empty array
          const { data, error } = await supabase
            .from('user_binders')
            .select('*, user_binder_cards(user_card_id, sort_order)')
            .eq('user_id', user.twitch_id)
            .eq('streamer_id', streamer.id)
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

          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          const { data, error } = await supabase
            .from('user_binders')
            .insert({ user_id: user.twitch_id, name, streamer_id: streamer.id })
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

          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          const { error } = await supabase
            .from('user_binders')
            .update({ name })
            .eq('id', id)
            .eq('user_id', user.twitch_id)
            .eq('streamer_id', streamer.id);

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

        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

        const { error } = await supabase
          .from('user_binders')
          .delete()
          .eq('id', id)
          .eq('user_id', user.twitch_id)
          .eq('streamer_id', streamer.id);

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
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          const { data: binder } = await supabase
            .from('user_binders')
            .select('id')
            .eq('id', binder_id)
            .eq('user_id', user.twitch_id)
            .eq('streamer_id', streamer.id)
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
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

        const { data: binder } = await supabase
          .from('user_binders')
          .select('id')
          .eq('id', binder_id)
          .eq('user_id', user.twitch_id)
          .eq('streamer_id', streamer.id)
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
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          const { data: binder } = await supabase
            .from('user_binders')
            .select('id')
            .eq('id', binder_id)
            .eq('user_id', user.twitch_id)
            .eq('streamer_id', streamer.id)
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

          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);

          const updates = order.map(item => ({
            id: item.id,
            user_id: user.twitch_id,
            streamer_id: streamer.id,
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

            // Invalidate collection ETag for both parties so they see updated cards
            ctx.waitUntil(Promise.all([
              invalidateCollectionEtag(env, trade.sender_id, trade.streamer_id),
              invalidateCollectionEtag(env, trade.receiver_id, trade.streamer_id),
            ]));

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

          const { grade: tradeGrade, isGenesisMint: tradeGM } = generateGrade();
          const { data: granted, error: insError } = await supabase.from('user_cards').insert({
            twitch_id: user.twitch_id,
            card_id: newCard.id,
            streamer_id: newCard.streamer_id,
            granted_by_streamer: newCard.streamer_id,
            is_obs_consumed: true,
            attack: newCard.attack,
            defense: newCard.defense,
            max_hp: newCard.defense,
            mechanic_id: newCard.mechanic_id,
            grade: tradeGrade,
            is_genesis_mint: tradeGM,
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

      // --- MAGIC DUST (Mechanic Trading) ---
      const rarityDustMultiplier = (rarity: string) => {
        const r = (rarity || 'common').toLowerCase();
        if (r === 'legendary') return 4;
        if (r === 'epic') return 3;
        if (r === 'rare') return 2;
        return 1;
      };

      if (method === 'GET' && path === '/api/dust/balance') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        const { data: u, error } = await supabase.from('users').select('magic_dust').eq('twitch_id', user.twitch_id).single();
        if (error || !u) return secureResponse('User not found', 404, corsHeaders, true);
        return secureResponse({ magic_dust: u.magic_dust ?? 0 }, 200, corsHeaders);
      }

      if (method === 'GET' && path === '/api/dust/mechanics') {
        try {
          const mechanics = await fetchWithCache(
            env,
            sharedRedis,
            CACHE_KEY_MECHANICS_LIST,
            CACHE_TTL_MECHANICS_SEC,
            async () => {
              const { data, error } = await supabase
                .from('mechanics')
                .select('id, name, display_name, icon, dust_sell_value, dust_buy_cost')
                .eq('is_active', true);
              if (error) throw error;
              return data || [];
            },
            ctx
          );
          return secureResponse(mechanics, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/dust/sell-mechanic') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const body = await request.json() as DustSellBody;
          if (!body.user_card_id) return secureResponse('user_card_id required', 400, corsHeaders, true);

          const { data: uc, error: ucErr } = await supabase
            .from('enriched_user_cards')
            .select('user_card_id, mechanic_id, rarity')
            .eq('twitch_id', user.twitch_id)
            .eq('user_card_id', body.user_card_id)
            .single();

          if (ucErr || !uc) return secureResponse('Card not found or not in your collection', 404, corsHeaders, true);
          if (!uc.mechanic_id) return secureResponse('Card has no mechanic to sell', 400, corsHeaders, true);

          const { data: mech } = await supabase.from('mechanics').select('dust_sell_value').eq('id', uc.mechanic_id).single();
          const baseValue = (mech as any)?.dust_sell_value ?? 10;
          const mult = rarityDustMultiplier(uc.rarity);
          const dustEarned = Math.max(1, Math.floor(baseValue * mult));

          const { error: updErr } = await supabase
            .from('user_cards')
            .update({ mechanic_id: null })
            .eq('id', body.user_card_id)
            .eq('twitch_id', user.twitch_id);

          if (updErr) throw updErr;

          const { data: uRow } = await supabase.from('users').select('magic_dust').eq('twitch_id', user.twitch_id).single();
          const currentDust = ((uRow as any)?.magic_dust ?? 0) as number;
          const { error: dustErr } = await supabase.from('users').update({ magic_dust: currentDust + dustEarned }).eq('twitch_id', user.twitch_id);
          if (dustErr) throw dustErr;

          const { data: u } = await supabase.from('users').select('magic_dust').eq('twitch_id', user.twitch_id).single();
          await logSystem(supabase, 'info', 'dust', `User ${user.username} sold mechanic for ${dustEarned} dust`, undefined, { user_id: user.twitch_id, user_card_id: body.user_card_id });
          return secureResponse({ success: true, dust_earned: dustEarned, magic_dust: u?.magic_dust ?? 0 }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Sell mechanic failed', 500, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/dust/buy-mechanic') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);
        try {
          const body = await request.json() as DustBuyBody;
          if (!body.user_card_id || !body.mechanic_id) return secureResponse('user_card_id and mechanic_id required', 400, corsHeaders, true);

          const { data: uc, error: ucErr } = await supabase
            .from('enriched_user_cards')
            .select('user_card_id, mechanic_id, rarity')
            .eq('twitch_id', user.twitch_id)
            .eq('user_card_id', body.user_card_id)
            .single();

          if (ucErr || !uc) return secureResponse('Card not found or not in your collection', 404, corsHeaders, true);
          if (uc.mechanic_id) return secureResponse('Card already has a mechanic', 400, corsHeaders, true);

          const { data: mech, error: mErr } = await supabase
            .from('mechanics')
            .select('id, dust_buy_cost')
            .eq('id', body.mechanic_id)
            .eq('is_active', true)
            .single();

          if (mErr || !mech) return secureResponse('Invalid mechanic', 404, corsHeaders, true);

          const baseCost = (mech as any).dust_buy_cost ?? 50;
          const mult = rarityDustMultiplier(uc.rarity);
          const dustCost = Math.max(1, Math.floor(baseCost * mult));

          const { data: u, error: uErr } = await supabase.from('users').select('magic_dust').eq('twitch_id', user.twitch_id).single();
          if (uErr || !u) return secureResponse('User not found', 404, corsHeaders, true);
          const balance = (u as any).magic_dust ?? 0;
          if (balance < dustCost) return secureResponse(`Insufficient dust. Need ${dustCost}, have ${balance}`, 400, corsHeaders, true);

          const { error: updErr } = await supabase
            .from('user_cards')
            .update({ mechanic_id: body.mechanic_id })
            .eq('id', body.user_card_id)
            .eq('twitch_id', user.twitch_id);
          if (updErr) throw updErr;

          const { error: dustErr } = await supabase.from('users').update({
            magic_dust: Math.max(0, balance - dustCost)
          }).eq('twitch_id', user.twitch_id);
          if (dustErr) throw dustErr;

          const { data: u2 } = await supabase.from('users').select('magic_dust').eq('twitch_id', user.twitch_id).single();
          await logSystem(supabase, 'info', 'dust', `User ${user.username} bought mechanic for ${dustCost} dust`, undefined, { user_id: user.twitch_id, user_card_id: body.user_card_id, mechanic_id: body.mechanic_id });
          return secureResponse({ success: true, dust_spent: dustCost, magic_dust: (u2 as any)?.magic_dust ?? 0 }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Buy mechanic failed', 500, corsHeaders, true);
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

      // Check Admin Session
      if (method === 'GET' && path === '/api/admin/check') {
        try {
          await checkAdmin(request);
          const u = await getUserFromSession(request, env, supabase);
          return new Response(JSON.stringify({
            authenticated: true,
            username: u?.username
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
          const { streamer, isPlatformAdmin, staffRole } = await checkAdmin(request);
          const body = await request.json() as AdminCardBody;

          // Multi-tenancy: platform admins + platform_staff (card_editor/staff) OR own streamer
          const targetStreamerId = body.streamer_id || body.creator_id;
          if (
            !canWritePlatformCardCatalog(isPlatformAdmin, staffRole) &&
            (!streamer || streamer.id !== targetStreamerId)
          ) {
            throw new Error("Unauthorized: Cannot create cards for other streamers");
          }

          const { error } = await supabase.from('cards').upsert({
            id: body.id,
            streamer_id: targetStreamerId, // Backward compatibility
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

          // Invalidate card pool cache for this streamer so new cards drop immediately
          try {
            const adminRedis = getRedis(env);
            if (adminRedis) {
              const rarities = ['common', 'rare', 'epic', 'legendary'];
              await Promise.all(rarities.map(r => adminRedis.del(`cache_cards_pool:${targetStreamerId}:${r}`)));
              console.log(`[Redis] Invalidated card pool cache for streamer ${targetStreamerId}`);
            }
          } catch (cacheErr) {
            console.error('[Redis] Cache invalidation failed:', cacheErr);
          }

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Unauthorized', 401, corsHeaders, true);
        }
      }

      // 1a. Upload Image
      if (method === 'POST' && path === '/api/admin/upload') {
        try {
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized: Upload requires creator or card staff access');
          }
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
          const userFolder = streamer?.username ? streamer.username.toLowerCase() : 'platform';
          const r2FilePath = `card_images/${userFolder}/${fileName}`;

          if (!env.CARD_IMAGES) {
            return secureResponse('Server error: No CARD_IMAGES R2 bucket binding found', 500, corsHeaders, true);
          }

          await env.CARD_IMAGES.put(r2FilePath, file, {
            httpMetadata: {
              contentType: file.type || 'application/octet-stream',
              cacheControl: 'public, max-age=31536000'
            }
          });

          const publicUrl = creatorCdnPublicUrl(env, r2FilePath);

          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(((e as any).message || String(e)) || 'Server error', 500, corsHeaders, true);
        }
      }

      // 1b. Bulk Add Cards
      if (method === 'POST' && path === '/api/admin/cards/bulk') {
        try {
          const { streamer, isPlatformAdmin, staffRole } = await checkAdmin(request);
          const body = await request.json() as BulkCardsBody;
          const cards = body.cards;

          if (!Array.isArray(cards) || cards.length === 0) {
            throw new Error("Invalid cards array");
          }

          // Multi-tenancy check for each card
          for (const card of cards) {
            const targetId = card.streamer_id || card.creator_id;
            if (
              !canWritePlatformCardCatalog(isPlatformAdmin, staffRole) &&
              (!streamer || streamer.id !== targetId)
            ) {
                throw new Error("Unauthorized: Bulk includes cards for other streamers");
            }
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
          const { isPlatformAdmin, staffRole } = await checkAdmin(request);
          if (!isPlatformAdmin && staffRole !== 'staff' && staffRole !== 'support') {
            throw new Error("Unauthorized: Platform Admin or staff required");
          }

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
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error("Unauthorized: Platform Admin required");
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
          const { streamer, isPlatformAdmin, staffRole } = await checkAdmin(request);
          const body = await request.json() as GrantBody;

          const lookupRaw = String(body.castle_code || body.username || '').trim();
          const user = await resolveUserByCastleCodeOrUsername(supabase, lookupRaw);

          const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('id, name, rarity, image_url, streamer_id, attack, defense, mechanic_id')
            .eq('id', body.card_id)
            .single();

          if (cardError || !card) throw new Error("Card not found");

          // Multi-tenancy: platform admins + card staff OR owning streamer
          if (
            !canWritePlatformCardCatalog(isPlatformAdmin, staffRole) &&
            (!streamer || streamer.id !== card.streamer_id)
          ) {
            throw new Error("Unauthorized: Cannot grant cards from other streamers");
          }

          const quantity = body.quantity || 1;
          const grants: any[] = [];
          for (let i = 0; i < quantity; i++) {
            const { grade: gGrade, isGenesisMint: gGM } = generateGrade();
            grants.push({
              twitch_id: user.twitch_id,
              card_id: card.id,
              streamer_id: card.streamer_id,
              granted_by_streamer: card.streamer_id,
              attack: card.attack,
              defense: card.defense,
              max_hp: card.defense,
              mechanic_id: card.mechanic_id,
              grade: gGrade,
              is_genesis_mint: gGM,
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

          await logSystem(supabase, 'info', 'grant', `${quantity}× ${card.name} → ${user.username} · Dashboard`, card.streamer_id, {
            recipient_username: user.username,
            recipient_twitch_id: user.twitch_id,
            card_id: card.id,
            card_name: card.name,
            quantity,
            platform: 'dashboard',
          });

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
            // If table doesn't exist, return empty array (notifications are optional). Apply migrations/072_notifications.sql.
            if (dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('permission denied')) {
              console.debug('[Notifications] notifications table missing or inaccessible; returning []. Run migration 072_notifications.sql.');
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

          await supabase.from('users').update({ role: 'creator' }).eq('twitch_id', u.twitch_id);
          console.log('[Onboard] Successfully created streamer:', newStreamer?.id);
          return secureResponse({ success: true, streamer_id: newStreamer?.id }, 200, corsHeaders);
        } catch (e: any) {
          console.error('[Onboard] Exception:', e);
          return secureResponse('Error: ' + e.message, 500, corsHeaders, true);
        }
      }
      
      // ── CARD TEMPLATES API (Creator-authenticated) ──

      // GET /api/creator/templates — list all templates for this streamer
      if (method === 'GET' && path === '/api/creator/templates') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('card_templates')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('name');

          if (error) throw error;
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // POST /api/creator/templates — create or update template
      if (method === 'POST' && path.startsWith('/api/creator/templates')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          if (teamRole === 'moderator') throw new Error("Forbidden: Moderators cannot edit templates");
          
          const body = await request.json().catch(() => ({})) as any;
          const templateIdMatch = path.match(/^\/api\/creator\/templates\/([^\/]+)$/);
          const templateId = templateIdMatch ? templateIdMatch[1] : null;

          const payload = {
            streamer_id: streamer.id,
            name: body.name || 'Untitled Template',
            image_url: body.image_url,
            foil_mask_url: body.foil_mask_url || null,
            layer_data: body.layer_data ? JSON.stringify(body.layer_data) : null,
            trait_area: body.trait_area || { x: 100, y: 800, w: 550, h: 150 },
            font_size: parseInt(body.font_size, 10) || 32,
            font_color: body.font_color || '#ffffff',
            text_align: body.text_align || 'center',
            icon_size: parseInt(body.icon_size, 10) || 32,
            icon_only: !!body.icon_only,
          };

          if (templateId) {
            const { error } = await supabase
              .from('card_templates')
              .update(payload)
              .eq('id', templateId)
              .eq('streamer_id', streamer.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('card_templates').insert(payload);
            if (error) throw error;
          }

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // DELETE /api/creator/templates/:id
      const templateDeleteMatch = path.match(/^\/api\/creator\/templates\/([^\/]+)$/);
      if (method === 'DELETE' && templateDeleteMatch) {
         try {
          const templateId = templateDeleteMatch[1];
          const { streamer, teamRole } = await checkCreator(request, supabase);
          if (teamRole === 'moderator') throw new Error("Forbidden: Moderators cannot delete templates");

          const { error } = await supabase
            .from('card_templates')
            .delete()
            .eq('id', templateId)
            .eq('streamer_id', streamer.id);

          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // ── STUDIO LAYOUT TEMPLATES (Creator-authenticated) ──

      // GET /api/creator/studio-layouts
      if (method === 'GET' && path === '/api/creator/studio-layouts') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('card_studio_layouts')
            .select('id, name, created_at')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // POST /api/creator/studio-layouts — create or update
      if (method === 'POST' && path.startsWith('/api/creator/studio-layouts')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          if (teamRole === 'moderator') throw new Error('Forbidden');
          const body = await request.json().catch(() => ({})) as any;
          const idMatch = path.match(/^\/api\/creator\/studio-layouts\/([^\/]+)$/);
          const layoutId = idMatch ? idMatch[1] : null;

          const payload = {
            streamer_id: streamer.id,
            name: (body.name || 'Untitled Layout').slice(0, 100),
            canvas_json: body.canvas_json ? JSON.stringify(body.canvas_json) : null,
          };

          if (layoutId) {
            const { error } = await supabase
              .from('card_studio_layouts')
              .update(payload)
              .eq('id', layoutId)
              .eq('streamer_id', streamer.id);
            if (error) throw error;
            return secureResponse({ success: true }, 200, corsHeaders);
          } else {
            const { data, error } = await supabase
              .from('card_studio_layouts')
              .insert(payload)
              .select('id')
              .single();
            if (error) throw error;
            return secureResponse({ success: true, id: data?.id }, 200, corsHeaders);
          }
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // DELETE /api/creator/studio-layouts/:id
      const studioLayoutDeleteMatch = path.match(/^\/api\/creator\/studio-layouts\/([^\/]+)$/);
      if (method === 'DELETE' && studioLayoutDeleteMatch) {
        try {
          const layoutId = studioLayoutDeleteMatch[1];
          const { streamer, teamRole } = await checkCreator(request, supabase);
          if (teamRole === 'moderator') throw new Error('Forbidden');
          const { error } = await supabase
            .from('card_studio_layouts')
            .delete()
            .eq('id', layoutId)
            .eq('streamer_id', streamer.id);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // GET /api/creator/studio-layouts/:id — fetch full canvas_json for loading
      const studioLayoutGetMatch = path.match(/^\/api\/creator\/studio-layouts\/([^\/]+)$/);
      if (method === 'GET' && studioLayoutGetMatch) {
        try {
          const layoutId = studioLayoutGetMatch[1];
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('card_studio_layouts')
            .select('*')
            .eq('id', layoutId)
            .eq('streamer_id', streamer.id)
            .single();
          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // ── DYNAMIC CARD IMAGE RENDERING (Public) ──

      // GET /api/cards/:id/image.png — dynamic card image with traits
      const cardImageMatch = path.match(/^\/api\/cards\/([^\/]+)\/image\.png$/);
      if (method === 'GET' && cardImageMatch) {
        try {
          const cardId = cardImageMatch[1];
          
          // --- R2 CACHE LAYER ---
          // v2 prefix busts any stale SVGs generated before the pure-SVG rewrite
          const cacheKey = `card_images/rendered/v2/${cardId}.svg`;
          try {
            const cachedObject = await env.CARD_IMAGES.get(cacheKey);
            if (cachedObject) {
              return new Response(cachedObject.body, {
                headers: {
                  'Content-Type': 'image/svg+xml',
                  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                  'X-Cache': 'HIT-R2'
                }
              });
            }
          } catch (r2Err) {
            console.error('[R2 Cache] Error reading:', r2Err);
          }

          // 1. Try to find if it's a User Card Instance (ID is UUID)
          let traits: string[] = [];
          let template: any = null;
          let imageUrl = '';
          let isGenesis = false;

          const { data: userCard, error: userCardErr } = await supabase
            .from('user_cards')
            .select('*, cards(*, card_templates(*))')
            .eq('id', cardId)
            .maybeSingle();

          let rewardRow: any = null;
          if (!userCard) {
            const { data: rewardRowData } = await supabase
              .from('pending_rewards')
              .select('*, cards(*, card_templates(*))')
              .eq('id', cardId)
              .maybeSingle();
            rewardRow = rewardRowData;
          }

          const targetRow = userCard || rewardRow;
          const targetTable = userCard ? 'user_cards' : (rewardRow ? 'pending_rewards' : null);

          // Pre-check: if trait_list has more entries than expected, clear the stale bake so
          // the healing logic below can rebuild a correct canonical list and re-bake.
          if (targetRow && targetTable) {
            const preIsGenesis = targetRow.is_genesis_mint || !!targetRow.genesis_mechanic_id || targetRow.cards?.is_genesis;
            const preExpected = preIsGenesis ? 2 : 1;
            const preTraits: string[] = targetRow.trait_list || [];
            if (preTraits.length > preExpected) {
              // Clear baked_image_url so the early-exit below is skipped and healing runs
              await supabase.from(targetTable).update({ baked_image_url: null }).eq('id', cardId);
              targetRow.baked_image_url = null;
            }
          }

          // If already baked, redirect straight to the CDN URL — no generation needed
          if (targetRow?.baked_image_url) {
            return Response.redirect(targetRow.baked_image_url, 302);
          }

          console.log(`[CardImage] cardId=${cardId} targetRow=${targetRow?.id ?? 'null'} template_id=${targetRow?.cards?.template_id ?? 'null'} card_templates=${targetRow?.cards?.card_templates?.id ?? 'null'}`);

          if (targetRow && targetRow.cards?.card_templates) {
            template = targetRow.cards.card_templates;
            traits = targetRow.trait_list || [];
            imageUrl = targetRow.cards.image_url;
            isGenesis = targetRow.is_genesis_mint || !!targetRow.genesis_mechanic_id || targetRow.cards?.is_genesis;

            // --- SELF-HEALING LOGIC ---
            // If the card has a template but NO traits, it was likely granted during a broken state.
            // We auto-roll them now and save them back to the DB to fix the card forever.
            const expectedTraitCount = isGenesis ? 2 : 1;
            if (traits.length === 0 && (targetRow.cards.auto_roll_traits !== false)) {
              console.log(`[Self-Healing] Rolling traits for card ${cardId} in table ${targetTable}...`);
              const rolled = await rollTraitsForCard(supabase, targetRow.cards, undefined, targetRow.mechanic_id, targetRow.genesis_mechanic_id);
              if (rolled.length > 0) {
                traits = rolled;
                // Persist back to DB so it's healed forever
                if (targetTable) {
                  const { error: healErr } = await supabase
                    .from(targetTable)
                    .update({ trait_list: traits })
                    .eq('id', cardId);
                  if (healErr) console.error(`[Self-Healing] Failed to save traits for ${cardId}:`, healErr.message);
                }
              }
            } else if (traits.length > expectedTraitCount) {
              // Over-healing: trait_list has more entries than expected (data bug from an earlier state).
              // Rebuild a canonical list: genesis_mechanic_id first (if any), then mechanic_id.
              const canonical: string[] = [];
              if (isGenesis && targetRow.genesis_mechanic_id) canonical.push(targetRow.genesis_mechanic_id);
              if (targetRow.mechanic_id && !canonical.includes(targetRow.mechanic_id)) canonical.push(targetRow.mechanic_id);
              // If mechanic_id isn't set, fall back to the first trait
              if (canonical.length === 0 && traits.length > 0) canonical.push(traits[0]);
              traits = canonical.slice(0, expectedTraitCount);
              console.log(`[Self-Healing] Trimmed excess traits for ${cardId}: now [${traits}]`);
              if (targetTable) {
                const { error: healErr } = await supabase
                  .from(targetTable)
                  .update({ trait_list: traits })
                  .eq('id', cardId);
                if (healErr) console.error(`[Self-Healing] Failed to trim traits for ${cardId}:`, healErr.message);
              }
            }
          } else if (targetRow && targetRow.cards && !targetRow.cards.template_id) {
            // targetRow found but its base card has no template — redirect to base image
            const rawImageUrl = targetRow.cards.image_url;
            if (rawImageUrl) return Response.redirect(rawImageUrl, 302);
            return new Response('Card has no template configured', { status: 404, headers: corsHeaders });
          } else {
            // Fall back: caller passed a base card id directly
            const { data: card } = await supabase
              .from('cards')
              .select('*, card_templates(*)')
              .eq('id', cardId)
              .maybeSingle();

            if (card && card.card_templates) {
              template = card.card_templates;
              traits = (card as any).trait_list || [];
              imageUrl = card.image_url;
              isGenesis = !!(card as any).is_genesis;
            } else if (card) {
              if (card.image_url) return Response.redirect(card.image_url, 302);
              return new Response('Card has no template configured', { status: 404, headers: corsHeaders });
            }
          }

          if (!template) {
            console.log(`[CardImage] No template resolved for cardId=${cardId}`);
            return new Response('Card or template not found', { status: 404, headers: corsHeaders });
          }

          // Lazy bake: use the same bakeCardImage pipeline so we get dedup + CDN URL +
          // baked_image_url persisted. For user card instances or pending rewards, bakeCardImage handles
          // everything; for base-card direct lookups (no instance) we fall back to
          // inline generate + R2 cache only.
          if (targetRow && targetTable) {
            template.origin = url.origin;
            // bakeCardImage runs sync here so we can return the CDN redirect immediately.
            // It writes baked_image_url to the appropriate table and uploads to R2.
            const isGenesis = targetRow.is_genesis_mint || !!targetRow.genesis_mechanic_id || targetRow.cards?.is_genesis;
            const cdnUrl = await bakeCardImage(
              env, supabase, cardId,
              { id: targetRow.card_id, image_url: imageUrl },
              template,
              traits,
              targetTable,
              isGenesis
            );
            if (cdnUrl) return Response.redirect(cdnUrl, 302);
          }

          // Fallback for base-card direct lookups (no user card instance)
          template.origin = url.origin;
          let fullTraits: any[] = [];
          if (traits.length > 0) {
            const { data: mechDetails } = await supabase
              .from('mechanics')
              .select('id, name, display_name, description, icon')
              .in('id', traits);
            fullTraits = traits.map(tid => mechDetails?.find((m: any) => m.id === tid)).filter(Boolean);
          }
          const svg = await generateCardSVG(template, fullTraits, isGenesis);
          ctx.waitUntil(
            env.CARD_IMAGES.put(cacheKey, svg, {
              httpMetadata: { contentType: 'image/svg+xml', cacheControl: 'public, max-age=86400' }
            }).catch((e: any) => console.error('[R2 Cache] Put failed:', e))
          );
          return new Response(svg, {
            headers: {
              'Content-Type': 'image/svg+xml',
              'Cache-Control': 'public, max-age=3600',
              'X-Cache': 'MISS',
            }
          });
        } catch (e: any) {
          return new Response(e.message, { status: 500, headers: corsHeaders });
        }
      }

      // ── DEBUG: Inspect card image state ──
      // GET /api/debug/card-image/:id — returns raw DB state for a user_card or base card
      // Remove or gate behind auth once issue is resolved.
      const debugCardMatch = path.match(/^\/api\/debug\/card-image\/([^\/]+)$/);
      if (method === 'GET' && debugCardMatch) {
        try {
          const debugId = debugCardMatch[1];
          // Query only columns that are guaranteed to exist (no migration-dependent columns)
          const { data: uc, error: ucErr } = await supabase
            .from('user_cards')
            .select('id, card_id, trait_list, cards(id, name, image_url, template_id)')
            .eq('id', debugId)
            .maybeSingle();

          const { data: bc, error: bcErr } = await supabase
            .from('cards')
            .select('id, name, image_url, template_id')
            .eq('id', debugId)
            .maybeSingle();

          return secureResponse({
            queried_id: debugId,
            user_card_query_error: ucErr?.message ?? null,
            base_card_query_error: bcErr?.message ?? null,
            user_card: uc ? {
              id: uc.id,
              card_id: uc.card_id,
              trait_list: uc.trait_list,
              card: uc.cards ? {
                id: (uc.cards as any).id,
                name: (uc.cards as any).name,
                image_url: (uc.cards as any).image_url,
                template_id: (uc.cards as any).template_id,
              } : null,
            } : null,
            base_card: bc ? {
              id: bc.id,
              name: bc.name,
              image_url: bc.image_url,
              template_id: bc.template_id,
            } : null,
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
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

      // GET /api/creator/progress — tier progress and achievement status
      if (method === 'GET' && path === '/api/creator/progress') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const now = new Date();

          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

          const [
            { count: cardsUploaded },
            { data: collectorRows },
            { data: monthlyRows },
            { count: totalCardsGiven },
          ] = await Promise.all([
            supabase.from('cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamer.id),
            supabase.from('user_cards').select('twitch_id').eq('streamer_id', streamer.id),
            supabase.from('user_cards').select('created_at').eq('streamer_id', streamer.id).gte('created_at', sixMonthsAgo.toISOString()),
            supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('streamer_id', streamer.id),
          ]);

          const onboarding = {
            has_uploaded_card: (cardsUploaded || 0) > 0,
            has_given_card: (totalCardsGiven || 0) > 0,
            has_pack: !!(streamer.pack_image_url || streamer.twitch_reward_id),
            has_brand: !!(streamer.brand_name && (streamer.brand_color_primary || streamer.brand_emoji)),
          };

          const uniqueCollectors = new Set((collectorRows || []).map((r: any) => r.twitch_id)).size;

          const monthlyMap = new Map<string, number>();
          for (const row of monthlyRows || []) {
            const d = new Date(row.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
          }

          const monthlyStats: { year: number; month: number; cards_purchased: number }[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyStats.push({ year: d.getFullYear(), month: d.getMonth() + 1, cards_purchased: monthlyMap.get(key) || 0 });
          }

          function maxConsecutive(stats: typeof monthlyStats, threshold: number) {
            let max = 0, cur = 0;
            for (const m of stats) {
              if (m.cards_purchased >= threshold) { cur++; max = Math.max(max, cur); }
              else cur = 0;
            }
            return max;
          }

          const affiliateConsec = maxConsecutive(monthlyStats, 150);
          const partnerConsec = maxConsecutive(monthlyStats, 500);
          const uploaded = cardsUploaded || 0;

          const affiliateReqs = {
            cards_uploaded: { required: 25, current: uploaded, met: uploaded >= 25 },
            unique_collectors: { required: 5, current: uniqueCollectors, met: uniqueCollectors >= 5 },
            qualifying_months: { required: 2, current: affiliateConsec, met: affiliateConsec >= 2, threshold: 150 },
          };
          const affiliateEligible = Object.values(affiliateReqs).every(r => r.met);

          const partnerReqs = {
            cards_uploaded: { required: 75, current: uploaded, met: uploaded >= 75 },
            unique_collectors: { required: 20, current: uniqueCollectors, met: uniqueCollectors >= 20 },
            qualifying_months: { required: 3, current: partnerConsec, met: partnerConsec >= 3, threshold: 500 },
          };
          const partnerEligible = affiliateEligible && Object.values(partnerReqs).every(r => r.met);

          let currentTier = streamer.creator_tier || 'base';
          if (partnerEligible && currentTier !== 'partner') {
            await Promise.all([
              supabase.from('streamers').update({
                creator_tier: 'partner',
                creator_tier_updated_at: now.toISOString(),
                creator_partner_achieved_at: streamer.creator_partner_achieved_at || now.toISOString(),
              }).eq('id', streamer.id),
              supabase.from('users').update({ role: 'partner' }).eq('twitch_id', streamer.twitch_id),
            ]);
            currentTier = 'partner';
          } else if (affiliateEligible && currentTier === 'base') {
            await Promise.all([
              supabase.from('streamers').update({
                creator_tier: 'affiliate',
                creator_tier_updated_at: now.toISOString(),
                creator_affiliate_achieved_at: streamer.creator_affiliate_achieved_at || now.toISOString(),
              }).eq('id', streamer.id),
              supabase.from('users').update({ role: 'affiliate' }).eq('twitch_id', streamer.twitch_id),
            ]);
            currentTier = 'affiliate';
          }

          const communityMilestones = [1, 5, 10, 20, 50].map(n => ({ collectors: n, met: uniqueCollectors >= n }));

          return secureResponse({
            current_tier: currentTier,
            cards_uploaded: uploaded,
            unique_collectors: uniqueCollectors,
            monthly_stats: monthlyStats,
            onboarding,
            community_milestones: communityMilestones,
            affiliate: {
              unlocked: currentTier === 'affiliate' || currentTier === 'partner',
              eligible: affiliateEligible,
              requirements: affiliateReqs,
            },
            partner: {
              unlocked: currentTier === 'partner',
              eligible: partnerEligible,
              locked: currentTier === 'base' && !affiliateEligible,
              requirements: partnerReqs,
            },
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

          // Treat null/undefined is_active as live; only explicit false = still setting up
          const setupComplete = !!(streamer.brand_name && streamer.is_active !== false);

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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);

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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          const b = await request.json() as any;
          if (teamRole === 'moderator') {
            assertModeratorPackSettingsOnly(b);
          } else {
            assertTeamCanEditCatalog(teamRole);
          }

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
          if (b.pack_design_url !== undefined) updateData.pack_design_url = b.pack_design_url;
          if (b.pack_foil_color !== undefined) updateData.pack_foil_color = b.pack_foil_color;
          if (b.card_back_url !== undefined) updateData.card_back_url = b.card_back_url;
          if (b.pack_open_sound_url !== undefined) updateData.pack_open_sound_url = b.pack_open_sound_url;

          // Twitch settings (direct)
          if (b.twitch_reward_id !== undefined) updateData.twitch_reward_id = b.twitch_reward_id;
          if (b.twitch_battle_reward_id !== undefined) updateData.twitch_battle_reward_id = b.twitch_battle_reward_id;

          // Battle/Trading Toggles
          if (b.battles_enabled !== undefined) updateData.battles_enabled = b.battles_enabled;
          if (b.trading_enabled !== undefined) updateData.trading_enabled = b.trading_enabled;
          if (b.binder_color !== undefined) updateData.binder_color = b.binder_color;
          if (b.collection_methods !== undefined) updateData.collection_methods = b.collection_methods;
          if (b.social_links !== undefined) updateData.social_links = b.social_links;
          if (b.achievement_names !== undefined) updateData.achievement_names = b.achievement_names;

          const streamerCdnUrlFields = [
            'pack_image_url',
            'pack_design_url',
            'card_back_url',
            'pack_open_sound_url',
            'brand_banner_url',
          ] as const;
          for (const field of streamerCdnUrlFields) {
            if (updateData[field] !== undefined) {
              await deleteReplacedCdnObject(env, streamer[field], updateData[field]);
            }
          }

          const { error: updateErr } = await supabase.from('streamers').update(updateData).eq('id', streamer.id);

          if (updateErr) throw updateErr;
          if (sharedRedis) {
            await warmStreamerBrandingCache(sharedRedis, { ...streamer, ...updateData });
            await bustStreamersPublicCache(sharedRedis, streamer);
          }

          // When collection_methods changes, re-register EventSub subscriptions so new
          // types (e.g. channel.cheer for bits) are subscribed for this broadcaster.
          if (b.collection_methods !== undefined && streamer.twitch_id) {
            const origin = new URL(request.url).origin;
            const resubTask = ensureEventSubSubscriptionsForBroadcaster(env, {
              broadcasterTwitchId: String(streamer.twitch_id),
              callbackOrigin: origin,
            }).catch((e: any) =>
              console.error('[Settings] EventSub re-register after collection_methods save failed:', e?.message || e)
            );
            if (ctx) ctx.waitUntil(resubTask);
            else await resubTask;
          }

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Auto-create Twitch Channel Points reward for creator (optional convenience)
      if (method === 'POST' && path === '/api/creator/twitch/auto-reward') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const body = await request.json().catch(() => ({})) as any;

          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Twitch is not fully connected with Channel Points permissions. Reconnect Twitch as a creator (Channel Points scopes).');
          }

          const cost = typeof body.cost === 'number' && body.cost > 0 ? body.cost : 500;
          const title = (body.title && String(body.title).trim()) || 'Open a Card Pack';
          const mode = body.mode === 'once_per_stream' ? 'once_per_stream' : 'unlimited';
          const isMaxPerStreamEnabled = mode === 'once_per_stream';

          const helixBody = buildHelixCustomRewardBody({
            title,
            cost,
            is_max_per_stream_enabled: isMaxPerStreamEnabled,
            max_per_stream: isMaxPerStreamEnabled ? 1 : undefined,
            is_max_per_user_per_stream_enabled: false,
            is_global_cooldown_enabled: false,
          });

          const { ok, data, status } = await helixCreateCustomReward(env, streamer.twitch_id, twitchAccessToken, helixBody);
          if (!ok) {
            console.error('[Twitch Auto Reward] Failed:', status, data);
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

      /** List manageable custom Channel Points rewards (for dashboard hydrate) */
      if (method === 'GET' && path === '/api/creator/twitch/custom-rewards') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
          }
          const rows = await helixListCustomRewards(env, streamer.twitch_id, twitchAccessToken);
          const rewards = rows.map((r) => normalizeHelixCustomRewardForClient(r));
          return secureResponse({ rewards }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to list rewards', 400, corsHeaders, true);
        }
      }

      /** Quick toggle: is_enabled and/or is_paused only */
      if (method === 'POST' && path === '/api/creator/twitch/custom-reward-state') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const b = await request.json().catch(() => ({})) as any;
          const rewardId = String(b.reward_id || '').trim();
          if (!rewardId) throw new Error('reward_id is required');

          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
          }

          const patch: Record<string, any> = {};
          if (typeof b.is_enabled === 'boolean') patch.is_enabled = b.is_enabled;
          if (typeof b.is_paused === 'boolean') patch.is_paused = b.is_paused;
          if (Object.keys(patch).length === 0) {
            throw new Error('Set is_enabled and/or is_paused');
          }

          const { ok, data, status } = await helixUpdateCustomReward(
            env,
            streamer.twitch_id,
            rewardId,
            twitchAccessToken,
            patch
          );
          if (!ok) {
            console.error('[Twitch custom-reward-state] Failed:', status, data);
            throw new Error(data?.message || 'Twitch rejected update');
          }
          const reward = data.data && data.data[0];
          return secureResponse({ success: true, reward_id: rewardId, reward }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Update failed', 400, corsHeaders, true);
        }
      }

      /** Delete reward on Twitch; optionally clear pack/battle link on streamer row */
      if (method === 'POST' && path === '/api/creator/twitch/custom-reward-delete') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const b = await request.json().catch(() => ({})) as any;
          const rewardId = String(b.reward_id || '').trim();
          if (!rewardId) throw new Error('reward_id is required');
          const unlink = b.unlink === 'pack' || b.unlink === 'battle' ? b.unlink : null;

          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
          }

          const del = await helixDeleteCustomReward(env, streamer.twitch_id, rewardId, twitchAccessToken);
          if (!del.ok && del.status !== 404) {
            console.error('[Twitch custom-reward-delete] Failed:', del.status, del.data);
            throw new Error(del.data?.message || 'Twitch rejected delete');
          }

          const updates: Record<string, unknown> = {};
          if (unlink === 'pack' && String(streamer.twitch_reward_id || '') === rewardId) {
            updates.twitch_reward_id = null;
          }
          if (unlink === 'battle' && String(streamer.twitch_battle_reward_id || '') === rewardId) {
            updates.twitch_battle_reward_id = null;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('streamers').update(updates).eq('id', streamer.id);
          }

          return secureResponse({ success: true, deleted: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Delete failed', 400, corsHeaders, true);
        }
      }

      /** Full Channel Points reward create (all Helix fields) + optional assign_as pack|battle; or PATCH when update_reward_id is set */
      if (method === 'POST' && path === '/api/creator/twitch/channel-reward') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const body = await request.json().catch(() => ({})) as any;
          delete body.icon_image_url;
          delete body.clear_custom_image;

          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
          }

          const updateRewardId = String(body.update_reward_id || '').trim();
          const helixBody = buildHelixCustomRewardBody(body);

          if (updateRewardId) {
            const { ok, data, status } = await helixUpdateCustomReward(
              env,
              streamer.twitch_id,
              updateRewardId,
              twitchAccessToken,
              helixBody
            );
            if (!ok) {
              console.error('[Twitch channel-reward] PATCH failed:', status, data);
              throw new Error(data?.message || 'Twitch rejected this reward update');
            }
            const reward = data.data && data.data[0];
            return secureResponse(
              { success: true, reward_id: updateRewardId, reward, updated: true },
              200,
              corsHeaders
            );
          }

          const { ok, data, status } = await helixCreateCustomReward(env, streamer.twitch_id, twitchAccessToken, helixBody);
          if (!ok) {
            console.error('[Twitch channel-reward] Failed:', status, data);
            throw new Error(data?.message || 'Twitch rejected this reward');
          }

          const reward = data.data && data.data[0];
          const rewardId = reward?.id as string | undefined;
          const assignAs = body.assign_as === 'battle' ? 'battle' : body.assign_as === 'pack' ? 'pack' : null;

          if (rewardId && assignAs === 'pack') {
            await supabase.from('streamers').update({ twitch_reward_id: rewardId }).eq('id', streamer.id);
          } else if (rewardId && assignAs === 'battle') {
            await supabase.from('streamers').update({ twitch_battle_reward_id: rewardId }).eq('id', streamer.id);
          }

          return secureResponse({ success: true, reward_id: rewardId, reward, updated: false }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to create reward', 400, corsHeaders, true);
        }
      }

      /** Toggle / save a built-in preset slot (creates or updates Twitch reward + DB row) */
      if (method === 'POST' && path === '/api/creator/channel-point-preset') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const b = await request.json().catch(() => ({})) as any;
          const presetKey = String(b.preset_key || '').trim();
          const def = CHANNEL_POINT_PRESET_DEFS.find((d) => d.key === presetKey);
          if (!def) throw new Error('Unknown preset');

          const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
          if (!twitchAccessToken) {
            throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
          }

          const { data: existing, error: exErr } = await supabase
            .from('streamer_channel_point_fixed_cards')
            .select('*')
            .eq('streamer_id', streamer.id)
            .eq('preset_key', presetKey)
            .maybeSingle();
          if (exErr) throw exErr;

          if (b.action === 'delete') {
            if (!existing?.id) {
              return secureResponse({ success: true, deleted: false }, 200, corsHeaders);
            }
            const ridDel = existing.twitch_reward_id as string | undefined;
            if (ridDel) {
              if (ridDel === streamer.twitch_reward_id || ridDel === streamer.twitch_battle_reward_id) {
                throw new Error('This reward is linked as pack or battle; change those first.');
              }
              const delH = await helixDeleteCustomReward(env, streamer.twitch_id, ridDel, twitchAccessToken);
              if (!delH.ok && delH.status !== 404) {
                throw new Error(delH.data?.message || 'Twitch could not delete reward');
              }
            }
            const { error: delRowErr } = await supabase
              .from('streamer_channel_point_fixed_cards')
              .delete()
              .eq('id', existing.id)
              .eq('streamer_id', streamer.id);
            if (delRowErr) throw delRowErr;
            return secureResponse({ success: true, deleted: true }, 200, corsHeaders);
          }

          const enabled = !!b.enabled;
          const hideFromOverlay = b.hide_from_overlay !== false;

          if (!enabled) {
            if (existing?.twitch_reward_id) {
              await helixUpdateCustomReward(env, streamer.twitch_id, existing.twitch_reward_id, twitchAccessToken, {
                is_enabled: false,
              });
            }
            if (existing?.id) {
              const { error: up } = await supabase
                .from('streamer_channel_point_fixed_cards')
                .update({ is_enabled: false })
                .eq('id', existing.id);
              if (up) throw up;
            }
            return secureResponse({ success: true, disabled: true }, 200, corsHeaders);
          }

          const cardId = String(b.card_id || '').trim();
          if (!cardId || cardId.length > 128) throw new Error('Choose a card');

          const { data: cardRow, error: cardErr } = await supabase
            .from('cards')
            .select('id')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .maybeSingle();
          if (cardErr || !cardRow) throw new Error('Card not found');

          const rs = b.reward && typeof b.reward === 'object' ? { ...b.reward } : {};
          delete rs.icon_image_url;
          delete rs.clear_custom_image;
          const helixBody = buildHelixCustomRewardBody({
            title: rs.title ?? def.default_title,
            cost: rs.cost ?? def.default_cost,
            ...rs,
          });

          let rewardId = existing?.twitch_reward_id as string | undefined;
          if (!rewardId) {
            const created = await helixCreateCustomReward(env, streamer.twitch_id, twitchAccessToken, helixBody);
            if (!created.ok) {
              throw new Error(created.data?.message || 'Twitch rejected reward');
            }
            rewardId = created.data?.data?.[0]?.id;
          } else {
            const updated = await helixUpdateCustomReward(env, streamer.twitch_id, rewardId, twitchAccessToken, {
              ...helixBody,
              is_enabled: true,
            });
            if (!updated.ok) {
              throw new Error(updated.data?.message || 'Twitch rejected update');
            }
          }

          if (!rewardId) throw new Error('No reward id from Twitch');
          if (rewardId === streamer.twitch_reward_id || rewardId === streamer.twitch_battle_reward_id) {
            throw new Error('That reward slot is already used for pack or battle');
          }

          const row = {
            streamer_id: streamer.id,
            preset_key: presetKey,
            twitch_reward_id: rewardId,
            card_id: cardId,
            label: String(helixBody.title || def.label).slice(0, 120),
            is_enabled: true,
            hide_from_overlay: hideFromOverlay,
          };

          if (existing?.id) {
            const { error: up } = await supabase.from('streamer_channel_point_fixed_cards').update(row).eq('id', existing.id);
            if (up) throw up;
          } else {
            const { error: ins } = await supabase.from('streamer_channel_point_fixed_cards').insert(row);
            if (ins) throw ins;
          }

          return secureResponse({ success: true, twitch_reward_id: rewardId }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Preset save failed', 400, corsHeaders, true);
        }
      }

      // Channel Points → one specific card (event / "I was here" rewards)
      if (method === 'GET' && path === '/api/creator/channel-point-fixed-cards') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const { data, error } = await supabase
            .from('streamer_channel_point_fixed_cards')
            .select(
              'id, twitch_reward_id, card_id, label, created_at, preset_key, is_enabled, hide_from_overlay, cards(name, rarity)'
            )
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: true });
          if (error) throw error;
          return secureResponse(
            {
              definitions: CHANNEL_POINT_PRESET_DEFS,
              mappings: data || [],
            },
            200,
            corsHeaders
          );
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to list fixed card rewards', 400, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/creator/channel-point-fixed-cards') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const b = await request.json().catch(() => ({})) as any;
          const twitchRewardId = String(b.twitch_reward_id || '').trim();
          const cardId = String(b.card_id || '').trim();
          const label =
            b.label !== undefined && b.label !== null ? String(b.label).trim().slice(0, 120) : null;

          if (!twitchRewardId) throw new Error('twitch_reward_id is required');
          if (!cardId || cardId.length > 128) throw new Error('Invalid card_id');
          if (twitchRewardId === streamer.twitch_reward_id) {
            throw new Error('This reward ID is already your main pack reward; use a different Twitch reward for event cards');
          }
          if (streamer.twitch_battle_reward_id && twitchRewardId === streamer.twitch_battle_reward_id) {
            throw new Error('This reward ID is reserved for battle redemptions');
          }

          const { data: cardRow, error: cardErr } = await supabase
            .from('cards')
            .select('id')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .maybeSingle();
          if (cardErr || !cardRow) throw new Error('Card not found in your catalog');

          const { data: inserted, error: insErr } = await supabase
            .from('streamer_channel_point_fixed_cards')
            .insert({
              streamer_id: streamer.id,
              twitch_reward_id: twitchRewardId,
              card_id: cardId,
              label: label || null,
              preset_key: null,
              is_enabled: true,
              hide_from_overlay: b.hide_from_overlay !== false,
            })
            .select('id, twitch_reward_id, card_id, label, created_at')
            .single();
          if (insErr) {
            if (String(insErr.message || '').toLowerCase().includes('duplicate')) {
              throw new Error('That Twitch reward ID is already linked for this channel');
            }
            throw insErr;
          }
          return secureResponse(inserted, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to add mapping', 400, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path.startsWith('/api/creator/channel-point-fixed-cards/')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const rowId = path.split('/').pop();
          if (
            !rowId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rowId)
          ) {
            return secureResponse('Invalid id', 400, corsHeaders, true);
          }
          const deleteTwitch =
            url.searchParams.get('delete_twitch') === '1' || url.searchParams.get('delete_twitch') === 'true';

          const { data: row, error: checkErr } = await supabase
            .from('streamer_channel_point_fixed_cards')
            .select('id, twitch_reward_id, preset_key')
            .eq('id', rowId)
            .eq('streamer_id', streamer.id)
            .maybeSingle();
          if (checkErr || !row) {
            return secureResponse('Mapping not found', 404, corsHeaders, true);
          }

          if (deleteTwitch) {
            if (row.preset_key) {
              throw new Error('This row is an event preset; delete it from Event cards.');
            }
            const twId = row.twitch_reward_id as string | undefined;
            if (twId) {
              if (twId === streamer.twitch_reward_id || twId === streamer.twitch_battle_reward_id) {
                throw new Error('This reward is linked as pack or battle; change those first.');
              }
              const twitchAccessToken = await getBroadcasterTwitchHelixAccessToken(supabase, env, streamer.twitch_id);
              if (!twitchAccessToken) {
                throw new Error('Reconnect Twitch as creator (Channel Points scopes).');
              }
              const delH = await helixDeleteCustomReward(env, streamer.twitch_id, twId, twitchAccessToken);
              if (!delH.ok && delH.status !== 404) {
                throw new Error(delH.data?.message || 'Twitch could not delete reward');
              }
            }
          }

          const { error: delErr } = await supabase
            .from('streamer_channel_point_fixed_cards')
            .delete()
            .eq('id', rowId)
            .eq('streamer_id', streamer.id);
          if (delErr) throw delErr;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to remove mapping', 400, corsHeaders, true);
        }
      }

      // Save Rarity Configuration
      if (method === 'POST' && path === '/api/creator/rarity-config') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);

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

      // Creator: Team management (channel owner only — do not use X-Act-As)
      if (method === 'GET' && path === '/api/creator/team') {
        try {
          const u = await getUserFromSession(request, env, supabase);
          if (!u) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const { data: owner } = await supabase.from('streamers').select('id').eq('twitch_id', u.twitch_id).maybeSingle();
          if (!owner) return secureResponse('Only channel owners manage team', 403, corsHeaders, true);
          const { data: rows, error } = await supabase
            .from('streamer_team_members')
            .select('member_twitch_id, role, created_at')
            .eq('streamer_id', owner.id)
            .order('created_at', { ascending: true });
          if (error) throw error;
          return secureResponse(rows || [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/creator/team') {
        try {
          const u = await getUserFromSession(request, env, supabase);
          if (!u) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const { data: owner } = await supabase.from('streamers').select('id').eq('twitch_id', u.twitch_id).maybeSingle();
          if (!owner) return secureResponse('Only channel owners manage team', 403, corsHeaders, true);
          const b = await request.json() as { member_twitch_id?: string; role?: 'moderator' | 'editor' };
          const mid = (b.member_twitch_id || '').trim();
          const role = b.role === 'editor' ? 'editor' : 'moderator';
          if (!mid) throw new Error('member_twitch_id required');
          const { error } = await supabase.from('streamer_team_members').upsert(
            { streamer_id: owner.id, member_twitch_id: mid, role },
            { onConflict: 'streamer_id,member_twitch_id' }
          );
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/creator/team') {
        try {
          const u = await getUserFromSession(request, env, supabase);
          if (!u) return secureResponse('Unauthorized', 401, corsHeaders, true);
          const { data: owner } = await supabase.from('streamers').select('id').eq('twitch_id', u.twitch_id).maybeSingle();
          if (!owner) return secureResponse('Only channel owners manage team', 403, corsHeaders, true);
          const mid = (url.searchParams.get('member_twitch_id') || '').trim();
          if (!mid) throw new Error('member_twitch_id required');
          const { error } = await supabase
            .from('streamer_team_members')
            .delete()
            .eq('streamer_id', owner.id)
            .eq('member_twitch_id', mid);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: list blocked collectors (mods + team act-as)
      if (method === 'GET' && path === '/api/creator/blocked-collectors') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('streamer_collector_blocks')
            .select('blocked_twitch_id, created_at')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: true });
          if (error) throw error;
          return secureResponse(data || [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/creator/blocked-collectors') {
        try {
          const { user, streamer } = await checkCreator(request, supabase);
          const b = await request.json() as { twitch_id?: string };
          const tid = (b.twitch_id || '').trim();
          if (!tid) throw new Error('twitch_id required');
          if (tid === user.twitch_id) throw new Error('Cannot block your own account');
          const { error } = await supabase.from('streamer_collector_blocks').upsert(
            { streamer_id: streamer.id, blocked_twitch_id: tid },
            { onConflict: 'streamer_id,blocked_twitch_id' }
          );
          if (error) throw error;
          const { data: bu } = await supabase.from('users').select('username').eq('twitch_id', tid).maybeSingle();
          const who = bu?.username || tid;
          await logSystem(supabase, 'info', 'admin', `Blocked collector ${who}`, streamer.id, {
            blocked_twitch_id: tid,
            blocked_username: bu?.username || null,
            platform: 'dashboard',
          });
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/creator/blocked-collectors') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const tid = (url.searchParams.get('twitch_id') || '').trim();
          if (!tid) throw new Error('twitch_id required');
          const { error } = await supabase
            .from('streamer_collector_blocks')
            .delete()
            .eq('streamer_id', streamer.id)
            .eq('blocked_twitch_id', tid);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'POST' && path === '/api/creator/collector-wipe') {
        try {
          const { user, streamer } = await checkCreator(request, supabase);
          const b = await request.json() as { twitch_id?: string };
          const tid = (b.twitch_id || '').trim();
          if (!tid) throw new Error('twitch_id required');
          if (tid === user.twitch_id) throw new Error('Cannot wipe your own collection');
          const { error: ucErr } = await supabase
            .from('user_cards')
            .delete()
            .eq('streamer_id', streamer.id)
            .eq('twitch_id', tid);
          if (ucErr) throw ucErr;
          const { error: uaErr } = await supabase
            .from('user_achievements')
            .delete()
            .eq('streamer_id', streamer.id)
            .eq('twitch_id', tid);
          if (uaErr) throw uaErr;
          const { data: wu } = await supabase.from('users').select('username').eq('twitch_id', tid).maybeSingle();
          const who = wu?.username || tid;
          await logSystem(supabase, 'warn', 'admin', `Wiped collection for ${who}`, streamer.id, {
            wiped_twitch_id: tid,
            wiped_username: wu?.username || null,
            platform: 'dashboard',
          });
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Platform admin: grant global staff roles (card_editor, staff, support)
      if (method === 'POST' && path === '/api/admin/platform-staff') {
        try {
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error('Platform Admin required');
          const b = await request.json() as { twitch_id?: string; role?: PlatformStaffRole };
          const tid = (b.twitch_id || '').trim();
          const r = b.role;
          if (!tid || !r || !['staff', 'card_editor', 'support'].includes(r)) {
            throw new Error('twitch_id and role (staff|card_editor|support) required');
          }
          const { error } = await supabase.from('platform_staff').upsert({ twitch_id: tid, role: r });
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      if (method === 'DELETE' && path === '/api/admin/platform-staff') {
        try {
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error('Platform Admin required');
          const tid = (url.searchParams.get('twitch_id') || '').trim();
          if (!tid) throw new Error('twitch_id required');
          const { error } = await supabase.from('platform_staff').delete().eq('twitch_id', tid);
          if (error) throw error;
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
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

      // Creator: List previously uploaded images for this streamer (from R2)
      if (method === 'GET' && path === '/api/creator/images') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const prefix = `card_images/${streamer.id}/`;
          const listed = await env.CARD_IMAGES.list({ prefix, limit: 200 });
          const images = (listed.objects || [])
            .filter((obj: any) => !obj.key.includes('/baked/') && !obj.key.endsWith('foil-mask.png'))
            .sort((a: any, b: any) => (b.uploaded?.getTime?.() ?? 0) - (a.uploaded?.getTime?.() ?? 0))
            .map((obj: any) => ({
              key: obj.key,
              url: creatorCdnPublicUrl(env, obj.key),
              size: obj.size,
              uploaded: obj.uploaded,
            }));
          return secureResponse(images, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // Creator: Create/Update own card
      if (method === 'POST' && path === '/api/creator/cards') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

            if (b.image_url) {
              await deleteReplacedCdnObject(env, existingCard.image_url, b.image_url);
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
              image_url: b.image_url || '',
              foil_mask_url: b.foil_mask_url ?? null,
              layer_data: b.layer_data ?? null,
              is_battle_eligible: b.is_battle_eligible !== undefined ? b.is_battle_eligible : true,
              is_trading_eligible: b.is_trading_eligible !== undefined ? b.is_trading_eligible : true,
              is_approved: true,
              set_id: b.set_id || null,
              card_number: b.card_number || null,
              template_id: b.template_id || null,
              auto_roll_traits: !!b.auto_roll_traits,
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

          // Auto-roll sample traits and warm R2 bake cache when a template is assigned
          if (data && data.template_id && (!b.trait_list || b.trait_list.length === 0)) {
            const { data: activeMechanics } = await supabase
              .from('mechanics')
              .select('id, rarity_weight')
              .eq('is_active', true);

            const primary = pickWeightedMechanicFromList(activeMechanics || []);
            if (primary) {
              const rolledTraitIds: string[] = [primary];
              await supabase.from('cards').update({ trait_list: rolledTraitIds }).eq('id', data.id);
              (data as any).trait_list = rolledTraitIds;

              // Delete any stale R2 cache for this card so the next GET regenerates from fresh DB state.
              // This must be synchronous — ctx.waitUntil runs after the response so a race window
              // would otherwise serve the old SVG.
              if (env?.CARD_IMAGES) {
                await env.CARD_IMAGES.delete(`card_images/rendered/v2/${data.id}.svg`).catch(() => {});
              }

              // Warm the R2 SVG bake cache asynchronously so it's ready for display
              if (ctx && env?.CARD_IMAGES) {
                ctx.waitUntil((async () => {
                  try {
                    const [{ data: tmpl }, { data: mechDetails }] = await Promise.all([
                      supabase.from('card_templates').select('*').eq('id', data.template_id).maybeSingle(),
                      supabase.from('mechanics').select('id,name,display_name,description,icon').in('id', rolledTraitIds)
                    ]);
                    if (!tmpl) return;
                    const fullTraits = rolledTraitIds
                      .map((tid: string) => mechDetails?.find((m: any) => m.id === tid))
                      .filter(Boolean);
                    const tmplWithImage = { ...tmpl, image_url: data.image_url, origin: (env.FRONTEND_URL || '').replace(/\/$/, '') };
                    const svg = await generateCardSVG(tmplWithImage, fullTraits, false);
                    await env.CARD_IMAGES.put(
                      `card_images/rendered/v2/${data.id}.svg`,
                      svg,
                      { httpMetadata: { contentType: 'image/svg+xml', cacheControl: 'public, max-age=86400' } }
                    );
                  } catch (bakeErr) {
                    console.error('[Creator Cards POST] Bake cache warm failed:', bakeErr);
                  }
                })());
              }
            }
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const cardBackId = path.split('/').pop();

          // Verify ownership
          const { data: existing, error: checkErr } = await supabase
            .from('streamer_card_backs')
            .select('id, image_url')
            .eq('id', cardBackId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existing) {
            return secureResponse('Card back not found or access denied', 404, corsHeaders, true);
          }

          const b = await request.json() as any;
          const updateData: any = {};
          if (b.name) updateData.name = b.name;
          if (b.image_url) {
            await deleteReplacedCdnObject(env, existing.image_url, b.image_url);
            updateData.image_url = b.image_url;
          }
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const cardBackId = path.split('/').pop();

          // Verify ownership
          const { data: existing, error: checkErr } = await supabase
            .from('streamer_card_backs')
            .select('id, image_url')
            .eq('id', cardBackId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existing) {
            return secureResponse('Card back not found or access denied', 404, corsHeaders, true);
          }

          await deleteReplacedCdnObject(env, existing.image_url, '');

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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

      // INTERNAL ANALYTICS HELPERS
      const emptyPackSourceBreakdown = () => ({
        granted: 0,
        kick_subs: 0,
        twitch_subs: 0,
        twitch_bits: 0,
        castle_site: 0,
        codes: 0,
        kick_channel_points: 0,
        twitch_channel_points: 0,
      });

      /** Maps streamer_activity_logs grant rows to analytics buckets (Pack activity tooltip). */
      const normalizePackGrantSourceBucket = (metadata: any, message: string) => {
        const m = metadata && typeof metadata === 'object' ? metadata : {};
        const msg = String(message || '');

        if (m.platform === 'stripe' || m.castle_site === true) return 'castle_site';
        if (m.platform === 'dashboard' || /· Dashboard/i.test(msg)) return 'granted';
        if (m.source === 'code' || m.promo_code || m.grant_kind === 'promo_code') return 'codes';

        if (m.platform === 'kick') {
          const k = String(m.kick_context || '').toLowerCase();
          if (k.includes('reward:') || k.includes('channel.reward')) return 'kick_channel_points';
          if (k.includes('kicks gifted')) return 'kick_channel_points';
          if (k.includes('sub') || k.includes('gift')) return 'kick_subs';
          return 'kick_subs';
        }

        if (m.platform === 'twitch') {
          const t = String(m.twitch_context || '').toLowerCase();
          if (t.includes('channel points')) return 'twitch_channel_points';
          if (t.includes('cheer') || t.includes('bits')) return 'twitch_bits';
          if (t.includes('gift') || t.includes('subscription') || t.includes('resub')) return 'twitch_subs';
          return 'twitch_subs';
        }

        if (/Kick \(/i.test(msg)) {
          if (/Kick \(Reward:/i.test(msg) || /Kick \([^)]*reward/i.test(msg)) return 'kick_channel_points';
          if (/Kicks gifted/i.test(msg)) return 'kick_channel_points';
          return 'kick_subs';
        }
        if (/Twitch \(/i.test(msg)) {
          const mm = msg.match(/Twitch \(([^)]+)\)/i);
          const ctx = mm ? mm[1].toLowerCase() : '';
          if (ctx.includes('channel points')) return 'twitch_channel_points';
          if (ctx.includes('cheer') || ctx.includes('bits')) return 'twitch_bits';
          if (ctx.includes('gift') || ctx.includes('subscription') || ctx.includes('resub')) return 'twitch_subs';
        }

        return 'granted';
      };

      const internalGetOverview = async (supabase: any, streamerId: string, days: number, windowStart: Date, windowEnd: Date) => {
        const { data: streamerData } = await supabase
          .from('streamers')
          .select('total_cards, total_collectors, total_packs_opened, stripe_pending_payout_cents')
          .eq('id', streamerId)
          .single();

        const { data: growthStats, error: growthErr } = await supabase
          .from('user_cards')
          .select('granted_at, created_at, twitch_id')
          .eq('streamer_id', streamerId)
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString());

        if (growthErr) throw growthErr;

        const dailyMap = new Map<string, Set<string>>();
        growthStats?.forEach((row: any) => {
          const d = (row.granted_at || row.created_at).split('T')[0];
          if (!dailyMap.has(d)) dailyMap.set(d, new Set());
          dailyMap.get(d)!.add(row.twitch_id);
        });

        const growthData = [];
        for (let i = 0; i < days; i++) {
          const curr = new Date(windowStart);
          curr.setDate(curr.getDate() + i);
          const ds = curr.toISOString().split('T')[0];
          growthData.push({ date: ds, count: dailyMap.get(ds)?.size || 0 });
        }

        const prevStart = new Date(windowStart.getTime() - days * 24 * 60 * 60 * 1000);
        const prevEnd   = windowStart;

        const [prevRes, currRes] = await Promise.all([
          supabase.from('user_cards').select('twitch_id', { count: 'exact', head: true })
            .eq('streamer_id', streamerId)
            .gte('created_at', prevStart.toISOString())
            .lte('created_at', prevEnd.toISOString()),
          supabase.from('user_cards').select('twitch_id', { count: 'exact', head: true })
            .eq('streamer_id', streamerId)
            .gte('created_at', windowStart.toISOString())
            .lte('created_at', windowEnd.toISOString())
        ]);

        return {
          total_cards: streamerData?.total_cards || 0,
          total_collectors: streamerData?.total_collectors || 0,
          total_packs_opened: streamerData?.total_packs_opened || 0,
          cards_change: 0,
          collectors_change: (currRes.count || 0) - (prevRes.count || 0),
          packs_change: 0,
          revenue_cents: Number(streamerData?.stripe_pending_payout_cents ?? 0),
          growth_data: growthData
        };
      };

      const internalGetCards = async (supabase: any, streamerId: string, days: number, windowStart: Date, windowEnd: Date) => {
        const { data: mostCollectedData } = await supabase
          .from('user_cards')
          .select('card_id, cards(name, image_url, rarity)')
          .eq('streamer_id', streamerId)
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString());

        const counts: Record<string, any> = {};
        mostCollectedData?.forEach((uc: any) => {
          const cid = uc.card_id;
          if (!counts[cid]) {
            counts[cid] = {
              id: cid,
              name: uc.cards?.name || 'Unknown',
              image_url: uc.cards?.image_url || '',
              rarity: uc.cards?.rarity || 'common',
              collection_count: 0
            };
          }
          counts[cid].collection_count++;
        });

        const mostCollected = Object.values(counts)
          .sort((a: any, b: any) => b.collection_count - a.collection_count)
          .slice(0, 10);

        const { data: allCards } = await supabase
          .from('cards')
          .select('id, name, image_url, rarity')
          .eq('streamer_id', streamerId);

        const allCardIds = allCards?.map((c: any) => c.id) || [];
        
        const { data: globalCounts } = await supabase
          .from('user_cards')
          .select('card_id')
          .eq('streamer_id', streamerId)
          .in('card_id', allCardIds);

        const globalCountMap: Record<string, number> = {};
        globalCounts?.forEach((uc: any) => {
          globalCountMap[uc.card_id] = (globalCountMap[uc.card_id] || 0) + 1;
        });

        const rarest = (allCards || [])
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            image_url: c.image_url,
            rarity: c.rarity,
            collection_count: globalCountMap[c.id] || 0
          }))
          .sort((a, b) => a.collection_count - b.collection_count)
          .slice(0, 10);

        const discovery: any = { 
          common: { total: 0, found: 0 }, 
          rare: { total: 0, found: 0 }, 
          epic: { total: 0, found: 0 }, 
          legendary: { total: 0, found: 0 } 
        };

        allCards?.forEach((c: any) => {
          const r = c.rarity?.toLowerCase() || 'common';
          if (!discovery[r]) discovery[r] = { total: 0, found: 0 };
          discovery[r].total++;
          if (globalCountMap[c.id] > 0) discovery[r].found++;
        });

        return {
          most_collected: mostCollected,
          rarest: rarest,
          community_discovery: discovery
        };
      };

      const internalGetPacks = async (supabase: any, streamerId: string, days: number, windowStart: Date, windowEnd: Date) => {
        const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
        const wsIso = windowStart.toISOString();
        const weIso = windowEnd.toISOString();

        const { data: recentOpenings } = await supabase
          .from('user_cards')
          .select('granted_at, created_at')
          .eq('streamer_id', streamerId)
          .gte('created_at', wsIso)
          .lte('created_at', weIso)
          .order('created_at', { ascending: true });

        let grantLogs: any[] | null = null;
        try {
          const { data, error } = await supabase
            .from('streamer_activity_logs')
            .select('created_at, metadata, message')
            .eq('streamer_id', streamerId)
            .eq('category', 'grant')
            .gte('created_at', wsIso)
            .lte('created_at', weIso)
            .order('created_at', { ascending: true })
            .limit(20000);
          if (!error) grantLogs = data;
        } catch {
          grantLogs = [];
        }

        const byDaySource = new Map<string, ReturnType<typeof emptyPackSourceBreakdown>>();
        const bump = (dateStr: string, bucket: keyof ReturnType<typeof emptyPackSourceBreakdown>) => {
          if (!byDaySource.has(dateStr)) byDaySource.set(dateStr, emptyPackSourceBreakdown());
          const row = byDaySource.get(dateStr)!;
          row[bucket]++;
        };

        for (const log of grantLogs || []) {
          const ca = log.created_at;
          if (!ca) continue;
          const dateStr = String(ca).split('T')[0];
          const bucket = normalizePackGrantSourceBucket(log.metadata, log.message) as keyof ReturnType<
            typeof emptyPackSourceBreakdown
          >;
          bump(dateStr, bucket);
        }

        const activityData: any[] = [];
        for (let i = 0; i < safeDays; i++) {
          const date = new Date(windowStart);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayOpenings = recentOpenings?.filter((o: any) => (o.granted_at || o.created_at)?.startsWith(dateStr)).length || 0;
          const src = byDaySource.get(dateStr) || emptyPackSourceBreakdown();
          activityData.push({ date: dateStr, count: dayOpenings, by_source: { ...src } });
        }

        const prevStart = new Date(windowStart.getTime() - days * 24 * 60 * 60 * 1000);
        const { data: prevOpenings } = await supabase
          .from('user_cards')
          .select('id', { count: 'exact', head: true })
          .eq('streamer_id', streamerId)
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', windowStart.toISOString());

        const currTotal = recentOpenings?.length || 0;
        const prevTotal = prevOpenings?.length || 0;
        return { total_openings: currTotal, prev_total: prevTotal, activity_data: activityData };
      };

      const internalGetBattles = async (supabase: any, streamerId: string, days: number, windowStart: Date, windowEnd: Date) => {
        const { data: battleRows } = await supabase
          .from('battles')
          .select('completed_at, winner_id')
          .eq('streamer_id', streamerId)
          .gte('completed_at', windowStart.toISOString())
          .lte('completed_at', windowEnd.toISOString())
          .not('completed_at', 'is', null);

        const dailyMap = new Map<string, number>();
        for (const b of battleRows || []) {
          const d = String(b.completed_at).split('T')[0];
          dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
        }

        const activityData: any[] = [];
        for (let i = 0; i < days; i++) {
          const date = new Date(windowStart);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          activityData.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 });
        }

        const prevStart = new Date(windowStart.getTime() - days * 24 * 60 * 60 * 1000);
        const { count: prevCount } = await supabase
          .from('battles')
          .select('id', { count: 'exact', head: true })
          .eq('streamer_id', streamerId)
          .gte('completed_at', prevStart.toISOString())
          .lte('completed_at', windowStart.toISOString())
          .not('completed_at', 'is', null);

        return { total_battles: battleRows?.length || 0, prev_total: prevCount || 0, activity_data: activityData };
      };

      const internalGetRevenue = async (supabase: any, streamerId: string, days: number, windowStart: Date, windowEnd: Date) => {
        const { data: revRows } = await supabase
          .from('streamer_activity_logs')
          .select('created_at, metadata')
          .eq('streamer_id', streamerId)
          .eq('category', 'revenue')
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString());

        const dailyMap = new Map<string, number>();
        let totalCents = 0;
        for (const r of revRows || []) {
          const d = String(r.created_at).split('T')[0];
          const cents = Number(r.metadata?.amount_cents ?? 0);
          dailyMap.set(d, (dailyMap.get(d) || 0) + cents);
          totalCents += cents;
        }

        const activityData: any[] = [];
        for (let i = 0; i < days; i++) {
          const date = new Date(windowStart);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          activityData.push({ date: dateStr, amount_cents: dailyMap.get(dateStr) || 0 });
        }

        const prevStart = new Date(windowStart.getTime() - days * 24 * 60 * 60 * 1000);
        const { data: prevRows } = await supabase
          .from('streamer_activity_logs')
          .select('metadata')
          .eq('streamer_id', streamerId)
          .eq('category', 'revenue')
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', windowStart.toISOString());
        const prevCents = (prevRows || []).reduce((sum: number, r: any) => sum + Number(r.metadata?.amount_cents ?? 0), 0);

        return { total_cents: totalCents, prev_cents: prevCents, activity_data: activityData };
      };

      const internalGetCollectors = async (supabase: any, streamerId: string, days: number, full: boolean) => {
        const { data: userCardIds } = await supabase
          .from('user_cards')
          .select('twitch_id, card_id')
          .eq('streamer_id', streamerId);

        const stats: Record<string, any> = {};
        userCardIds?.forEach((uc: any) => {
          const tid = uc.twitch_id;
          if (!stats[tid]) {
            stats[tid] = { twitch_id: tid, total_cards: 0, unique_cards: new Set() };
          }
          stats[tid].total_cards++;
          stats[tid].unique_cards.add(uc.card_id);
        });

        const collectorsArray = Object.values(stats).map((s: any) => ({
          twitch_id: s.twitch_id,
          total_cards: s.total_cards,
          unique_cards: s.unique_cards.size
        }));

        collectorsArray.sort((a, b) => b.total_cards - a.total_cards);
        const topList = collectorsArray.slice(0, full ? 2000 : 100);

        const topTids = topList.map(c => c.twitch_id);
        const { data: userDetails } = await supabase
          .from('users')
          .select('twitch_id, username, avatar_url, trade_code')
          .in('twitch_id', topTids);

        const userMap = new Map((userDetails || []).map((u: any) => [String(u.twitch_id), u]));

        const finalCollectors = topList.map(s => {
          const u = userMap.get(String(s.twitch_id));
          return {
            ...s,
            username: u?.username || 'Unknown',
            avatar_url: u?.avatar_url || null,
            trade_code: u?.trade_code || null
          };
        });

        return {
          top_collectors: finalCollectors,
          all_collectors: full ? finalCollectors : []
        };
      };

      // Creator: Combined Analytics Batch (no Redis/KV cache — dashboard must reflect recent grants/opens)
      if (method === 'GET' && path === '/api/creator/analytics/combined') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const rawDays = url.searchParams.get('days') || '30';
          const days = rawDays === 'all' ? 3650 : Math.max(1, parseInt(rawDays, 10) || 30);
          const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
          // windowEnd = end of the requested period; windowStart = beginning of it
          const windowEnd   = new Date(Date.now() - offset * days * 24 * 60 * 60 * 1000);
          const windowStart = new Date(windowEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
          const [overview, cards, packs, collectors, battles, revenue] = await Promise.all([
            internalGetOverview(supabase, streamer.id, days, windowStart, windowEnd),
            internalGetCards(supabase, streamer.id, days, windowStart, windowEnd),
            internalGetPacks(supabase, streamer.id, days, windowStart, windowEnd),
            internalGetCollectors(supabase, streamer.id, days, false),
            internalGetBattles(supabase, streamer.id, days, windowStart, windowEnd),
            internalGetRevenue(supabase, streamer.id, days, windowStart, windowEnd),
          ]);
          return secureResponse({ overview, cards, packs, collectors, battles, revenue }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Analytics Overview
      if (method === 'GET' && path === '/api/creator/analytics/overview') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');
          const cacheKey = `cache:v1:analytics:overview:${streamer.id}:${days}`;
          const overview = await fetchWithCache(env, sharedRedis, cacheKey, CACHE_TTL_ANALYTICS_SEC, () => internalGetOverview(supabase, streamer.id, days), ctx);
          return secureResponse(overview, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Card Analytics
      if (method === 'GET' && path === '/api/creator/analytics/cards') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');
          const cacheKey = `cache:v1:analytics:cards:${streamer.id}:${days}`;
          const cardAnalytics = await fetchWithCache(env, sharedRedis, cacheKey, CACHE_TTL_ANALYTICS_SEC, () => internalGetCards(supabase, streamer.id, days), ctx);
          return secureResponse(cardAnalytics, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Collector Analytics
      if (method === 'GET' && path === '/api/creator/analytics/collectors') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');
          const includeFullList = url.searchParams.get('full') === '1';
          const cacheKey = `cache:v1:analytics:collectors:${streamer.id}:${includeFullList}`;
          const collectorAnalytics = await fetchWithCache(env, sharedRedis, cacheKey, CACHE_TTL_ANALYTICS_SEC, () => internalGetCollectors(supabase, streamer.id, days, includeFullList), ctx);
          return secureResponse(collectorAnalytics, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Get Pack Analytics
      if (method === 'GET' && path === '/api/creator/analytics/packs') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const days = parseInt(url.searchParams.get('days') || '30');
          const cacheKey = `cache:v1:analytics:packs:${streamer.id}:${days}`;
          const packAnalytics = await fetchWithCache(env, sharedRedis, cacheKey, CACHE_TTL_ANALYTICS_SEC, () => internalGetPacks(supabase, streamer.id, days), ctx);
          return secureResponse(packAnalytics, 200, corsHeaders);
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
          return secureResponse({ valid: false, error: 'Authorization error' }, 400, corsHeaders);
        }
      }

      // Creator: Regenerate OBS Overlay Token (security fix #7 — rotates static token)
      if (method === 'POST' && path === '/api/creator/regenerate-obs-token') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const newToken = crypto.randomUUID();
          const { error } = await supabase
            .from('streamers')
            .update({ obs_overlay_token: newToken })
            .eq('id', streamer.id);
          if (error) throw error;
          return secureResponse({ obs_overlay_token: newToken }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse('Failed to regenerate token', 500, corsHeaders, true);
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);

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

      // Creator: EventSub — which types are enabled for this channel (Helix, app token)
      if (method === 'GET' && path === '/api/creator/eventsub/status') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const appToken = await getTwitchAppAccessToken(env);
          if (!appToken) {
            return secureResponse({ error: 'Could not obtain Twitch app token' }, 500, corsHeaders, true);
          }
          const all = await helixListAllEventSubSubscriptions(env, appToken);
          const bid = String(streamer.twitch_id);
          const callbackHint = `${new URL(request.url).origin}/api/twitch/webhook`;
          const relevant = all.filter(
            (s: any) => String(s.condition?.broadcaster_user_id) === bid && s.status === 'enabled'
          );
          const byType: Record<string, string> = {};
          for (const s of relevant) {
            byType[s.type] = s.status;
          }
          const missing = EVENTSUB_WEBHOOK_TYPES.filter(
            (t) => !eventSubAlreadyEnabled(all, t.type, t.version, bid, callbackHint)
          ).map((m) => m.type);

          return secureResponse(
            {
              broadcaster_user_id: bid,
              callback_example: callbackHint,
              enabled_for_channel: relevant.length,
              types_present: Object.keys(byType),
              types_missing: missing,
            },
            200,
            corsHeaders
          );
        } catch (e: any) {
          return secureResponse({ error: e.message }, 400, corsHeaders, true);
        }
      }

      // Creator: EventSub — register webhook subscriptions with Twitch (Helix)
      if (method === 'POST' && path === '/api/creator/eventsub/reconnect') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);

          let body: any = {};
          try {
            const ct = request.headers.get('Content-Type') || '';
            if (ct.includes('application/json')) body = await request.json();
          } catch {
            /* ignore */
          }

          const requestOrigin = new URL(request.url).origin;
          const callbackBase =
            (typeof body.callback_base === 'string' && body.callback_base.trim()) || requestOrigin;
          const normalizedBase = normalizeWebhookCallbackUrl(callbackBase.trim());

          const es = await ensureEventSubSubscriptionsForBroadcaster(env, {
            broadcasterTwitchId: String(streamer.twitch_id),
            callbackOrigin: normalizedBase,
          });

          if (es.skippedReason === 'bad_webhook_secret') {
            return secureResponse(
              {
                error:
                  'TWITCH_WEBHOOK_SECRET must be set on the Worker (10–100 characters). It is used as the EventSub transport secret and for webhook signature verification.',
              },
              400,
              corsHeaders,
              true
            );
          }
          if (es.skippedReason === 'no_app_token') {
            return secureResponse(
              { error: 'Could not obtain Twitch app token — check TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET' },
              500,
              corsHeaders,
              true
            );
          }

          await logSystem(
            supabase,
            es.errors.length ? 'warn' : 'info',
            'webhook',
            `EventSub reconnect: created ${es.created.length}, skipped ${es.skipped.length}, errors ${es.errors.length}`,
            streamer.id,
            { created: es.created, skipped: es.skipped, errors: es.errors, callbackUrl: es.callbackUrl }
          );

          return secureResponse(
            {
              success: es.errors.length === 0,
              callback: es.callbackUrl,
              created: es.created,
              skipped: es.skipped,
              errors: es.errors,
              hint:
                es.created.length === 0 && es.skipped.length === EVENTSUB_WEBHOOK_TYPES.length
                  ? 'All subscription types were already registered for this callback URL.'
                  : undefined,
            },
            200,
            corsHeaders
          );
        } catch (e: any) {
          return secureResponse({ error: e.message || 'EventSub reconnect failed' }, 400, corsHeaders, true);
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const b = await request.json() as any;

          // Store automation settings (would be in a separate table or JSON column)
          await logSystem(supabase, 'info', 'system', `Automation settings updated for ${streamer.username}`, streamer.id);

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ error: e.message }, 400, corsHeaders);
        }
      }

      // Creator: Save Milestone Reward
      if (method === 'POST' && path === '/api/creator/automation/milestone') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

      // Creator: Assign card to set (must come before other card operations)
      if (method === 'POST' && path.startsWith('/api/creator/cards/') && path.endsWith('/assign-set')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

      // Creator: Activity log (list) — source: streamer_activity_logs (see migration 036)
      if (method === 'GET' && path === '/api/creator/events') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const search = (url.searchParams.get('search') || '').trim().toLowerCase();
          const category = url.searchParams.get('category') || 'all';

          let q = supabase
            .from('streamer_activity_logs')
            .select('id, streamer_id, level, category, message, metadata, created_at')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false })
            .limit(400);

          if (category && category !== 'all') {
            q = q.eq('category', category);
          }

          const { data, error } = await q;
          if (error) throw error;

          let rows: any[] = data || [];
          if (search) {
            rows = rows.filter(
              (r: any) =>
                (r.message && String(r.message).toLowerCase().includes(search)) ||
                (r.metadata && JSON.stringify(r.metadata).toLowerCase().includes(search))
            );
          }

          return secureResponse(rows, 200, corsHeaders);
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (msg.includes('relation') && msg.includes('does not exist')) {
            return secureResponse([], 200, corsHeaders);
          }
          return secureResponse(msg, 400, corsHeaders, true);
        }
      }

      // Creator: Trigger Special Event (Rarity Boost)
      if (method === 'POST' && path === '/api/creator/events') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

      // Creator: Get Active Event (optional UI — query errors → null, not 4xx; matches /api/creator/profile auth)
      if (method === 'GET' && path === '/api/creator/events/active') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const now = new Date().toISOString();
          const { data: rows, error } = await supabase
            .from('streamer_events')
            .select('*')
            .eq('streamer_id', streamer.id)
            .eq('is_active', true)
            .lte('starts_at', now)
            .gte('ends_at', now)
            .order('ends_at', { ascending: false })
            .limit(1);
          if (error) {
            console.error('[events/active] streamer_events query:', error.message || error);
            return secureResponse(null, 200, corsHeaders);
          }
          const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          return secureResponse(row, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      if (method === 'PUT' && path.startsWith('/api/creator/cards/')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const cardId = path.split('/').pop();
          const b = await request.json() as any;

          // Verify ownership and get current URLs for optional R2 cleanup
          const { data: existingCard, error: checkErr } = await supabase
            .from('cards')
            .select('id, streamer_id, image_url, foil_mask_url')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingCard) {
            return secureResponse('Card not found or access denied', 404, corsHeaders, true);
          }

          if (b.image_url) {
            await deleteReplacedCdnObject(env, existingCard.image_url, b.image_url);
          }
          if ('foil_mask_url' in b) {
            await deleteReplacedCdnObject(env, existingCard.foil_mask_url, b.foil_mask_url ?? '');
          }

          const updateData: any = {};
          if (b.name) updateData.name = b.name;
          if (b.rarity) updateData.rarity = b.rarity;
          if (b.description !== undefined) updateData.description = b.description;
          if (b.attack !== undefined) updateData.attack = b.attack;
          if (b.defense !== undefined) updateData.defense = b.defense;
          if (b.image_url) updateData.image_url = b.image_url;
          if ('foil_mask_url' in b) updateData.foil_mask_url = b.foil_mask_url ?? null;
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

      // Creator: Save layer data only (draft auto-save, no image re-upload)
      if (method === 'PATCH' && path.startsWith('/api/creator/cards/') && path.endsWith('/draft')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const cardId = path.split('/').slice(-2, -1)[0]; // /api/creator/cards/:id/draft
          const b = await request.json() as any;

          const { data: existingCard, error: checkErr } = await supabase
            .from('cards')
            .select('id, streamer_id')
            .eq('id', cardId)
            .eq('streamer_id', streamer.id)
            .single();

          if (checkErr || !existingCard) {
            return secureResponse('Card not found or access denied', 404, corsHeaders, true);
          }

          const { error: updateErr } = await supabase
            .from('cards')
            .update({ layer_data: b.layer_data ?? null })
            .eq('id', cardId);

          if (updateErr) throw updateErr;
          return secureResponse({ ok: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Remove image background via Cloudflare AI
      if (method === 'POST' && path === '/api/creator/remove-bg') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          if (!env.AI) return secureResponse('AI binding not configured', 503, corsHeaders, true);

          const { image_url } = await request.json() as { image_url: string };
          if (!image_url) return secureResponse('image_url required', 400, corsHeaders, true);

          // Fetch the source image through our proxy to avoid CORS/auth issues
          const imgRes = await fetch(`${new URL(request.url).origin}/api/img-proxy?url=${encodeURIComponent(image_url)}`, {
            headers: { cookie: request.headers.get('cookie') || '' }
          });
          if (!imgRes.ok) throw new Error('Failed to fetch source image');
          const imgBuffer = await imgRes.arrayBuffer();

          // Run background removal
          const result = await env.AI.run('@cf/bria-ai/rmbg-1.4', {
            image: [...new Uint8Array(imgBuffer)],
          }) as { image: number[] };

          if (!result?.image) throw new Error('AI returned no result');

          const outputBuffer = new Uint8Array(result.image).buffer;
          const filePath = `card_images/${streamer.id}/${Date.now()}-rmbg.png`;
          await env.CARD_IMAGES.put(filePath, outputBuffer, {
            httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' }
          });

          const publicUrl = creatorCdnPublicUrl(env, filePath);
          return secureResponse({ url: publicUrl }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Background removal failed', 500, corsHeaders, true);
        }
      }

      // Creator: Delete own card
      if (method === 'DELETE' && path.startsWith('/api/creator/cards/') && !path.endsWith('/assign-set')) {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

          await deleteReplacedCdnObject(env, existingCard.image_url, '');

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

      // Creator: Grant card to user (optional quantity for overlay / queue stress testing)
      if (method === 'POST' && path === '/api/creator/grant') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const b = await request.json() as any;
          const castleRaw = String(b.castle_code || '').trim();
          let recipientTwitchId = String(b.twitch_id || '').trim();
          let recipientUsernameDefault = String(b.username || '').trim() || 'System Grant';

          if (castleRaw) {
            const resolved = await resolveUserByCastleCodeOrUsername(supabase, castleRaw);
            recipientTwitchId = resolved.twitch_id;
            recipientUsernameDefault = resolved.username;
          } else if (!recipientTwitchId) {
            const fallback = String(b.username || b.recipient || '').trim();
            if (!fallback) throw new Error('Missing recipient — pick a member, username, or Castle code');
            const resolved = await resolveUserByCastleCodeOrUsername(supabase, fallback);
            recipientTwitchId = resolved.twitch_id;
            recipientUsernameDefault = resolved.username;
          }
          if (!recipientTwitchId) throw new Error('Missing recipient — pick a member, username, or Castle code');
          if (!b.card_id && !b.random_rarity) throw new Error('Missing card_id or random_rarity');

          const isRandom = b.card_id === 'random';
          const forcedCardId = isRandom ? undefined : b.card_id;
          const forcedRarity = isRandom ? b.random_rarity : undefined;

          let qty = 1;
          if (b.quantity !== undefined && b.quantity !== null && b.quantity !== '') {
            const n = parseInt(String(b.quantity), 10);
            if (Number.isFinite(n) && n >= 1) qty = Math.min(n, 200);
          }

          let granted = 0;
          let lastResult: GrantActivitySummary | null = null;
          let lastStopReason: string | undefined;

          // quantity > 1: shared batch path (same as Twitch mass gift — low subrequest count).
          if (qty > 1) {
            const silent = !!b.is_silent;
            const res = await bulkGrantRandomCardsToTwitchUser(
              supabase,
              env,
              streamer.id,
              recipientTwitchId,
              recipientUsernameDefault,
              qty,
              {
                forcedCardId,
                forcedRarity,
                isObsConsumedForIndex: () => silent,
              }
            );
            granted = res.granted;
            lastResult = res.lastResult;
          } else {
            const grantOpts: GrantRandomCardOptions = {
              forcedCardId,
              forcedRarity,
              isSilent: b.is_silent,
              skipAchievementCheck: false,
              skipRedisForGrantPool: false,
              grantPoolRequestCache: undefined,
            };
            const grantDiagnostic: { failReason?: string } = {};
            const grantResult = await grantRandomCard(
              supabase,
              recipientTwitchId,
              recipientUsernameDefault,
              streamer.id,
              null,
              env,
              { ...grantOpts, grantDiagnostic }
            );
            if (!grantResult) {
              lastStopReason = grantDiagnostic.failReason;
              throw new Error(
                lastStopReason ||
                  'Grant failed — no card was awarded. Check active sets, card pool, and that the viewer is not blocked.'
              );
            }
            granted = 1;
            lastResult = grantResult;
          }

          const recipientUsername = lastResult?.recipient_username || recipientUsernameDefault || 'Unknown';
          if (granted === 1 && lastResult) {
            await logSystem(
              supabase,
              'info',
              'grant',
              `"${lastResult.card_name}" → ${recipientUsername} · Dashboard`,
              streamer.id,
              {
                card_id: lastResult.card_id,
                card_name: lastResult.card_name,
                rarity: lastResult.rarity,
                recipient_twitch_id: lastResult.recipient_twitch_id,
                recipient_username: recipientUsername,
                platform: 'dashboard',
              }
            );
          } else if (granted > 1 && lastResult) {
            await logSystem(
              supabase,
              'info',
              'grant',
              `Bulk grant ×${granted} → ${recipientUsername} · Dashboard`,
              streamer.id,
              {
                quantity: granted,
                bulk_grant: true,
                recipient_twitch_id: lastResult.recipient_twitch_id,
                recipient_username: recipientUsername,
                platform: 'dashboard',
                last_card_id: lastResult.card_id,
                last_card_name: lastResult.card_name,
              }
            );
          }

          return secureResponse(
            {
              success: true,
              granted,
              requested: qty,
              partial: granted < qty,
              ...(granted < qty && lastStopReason ? { stop_reason: lastStopReason } : {})
            },
            200,
            corsHeaders
          );
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
      }

      // Creator: Create/Update own set
      if (method === 'POST' && path === '/api/creator/sets') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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
          if (b.pack_image_url !== undefined) setData.pack_image_url = b.pack_image_url;
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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
          if (b.pack_image_url !== undefined) updateData.pack_image_url = b.pack_image_url;
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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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

          const cardIds = setCards?.map((c: any) => c.id) || [];
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
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canReadPlatformAdminViews(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
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
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
          const cardId = url.searchParams.get('card_id');
          if (!cardId) throw new Error("Missing card_id");

          // IDOR fix: combine ownership check into DELETE — platform admins can delete any card
          let deleteQuery = supabase.from('cards').delete().eq('id', cardId);
          if (!isPlatformAdmin && !canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && streamer) {
            deleteQuery = deleteQuery.eq('streamer_id', streamer.id);
          }

          const { error, count } = await deleteQuery;
          if (error) throw error;
          if (count === 0) return new Response(JSON.stringify({ error: 'Card not found or not authorized' }), { status: 404, headers: corsHeaders });

          // Invalidate card pool cache for this streamer
          try {
            const adminRedis = getRedis(env);
            if (adminRedis && streamer) {
              const rarities = ['common', 'rare', 'epic', 'legendary'];
              await Promise.all(rarities.map(r => adminRedis.del(`cache_cards_pool:${streamer.id}:${r}`)));
            }
          } catch { /* Non-critical */ }

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 401, headers: corsHeaders });
        }
      }

      // 9. Admin Stats
      if (method === 'GET' && path === '/api/admin/stats') {
        try {
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canReadPlatformAdminViews(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }

          const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { count: cardCount } = await supabase.from('user_cards').select('*', { count: 'exact', head: true });
          const { count: uniqueCount } = await supabase.from('cards').select('*', { count: 'exact', head: true });

          const { data: legendaryCards } = await supabase.from('cards').select('id').eq('rarity', 'Legendary');
          const legendaryIds = legendaryCards?.map((c: any) => c.id) || [];
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

      // Public: sets for progress / binder UI — pass ?streamer=username (or streamer_id) to scope to one creator
      // Public catalog: all cards for a streamer, with set info merged in.
      // Used by the /[username] creator collection page. Edge-cached for 5 min.
      if (method === 'GET' && path === '/api/public/catalog') {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

          const [{ data: cardsData, error: cardsErr }, { data: setsData }] = await Promise.all([
            supabase
              .from('cards')
              .select('id, name, image_url, rarity, type, description, card_number, set_id')
              .eq('streamer_id', streamer.id)
              .order('rarity', { ascending: false })
              .order('card_number', { ascending: true, nullsFirst: false }),
            supabase
              .from('streamer_sets')
              .select('id, name, code, image_url, release_date')
              .eq('streamer_id', streamer.id),
          ]);

          if (cardsErr) throw cardsErr;

          const setMap: Record<string, any> = {};
          (setsData || []).forEach((s: any) => { setMap[s.id] = s; });

          const mapped = (cardsData || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            image_url: c.image_url,
            rarity: c.rarity,
            type: c.type,
            description: c.description,
            card_number: c.card_number,
            set_id: c.set_id,
            set_name: setMap[c.set_id]?.name || null,
            set_code: setMap[c.set_id]?.code || null,
            set_image_url: setMap[c.set_id]?.image_url || null,
          }));

          const response = secureResponse(mapped, 200, corsHeaders);
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // Public streamer info — used by the /{username} collection page.
      // Returns only non-sensitive, public-facing fields.  Edge-cached 5 min.
      if (method === 'GET' && path === '/api/public/streamer') {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

          const pub = {
            id:                   streamer.id,
            username:             streamer.username,
            display_name:         (streamer as any).display_name   ?? null,
            brand_name:           (streamer as any).brand_name      ?? null,
            brand_tagline:        (streamer as any).brand_tagline   ?? null,
            brand_emoji:          (streamer as any).brand_emoji     ?? null,
            brand_color_primary:  (streamer as any).brand_color_primary   ?? null,
            brand_color_secondary:(streamer as any).brand_color_secondary ?? null,
            avatar_url:           (streamer as any).avatar_url      ?? null,
            is_live:              (streamer as any).is_live         ?? false,
            kick_username:        (streamer as any).kick_username   ?? null,
            twitter:              (streamer as any).twitter         ?? null,
            youtube:              (streamer as any).youtube         ?? null,
            discord:              (streamer as any).discord         ?? null,
            pack_image_url:       (streamer as any).pack_image_url  ?? null,
          };

          const response = secureResponse(pub, 200, corsHeaders);
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // ── Pack opening: list pending sessions ───────────────────────────────
      if (method === 'GET' && path === '/api/packs/pending') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse({ error: 'unauthorized' }, 401, corsHeaders, true);

          // Temporary debug instrumentation for pack pending visibility.
          let supabaseKeyRole = 'unknown';
          try {
            const payloadB64 = String(env.SUPABASE_SERVICE_KEY || '').split('.')[1] || '';
            const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
            supabaseKeyRole = JSON.parse(atob(normalized)).role || 'unknown';
          } catch (_) {}

          const { data, error } = await supabase
            .from('pack_sessions')
            .select('id, streamer_id, user_card_ids, source, created_at')
            .eq('twitch_id', sessionUser.twitch_id)
            .is('opened_at', null)
            .order('created_at', { ascending: true });

          if (error) {
            return secureResponse({
              __debug: true,
              twitch_id_used: sessionUser.twitch_id,
              supabase_key_role: supabaseKeyRole,
              error: error.message,
              code: (error as any).code,
            }, 200, corsHeaders);
          }
          if (url.searchParams.get('debug') === '1') {
            return secureResponse({
              __debug: true,
              twitch_id_used: sessionUser.twitch_id,
              supabase_key_role: supabaseKeyRole,
              count: data?.length ?? 0,
              packs: data ?? [],
            }, 200, corsHeaders);
          }
          return secureResponse(data ?? [], 200, corsHeaders);
        } catch (e: any) {
          return secureResponse({ __debug: true, exception: e?.message }, 200, corsHeaders);
        }
      }

      // ── Pack opening: mark session opened + return card data ──────────────
      if (method === 'POST' && /^\/api\/packs\/([^/]+)\/open$/.test(path)) {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse({ error: 'unauthorized' }, 401, corsHeaders, true);

          const packId = path.split('/')[3];

          // Fetch the session (must belong to this viewer and be unopened)
          const { data: pack, error: packErr } = await supabase
            .from('pack_sessions')
            .select('id, twitch_id, user_card_ids, streamer_id, source')
            .eq('id', packId)
            .eq('twitch_id', sessionUser.twitch_id)
            .is('opened_at', null)
            .maybeSingle();

          if (packErr) {
            console.warn('[Packs] open query error', {
              pack_id: packId,
              twitch_id: sessionUser.twitch_id,
              code: (packErr as any).code || null,
              message: (packErr as any).message || null,
              details: (packErr as any).details || null,
              hint: (packErr as any).hint || null,
            });
            return secureResponse({ error: packErr.message }, 500, corsHeaders, true);
          }
          console.log('[Packs] open query result', {
            pack_id: packId,
            twitch_id: sessionUser.twitch_id,
            found: !!pack,
          });
          if (!pack) return secureResponse({ error: 'Pack not found or already opened' }, 404, corsHeaders, true);

          // Fetch full card data for the reveal via enriched view
          const { data: cardRows, error: cardErr } = await supabase
            .from('enriched_user_cards')
            .select('user_card_id, card_id, name, rarity, type, image_url, baked_image_url, set_name, trait_list, mechanic_name, mechanic_display_name, genesis_mechanic_name, genesis_mechanic_display_name, is_obs_consumed')
            .in('user_card_id', pack.user_card_ids);

          if (cardErr) return secureResponse({ error: cardErr.message }, 500, corsHeaders, true);

          // Mark as opened
          await supabase
            .from('pack_sessions')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', packId);

          // Fetch streamer config for pack art
          const { data: streamerRow } = await supabase
            .from('streamers')
            .select('pack_image_url, pack_open_sound_url, pack_foil_color, brand_name, brand_color_primary')
            .eq('id', pack.streamer_id)
            .maybeSingle();

          return secureResponse({
            pack_id: packId,
            source: pack.source,
            streamer: streamerRow ?? {},
            cards: (cardRows ?? []).map((uc: any) => ({
              user_card_id: uc.user_card_id,
              id: uc.card_id,
              name: uc.name,
              rarity: uc.rarity,
              type: uc.type,
              image_url: uc.image_url,
              baked_image_url: uc.baked_image_url,
              set_name: uc.set_name,
              trait_list: uc.trait_list,
              mechanic_name: uc.mechanic_name,
              mechanic_display_name: uc.mechanic_display_name,
              genesis_mechanic_name: uc.genesis_mechanic_name,
              genesis_mechanic_display_name: uc.genesis_mechanic_display_name,
            })),
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 500, corsHeaders, true);
        }
      }

      // ── Viewer collection hub ─────────────────────────────────────────────
      if (method === 'GET' && path === '/api/my-collections') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse({ error: 'unauthorized' }, 401, corsHeaders, true);

          const [{ data, error }, { data: favorites }] = await Promise.all([
            supabase.rpc('get_my_collections', {
              p_twitch_id: sessionUser.twitch_id,
            }),
            supabase
              .from('user_favorites')
              .select('streamer_id')
              .eq('user_id', sessionUser.twitch_id),
          ]);
          if (error) {
            console.error('[MyCollections] RPC error:', error.message);
            return secureResponse({ error: error.message }, 500, corsHeaders, true);
          }
          const favoriteSet = new Set((favorites || []).map((f: any) => String(f.streamer_id || '').toLowerCase()));
          const enriched = (Array.isArray(data) ? data : []).map((row: any) => ({
            ...row,
            is_favorited: favoriteSet.has(String(row.streamer_id || '').toLowerCase()),
          }));
          return secureResponse(enriched, 200, corsHeaders);
        } catch (e: any) {
          console.error('[MyCollections] Exception:', e);
          return secureResponse({ error: e.message }, 500, corsHeaders, true);
        }
      }

      if (method === 'GET' && path === '/api/my-collections/discover') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse({ error: 'unauthorized' }, 401, corsHeaders, true);

          const { data: dbUser } = await supabase
            .from('users')
            .select('twitch_access_token_encrypted')
            .eq('twitch_id', sessionUser.twitch_id)
            .maybeSingle();

          if (!dbUser?.twitch_access_token_encrypted) return secureResponse([], 200, corsHeaders);

          let accessToken = '';
          try {
            accessToken = await decryptSensitive(dbUser.twitch_access_token_encrypted, twitchTokenEncryptSecret(env));
          } catch {
            return secureResponse([], 200, corsHeaders);
          }

          const followsRes = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${sessionUser.twitch_id}&first=100`, {
            headers: {
              'Client-ID': env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`
            }
          });
          if (!followsRes.ok) return secureResponse([], 200, corsHeaders);
          const followsData: any = await followsRes.json().catch(() => ({ data: [] }));
          const followedIds = Array.isArray(followsData?.data) ? followsData.data.map((f: any) => String(f.broadcaster_id)) : [];
          if (!followedIds.length) return secureResponse([], 200, corsHeaders);

          const [{ data: mine }, { data: streamers }, { data: favorites }] = await Promise.all([
            supabase.rpc('get_my_collections', { p_twitch_id: sessionUser.twitch_id }),
            supabase
              .from('streamers')
              .select('id, username, brand_name, brand_color_primary, avatar_url, pack_image_url, kick_username, twitch_id')
              .in('twitch_id', followedIds)
              .eq('is_active', true),
            supabase
              .from('user_favorites')
              .select('streamer_id')
              .eq('user_id', sessionUser.twitch_id),
          ]);

          const ownedSet = new Set((Array.isArray(mine) ? mine : []).map((r: any) => String(r.streamer_id || '').toLowerCase()));
          const favSet = new Set((favorites || []).map((f: any) => String(f.streamer_id || '').toLowerCase()));
          const discover = (streamers || [])
            .filter((s: any) => !ownedSet.has(String(s.id || '').toLowerCase()))
            .map((s: any) => ({
              streamer_id: s.id,
              streamer_username: s.username,
              brand_name: s.brand_name || s.username,
              brand_color_primary: s.brand_color_primary,
              avatar_url: s.avatar_url,
              pack_image_url: s.pack_image_url,
              card_count: 0,
              preview_images: [],
              is_favorited: favSet.has(String(s.id || '').toLowerCase()),
              source: s.kick_username ? 'twitch-follow+kick' : 'twitch-follow',
            }));

          return secureResponse(discover, 200, corsHeaders);
        } catch (e: any) {
          console.error('[MyCollections/Discover] Exception:', e);
          return secureResponse({ error: e.message }, 500, corsHeaders, true);
        }
      }

      if (method === 'GET' && path === '/api/my-collections/mutuals') {
        try {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) return secureResponse({ error: 'unauthorized' }, 401, corsHeaders, true);

          const [{ data, error }, { data: favorites }] = await Promise.all([
            supabase.rpc('get_mutual_recommendations', {
              p_twitch_id: sessionUser.twitch_id,
            }),
            supabase
              .from('user_favorites')
              .select('streamer_id')
              .eq('user_id', sessionUser.twitch_id),
          ]);
          if (error) {
            console.error('[MyCollections/Mutuals] RPC error:', error.message);
            return secureResponse([], 200, corsHeaders);
          }
          const favoriteSet = new Set((favorites || []).map((f: any) => String(f.streamer_id || '').toLowerCase()));
          const enriched = (Array.isArray(data) ? data : []).map((row: any) => ({
            ...row,
            is_favorited: favoriteSet.has(String(row.streamer_id || '').toLowerCase()),
          }));
          return secureResponse(enriched, 200, corsHeaders);
        } catch (e: any) {
          console.error('[MyCollections/Mutuals] Exception:', e);
          return secureResponse([], 200, corsHeaders);
        }
      }

      if (method === 'GET' && path === '/api/sets') {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          let q = supabase.from('streamer_sets').select('*').order('release_date', { ascending: false });
          if (streamer?.id) {
            q = q.eq('streamer_id', streamer.id);
          }
          const { data, error } = await q;

          if (error) throw error;
          return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 500, headers: corsHeaders });
        }
      }

      // Get all sets
      if (method === 'GET' && path === '/api/admin/sets') {
        try {
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canReadPlatformAdminViews(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
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
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
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
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
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
          const { isPlatformAdmin, streamer, staffRole } = await checkAdmin(request);
          if (!canWritePlatformCardCatalog(isPlatformAdmin, staffRole) && !streamer) {
            throw new Error('Unauthorized');
          }
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
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error('Unauthorized: Platform Admin required');
          const { error } = await supabase.from('user_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: ((e as any).message || String(e)) }), { status: 401, headers: corsHeaders });
        }
      }

      if (method === 'DELETE' && path === '/api/admin/bulk/delete-all-trades') {
        try {
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error('Unauthorized: Platform Admin required');
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
          const { isPlatformAdmin } = await checkAdmin(request);
          if (!isPlatformAdmin) throw new Error('Unauthorized: Platform Admin required');

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
            'brand_name', 'brand_tagline', 'pack_image_url', 'pack_design_url', 'pack_foil_color', 'card_back_url',
            'pack_open_sound_url', 'twitch_client_secret', 'streamelements_jwt',
            'twitch_reward_id', 'twitch_battle_reward_id'
          ];

          const updates: any = {};
          for (const field of allowedFields) {
            if (body[field] !== undefined) {
              if (['twitch_client_secret', 'streamelements_jwt'].includes(field) && body[field]) {
                updates[field] = await encryptSensitive(body[field], env.ENCRYPTION_SECRET ?? env.SESSION_SECRET);
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
          if (sharedRedis) await bustStreamersPublicCache(sharedRedis, streamer);

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
          const { streamer, teamRole } = await checkCreator(request, supabase);
          // Owner + editors + moderators (mods: pack editor / pack art; cannot reach card APIs without editor role)
          if (teamRole !== 'moderator') {
            assertTeamCanEditCatalog(teamRole);
          }
          const formData = await request.formData();
          const file = formData.get('file') as File;
          const purpose = String(formData.get('purpose') || '').trim();
          const isTwitchRewardIcon = purpose === 'twitch_reward_icon';

          if (!file) return secureResponse('No file uploaded', 400, corsHeaders, true);

          if (file.size > CARD_IMAGE_MAX_BYTES) {
            return secureResponse(`File too large. Max ${CARD_IMAGE_MAX_BYTES / (1024 * 1024)}MB.`, 413, corsHeaders, true);
          }

          const nameLower = (file.name || '').toLowerCase();
          const ctLower = (file.type || '').toLowerCase();
          let ext: string;
          let contentType: string;
          if (isTwitchRewardIcon) {
            const isJpeg =
              ctLower === 'image/jpeg' ||
              ctLower === 'image/jpg' ||
              nameLower.endsWith('.jpg') ||
              nameLower.endsWith('.jpeg');
            const isPng = ctLower === 'image/png' || nameLower.endsWith('.png');
            if (!isJpeg && !isPng) {
              return secureResponse(
                'Twitch reward icon must be PNG or JPEG (WebP is not stored for this upload).',
                400,
                corsHeaders,
                true
              );
            }
            ext = isJpeg ? '.jpg' : '.png';
            contentType = isJpeg ? 'image/jpeg' : 'image/png';
          } else {
            ext = file.type === 'image/webp' ? '.webp' : (file.name.match(/\.[^/.]+$/) || ['.png'])[0];
            contentType = file.type || 'image/webp';
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `card_images/${streamer.id}/${Date.now()}-${baseName}${ext}`;
          const filePath = `${fileName}`;

          await env.CARD_IMAGES.put(filePath, await file.arrayBuffer(), {
            httpMetadata: {
              contentType,
              cacheControl: 'public, max-age=31536000, immutable'
            }
          });

          const publicUrl = creatorCdnPublicUrl(env, filePath);

          return secureResponse({ success: true, url: publicUrl }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Upload failed', 500, corsHeaders, true);
        }
      }

      // 6.9 Creator: Onboarding Complete
      if (method === 'POST' && path === '/api/creator/onboarding/complete') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
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
              image_url: card.image_url || '',
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
        try {
          const streamers = await fetchWithCache(
            env,
            sharedRedis,
            CACHE_KEY_STREAMERS_ACTIVE,
            CACHE_TTL_STREAMERS_SEC,
            async () => {
              const { data, error: sErr } = await supabase
                .from('streamers')
                .select('id, username, display_name, avatar_url')
                .eq('is_active', true);
              if (sErr) throw sErr;
              return data || [];
            },
            ctx
          );
          return secureResponse(streamers, 200, corsHeaders, false, {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          });
        } catch (e: any) {
          return secureResponse(e?.message || 'Database error', 500, corsHeaders, true);
        }
      }

      // Get public config for a specific streamer
      if (method === 'GET' && path === '/api/streamer/config') {
        const streamerParam = url.searchParams.get('streamer');
        if (!streamerParam) return secureResponse('Missing streamer parameter', 400, corsHeaders, true);

        const cacheKey = `cache:v1:streamer:config:${String(streamerParam).trim().toLowerCase()}`;
        try {
          const cached = await fetchWithCache(
            env,
            sharedRedis,
            cacheKey,
            CACHE_TTL_STREAMER_CONFIG_SEC,
            async () => {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerParam);

              let query = supabase
                .from('streamers')
                .select(
                  'id, username, display_name, avatar_url, brand_name, brand_tagline, brand_logo_url, binder_color, social_links, pack_image_url, pack_design_url, card_back_url, pack_animation_style, pack_open_sound_url, pack_foil_color, stripe_connect_id'
                );
              if (isUuid) {
                query = query.or(`id.eq.${streamerParam},username.eq.${streamerParam}`);
              } else {
                query = query.ilike('username', String(streamerParam).trim());
              }

              const { data: streamer, error } = await query.maybeSingle();
              if (error) throw error;
              if (!streamer) return null;
              const pack_sales_enabled = !!streamer.stripe_connect_id;
              const { stripe_connect_id: _sid, ...publicStreamer } = streamer as any;
              return { ...publicStreamer, pack_sales_enabled };
            },
            ctx
          );
          if (!cached) return secureResponse('Streamer not found', 404, corsHeaders, true);
          return secureResponse(cached, 200, corsHeaders, false, {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300'
          });
        } catch (e: any) {
          return secureResponse(e?.message || 'Database error', 500, corsHeaders, true);
        }
      }


      // 1. Get Collection — ETag / 304 conditional GET
      // Full edge-cache is wrong (must reflect grants/trades immediately).
      // ETag-based conditional GET gives ~2ms 304s for repeat opens with no changes.
      if (method === 'GET' && path === '/api/collection') {
        const bootT0 = Date.now();
        const user = await getUserFromSession(request, env, supabase);
        const streamerParam = url.searchParams.get('streamer') || url.searchParams.get('streamer_id');

        if (!user) {
          return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }

        const targetTwitchId = user.twitch_id;
        const etagScope = streamerParam === 'all' ? 'all' : (streamerParam || 'default');
        const etagKvKey = `collection:etag:v1:${targetTwitchId}:${etagScope}`;

        // ETag conditional check — KV lookup only (~1ms), no Supabase if unchanged
        const storedEtag = await (env as any).KV_CACHE?.get(etagKvKey).catch(() => null);
        const clientEtag = request.headers.get('If-None-Match');
        if (storedEtag && clientEtag === storedEtag) {
          return new Response(null, {
            status: 304,
            headers: { ...corsHeaders, ETag: storedEtag, 'Cache-Control': 'private, no-store' },
          });
        }

        const limitRaw = url.searchParams.get('limit');
        let limit = COLLECTION_DEFAULT_LIMIT;
        if (limitRaw != null && limitRaw !== '') {
          const n = parseInt(limitRaw, 10);
          if (!Number.isNaN(n) && n > 0) limit = Math.min(n, COLLECTION_MAX_LIMIT);
        }

        let query = supabase
          .from('enriched_user_cards')
          .select(ENRICHED_USER_CARDS_COLLECTION_SELECT)
          .eq('twitch_id', targetTwitchId);

        if (streamerParam !== 'all') {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer context not found', 404, corsHeaders, true);
          query = query.eq('streamer_id', streamer.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

        if (error) {
          console.error('DB Error:', error.message);
          return secureResponse(error.message, 500, corsHeaders, true);
        }

        const responseData = data || [];

        // Compute and persist ETag: row count + latest created_at
        const newEtag = `"${responseData.length}-${responseData[0]?.created_at ?? '0'}"`;
        ctx.waitUntil(
          (env as any).KV_CACHE?.put(etagKvKey, newEtag, { expirationTtl: 300 }).catch(() => {})
        );

        return secureResponse(responseData, 200, corsHeaders, false, {
          ETag: newEtag,
          'Cache-Control': 'private, no-store',
          'Server-Timing': `total;dur=${Date.now() - bootT0}`,
        });
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
        const response = new Response(JSON.stringify({ count: count || 0 }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=300' } 
        });
        if (cache && cacheKeyUrl) {
          ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
        }
        return response;
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
          const bootT0 = Date.now();
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

          const response = secureResponse(stats, 200, corsHeaders, false, {
            'Server-Timing': `total;dur=${Date.now() - bootT0}`
          });
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          console.error('[Stats] Exception:', e);
          return secureResponse({ total: 0, legendary: 0 }, 200, corsHeaders);
        }
      }

      // 3. Get Leaderboard — uses Postgres RPC (server-side GROUP BY COUNT) + 60s Redis cache
      if (method === 'GET' && path === '/api/leaderboard') {
        try {
          const streamer = await resolveStreamerContext(request, supabase, url);
          if (!streamer) return secureResponse('Streamer not found', 404, corsHeaders, true);

          const leaderboard = await fetchWithCache(
            env,
            sharedRedis,
            `leaderboard:${streamer.id}`,
            60,
            async () => {
              const { data, error } = await supabase.rpc('get_leaderboard_top100', { p_streamer_id: streamer.id });
              if (error) throw error;
              return data || [];
            },
            ctx
          );

          const response = secureResponse(leaderboard, 200, corsHeaders);
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          console.error('[Leaderboard] Exception:', e);
          return secureResponse('An internal error occurred', 500, corsHeaders, true);
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

        const result = await fetchAchievementsWithCache(env, supabase, sharedRedis, twitchId, streamer.id, customNames, ctx);

        // Auto-sync: If they have 0 achievements but cards, trigger a sync in the background
        if (Array.isArray(result) && result.filter(a => a.unlocked).length === 0) {
          const { count: cardCount } = await supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('twitch_id', twitchId).eq('streamer_id', streamer.id);
          if (cardCount && cardCount > 0) {
            console.log(`[Achievements] Auto-syncing for ${twitchId} (0 achievements but ${cardCount} cards)`);
            ctx.waitUntil(syncUserAchievements(supabase, twitchId, streamer.id));
          }
        }

        return secureResponse(result, 200, corsHeaders);
      }

      // Achievements are now synced automatically via /api/achievements GET

      // 3.6 Creator Stats Dashboard
      if (method === 'GET' && path === '/api/creator/stats') {
        try {
          const { streamer } = await checkCreator(request, supabase);

          // Get stats from leaderboard view
          const { data: lbData } = await supabase
            .from('streamer_leaderboards')
            .select('total_cards, unique_collectors')
            .eq('streamer_id', streamer.id)
            .maybeSingle();

          // Get pack count
          const { count: packCount } = await supabase
            .from('streamer_sets')
            .select('*', { count: 'exact', head: true })
            .eq('streamer_id', streamer.id);

          return secureResponse({
            minted: lbData?.total_cards || 0,
            packs: packCount || 0,
            community: lbData?.unique_collectors || 0
          }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // 3.7 Creator Cards handled at line 3782 & 3798

      // 3.8 Creator Packs List
      if (method === 'GET' && path === '/api/creator/packs') {
        try {
          const { streamer } = await checkCreator(request, supabase);
          const { data, error } = await supabase
            .from('streamer_sets')
            .select('*')
            .eq('streamer_id', streamer.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return secureResponse(data, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 403, corsHeaders, true);
        }
      }

      // 3.8b Creator Assemble Pack (POST)
      if (method === 'POST' && path === '/api/creator/packs') {
        try {
          const { streamer, teamRole } = await checkCreator(request, supabase);
          assertTeamCanEditCatalog(teamRole);
          const body: any = await request.json();
          if (!body.name) return secureResponse('Pack name required', 400, corsHeaders, true);

          const { data, error } = await supabase
            .from('streamer_sets')
            .insert({
              streamer_id: streamer.id,
              name: body.name,
              description: body.description || '',
              code: body.code || body.name.substring(0, 3).toUpperCase(),
              is_active: true
            })
            .select()
            .single();

          if (error) throw error;
          return secureResponse({ success: true, pack: data }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message, 400, corsHeaders, true);
        }
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

      // 4. Auth Start (SPA login page is /login — do not redirect it to Twitch; only /auth/twitch starts OAuth)
      if (method === 'GET' && path === '/auth/twitch') {
        const role = url.searchParams.get('role') === 'creator' ? 'creator' : 'viewer';
        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/auth/callback`;
        const state = encodeURIComponent(JSON.stringify({ role }));

        const scopes = twitchScopesRequiredForCreator(role === 'creator');
        const scopeParam = encodeURIComponent(scopes.join(' '));

        const reauth = url.searchParams.get('reauth') === '1' || url.searchParams.get('force_verify') === '1';
        const verifyParam = reauth ? '&force_verify=true' : '';

        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopeParam}&state=${state}${verifyParam}`;
        return Response.redirect(authUrl, 302);
      }

      // 4c. Kick OAuth (PKCE) — https://docs.kick.com/getting-started/generating-tokens-oauth2-flow
      // ?mode=link — add Kick to existing Twitch (or viewer) session; does not replace Castle identity
      if (method === 'GET' && path === '/auth/kick') {
        if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) {
          return new Response('Kick OAuth not configured', { status: 503 });
        }
        const role = url.searchParams.get('role') === 'creator' ? 'creator' : 'viewer';
        const linkMode = url.searchParams.get('mode') === 'link';
        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/auth/kick/callback`;
        const { verifier, challenge } = await generateKickPkce();

        if (linkMode) {
          const sessionUser = await getUserFromSession(request, env, supabase);
          if (!sessionUser) {
            return Response.redirect(`${origin}/login?kick_link=1`, 302);
          }
          if (String(sessionUser.twitch_id || '').startsWith('kick_')) {
            return new Response(
              'You are logged in with Kick only. Sign in with Twitch first, then use Connect Kick on the dashboard.',
              { status: 400 }
            );
          }
          const linkSub = String(sessionUser.twitch_id || '').trim();
          const linkJwt = await new SignJWT({ typ: 'kick_oauth_link' })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject(linkSub)
            .setExpirationTime('15m')
            .sign(new TextEncoder().encode(env.SESSION_SECRET));
          const state = encodeURIComponent(JSON.stringify({ role, mode: 'link' }));
          const authUrl =
            `https://id.kick.com/oauth/authorize?response_type=code` +
            `&client_id=${encodeURIComponent(env.KICK_CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(KICK_OAUTH_SCOPES)}` +
            `&code_challenge=${encodeURIComponent(challenge)}` +
            `&code_challenge_method=S256` +
            `&state=${state}`;
          const isHttpsKick = request.url.startsWith('https');
          const secureKick = isHttpsKick ? '; Secure' : '';
          const hdrs = new Headers();
          hdrs.set('Location', authUrl);
          hdrs.append(
            'Set-Cookie',
            `kick_pkce_verifier=${encodeURIComponent(verifier)}; HttpOnly${secureKick}; SameSite=Lax; Path=/; Max-Age=600`
          );
          hdrs.append(
            'Set-Cookie',
            `kick_oauth_link=${encodeURIComponent(linkJwt)}; HttpOnly${secureKick}; SameSite=Lax; Path=/; Max-Age=900`
          );
          return new Response(null, { status: 302, headers: hdrs });
        }

        const state = encodeURIComponent(JSON.stringify({ role }));
        const authUrl =
          `https://id.kick.com/oauth/authorize?response_type=code` +
          `&client_id=${encodeURIComponent(env.KICK_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(KICK_OAUTH_SCOPES)}` +
          `&code_challenge=${encodeURIComponent(challenge)}` +
          `&code_challenge_method=S256` +
          `&state=${state}`;
        const isHttpsKick = request.url.startsWith('https');
        const secureKick = isHttpsKick ? '; Secure' : '';
        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            'Set-Cookie': `kick_pkce_verifier=${encodeURIComponent(verifier)}; HttpOnly${secureKick}; SameSite=Lax; Path=/; Max-Age=600`,
          },
        });
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

      // 5b. Kick OAuth callback (PKCE)
      if (method === 'GET' && path === '/auth/kick/callback') {
        if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) {
          return new Response('Kick OAuth not configured', { status: 503 });
        }
        const oauthErr = url.searchParams.get('error');
        if (oauthErr) {
          return new Response(`Kick OAuth error: ${oauthErr}`, { status: 400 });
        }
        const code = url.searchParams.get('code');
        const stateParam = url.searchParams.get('state');
        const cookieHeader = request.headers.get('Cookie') || '';
        const verifierEnc = cookieHeader.match(/(?:^|; )kick_pkce_verifier=([^;]*)/)?.[1];
        const verifier = verifierEnc ? decodeURIComponent(verifierEnc) : null;
        if (!code || !verifier) {
          return new Response('Missing code or PKCE cookie', { status: 400 });
        }
        let role = 'viewer';
        let linkMode = false;
        try {
          if (stateParam) {
            const parsed = JSON.parse(decodeURIComponent(stateParam));
            if (parsed.role) role = parsed.role;
            if (parsed.mode === 'link') linkMode = true;
          }
        } catch (e) {
          /* ignore */
        }
        const originKick = new URL(request.url).origin;
        const isHttpsKickCb = request.url.startsWith('https');
        const secureFlagKickCb = isHttpsKickCb ? '; Secure' : '';
        const redirectUriKick = `${originKick}/auth/kick/callback`;
        const tokenResp = await fetch('https://id.kick.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: env.KICK_CLIENT_ID,
            client_secret: env.KICK_CLIENT_SECRET,
            code,
            redirect_uri: redirectUriKick,
            code_verifier: verifier,
          }),
        });
        const tokenData: any = await tokenResp.json();
        if (!tokenData.access_token) {
          console.error('[Kick/Callback] Token exchange failed:', tokenData);
          return new Response('Kick auth failed', { status: 401 });
        }
        const meResp = await fetch('https://api.kick.com/public/v1/users', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const meJson: any = await meResp.json();
        const ku = Array.isArray(meJson?.data) ? meJson.data[0] : meJson?.data;
        if (!ku?.user_id) {
          console.error('[Kick/Callback] User payload:', meJson);
          return new Response('Kick user profile missing', { status: 502 });
        }
        const canonicalId = kickCanonicalUserId(ku.user_id);
        const displayName = String(ku.name || 'Kick User');
        const avatarUrl = ku.profile_picture || null;
        const encKeyKick = env.ENCRYPTION_SECRET ?? env.SESSION_SECRET;
        const encryptedAccessKick = await encryptSensitive(tokenData.access_token, encKeyKick);
        const encryptedRefreshKick = tokenData.refresh_token
          ? await encryptSensitive(tokenData.refresh_token, encKeyKick)
          : null;
        const tokenScopeKick = Array.isArray(tokenData.scope)
          ? tokenData.scope.join(' ')
          : tokenData.scope || null;

        const kidStr = String(ku.user_id);

        if (linkMode) {
          const linkCookie = cookieHeader.match(/(?:^|; )kick_oauth_link=([^;]*)/)?.[1];
          const linkTok = linkCookie ? decodeURIComponent(linkCookie) : null;
          if (!linkTok) {
            return new Response(
              'Missing link session — open Connect Kick from the dashboard while logged in with Twitch.',
              { status: 400 }
            );
          }
          let targetTwitchId: string;
          try {
            const { payload } = await jwtVerify(linkTok, new TextEncoder().encode(env.SESSION_SECRET));
            if ((payload as any).typ !== 'kick_oauth_link') throw new Error('bad typ');
            targetTwitchId = String((payload as any).sub || '').trim();
            if (!targetTwitchId || targetTwitchId.startsWith('kick_')) throw new Error('invalid sub');
          } catch (e: any) {
            console.warn('[Kick/Link] JWT:', e?.message || e);
            return new Response('Kick link session expired — try Connect Kick again from the dashboard.', {
              status: 401,
            });
          }

          const { data: conflictRow } = await supabase
            .from('users')
            .select('twitch_id')
            .eq('kick_user_id', kidStr)
            .maybeSingle();
          if (conflictRow && String(conflictRow.twitch_id).trim() !== targetTwitchId) {
            return new Response(
              'This Kick account is already linked to another Castle profile. Unlink it there or use a different Kick login.',
              { status: 409 }
            );
          }

          const { data: linkUpdated, error: linkErr } = await supabase
            .from('users')
            .update({
              kick_access_token_encrypted: encryptedAccessKick,
              kick_refresh_token_encrypted: encryptedRefreshKick,
              kick_token_scope: tokenScopeKick,
              kick_user_id: kidStr,
            })
            .eq('twitch_id', targetTwitchId)
            .select('twitch_id');
          if (linkErr) {
            console.error('[Kick/Link] update:', linkErr);
            return new Response('Could not save Kick connection', { status: 500 });
          }
          if (!linkUpdated || linkUpdated.length === 0) {
            const { data: rowProbe } = await supabase
              .from('users')
              .select('twitch_id')
              .eq('twitch_id', targetTwitchId)
              .maybeSingle();
            console.error('[Kick/Link] 0 rows updated; target=', targetTwitchId, 'row_exists=', !!rowProbe);
            return new Response(
              'Could not link Kick: your Castle profile was not updated (session may not match your Twitch account). Sign out and sign in with Twitch, then try again.',
              { status: 409 }
            );
          }

          await ensureKickEventSubscriptions(tokenData.access_token);

          // Clear health cache on success
          if (ctx && (env as any).KV_CACHE) {
            ctx.waitUntil((env as any).KV_CACHE.delete(`auth:health:v2:${targetTwitchId}`));
          }

          const destBase = role === 'creator' ? `${originKick}/dashboard.html` : `${originKick}/hub`;
          const destLink = destBase + (destBase.includes('?') ? '&' : '?') + 'kick=linked';
          const hdrsLink = new Headers();
          hdrsLink.set('Location', destLink);
          hdrsLink.append(
            'Set-Cookie',
            `kick_pkce_verifier=; Path=/; Max-Age=0; HttpOnly${secureFlagKickCb}; SameSite=Lax`
          );
          hdrsLink.append(
            'Set-Cookie',
            `kick_oauth_link=; Path=/; Max-Age=0; HttpOnly${secureFlagKickCb}; SameSite=Lax`
          );
          return new Response(null, { status: 302, headers: hdrsLink });
        }

        // Normal Login: Check if this Kick user is already linked to a Twitch ID
        const { data: existingUser } = await supabase
          .from('users')
          .select('twitch_id, twitch_access_token_encrypted, twitch_refresh_token_encrypted, twitch_token_scope')
          .eq('kick_user_id', kidStr)
          .maybeSingle();

        const finalTwitchId = existingUser?.twitch_id || canonicalId;

        // If we're using a different ID (canonicalId fallback), check if it has Twitch tokens to preserve
        let preservedTwitch = existingUser;
        if (!preservedTwitch && finalTwitchId !== canonicalId) {
             // Already handled by existingUser check usually, but just in case
        } else if (!preservedTwitch) {
            const { data: twitchOnlyRow } = await supabase
                .from('users')
                .select('twitch_access_token_encrypted, twitch_refresh_token_encrypted, twitch_token_scope')
                .eq('twitch_id', finalTwitchId)
                .maybeSingle();
            preservedTwitch = twitchOnlyRow as any;
        }

        const userUpsertKick: any = {
          twitch_id: finalTwitchId,
          username: displayName,
          avatar_url: avatarUrl,
          is_linked: true,
          kick_access_token_encrypted: encryptedAccessKick,
          kick_refresh_token_encrypted: encryptedRefreshKick,
          kick_token_scope: tokenScopeKick,
          kick_user_id: kidStr,
        };

        if (preservedTwitch) {
          if (preservedTwitch.twitch_access_token_encrypted) {
            userUpsertKick.twitch_access_token_encrypted = preservedTwitch.twitch_access_token_encrypted;
          }
          if (preservedTwitch.twitch_refresh_token_encrypted) {
            userUpsertKick.twitch_refresh_token_encrypted = preservedTwitch.twitch_refresh_token_encrypted;
          }
          if (preservedTwitch.twitch_token_scope) {
            userUpsertKick.twitch_token_scope = preservedTwitch.twitch_token_scope;
          }
        }

        const { error: userErrKick } = await supabase.from('users').upsert(
          userUpsertKick,
          { onConflict: 'twitch_id' }
        );

        // Clear health cache
        if (ctx && (env as any).KV_CACHE) {
          ctx.waitUntil((env as any).KV_CACHE.delete(`auth:health:v2:${finalTwitchId}`));
        }
        if (userErrKick) console.error('[Kick/Callback] users upsert:', userErrKick);

        if (role === 'creator') {
          const slugKick = `kick${ku.user_id}`;
          const { error: seKick } = await supabase.from('streamers').upsert(
            {
              twitch_id: canonicalId,
              username: slugKick.toLowerCase(),
              display_name: displayName,
              avatar_url: avatarUrl,
              brand_name: displayName,
            },
            { onConflict: 'twitch_id' }
          );
          if (seKick) console.error('[Kick/Callback] streamers upsert:', seKick);
          await ensureKickEventSubscriptions(tokenData.access_token);
        }

        const { data: pendingKick } = await supabase
          .from('pending_rewards')
          .select('card_id, streamer_id, is_obs_consumed, cards!inner(rarity, attack, defense, mechanic_id)')
          .eq('twitch_id', canonicalId);

        if (pendingKick && pendingKick.length > 0) {
          const toInsertKick = [];
          for (const p of pendingKick) {
            const cardDataK = Array.isArray(p.cards) ? p.cards[0] : (p.cards as any);
            const gradeK = (p as any).grade ?? generateGrade().grade;
            const isGMK = (p as any).is_genesis_mint ?? false;
            toInsertKick.push({
              twitch_id: canonicalId,
              card_id: p.card_id,
              streamer_id: p.streamer_id,
              granted_by_streamer: p.streamer_id,
              is_obs_consumed: p.is_obs_consumed,
              attack: cardDataK?.attack || 0,
              defense: cardDataK?.defense || 0,
              max_hp: cardDataK?.defense || 0,
              mechanic_id: cardDataK?.mechanic_id || null,
              grade: gradeK,
              is_genesis_mint: isGMK,
            });
          }
          await supabase.from('user_cards').insert(toInsertKick);
          await supabase.from('pending_rewards').delete().eq('twitch_id', canonicalId);
        }

        const { data: streamerKick } = await supabase
          .from('streamers')
          .select('id, is_active')
          .eq('twitch_id', canonicalId)
          .maybeSingle();

        const sessionTokenKick = await new SignJWT({
          sub: canonicalId,
          twitch_id: canonicalId,
          username: displayName,
          is_creator: !!streamerKick,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(canonicalId)
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(new TextEncoder().encode(env.SESSION_SECRET));

        const requestOriginKick = new URL(request.url).origin;
        let destinationKick = role === 'creator' ? `${requestOriginKick}/dashboard` : `${requestOriginKick}/hub`;
        if (role === 'creator') {
          if (!streamerKick || !streamerKick.is_active) {
            destinationKick = `${requestOriginKick}/onboarding?role=creator`;
          }
        } else {
          const { data: dbUserKick } = await supabase
            .from('users')
            .select('is_onboarding_complete')
            .eq('twitch_id', canonicalId)
            .maybeSingle();
          if (!dbUserKick || dbUserKick.is_onboarding_complete === false) {
            destinationKick = `${requestOriginKick}/onboarding?role=collector`;
          }
        }

        const hdrsKick = new Headers();
        hdrsKick.set('Location', destinationKick);
        hdrsKick.append(
          'Set-Cookie',
          `session=${sessionTokenKick}; HttpOnly${secureFlagKickCb}; SameSite=Lax; Path=/; Max-Age=604800`
        );
        hdrsKick.append(
          'Set-Cookie',
          `kick_pkce_verifier=; Path=/; Max-Age=0; HttpOnly${secureFlagKickCb}; SameSite=Lax`
        );
        return new Response(null, { status: 302, headers: hdrsKick });
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

        // 1. Mark User as Linked and store tokens (same key as refresh + health checks)
        const encKey = env ? twitchTokenEncryptSecret(env) : '';
        const encryptedAccess = await encryptSensitive(tokenData.access_token, encKey);
        const encryptedRefresh = tokenData.refresh_token
          ? await encryptSensitive(tokenData.refresh_token, encKey)
          : null;

        const tokenScope = Array.isArray(tokenData.scope)
          ? tokenData.scope.join(' ')
          : (tokenData.scope || null);

        const { data: existingBeforeTwitch } = await supabase
          .from('users')
          .select(
            'kick_access_token_encrypted, kick_refresh_token_encrypted, kick_token_scope, kick_user_id'
          )
          .eq('twitch_id', user.id)
          .maybeSingle();

        const userUpsert: Record<string, unknown> = {
          twitch_id: user.id,
          username: user.display_name,
          avatar_url: user.profile_image_url,
          is_linked: true,
          twitch_access_token_encrypted: encryptedAccess,
          twitch_refresh_token_encrypted: encryptedRefresh,
          twitch_token_scope: tokenScope,
        };
        const exKick = existingBeforeTwitch;
        if (exKick && (exKick.kick_access_token_encrypted || exKick.kick_user_id)) {
          if (exKick.kick_access_token_encrypted != null) {
            userUpsert.kick_access_token_encrypted = exKick.kick_access_token_encrypted;
          }
          if (exKick.kick_refresh_token_encrypted != null) {
            userUpsert.kick_refresh_token_encrypted = exKick.kick_refresh_token_encrypted;
          }
          if (exKick.kick_token_scope != null) userUpsert.kick_token_scope = exKick.kick_token_scope;
          if (exKick.kick_user_id != null) userUpsert.kick_user_id = exKick.kick_user_id;
        }

        const { error: userErr } = await supabase.from('users').upsert(userUpsert, { onConflict: 'twitch_id' });
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
          if (streamerErr) {
            console.error("[Auth/Callback] Streamers Upsert Error:", streamerErr);
          } else {
            try {
              const { data: sRow } = await supabase.from('streamers').select('id').eq('twitch_id', user.id).maybeSingle();
              if (sRow?.id) {
                const es = await ensureEventSubSubscriptionsForBroadcaster(env, {
                  broadcasterTwitchId: String(user.id),
                  callbackOrigin: origin,
                });
                if (es.skippedReason === 'bad_webhook_secret') {
                  console.warn('[Auth/Callback] EventSub auto-register skipped: TWITCH_WEBHOOK_SECRET length invalid');
                } else if (es.skippedReason === 'no_app_token') {
                  console.warn('[Auth/Callback] EventSub auto-register skipped: Twitch app token unavailable');
                } else if (es.created.length > 0 || es.errors.length > 0) {
                  await logSystem(
                    supabase,
                    es.errors.length ? 'warn' : 'info',
                    'webhook',
                    `EventSub auto (creator login): created ${es.created.length}, skipped ${es.skipped.length}, errors ${es.errors.length}`,
                    sRow.id,
                    { created: es.created, skipped: es.skipped, errors: es.errors, callbackUrl: es.callbackUrl }
                  );
                }
              }
            } catch (e: any) {
              console.error('[Auth/Callback] EventSub auto-register failed:', e?.message || e);
            }
          }
        }

        // 2. Claim Pending Rewards
        const { data: pending } = await supabase
          .from('pending_rewards')
          .select('id, card_id, streamer_id, is_obs_consumed, trait_list, mechanic_id, genesis_mechanic_id, attack, defense, max_hp, baked_image_url, grade, is_genesis_mint, cards!inner(rarity, attack, defense, mechanic_id)')
          .eq('twitch_id', user.id);

        if (pending && pending.length > 0) {
          console.log(`[Auth] Claiming ${pending.length} cards for ${user.display_name}`);

          const toInsert = [];
          for (const p of pending) {
            const cardCatalog = Array.isArray(p.cards) ? p.cards[0] : (p.cards as any);
            
            // Map columns, falling back to catalog data for legacy rows predating migration 065
            toInsert.push({
              id: p.id, // Carry over the pre-generated ID so notifications still work
              twitch_id: user.id,
              card_id: p.card_id,
              streamer_id: p.streamer_id,
              granted_by_streamer: p.streamer_id,
              is_obs_consumed: p.is_obs_consumed,
              attack: p.attack || cardCatalog?.attack || 0,
              defense: p.defense || cardCatalog?.defense || 0,
              max_hp: p.max_hp || cardCatalog?.defense || 0,
              mechanic_id: p.mechanic_id || cardCatalog?.mechanic_id || null,
              genesis_mechanic_id: p.genesis_mechanic_id || null,
              grade: p.grade ?? generateGrade().grade,
              is_genesis_mint: p.is_genesis_mint ?? false,
              trait_list: p.trait_list || [],
              baked_image_url: p.baked_image_url || null,
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
          .select('id, is_active')
          .eq('twitch_id', user.id)
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

        // Default to hub for viewers, or dashboard for creators
        let destination = role === 'creator' ? `${requestOrigin}/dashboard` : `${requestOrigin}/hub`;
        
        if (role === 'creator') {
          if (!streamer || !streamer.is_active) {
            destination = `${requestOrigin}/onboarding?role=creator`;
          }
        } else {
          // Check if collector onboarding is complete
          const { data: dbUser } = await supabase
            .from('users')
            .select('is_onboarding_complete')
            .eq('twitch_id', user.id)
            .maybeSingle();

          // Only force onboarding if it is explicitly false
          if (!dbUser || dbUser.is_onboarding_complete === false) {
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

      // ── OBS INIT — validates token, returns Supabase Realtime config (replaces polling) ──
      // obs.html calls this once on load, then opens a Supabase Realtime WebSocket directly.
      // This eliminates the 500ms /api/obs/signal polling interval entirely.
      if (method === 'GET' && path === '/api/obs/init') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        }

        // Fetch full config for initial branding
        const { data: fullStreamer } = await supabase
          .from('streamers')
          .select('id, username, brand_name, obs_settings, obs_paused, pack_image_url, card_back_url, pack_animation_style')
          .eq('id', streamer.id)
          .maybeSingle();

        return new Response(JSON.stringify({
          streamer_id: streamer.id,
          streamer_username: fullStreamer?.username,
          supabase_url: env.SUPABASE_URL,
          supabase_anon_key: env.SUPABASE_KEY,
          obs_settings: fullStreamer?.obs_settings || { show_rarities: ['common', 'rare', 'epic', 'legendary'] },
          obs_paused: !!fullStreamer?.obs_paused,
          pack_image_url: fullStreamer?.pack_image_url || '/default_pack.png',
          card_back_url: fullStreamer?.card_back_url || null,
          pack_animation_style: fullStreamer?.pack_animation_style || 'style1',
          brand_name: fullStreamer?.brand_name || fullStreamer?.username || null,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }

      // ── OBS WEBSOCKET — push-based signal (preferred over polling) ───────────
      // obs.html connects here via WebSocket. The OBSQueueSession DO broadcasts
      // pause/skip signals immediately to all connected overlays for a streamer.
      if (path === '/api/obs/ws') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });

        if (!env.OBS_QUEUE_SESSIONS) {
          return new Response(JSON.stringify({ error: 'OBS_QUEUE_SESSIONS DO not configured' }), { status: 503, headers: corsHeaders });
        }
        const doId = env.OBS_QUEUE_SESSIONS.idFromName(streamer.id);
        const stub = env.OBS_QUEUE_SESSIONS.get(doId);
        // Forward the WebSocket upgrade to the DO
        return stub.fetch(new Request(`https://do/ws`, request));
      }

      // ── OBS SIGNAL (poll — now reads from DO storage, not Supabase) ─────────
      // Clients that haven't upgraded to WebSocket still work; skip signal
      // is cleared in the DO atomically.
      if (method === 'GET' && path === '/api/obs/signal') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });

        // Read state from DO (~0.1ms) — no Supabase query
        if (env.OBS_QUEUE_SESSIONS) {
          const doId = env.OBS_QUEUE_SESSIONS.idFromName(streamer.id);
          const stub = env.OBS_QUEUE_SESSIONS.get(doId);
          const stateRes = await stub.fetch(new Request('https://do/state'));
          const state: any = await stateRes.json().catch(() => ({}));
          const skip   = !!state.skip;
          const paused = !!state.paused;
          // Clear skip signal in DO so it only fires once
          if (skip) {
            ctx.waitUntil(stub.fetch(new Request('https://do/clear-skip', { method: 'POST' })));
          }
          return new Response(JSON.stringify({ paused, skip }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        }

        // Fallback: read from Supabase (if DO not yet deployed)
        const { data: s } = await supabase
          .from('streamers')
          .select('obs_paused, obs_skip_signal')
          .eq('id', streamer.id)
          .maybeSingle();
        const skip   = !!s?.obs_skip_signal;
        const paused = !!s?.obs_paused;
        if (skip) {
          await supabase.from('streamers').update({ obs_skip_signal: false }).eq('id', streamer.id);
        }
        return new Response(JSON.stringify({ paused, skip }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }

      // ── QUEUE CONTROL API (token-authenticated, used by queue-control.html) ──

      // GET /api/obs/queue-ctl — list pending + consumed items
      if (method === 'GET' && path === '/api/obs/queue-ctl') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });

        // Fetch full streamer record for obs_settings + pause state
        const { data: fullStreamer } = await supabase.from('streamers').select('obs_settings, obs_paused').eq('id', streamer.id).maybeSingle();

        const [pendingRes, consumedRes] = await Promise.all([
          supabase.from('user_cards')
            .select('id, created_at, cards(id, name, rarity, image_url), users(username, avatar_url)')
            .eq('streamer_id', streamer.id).eq('is_obs_consumed', false)
            .order('created_at', { ascending: true }).limit(50),
          supabase.from('user_cards')
            .select('id, created_at, cards(id, name, rarity, image_url), users(username, avatar_url)')
            .eq('streamer_id', streamer.id).eq('is_obs_consumed', true)
            .order('created_at', { ascending: false }).limit(30),
        ]);

        return new Response(JSON.stringify({
          pending:      pendingRes.data  || [],
          consumed:     consumedRes.data || [],
          obs_settings: fullStreamer?.obs_settings || { show_rarities: ['common', 'rare', 'epic', 'legendary'] },
          obs_paused:   !!fullStreamer?.obs_paused,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // POST /api/obs/queue-ctl/skip
      if (method === 'POST' && path === '/api/obs/queue-ctl/skip') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const body = await request.json().catch(() => ({})) as any;
        if (!body.id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
        const { error } = await supabase.from('user_cards').update({ is_obs_consumed: true }).eq('id', body.id).eq('streamer_id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      // POST /api/obs/queue-ctl/replay
      if (method === 'POST' && path === '/api/obs/queue-ctl/replay') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const body = await request.json().catch(() => ({})) as any;
        if (!body.id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
        const { error } = await supabase.from('user_cards').update({ is_obs_consumed: false, created_at: new Date().toISOString() }).eq('id', body.id).eq('streamer_id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      // POST /api/obs/queue-ctl/clear
      if (method === 'POST' && path === '/api/obs/queue-ctl/clear') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const { error } = await supabase.from('user_cards').update({ is_obs_consumed: true }).eq('streamer_id', streamer.id).eq('is_obs_consumed', false);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      // POST /api/obs/queue-ctl/settings
      if (method === 'POST' && path === '/api/obs/queue-ctl/settings') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const body = await request.json().catch(() => ({})) as any;
        if (!body.obs_settings?.show_rarities) return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders });
        const validRarities = ['common', 'rare', 'epic', 'legendary'];
        const clean = body.obs_settings.show_rarities.filter((r: string) => validRarities.includes(r.toLowerCase()));
        const { error } = await supabase.from('streamers').update({ obs_settings: { show_rarities: clean } }).eq('id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, obs_settings: { show_rarities: clean } }), { status: 200, headers: corsHeaders });
      }

      // ── Helper: push signal to OBSQueueSession DO and broadcast to WS clients ──
      const pushObsSignal = (streamerId: string, signal: { paused?: boolean; skip?: boolean }) => {
        if (!env.OBS_QUEUE_SESSIONS) return;
        const doId = env.OBS_QUEUE_SESSIONS.idFromName(streamerId);
        const stub = env.OBS_QUEUE_SESSIONS.get(doId);
        ctx.waitUntil(stub.fetch(new Request('https://do/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signal),
        })));
      };

      // POST /api/obs/queue-ctl/pause — freeze the queue (overlay gets null from /next)
      if (method === 'POST' && path === '/api/obs/queue-ctl/pause') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const { error } = await supabase.from('streamers').update({ obs_paused: true }).eq('id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        pushObsSignal(streamer.id, { paused: true });
        return new Response(JSON.stringify({ success: true, paused: true }), { status: 200, headers: corsHeaders });
      }

      // POST /api/obs/queue-ctl/resume — unfreeze the queue
      if (method === 'POST' && path === '/api/obs/queue-ctl/resume') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const { error } = await supabase.from('streamers').update({ obs_paused: false }).eq('id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        pushObsSignal(streamer.id, { paused: false });
        return new Response(JSON.stringify({ success: true, paused: false }), { status: 200, headers: corsHeaders });
      }

      // POST /api/obs/queue-ctl/skip-now — interrupt the currently playing animation
      if (method === 'POST' && path === '/api/obs/queue-ctl/skip-now') {
        const streamerParam = url.searchParams.get('streamer');
        const tokenParam    = url.searchParams.get('token');
        const streamer = await verifyOBSToken(streamerParam || '', tokenParam || '');
        if (!streamer) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
        const { error } = await supabase.from('streamers').update({ obs_skip_signal: true }).eq('id', streamer.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        pushObsSignal(streamer.id, { skip: true });
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      // Also expose pause/resume/skip-now via session-auth for the dashboard queue tab
      if (method === 'POST' && path === '/api/creator/obs-queue/pause') {
        const { user, streamer } = await checkCreator(request, supabase);
        await supabase.from('streamers').update({ obs_paused: true }).eq('id', streamer.id);
        pushObsSignal(streamer.id, { paused: true });
        return secureResponse({ success: true, paused: true }, 200, corsHeaders);
      }
      if (method === 'POST' && path === '/api/creator/obs-queue/resume') {
        const { user, streamer } = await checkCreator(request, supabase);
        await supabase.from('streamers').update({ obs_paused: false }).eq('id', streamer.id);
        pushObsSignal(streamer.id, { paused: false });
        return secureResponse({ success: true, paused: false }, 200, corsHeaders);
      }
      if (method === 'POST' && path === '/api/creator/obs-queue/skip-now') {
        const { user, streamer } = await checkCreator(request, supabase);
        await supabase.from('streamers').update({ obs_skip_signal: true }).eq('id', streamer.id);
        pushObsSignal(streamer.id, { skip: true });
        return secureResponse({ success: true }, 200, corsHeaders);
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

        // Load streamer's full obs config (settings + pause flag)
        const { data: fullStreamer } = await supabase
          .from('streamers')
          .select('obs_settings, obs_paused')
          .eq('id', streamer.id)
          .maybeSingle();

        // If the queue is paused, return null immediately — overlay stays quiet
        if (fullStreamer?.obs_paused) {
          return new Response(JSON.stringify({ cards: null, paused: true }), { status: 200, headers: corsHeaders });
        }

        const obsSettings = fullStreamer?.obs_settings || { show_rarities: ['common', 'rare', 'epic', 'legendary'] };
        const allowedRarities: string[] = (obsSettings.show_rarities || ['common', 'rare', 'epic', 'legendary'])
          .map((r: string) => r.toLowerCase());

        // Fetch the oldest unconsumed card for this streamer
        // Fetch up to 20 at a time so we can skip filtered-out rarities in one pass
        const { data: candidates, error } = await supabase
          .from('user_cards')
          .select('id, card_id, twitch_id, cards(id, name, rarity, image_url, template_id), users(username)')
          .eq('streamer_id', streamer.id)
          .eq('is_obs_consumed', false)
          .order('created_at', { ascending: true })
          .limit(20);

        if (error) {
          console.error('[OBS] DB Error:', error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }

        if (!candidates || candidates.length === 0) {
          return new Response(JSON.stringify({ cards: null }), { status: 200, headers: corsHeaders });
        }

        // Find first card whose rarity passes the filter; auto-consume skipped ones
        let chosenCard: any = null;
        const toSkip: string[] = [];

        for (const uc of candidates) {
          const cardRarity = ((uc.cards as any)?.rarity || 'common').toLowerCase();
          if (allowedRarities.includes(cardRarity)) {
            chosenCard = uc;
            break;
          } else {
            // Mark this one as consumed (silently skipped — below rarity threshold)
            toSkip.push(uc.id);
          }
        }

        // Bulk-skip filtered-out cards
        if (toSkip.length > 0) {
          await supabase.from('user_cards').update({ is_obs_consumed: true }).in('id', toSkip);
          console.log(`[OBS] Auto-skipped ${toSkip.length} card(s) below rarity threshold`);
        }

        if (!chosenCard) {
          return new Response(JSON.stringify({ cards: null }), { status: 200, headers: corsHeaders });
        }

        const card = chosenCard.cards as any;
        const user = chosenCard.users as any;

        const payload = {
          user_card_id: chosenCard.id,
          card_id: card?.id,
          name: card?.name,
          rarity: card?.rarity,
          image_url: card?.template_id 
            ? `${url.origin}/api/cards/${chosenCard.id}/image.png`
            : card?.image_url,
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
          // Token-based authentication (required)
          streamer = await verifyOBSToken(streamerParam, tokenParam);
          if (!streamer) {
            return new Response(JSON.stringify({ error: 'Invalid token or streamer' }), { status: 403, headers: corsHeaders });
          }
        } else {
          // Legacy twitch_id path is disabled — require authenticated token format
          return new Response(JSON.stringify({ error: 'Authentication required: provide streamer and token parameters' }), { status: 400, headers: corsHeaders });
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
          .eq('streamer_id', streamer.id)
          .select('id'); // return updated rows so we can confirm

        if (updateError) {
          console.error('[OBS] Update Error:', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });
        }

        console.log(`[OBS] Consumed ${updateData?.length ?? 0} row(s) for id=${targetId}`);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      // ============================================================
      // OBS QUEUE MANAGEMENT (Creator-authenticated, session-based)
      // ============================================================

      // GET /api/creator/obs-queue — list pending + recently consumed queue items
      if (method === 'GET' && path === '/api/creator/obs-queue') {
        const { user, streamer } = await checkCreator(request, supabase);

        // Pending (unconsumed) — oldest first
        const { data: pending, error: pendingErr } = await supabase
          .from('user_cards')
          .select('id, created_at, cards(id, name, rarity, image_url), users(username, avatar_url)')
          .eq('streamer_id', streamer.id)
          .eq('is_obs_consumed', false)
          .order('created_at', { ascending: true })
          .limit(50);

        if (pendingErr) return secureResponse({ error: pendingErr.message }, 500, corsHeaders, true);

        // Recently consumed — newest first, last 30
        const { data: consumed, error: consumedErr } = await supabase
          .from('user_cards')
          .select('id, created_at, cards(id, name, rarity, image_url), users(username, avatar_url)')
          .eq('streamer_id', streamer.id)
          .eq('is_obs_consumed', true)
          .order('created_at', { ascending: false })
          .limit(30);

        if (consumedErr) return secureResponse({ error: consumedErr.message }, 500, corsHeaders, true);

        // Current obs_settings (rarity filter) + pause state
        const obsSettings = streamer.obs_settings || { show_rarities: ['common', 'rare', 'epic', 'legendary'] };
        const obsPaused   = !!streamer.obs_paused;

        return secureResponse({ pending: pending || [], consumed: consumed || [], obs_settings: obsSettings, obs_paused: obsPaused }, 200, corsHeaders);
      }

      // POST /api/creator/obs-queue/skip — mark a specific card as consumed (skip)
      if (method === 'POST' && path === '/api/creator/obs-queue/skip') {
        const { user, streamer } = await checkCreator(request, supabase);
        const body = await request.json().catch(() => ({})) as any;
        const id = body.id;
        if (!id) return secureResponse({ error: 'Missing id' }, 400, corsHeaders, true);

        const { error } = await supabase
          .from('user_cards')
          .update({ is_obs_consumed: true })
          .eq('id', id)
          .eq('streamer_id', streamer.id);

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // POST /api/creator/obs-queue/replay — reset a card to unconsumed (replay), pushing it to end of queue
      if (method === 'POST' && path === '/api/creator/obs-queue/replay') {
        const { user, streamer } = await checkCreator(request, supabase);
        const body = await request.json().catch(() => ({})) as any;
        const id = body.id;
        if (!id) return secureResponse({ error: 'Missing id' }, 400, corsHeaders, true);

        // Update created_at to now so it plays AFTER currently-queued items
        const { error } = await supabase
          .from('user_cards')
          .update({ is_obs_consumed: false, created_at: new Date().toISOString() })
          .eq('id', id)
          .eq('streamer_id', streamer.id);

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // POST /api/creator/obs-queue/clear — mark ALL pending cards as consumed
      if (method === 'POST' && path === '/api/creator/obs-queue/clear') {
        const { user, streamer } = await checkCreator(request, supabase);

        const { error } = await supabase
          .from('user_cards')
          .update({ is_obs_consumed: true })
          .eq('streamer_id', streamer.id)
          .eq('is_obs_consumed', false);

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true }, 200, corsHeaders);
      }

      // GET /api/creator/obs-settings — get OBS display settings
      if (method === 'GET' && path === '/api/creator/obs-settings') {
        const { user, streamer } = await checkCreator(request, supabase);
        const obsSettings = streamer.obs_settings || { show_rarities: ['common', 'rare', 'epic', 'legendary'] };
        return secureResponse({ obs_settings: obsSettings }, 200, corsHeaders);
      }

      // POST /api/creator/obs-settings — save OBS display settings
      if (method === 'POST' && path === '/api/creator/obs-settings') {
        const { user, streamer, teamRole } = await checkCreator(request, supabase);
        assertTeamCanEditCatalog(teamRole);
        const body = await request.json().catch(() => ({})) as any;
        const newSettings = body.obs_settings;
        if (!newSettings || !Array.isArray(newSettings.show_rarities)) {
          return secureResponse({ error: 'Invalid settings payload' }, 400, corsHeaders, true);
        }

        const validRarities = ['common', 'rare', 'epic', 'legendary'];
        const cleanRarities = newSettings.show_rarities.filter((r: string) => validRarities.includes(r.toLowerCase()));

        const { error } = await supabase
          .from('streamers')
          .update({ obs_settings: { show_rarities: cleanRarities } })
          .eq('id', streamer.id);

        if (error) return secureResponse({ error: error.message }, 500, corsHeaders, true);
        return secureResponse({ success: true, obs_settings: { show_rarities: cleanRarities } }, 200, corsHeaders);
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

      // --- GET /api/battle/history ---
      // Returns recent completed battles for the current user for this streamer
      if (method === 'GET' && path === '/api/battle/history') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const { data: battles } = await supabase
          .from('battles')
          .select('id, challenger_id, challenger_name, target_name, status, completed_at, battle_data')
          .eq('streamer_id', streamer.id)
          .eq('status', 'completed')
          .or(`challenger_id.eq.${user.twitch_id},target_name.ilike.${user.username}`)
          .order('completed_at', { ascending: false })
          .limit(10);

        const history = (battles || []).map(b => {
          const isChallenger = b.challenger_id === user.twitch_id;
          const opponent = isChallenger ? b.target_name : b.challenger_name;
          const bd = b.battle_data as any;
          let won: boolean | null = null;
          if (bd?.winner) {
            won = isChallenger
              ? bd.winner === 'challenger'
              : bd.winner === 'target';
          }
          return { id: b.id, opponent, won, completed_at: b.completed_at };
        });

        return secureResponse({ history }, 200, corsHeaders);
      }

      // Same shape for GET list + POST/PATCH single-deck responses (nested slot joins)
      const BATTLE_SAVED_DECK_SELECT = `
            id, name, is_active,
            slot_1_card_id, slot_2_card_id, slot_3_card_id,
            slot_1:slot_1_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_2:slot_2_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity)),
            slot_3:slot_3_card_id (id, attack, defense, max_hp, mechanic_id, genesis_mechanic_id, mechanic:mechanic_id(name, display_name, icon), genesis_mechanic:genesis_mechanic_id(name, display_name, icon), card:card_id(name, image_url, rarity))
          `;

      // --- GET /api/battle/saved-decks ---
      // Returns the user's saved decks for this streamer
      if (method === 'GET' && path === '/api/battle/saved-decks') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const { data: savedDecks, error } = await supabase
          .from('user_saved_decks')
          .select(BATTLE_SAVED_DECK_SELECT)
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
          .select(BATTLE_SAVED_DECK_SELECT)
          .single();

        if (saveError) {
          if (saveError.code === '23505') { // Unique violation
            return secureResponse({ error: 'A deck with this name already exists' }, 400, corsHeaders, true);
          }
          return secureResponse({ error: saveError.message }, 500, corsHeaders, true);
        }

        return secureResponse({ deck: newDeck }, 200, corsHeaders);
      }

      // --- PATCH /api/battle/saved-decks ---
      // Updates an existing saved deck's slots (and optionally name)
      if (method === 'PATCH' && path === '/api/battle/saved-decks') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse({ error: 'Unauthorized' }, 401, corsHeaders, true);
        const streamer = await resolveStreamerContext(request, supabase, url);
        if (!streamer) return secureResponse({ error: 'Streamer not found' }, 404, corsHeaders, true);

        const body: any = await request.json();
        const { id, name, slot_1, slot_2, slot_3 } = body;
        if (!id) return secureResponse({ error: 'Deck ID required' }, 400, corsHeaders, true);

        // Verify the deck belongs to this user
        const { data: existing, error: fetchErr } = await supabase
          .from('user_saved_decks')
          .select('id')
          .eq('id', id)
          .eq('twitch_id', user.twitch_id)
          .eq('streamer_id', streamer.id)
          .maybeSingle();

        if (fetchErr || !existing) return secureResponse({ error: 'Deck not found' }, 404, corsHeaders, true);

        // Verify ownership of any provided card slots
        const slotIds = [slot_1, slot_2, slot_3].filter(Boolean);
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

        const updates: any = {
          slot_1_card_id: slot_1 ?? null,
          slot_2_card_id: slot_2 ?? null,
          slot_3_card_id: slot_3 ?? null,
        };
        if (name && name.trim()) updates.name = name.trim();

        const { data: updated, error: updateErr } = await supabase
          .from('user_saved_decks')
          .update(updates)
          .eq('id', id)
          .eq('twitch_id', user.twitch_id)
          .select(BATTLE_SAVED_DECK_SELECT)
          .single();

        if (updateErr) return secureResponse({ error: updateErr.message }, 500, corsHeaders, true);
        return secureResponse({ deck: updated }, 200, corsHeaders);
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

      // 6. SPA Routing Fallback
      // If not an API/Auth route, and not a static asset, serve index.html
      // Skip this block entirely for /api/ paths so they can reach API routes defined below
      // (e.g. the trading centre handlers at the end of this function).
      if (env.ASSETS && !path.startsWith('/api/')) {
        // ── Named HTML routes ───────────────────────────────────────────────
        // Check these BEFORE the generic env.ASSETS.fetch() call, because
        // the Assets binding may return index.html (200) as an SPA fallback
        // for unknown paths, which would short-circuit the checks below.
        if (!path.includes('.') && path !== '/obs-overlay' && path !== '/queue-control') {

          // ── Helper: lightweight session check for route guards ────────────
          // Returns { user, isCreator } or null if not logged in.
          // Only called once per request and cached.
          let _guardSession: { user: any; isCreator: boolean } | null | undefined;
          const guardSession = async () => {
            if (_guardSession !== undefined) return _guardSession;
            try {
              const u = await getUserFromSession(request, env, supabase);
              if (!u) { _guardSession = null; return null; }
              const { data: str } = await supabase.from('streamers').select('id').eq('twitch_id', u.twitch_id).maybeSingle();
              _guardSession = { user: u, isCreator: !!str };
              return _guardSession;
            } catch { _guardSession = null; return null; }
          };

          const serveHtml = async (file: string) => {
            const r = await env.ASSETS.fetch(new Request(`${url.origin}/${file}`));
            if (r.ok) return new Response(r.body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders } });
            return null;
          };

          const redirectTo = (dest: string) =>
            new Response(null, { status: 302, headers: { Location: dest, ...corsHeaders } });

          // ── / (root): logged in → /my-collection ─────────────────────────
          if (path === '/') {
            const s = await guardSession();
            if (s) return redirectTo('/my-collection');
            // fall through to index.html via final fallback
          }

          // ── /login: already logged in → redirect away ────────────────────
          if (path === '/login') {
            const s = await guardSession();
            if (s) {
              const nextParam = url.searchParams.get('next');
              if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) return redirectTo(nextParam);
              return redirectTo('/my-collection');
            }
            const res = await serveHtml('index.html');
            if (res) return res;
          }

          // ── /profile (bare): self-redirect ───────────────────────────────
          if (path === '/profile') {
            const s = await guardSession();
            if (s && s.user.username) return redirectTo(`/profile/${s.user.username}`);
            if (!s) return redirectTo('/login?next=/profile');
            return redirectTo('/my-collection');
          }

          // ── Auth + onboarding + role guards ──────────────────────────────
          const AUTH_REQUIRED = new Set(['/my-collection', '/battle', '/settings', '/trading', '/card-creator']);
          const CREATOR_ONLY = new Set(['/dashboard', '/card-studio', '/stream-features']);

          if (AUTH_REQUIRED.has(path) || CREATOR_ONLY.has(path)) {
            const s = await guardSession();
            if (!s) return redirectTo(`/login?next=${encodeURIComponent(path)}`);
            if (!s.user.is_onboarding_complete) return redirectTo('/onboarding');
            if (CREATOR_ONLY.has(path) && !s.isCreator) return redirectTo('/my-collection');
          }

          // ── Serve named HTML routes ──────────────────────────────────────
          if (path === '/onboarding') { const res = await serveHtml('onboarding.html'); if (res) return res; }
          if (path === '/dashboard')  { const res = await serveHtml('dashboard.html');  if (res) return res; }
          if (path === '/my-collection') { const res = await serveHtml('my-collection.html'); if (res) return res; }
          if (path === '/battle')     { const res = await serveHtml('battle.html');     if (res) return res; }
          if (path === '/settings')   { const res = await serveHtml('settings.html');   if (res) return res; }
          if (path === '/card-studio') { const res = await serveHtml('dashboard.html'); if (res) return res; }
          if (path === '/card-creator') { const res = await serveHtml('card-creator.html'); if (res) return res; }
          if (path === '/stream-features') { const res = await serveHtml('dashboard.html'); if (res) return res; }

          // /trading → trading centre (bare path)
          if (path === '/trading') { const res = await serveHtml('trading.html'); if (res) return res; }

          // /{streamer}/trading → trading centre (streamer-scoped)
          if (/^\/[a-zA-Z0-9][a-zA-Z0-9_-]{1,29}\/trading$/.test(path)) {
            const res = await serveHtml('trading.html'); if (res) return res;
          }

          // /profile/:username → public profile page
          if (path.startsWith('/profile/') && path.length > 9) {
            const res = await serveHtml('profile.html'); if (res) return res;
          }

          // /{username} → creator collection page
          // Single-segment paths that must NOT be served as /{username} → collection.html
          // (e.g. /login is a valid slug pattern but is the SPA sign-in page — see parseRoute in public/app.js reserved list)
          const KNOWN_SPA_PATHS = new Set([
            '/dashboard',
            '/onboarding',
            '/arena',
            '/privacy',
            '/terms',
            '/cookies',
            '/hub',
            '/binder',
            '/404',
            '/my-collection',
            '/battle',
            '/profile',
            '/settings',
            '/card-studio',
            '/card-creator',
            '/stream-features',
            '/login',
            '/logout',
            '/auth',
            '/trading',
          ]);
          if (!KNOWN_SPA_PATHS.has(path) && /^\/[a-zA-Z0-9][a-zA-Z0-9_-]{1,29}$/.test(path)) {
            const collectionRes = await env.ASSETS.fetch(new Request(`${url.origin}/collection.html`));
            if (collectionRes.ok) {
              return new Response(collectionRes.body, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Debug': 'collection-block', ...corsHeaders }
              });
            }
          }
        }

        // Try serving the exact static asset path (.js, .css, .png, etc.)
        const assetRes = await env.ASSETS.fetch(request.clone());
        if (assetRes.ok) return assetRes;

        // Final fallback: serve index.html for any remaining extension-less paths
        if (!path.includes('.') && path !== '/obs-overlay' && path !== '/queue-control') {
          const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
          if (indexRes.ok) {
            return new Response(indexRes.body, {
              status: 200,
              headers: { 'Content-Type': 'text/html', 'X-Debug': 'index-fallback', ...corsHeaders }
            });
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ── PUBLIC BINDER VIEW ───────────────────────────────────────────────
      // Shared edge cache (60s s-maxage) + KV (60s TTL).
      // Key: /api/public/binder/{ownerTwitchId}/{streamerId}
      // Invalidate via KV.delete when the binder or its cards are mutated.
      // ═══════════════════════════════════════════════════════════════════════

      if (method === 'GET' && path.startsWith('/api/public/binder/')) {
        try {
          // path shape: /api/public/binder/{ownerTwitchId}/{streamerId}
          const parts = path.slice('/api/public/binder/'.length).split('/');
          const ownerTwitchId = parts[0];
          const streamerId    = parts[1];

          if (!ownerTwitchId || !streamerId) {
            return secureResponse('Usage: /api/public/binder/{ownerTwitchId}/{streamerId}', 400, corsHeaders, true);
          }

          const kvKey = `binder:v1:${ownerTwitchId}:${streamerId}`;

          const binderData = await fetchWithCache(env, sharedRedis, kvKey, 60, async () => {
            // Fetch the binder rows for this owner+streamer
            const { data: binders, error: bErr } = await supabase
              .from('binders')
              .select('id, name, created_at')
              .eq('owner_twitch_id', ownerTwitchId)
              .eq('streamer_id', streamerId)
              .order('created_at', { ascending: true });
            if (bErr) throw bErr;

            // Fetch the owner's cards in this streamer's pool
            const { data: cards, error: cErr } = await supabase
              .from('enriched_user_cards')
              .select(ENRICHED_USER_CARDS_COLLECTION_SELECT)
              .eq('twitch_id', ownerTwitchId)
              .eq('streamer_id', streamerId)
              .order('created_at', { ascending: false })
              .limit(200);
            if (cErr) throw cErr;

            // Fetch owner display info
            const { data: owner } = await supabase
              .from('users')
              .select('username, avatar_url')
              .eq('twitch_id', ownerTwitchId)
              .maybeSingle();

            return { owner: owner || null, binders: binders || [], cards: cards || [] };
          }, ctx);

          const response = secureResponse(binderData, 200, corsHeaders, false, {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          });
          if (cache && cacheKeyUrl) {
            ctx.waitUntil(cache.put(cacheKeyUrl, response.clone()).catch(() => {}));
          }
          return response;
        } catch (e: any) {
          return secureResponse(e?.message || 'Failed to load binder', 500, corsHeaders, true);
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ── TRADING CENTRE API ───────────────────────────────────────────────
      // ═══════════════════════════════════════════════════════════════════════

      // GET /api/market/listings — paginated active listings for a streamer
      // Public (mine=0) results are KV-cached for 15s. mine=1 is always real-time.
      if (method === 'GET' && path === '/api/market/listings') {
        const streamerId = url.searchParams.get('streamer_id');
        if (!streamerId) return secureResponse('streamer_id required', 400, corsHeaders, true);

        const page    = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
        const limit   = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
        const sort    = url.searchParams.get('sort') || 'recent';
        const search  = (url.searchParams.get('search') || '').toLowerCase();
        const trait   = (url.searchParams.get('trait') || '').toLowerCase();
        const mineOnly = url.searchParams.get('mine') === '1';

        const user = mineOnly ? await getUserFromSession(request, env, supabase) : null;
        if (mineOnly && !user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        // Public listings are cacheable; mine=1 is real-time user-specific
        if (!mineOnly) {
          const marketKvKey = `market:v1:${streamerId}:${page}:${sort}:${search}:${trait}`;
          try {
            const cached = await fetchWithCache(env, sharedRedis, marketKvKey, 15, async () => {
              return await fetchMarketListings(supabase, streamerId, null, sort, search, trait, page, limit);
            }, ctx);
            return secureResponse(cached, 200, corsHeaders, false, {
              'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
            });
          } catch (e: any) {
            return secureResponse(e.message || 'Failed to load listings', 500, corsHeaders, true);
          }
        }

        // mine=1 — real-time, user-specific
        try {
          const result = await fetchMarketListings(supabase, streamerId, user!.twitch_id, sort, search, trait, page, limit);
          return secureResponse(result, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to load listings', 500, corsHeaders, true);
        }
      }

      // POST /api/market/listings — create a new listing
      if (method === 'POST' && path === '/api/market/listings') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as { user_card_id?: string; streamer_id?: string };
          if (!body.user_card_id || !body.streamer_id) return secureResponse('user_card_id and streamer_id required', 400, corsHeaders, true);

          // Verify the user actually owns this card in this streamer's pool
          const { data: cardCheck, error: ccError } = await supabase
            .from('user_cards')
            .select('id')
            .eq('id', body.user_card_id)
            .eq('twitch_id', user.twitch_id)
            .eq('streamer_id', body.streamer_id)
            .single();

          if (ccError || !cardCheck) return secureResponse('Card not found in your collection', 404, corsHeaders, true);

          // Check not already actively listed
          const { data: existing } = await supabase
            .from('market_listings')
            .select('id')
            .eq('user_card_id', body.user_card_id)
            .eq('status', 'active')
            .single();

          if (existing) return secureResponse('Card is already listed', 409, corsHeaders, true);

          const { data: listing, error: insertError } = await supabase
            .from('market_listings')
            .insert({
              streamer_id: body.streamer_id,
              lister_twitch_id: user.twitch_id,
              user_card_id: body.user_card_id,
              status: 'active',
            })
            .select()
            .single();

          if (insertError) throw insertError;
          // Bust market KV cache so next public view is fresh
          ctx.waitUntil(bustMarketCache(env, body.streamer_id));
          return secureResponse({ success: true, listing }, 201, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to create listing', 500, corsHeaders, true);
        }
      }

      // DELETE /api/market/listings/:id — cancel own listing
      if (method === 'DELETE' && /^\/api\/market\/listings\/[^/]+$/.test(path)) {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const listingId = path.split('/').pop();
        try {
          // Only the lister can cancel
          const { data: listing } = await supabase
            .from('market_listings')
            .select('id, lister_twitch_id, streamer_id')
            .eq('id', listingId)
            .eq('status', 'active')
            .single();

          if (!listing) return secureResponse('Listing not found', 404, corsHeaders, true);
          if (listing.lister_twitch_id !== user.twitch_id) return secureResponse('Forbidden', 403, corsHeaders, true);

          // Cancel listing and reject pending offers
          await supabase.from('market_offers').update({ status: 'rejected' }).eq('listing_id', listingId).eq('status', 'pending');
          const { error } = await supabase.from('market_listings').update({ status: 'cancelled' }).eq('id', listingId);
          if (error) throw error;

          // Bust market KV cache
          ctx.waitUntil(bustMarketCache(env, listing.streamer_id));
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to cancel listing', 500, corsHeaders, true);
        }
      }

      // GET /api/market/listings/:id/offers — get pending offers on own listing
      if (method === 'GET' && /^\/api\/market\/listings\/[^/]+\/offers$/.test(path)) {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const listingId = path.split('/')[4]; // /api/market/listings/{id}/offers
        try {
          // Verify ownership
          const { data: listing } = await supabase
            .from('market_listings')
            .select('id, lister_twitch_id')
            .eq('id', listingId)
            .single();

          if (!listing) return secureResponse('Listing not found', 404, corsHeaders, true);
          if (listing.lister_twitch_id !== user.twitch_id) return secureResponse('Forbidden', 403, corsHeaders, true);

          const { data: offerRows, error: offersError } = await supabase
            .from('market_offers')
            .select('id, offerer_twitch_id, offered_user_card_id, status, created_at, expires_at')
            .eq('listing_id', listingId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

          if (offersError) throw offersError;
          if (!offerRows?.length) return secureResponse([], 200, corsHeaders);

          const cardIds = [...new Set(offerRows.map((o: any) => o.offered_user_card_id).filter(Boolean))];
          const { data: cardRows, error: cardsError } = await supabase
            .from('enriched_user_cards')
            .select('user_card_id, name, rarity, image_url, baked_image_url, template_id, trait_list, streamer_id')
            .in('user_card_id', cardIds);
          if (cardsError) throw cardsError;
          const cardById = new Map((cardRows || []).map((c: any) => [c.user_card_id, { ...c, user_card_id: c.user_card_id }]));

          const offererIds = [...new Set(offerRows.map((o: any) => o.offerer_twitch_id).filter(Boolean))];
          const { data: userRows } = await supabase
            .from('users')
            .select('twitch_id, username')
            .in('twitch_id', offererIds);
          const nameByTwitch = new Map((userRows || []).map((u: any) => [u.twitch_id, u.username]));

          const result = (offerRows || []).map((o: any) => {
            const card = cardById.get(o.offered_user_card_id);
            return {
              id: o.id,
              offerer_twitch_id: o.offerer_twitch_id,
              offerer_username: nameByTwitch.get(o.offerer_twitch_id) || undefined,
              offered_user_card_id: o.offered_user_card_id,
              status: o.status,
              created_at: o.created_at,
              expires_at: o.expires_at,
              card: card || null,
            };
          }).filter((row: any) => row.card);

          return secureResponse(result, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to load offers', 500, corsHeaders, true);
        }
      }

      // POST /api/market/offers — make an offer on a listing
      if (method === 'POST' && path === '/api/market/offers') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        try {
          const body = await request.json() as { listing_id?: string; offered_user_card_id?: string };
          if (!body.listing_id || !body.offered_user_card_id) return secureResponse('listing_id and offered_user_card_id required', 400, corsHeaders, true);

          // Validate listing is active
          const { data: listing } = await supabase
            .from('market_listings')
            .select('id, lister_twitch_id, streamer_id')
            .eq('id', body.listing_id)
            .eq('status', 'active')
            .single();

          if (!listing) return secureResponse('Listing not found or no longer active', 404, corsHeaders, true);
          if (listing.lister_twitch_id === user.twitch_id) return secureResponse('You cannot offer on your own listing', 400, corsHeaders, true);

          // Verify the offered card belongs to the offerer and is in the same streamer hub
          const { data: cardCheck } = await supabase
            .from('user_cards')
            .select('id')
            .eq('id', body.offered_user_card_id)
            .eq('twitch_id', user.twitch_id)
            .eq('streamer_id', listing.streamer_id)
            .single();

          if (!cardCheck) return secureResponse('Card not found in your collection', 404, corsHeaders, true);

          // Check for existing pending offer from this user on this listing
          const { data: existingOffer } = await supabase
            .from('market_offers')
            .select('id')
            .eq('listing_id', body.listing_id)
            .eq('offerer_twitch_id', user.twitch_id)
            .eq('status', 'pending')
            .single();

          if (existingOffer) return secureResponse('You already have a pending offer on this listing', 409, corsHeaders, true);

          const { data: offer, error: insertError } = await supabase
            .from('market_offers')
            .insert({
              listing_id: body.listing_id,
              offerer_twitch_id: user.twitch_id,
              offered_user_card_id: body.offered_user_card_id,
              status: 'pending',
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return secureResponse({ success: true, offer }, 201, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to submit offer', 500, corsHeaders, true);
        }
      }

      // POST /api/market/offers/:id/accept — accept an offer (swap cards)
      if (method === 'POST' && /^\/api\/market\/offers\/[^/]+\/accept$/.test(path)) {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const offerId = path.split('/')[4]; // /api/market/offers/{id}/accept
        try {
          // Verify caller owns the listing
          const { data: offer } = await supabase
            .from('market_offers')
            .select('id, listing_id')
            .eq('id', offerId)
            .eq('status', 'pending')
            .single();

          if (!offer) return secureResponse('Offer not found or already processed', 404, corsHeaders, true);

          const { data: listing } = await supabase
            .from('market_listings')
            .select('id, lister_twitch_id')
            .eq('id', offer.listing_id)
            .eq('status', 'active')
            .single();

          if (!listing) return secureResponse('Listing not found or no longer active', 404, corsHeaders, true);
          if (listing.lister_twitch_id !== user.twitch_id) return secureResponse('Forbidden', 403, corsHeaders, true);

          // Call the atomic RPC to swap cards
          const { data: result, error: rpcError } = await supabase.rpc('accept_trade_offer', { p_offer_id: offerId });
          if (rpcError) throw rpcError;

          // Bust market cache and collection ETags for both parties
          ctx.waitUntil(Promise.all([
            bustMarketCache(env, listing.streamer_id),
            // Collection ETags: we don't have both twitch IDs here without extra queries —
            // the ETag TTL (5 min) is an acceptable backstop for this low-frequency mutation.
          ]));
          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to accept offer', 500, corsHeaders, true);
        }
      }

      // DELETE /api/market/offers/:id — retract own pending offer
      if (method === 'DELETE' && /^\/api\/market\/offers\/[^/]+$/.test(path)) {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const offerId = path.split('/').pop();
        try {
          const { data: offer } = await supabase
            .from('market_offers')
            .select('id, offerer_twitch_id')
            .eq('id', offerId)
            .eq('status', 'pending')
            .single();

          if (!offer) return secureResponse('Offer not found', 404, corsHeaders, true);
          if (offer.offerer_twitch_id !== user.twitch_id) return secureResponse('Forbidden', 403, corsHeaders, true);

          const { error } = await supabase.from('market_offers').update({ status: 'rejected' }).eq('id', offerId);
          if (error) throw error;

          return secureResponse({ success: true }, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to retract offer', 500, corsHeaders, true);
        }
      }

      // GET /api/market/my-cards — user's cards available to list or offer
      if (method === 'GET' && path === '/api/market/my-cards') {
        const user = await getUserFromSession(request, env, supabase);
        if (!user) return secureResponse('Unauthorized', 401, corsHeaders, true);

        const streamerId   = url.searchParams.get('streamer_id');
        const excludeListed = url.searchParams.get('exclude_listed') === '1';
        if (!streamerId) return secureResponse('streamer_id required', 400, corsHeaders, true);

        try {
          // Get user's cards for this streamer (using enriched view for image/trait data)
          let q = supabase
            .from('enriched_user_cards')
            .select('user_card_id, name, rarity, image_url, baked_image_url, template_id, trait_list')
            .eq('twitch_id', user.twitch_id)
            .eq('streamer_id', streamerId)
            .order('rarity', { ascending: false })
            .limit(200);

          const { data: cards, error } = await q;
          if (error) throw error;

          let result = cards || [];

          if (excludeListed && result.length) {
            // Filter out cards that already have an active listing
            const cardIds = result.map((c: any) => c.user_card_id);
            const { data: listed } = await supabase
              .from('market_listings')
              .select('user_card_id')
              .eq('status', 'active')
              .in('user_card_id', cardIds);

            const listedSet = new Set((listed || []).map((l: any) => l.user_card_id));
            result = result.filter((c: any) => !listedSet.has(c.user_card_id));
          }

          return secureResponse(result, 200, corsHeaders);
        } catch (e: any) {
          return secureResponse(e.message || 'Failed to load cards', 500, corsHeaders, true);
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



// --- DURABLE OBJECTS (Advanced Optimization) ---

/**
 * PackOpeningSession DO
 * Manages the multi-step reveal of a pack to avoid hammering Postgres with partial state.
 */
export class PackOpeningSession {
  state: any; // DurableObjectState
  env: Env;

  constructor(state: any, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Simple state management for demonstration
    let current: any = await this.state.storage.get("session") || { revealed: 0, total: 5, cards: [] };

    if (path === "/reveal") {
      if (current.revealed < current.total) {
        current.revealed++;
        await this.state.storage.put("session", current);
      }
      return new Response(JSON.stringify(current), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(current), { headers: { "Content-Type": "application/json" } });
  }
}

// ─── OBSQueueSession Durable Object ──────────────────────────────────────────
/**
 * Push-based OBS signal hub.
 *
 * Routes:
 *   GET  /ws          — WebSocket upgrade; broadcasts state changes to overlay clients
 *   POST /signal      — { paused?, skip? } — update stored state + broadcast to all WS clients
 *   GET  /state       — return current { paused, skip } (for poll-fallback)
 *   POST /clear-skip  — atomically clear skip flag after it has been consumed
 *
 * One DO instance per streamer (idFromName(streamerId)).
 * Replaces the Supabase polling pattern: 7,200 DB queries/hr → 0 per active streamer.
 */
export class OBSQueueSession {
  state: DurableObjectState;
  env: Env;
  sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    // Re-attach any hibernated WebSockets on wake
    for (const ws of this.state.getWebSockets()) {
      this.sockets.add(ws);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── WebSocket upgrade ─────────────────────────────────────────────────────
    if (path === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.state.acceptWebSocket(server);
      this.sockets.add(server);
      server.addEventListener('close', () => this.sockets.delete(server));
      server.addEventListener('error', () => this.sockets.delete(server));

      // Send current state immediately on connect so overlay is in sync
      const current = await this.state.storage.get<any>('state') ?? { paused: false, skip: false };
      server.send(JSON.stringify({ type: 'state', ...current }));

      return new Response(null, { status: 101, webSocket: client });
    }

    // ── Signal push from Worker ───────────────────────────────────────────────
    if (path === '/signal' && request.method === 'POST') {
      const signal = await request.json() as { paused?: boolean; skip?: boolean };
      const current = await this.state.storage.get<any>('state') ?? { paused: false, skip: false };
      const updated = { ...current, ...signal };
      await this.state.storage.put('state', updated);

      // Broadcast to all connected OBS overlays
      const msg = JSON.stringify({ type: 'signal', ...updated });
      for (const ws of [...this.sockets]) {
        try {
          ws.send(msg);
        } catch {
          this.sockets.delete(ws);
        }
      }
      return new Response('OK', { status: 200 });
    }

    // ── State poll (poll-fallback path) ───────────────────────────────────────
    if (path === '/state' && request.method === 'GET') {
      const state = await this.state.storage.get<any>('state') ?? { paused: false, skip: false };
      return new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Clear skip signal (consumed by poll client) ───────────────────────────
    if (path === '/clear-skip' && request.method === 'POST') {
      const current = await this.state.storage.get<any>('state') ?? { paused: false, skip: false };
      await this.state.storage.put('state', { ...current, skip: false });
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }
}
