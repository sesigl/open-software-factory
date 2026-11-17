// The client of the fakes.oidc scenarios: they call the provider in the test's process (ADR 0039), and a module would
// sign in the same way, with the authorization code flow and PKCE, and verify the ID token with the provider's keys.
// Web Crypto is a global of Node, so the client needs no import for it.
import type { FakeOidc } from "@opensoftware/testkit";

const VERIFIER = "v".repeat(43);
const REDIRECT = "http://127.0.0.1:9/callback";
const base64url = (bytes: ArrayBuffer): string => Buffer.from(bytes).toString("base64url");
/** The parsed JSON of an answer. */
// biome-ignore lint/suspicious/noExplicitAny: the client reads the provider's JSON as a module would.
const json = async (answer: Response | Promise<Response>): Promise<any> => (await answer).json();

/**
 * Signs in at the provider as a module does and gives the state and the error, or the state, whether the provider's
 * first key verifies the ID token, whether its issuer is the provider, and its claims.
 */
export async function signIn(oidc: FakeOidc): Promise<Record<string, unknown>> {
  const config = await json(fetch(`${oidc.url}/.well-known/openid-configuration`));
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(VERIFIER)));
  const authorize = new URL(config.authorization_endpoint);
  const query = {
    client_id: oidc.clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    state: "state-1",
    nonce: "nonce-1",
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  for (const [key, value] of Object.entries(query)) authorize.searchParams.set(key, value);
  const back = new URL((await fetch(authorize, { redirect: "manual" })).headers.get("location") ?? "");
  const state = back.searchParams.get("state");
  const error = back.searchParams.get("error");
  if (error) return { state, error };
  const basic = Buffer.from(`${oidc.clientId}:${oidc.clientSecret}`).toString("base64");
  const token = await json(
    fetch(config.token_endpoint, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: back.searchParams.get("code") ?? "",
        redirect_uri: REDIRECT,
        code_verifier: VERIFIER,
      }),
    }),
  );
  const [head, body, signature] = String(token.id_token).split(".");
  const { keys } = await json(fetch(config.jwks_uri));
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("jwk", keys[0], algorithm, false, ["verify"]);
  const signed = new TextEncoder().encode(`${head}.${body}`);
  const valid = await crypto.subtle.verify(algorithm, key, Buffer.from(signature ?? "", "base64url"), signed);
  const claims = JSON.parse(Buffer.from(body ?? "", "base64url").toString());
  return {
    state,
    valid,
    issuer: claims.iss === oidc.url,
    email: claims.email,
    verified: claims.email_verified,
    name: claims.name,
    nonce: claims.nonce,
    aud: claims.aud,
    iat: new Date(claims.iat * 1000).toISOString(),
  };
}
