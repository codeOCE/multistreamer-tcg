import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // Test-only values — never point at real Stripe/Supabase/Twitch.
          // ADMIN_PASSWORD is intentionally unset so the beta gate doesn't
          // block test requests to routes other than what's under test.
          bindings: {
            // Explicitly blank — overrides any real value loaded from .env so the
            // beta gate doesn't intercept routes under test. Tests that need the
            // gate active set it per-test via `env.ADMIN_PASSWORD = '...'`.
            ADMIN_PASSWORD: '',
            SUPABASE_URL: 'https://test.supabase.local',
            SUPABASE_KEY: 'test-anon-key',
            SUPABASE_SERVICE_KEY: 'test-service-key',
            TWITCH_CLIENT_ID: 'test-twitch-client-id',
            TWITCH_CLIENT_SECRET: 'test-twitch-client-secret',
            TWITCH_WEBHOOK_SECRET: 'test-twitch-webhook-secret',
            STRIPE_SECRET_KEY: 'sk_test_dummy',
            STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
            FRONTEND_URL: 'https://test.local',
            SESSION_SECRET: 'test-session-secret-not-real',
            CREATOR_CDN_BASE: 'https://cdn.test.local',
          },
        },
      },
    },
  },
});
