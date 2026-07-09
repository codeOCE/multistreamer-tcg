import { SignJWT } from 'jose';
import { env } from 'cloudflare:test';

/** Mints a session cookie the same way src/index.ts signs one (SignJWT, sub = twitch_id). */
export async function sessionCookieFor(twitchId: string) {
  const token = await new SignJWT({ sub: twitchId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(env.SESSION_SECRET as string));
  return `session=${token}`;
}
