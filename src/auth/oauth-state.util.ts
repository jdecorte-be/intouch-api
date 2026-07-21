import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless CSRF protection for the Google OAuth redirect flow: no session
// exists yet at /auth/google time, so instead of storing state server-side
// we sign it with AUTH_SECRET and verify the signature on callback.
export type OAuthClient = "web" | "mobile";

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createOAuthState(client: OAuthClient) {
  const payload = `${client}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string | undefined): OAuthClient | null {
  if (!state) {
    return null;
  }

  const [client, timestamp, signature] = state.split(".");

  if (!client || !timestamp || !signature || (client !== "web" && client !== "mobile")) {
    return null;
  }

  const payload = `${client}.${timestamp}`;
  const expected = sign(payload);

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  // 10 minute validity window for the round trip through Google.
  if (Date.now() - Number(timestamp) > 10 * 60 * 1000) {
    return null;
  }

  return client;
}
