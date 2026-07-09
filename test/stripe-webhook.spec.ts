import { SELF, fetchMock, env } from 'cloudflare:test';
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import Stripe from 'stripe';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

const stripe = new Stripe('sk_test_dummy');

async function signedPayload(body: object, secret = env.STRIPE_WEBHOOK_SECRET as string) {
  const payload = JSON.stringify(body);
  const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
  return { payload, header };
}

describe('POST /api/payment/webhook', () => {
  it('rejects a request with no signature before touching the database', async () => {
    const res = await SELF.fetch('https://tcg.creatorcastle.gg/api/payment/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(res.status).toBe(400);
    // fetchMock has no interceptors queued — if the handler had reached Supabase,
    // the request would hang or throw "no matching mock" instead of resolving here.
  });

  it('rejects a request signed with the wrong secret', async () => {
    const { payload, header } = await signedPayload({ type: 'checkout.session.completed' }, 'whsec_totally_wrong');
    const res = await SELF.fetch('https://tcg.creatorcastle.gg/api/payment/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': header },
      body: payload,
    });
    expect(res.status).toBe(400);
  });

  it('is not swallowed by the beta gate even when ADMIN_PASSWORD is set', async () => {
    // Regression test for the bug where BETA_GATE_EXEMPT listed the wrong path
    // ('/api/stripe/webhook' instead of the real '/api/payment/webhook'), so a
    // server-to-server Stripe call with no cookies was 302-redirected instead
    // of reaching signature verification.
    const prevAdminPassword = (env as any).ADMIN_PASSWORD;
    (env as any).ADMIN_PASSWORD = 'test-beta-password';
    try {
      const { payload, header } = await signedPayload({ type: 'ping' });
      const res = await SELF.fetch('https://tcg.creatorcastle.gg/api/payment/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': header },
        body: payload,
      });
      // A correctly-signed-but-unhandled event type still proves the request
      // reached Stripe's verification step rather than being redirected (302).
      expect(res.status).not.toBe(302);
    } finally {
      (env as any).ADMIN_PASSWORD = prevAdminPassword;
    }
  });
});
