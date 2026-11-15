// fakes.personIssuer: an issuer of person proofs in the test process (ADR 0151). It serves its key set, the format
// `person-keys`, at `/.well-known/jwks.json` and signs proofs with an Ed25519 key made for the test run and never
// written down. A proof carries the testkit's clock, so a module that runs with OSF_NOW accepts it; a test changes a
// claim or the header to prove that a module refuses it.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { JSONWebKeySet } from "jose";
import { FIXED_DATE } from "../support/process.ts";

export interface PersonIssuerOptions {
  /** The issuer's name, the proofs' `iss` and the name of the module's setting. Default "console". */
  name?: string;
  /** Also answer containers: listen on every interface and give `containerUrl` (ADR 0054). */
  containers?: boolean;
}

/** The claims of a proof (format `person-proof`); each one a test leaves out has its default. */
export interface PersonClaims {
  /** The person, the actor's `id`. */
  sub: string | undefined;
  /** The module the call goes to: "foreman", "intake" or "gatekeeper". */
  aud: string | undefined;
  /** The request's path, without the query. */
  path: string | undefined;
  /** Default "POST". */
  method?: string;
  /** The request's body as sent; its SHA-256 is `bodyDigest`. Default: empty. */
  body?: string | Uint8Array;
  /** The person's role. Default "member". */
  role?: string;
  name?: string;
  /** Default: the testkit's clock, 2026-01-01T00:00:00Z, in seconds. */
  iat?: number;
  /** Default: 30 seconds after `iat`. */
  exp?: number;
  /** Default: the issuer's name. */
  iss?: string;
  /** Default: the SHA-256 of `body`, in base64url. */
  bodyDigest?: string;
  /** Any other claim; `undefined` leaves a claim out. */
  [claim: string]: unknown;
}

/** The protected header of a proof, to make one that a module refuses. */
export interface PersonHeader {
  /** Default "osf-person+jwt". */
  typ?: string;
  /** "Ed25519" (the default) or "EdDSA", the older name of the same signature. */
  alg?: "Ed25519" | "EdDSA";
  /** Default: the thumbprint of the issuer's key. */
  kid?: string;
}

export interface FakePersonIssuer {
  name: string;
  /** The key set's URL. */
  url: string;
  /** The key set's URL as a container reaches it, with `containers: true`. */
  containerUrl?: string;
  /** `<name>=<url>`, the value of a module's setting `<MODULE>_PERSON_KEYS`. */
  setting: string;
  /** The key set it serves: one Ed25519 public key. */
  keys: { keys: Record<string, string>[] };
  /** A signed proof, the value of the header `OSF-Person`. */
  prove(claims: PersonClaims, header?: PersonHeader): Promise<string>;
  /** How many times the key set was fetched. */
  fetched(): number;
}

/** A proof as `fakes.personProof` reads it, for a test of a module that sends one. */
export interface ReadProof {
  /** Whether the key of the key set that the proof's `kid` names verifies its Ed25519 signature. */
  verified: boolean;
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  /** Whether the claim `bodyDigest` is the SHA-256 of the body, in base64url. */
  bodyMatches: boolean;
}

/** Reads a proof that a module sent, with the key set at `keys` and the body the proof came with. */
export async function readPersonProof(proof: string, keys: string, body = ""): Promise<ReadProof> {
  const { compactVerify, createLocalJWKSet, decodeJwt, decodeProtectedHeader } = await import("jose");
  const set = (await (await fetch(keys)).json()) as JSONWebKeySet;
  const verified = await compactVerify(proof, createLocalJWKSet(set), { algorithms: ["Ed25519"] }).then(
    () => true,
    () => false,
  );
  const claims = decodeJwt(proof);
  const bodyMatches = claims.bodyDigest === createHash("sha256").update(body).digest("base64url");
  return { verified, header: decodeProtectedHeader(proof), claims, bodyMatches };
}

/** The testkit's clock in seconds since 1970. */
const PROOF_NOW = Math.floor(Date.parse(FIXED_DATE) / 1000);

export async function startPersonIssuer(
  options: PersonIssuerOptions = {},
): Promise<{ issuer: FakePersonIssuer; close(): Promise<string[]> }> {
  // jose loads with the first issuer a scenario starts: most test processes start none.
  const { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT } = await import("jose");
  const name = options.name ?? "console";
  const { privateKey, publicKey } = await generateKeyPair("Ed25519");
  const { kty, crv, x } = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint({ kty, crv, x }, "sha256");
  const keys = { keys: [{ kty: "OKP", crv: "Ed25519", alg: "Ed25519", use: "sig", kid, x } as Record<string, string>] };
  const problems: string[] = [];
  let fetched = 0;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/.well-known/jwks.json") {
      fetched += 1;
      response.writeHead(200, { "content-type": "application/json" });
      return response.end(JSON.stringify(keys));
    }
    problems.push(`fakes.personIssuer got an unsupported request: ${request.method} ${request.url}`);
    response.writeHead(404, { "content-type": "application/json" });
    response.end('{"error":"not_found"}');
  });
  await new Promise<void>((resolve) => server.listen(0, options.containers ? "0.0.0.0" : "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  return {
    issuer: {
      name,
      url,
      ...(options.containers ? { containerUrl: `http://host.docker.internal:${port}/.well-known/jwks.json` } : {}),
      setting: `${name}=${url}`,
      keys,
      async prove(claims, header = {}) {
        const { body = "", ...rest } = claims;
        const iat = claims.iat ?? PROOF_NOW;
        const defaults = {
          iss: name,
          role: "member",
          method: "POST",
          iat,
          exp: iat + 30,
          bodyDigest: createHash("sha256").update(body).digest("base64url"),
        };
        const payload = Object.fromEntries(
          Object.entries({ ...defaults, ...rest }).filter(([, value]) => value !== undefined),
        );
        return new SignJWT(payload)
          .setProtectedHeader({
            alg: header.alg ?? "Ed25519",
            kid: header.kid ?? kid,
            typ: header.typ ?? "osf-person+jwt",
          })
          .sign(privateKey);
      },
      fetched: () => fetched,
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return problems.splice(0);
    },
  };
}
