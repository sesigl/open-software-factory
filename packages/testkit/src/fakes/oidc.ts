// fakes.oidc: an OpenID Connect provider in the test process (ADR 0134). It serves the discovery document, the
// authorization endpoint, the token endpoint and the keys, and signs in the person a test names: the authorization
// endpoint redirects at once with a code, without a page. ID tokens carry the testkit's clock, so a module that runs
// with OSF_NOW checks them as valid. It checks PKCE (S256), the client's secret and the redirect address.
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { FIXED_DATE } from "../support/process.ts";

export interface OidcPerson {
  email: string;
  name?: string;
  /** Whether the provider marks the email as verified; true unless set. */
  verified?: boolean;
}

export interface OidcOptions {
  /** Also answer containers: listen on every interface and give `containerUrl` (ADR 0054). */
  containers?: boolean;
}

export interface FakeOidc {
  /** The issuer; its discovery document is `<url>/.well-known/openid-configuration`. */
  url: string;
  /** The issuer as a container reaches it, with `containers: true`. */
  containerUrl?: string;
  /** The client the module signs in with. */
  clientId: string;
  clientSecret: string;
  /** The person whom the next authorization signs in. Without one, the provider answers `access_denied`. */
  signIn(person: OidcPerson): void;
  /** The paths of the requests it received, the first first. */
  received(): string[];
}

const CLIENT_ID = "testkit-console";
// A value of the test only, like the other fakes' tokens: no provider issues it.
const CLIENT_SECRET = "testkit-oidc-client-secret";

const form = async (request: IncomingMessage): Promise<URLSearchParams> => {
  let body = "";
  for await (const chunk of request) body += chunk;
  return new URLSearchParams(body);
};

export async function startOidc(options: OidcOptions = {}): Promise<{ oidc: FakeOidc; close(): Promise<string[]> }> {
  // jose loads with the first provider a scenario starts: most test processes start none.
  const { exportJWK, generateKeyPair, SignJWT } = await import("jose");
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "testkit", alg: "RS256", use: "sig" };
  const received: string[] = [];
  const problems: string[] = [];
  let next: OidcPerson | undefined;
  let codes = 0;
  const pending = new Map<
    string,
    { person: OidcPerson; redirect: string; nonce?: string; challenge?: string; issuer: string }
  >();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://fake");
    received.push(url.pathname);
    const issuer = `http://${request.headers.host}`;
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/.well-known/openid-configuration") {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
        scopes_supported: ["openid", "email", "profile"],
      });
    }
    if (url.pathname === "/jwks") return json(200, { keys: [jwk] });
    if (url.pathname === "/authorize") {
      const query = url.searchParams;
      const redirect = query.get("redirect_uri") ?? "";
      const back = new URL(redirect);
      const state = query.get("state");
      if (state) back.searchParams.set("state", state);
      if (query.get("client_id") !== CLIENT_ID || !next) {
        back.searchParams.set("error", "access_denied");
      } else {
        const code = `code-${++codes}`;
        pending.set(code, {
          person: next,
          redirect,
          nonce: query.get("nonce") ?? undefined,
          challenge: query.get("code_challenge") ?? undefined,
          issuer,
        });
        next = undefined;
        back.searchParams.set("code", code);
      }
      response.writeHead(302, { location: back.href });
      return response.end();
    }
    if (url.pathname === "/token" && request.method === "POST") {
      const fields = await form(request);
      const basic = /^Basic (.+)$/.exec(request.headers.authorization ?? "")?.[1];
      const [id, secret] = basic
        ? Buffer.from(basic, "base64").toString().split(":").map(decodeURIComponent)
        : [fields.get("client_id"), fields.get("client_secret")];
      const code = fields.get("code") ?? "";
      const grant = pending.get(code);
      pending.delete(code);
      const verifier = fields.get("code_verifier") ?? "";
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const refused =
        id !== CLIENT_ID || secret !== CLIENT_SECRET
          ? "invalid_client"
          : !grant || grant.redirect !== fields.get("redirect_uri") || grant.challenge !== challenge
            ? "invalid_grant"
            : undefined;
      if (refused || !grant) {
        problems.push(`fakes.oidc refused a token request: ${refused}`);
        return json(400, { error: refused });
      }
      const now = Math.floor(Date.parse(FIXED_DATE) / 1000);
      const idToken = await new SignJWT({
        email: grant.person.email,
        email_verified: grant.person.verified ?? true,
        ...(grant.person.name ? { name: grant.person.name } : {}),
        ...(grant.nonce ? { nonce: grant.nonce } : {}),
      })
        .setProtectedHeader({ alg: "RS256", kid: "testkit" })
        .setIssuer(grant.issuer)
        .setSubject(grant.person.email)
        .setAudience(CLIENT_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(privateKey);
      return json(200, { access_token: `access-${code}`, token_type: "Bearer", expires_in: 300, id_token: idToken });
    }
    problems.push(`fakes.oidc got an unsupported request: ${request.method} ${url.pathname}`);
    return json(404, { error: "not_found" });
  });
  await new Promise<void>((resolve) => server.listen(0, options.containers ? "0.0.0.0" : "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    oidc: {
      url: `http://127.0.0.1:${port}`,
      ...(options.containers ? { containerUrl: `http://host.docker.internal:${port}` } : {}),
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      signIn(person) {
        next = person;
      },
      received: () => [...received],
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return problems.splice(0);
    },
  };
}
