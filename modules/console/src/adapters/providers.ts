// The providers of the sign-in (ADR 0134): OpenID Connect with the authorization code flow, PKCE, state and nonce,
// through openid-client; and GitHub's OAuth app, which reads the person's verified primary email from its API.
import * as client from "openid-client";
import type { SignIn } from "../domain/signin.ts";

export interface Begun {
  /** Where the browser goes to sign in. */
  url: string;
  /** What the callback needs: state, nonce and verifier, kept in a short-lived cookie. */
  flow: { state: string; nonce?: string; verifier?: string };
}

export interface Signed {
  email: string;
  name?: string;
  verified: boolean;
}

export interface Provider {
  begin(): Promise<Begun>;
  /** The person of the callback, or throws with the reason. */
  finish(callback: URL, flow: Begun["flow"]): Promise<Signed>;
}

const callbackOf = (sign: SignIn) => `${sign.url}/signin/callback`;

export function providerOf(sign: SignIn, now: () => number): Provider {
  return sign.provider === "oidc" ? oidc(sign, now) : github(sign);
}

function oidc(sign: SignIn, now: () => number): Provider {
  const settings = sign.oidc as NonNullable<SignIn["oidc"]>;
  let found: Promise<client.Configuration> | undefined;
  const configuration = () => {
    const issuer = new URL(settings.issuer);
    // A provider on loopback, like a test's, answers over HTTP; any other needs HTTPS.
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(issuer.hostname);
    found ??= client.discovery(
      issuer,
      settings.clientId,
      // The console's clock: OSF_NOW in tests, so the provider's tokens of that time are valid.
      { [client.clockSkew]: Math.round((now() - Date.now()) / 1000) },
      client.ClientSecretPost(settings.clientSecret),
      loopback ? { execute: [client.allowInsecureRequests] } : undefined,
    );
    found.catch(() => {
      found = undefined;
    });
    return found;
  };
  return {
    async begin() {
      const config = await configuration();
      const flow = {
        state: client.randomState(),
        nonce: client.randomNonce(),
        verifier: client.randomPKCECodeVerifier(),
      };
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: callbackOf(sign),
        scope: "openid email profile",
        state: flow.state,
        nonce: flow.nonce,
        code_challenge: await client.calculatePKCECodeChallenge(flow.verifier),
        code_challenge_method: "S256",
      });
      return { url: url.href, flow };
    },
    async finish(callback, flow) {
      const config = await configuration();
      const tokens = await client.authorizationCodeGrant(config, callback, {
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        pkceCodeVerifier: flow.verifier,
      });
      const claims: Record<string, unknown> = tokens.claims() ?? {};
      return {
        email: String(claims.email ?? ""),
        ...(typeof claims.name === "string" ? { name: claims.name } : {}),
        verified: claims.email_verified === true,
      };
    },
  };
}

function github(sign: SignIn): Provider {
  const settings = sign.github as NonNullable<SignIn["github"]>;
  return {
    async begin() {
      const flow = { state: client.randomState() };
      const url = new URL(`${settings.url}/login/oauth/authorize`);
      url.searchParams.set("client_id", settings.clientId);
      url.searchParams.set("redirect_uri", callbackOf(sign));
      url.searchParams.set("scope", "read:user user:email");
      url.searchParams.set("state", flow.state);
      return { url: url.href, flow };
    },
    async finish(callback, flow) {
      if (callback.searchParams.get("state") !== flow.state) throw new Error("the sign-in's state does not match");
      const code = callback.searchParams.get("code");
      if (!code) throw new Error(callback.searchParams.get("error") ?? "GitHub gave no code");
      const answer = (await (
        await fetch(`${settings.url}/login/oauth/access_token`, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            code,
            redirect_uri: callbackOf(sign),
          }),
        })
      ).json()) as { access_token?: string; error?: string };
      if (!answer.access_token) throw new Error(answer.error ?? "GitHub gave no token");
      const headers = { authorization: `Bearer ${answer.access_token}`, accept: "application/vnd.github+json" };
      const [user, emails] = (await Promise.all([
        fetch(`${settings.apiUrl}/user`, { headers }).then((response) => response.json()),
        fetch(`${settings.apiUrl}/user/emails`, { headers }).then((response) => response.json()),
      ])) as [{ name?: string | null }, { email: string; primary: boolean; verified: boolean }[]];
      const primary = emails.find((email) => email.primary);
      return {
        email: primary?.email ?? "",
        ...(user.name ? { name: user.name } : {}),
        verified: primary?.verified === true,
      };
    },
  };
}
