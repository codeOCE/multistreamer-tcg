import { SELF, fetchMock, env } from 'cloudflare:test';
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { sessionCookieFor } from './helpers/auth';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

const SUPABASE_ORIGIN = env.SUPABASE_URL as string;
const TWITCH_ID = 'twitch-user-123';

function mockUserLookup(twitchId: string) {
  fetchMock
    .get(SUPABASE_ORIGIN)
    .intercept({ method: 'GET', path: (p) => p.startsWith('/rest/v1/users') })
    .reply(200, [{ twitch_id: twitchId, username: 'testuser', role: 'collector' }]);
}

function mockPackSessionLookup(result: unknown[]) {
  fetchMock
    .get(SUPABASE_ORIGIN)
    .intercept({ method: 'GET', path: (p) => p.startsWith('/rest/v1/pack_sessions') })
    .reply(200, result);
}

describe('POST /api/packs/:id/open — ownership & replay guard', () => {
  it('returns 404 for a pack that does not belong to the requesting user (or is already opened)', async () => {
    mockUserLookup(TWITCH_ID);
    // Supabase query filters by twitch_id + opened_at IS NULL server-side; simulating
    // "no matching row" is how both "not yours" and "already opened" surface identically —
    // that's the point: the endpoint must not leak which case it is.
    mockPackSessionLookup([]);

    const cookie = await sessionCookieFor(TWITCH_ID);
    const res = await SELF.fetch('https://tcg.creatorcastle.gg/api/packs/some-other-users-pack-id/open', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
      redirect: 'manual',
    });

    expect(res.status).toBe(404);
    const body: any = await res.json();
    // secureResponse(data, status, headers, isError=true) wraps `data` under another `error` key.
    expect(body.error.error).toMatch(/not found/i);
  });

  it('returns 401 with no session cookie at all', async () => {
    const res = await SELF.fetch('https://tcg.creatorcastle.gg/api/packs/any-id/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
  });
});
