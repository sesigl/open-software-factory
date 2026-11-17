---
status: accepted
topic: console
date: 2026-11-15
---

# 0151. The console proves the person to every module: a signed token per call, its keys published by the console

## Context

foreman, intake and gatekeeper take the person who acts from the caller. The console names the person in the body of
each call (`requester` of `POST /v1/work-items`, `by` of a signal, a retry and a gate decision), and the module only
checks the API token (ADR 0089, ADR 0118). So anyone who holds a module's API token can act as any person: a team's
script, a module that holds another module's token (the foreman holds gatekeeper's), or whoever reads `.env`. ADR
0118 left this open: "Revisit when gatekeeper should check the person itself". With its own sign-in (ADR 0134) the
console knows who acted, and T-61 of `TODO.md` asks the console to prove it, before a console is reachable from the
internet.

What a module trusts today:

| Module | Route | Where the person comes from |
| --- | --- | --- |
| intake | `POST /v1/work-items` | `requester` of the body; `intake mcp` sends `INTAKE_REQUESTER` of the developer's machine |
| foreman | `POST /v1/runs/{runId}/signals`, `POST /v1/runs/{runId}/retry` | `by` of the body |
| gatekeeper | `POST /v1/gates/{gateId}/decisions` | `by` of the body, matched against the groups file |
| foreman | `POST /v1/runs`, `work.received@v1` | the work item's `requester`, as intake or a program made it |

Slack, the forge and Sentry reach intake and gatekeeper through their own signed webhooks; they name the person
themselves and do not change here.

This ADR is the first slice of T-61: the decision and the formats in `contracts/`. The console's slice signs, and one
slice per module checks.

## Decision

### What is proven

For each call that names a person, the console signs a **person proof**: a JSON Web Token (RFC 7519) in the compact
form of a JSON Web Signature (RFC 7515), sent in the request header `OSF-Person`. The API token in `Authorization`
stays: a module wants both. The body does not change, so a module that does not know the header ignores it.

The protected header is `{ "alg": "Ed25519", "kid": <key ID>, "typ": "osf-person+jwt" }`. `Ed25519` is the fully
specified name of RFC 9864 for EdDSA with Ed25519 (RFC 8037). The `typ` (explicit typing, RFC 8725) keeps another JWT,
like an ID token of the provider, from passing as a proof. A module accepts only this `alg` and this `typ`.

The claims are the format `person-proof` of `contracts/` (model `PersonProof`):

| Claim | Required | Value |
| --- | --- | --- |
| `iss` | yes | The issuer's name, a lowercase name: `console` for the console |
| `sub` | yes | The person, as the module records the actor's `id`: the email in lower case with the own sign-in, the proxy header's value behind a proxy |
| `name` | no | The name to show; the module records it as the actor's `displayName` |
| `role` | yes | The person's role from the access file: `member`, `factory-engineer` or `admin` (ADR 0134, ADR 0148) |
| `aud` | yes | The module the call goes to: `foreman`, `intake` or `gatekeeper` |
| `iat` | yes | When the console signed it, in seconds since 1970 (a NumericDate) |
| `exp` | yes | Its end, at most 60 seconds after `iat`; the console signs for 30 seconds |
| `method` | yes | The request's method in upper case, like `POST` |
| `path` | yes | The request's path as sent in the request line, without the query, like `/v1/runs/run_0a1b/signals` |
| `bodyDigest` | yes | The SHA-256 of the request's body bytes as sent, in base64url without padding (43 characters) |

The format is open, as the wire formats are (ADR 0143): a module ignores a claim it does not know, so a minor
version of `contracts` may add an optional one. Every claim above that a module checks is required.

No claim names the factory. The path binds the proof to one run or one gate, whose ID only one foreman or gatekeeper
knows, and `aud` binds it to one kind of module. No `jti`: a proof is bound to one request (below), so a replay can
only repeat the same request within 30 seconds. A repeated "submit work" gets the same work item, since the console's
dedupe key holds the person and the time; a repeated signal or decision is the same action again. A module therefore
keeps no list of seen proofs, and a module with several replicas needs no shared state.

### Keys

- **The console signs with an Ed25519 key** from `CONSOLE_SIGNING_KEY`: 32 random bytes as 64 hex digits, the seed of
  the private key (RFC 8032). Node 24 makes the key pair from the seed, and `jose` signs with it; no key file and no
  PEM. Like `CONSOLE_SESSION_SECRET`, it may name two keys separated by a comma: the first signs, every key is
  published.
- **The console publishes the public keys** at `GET /.well-known/jwks.json` as a JSON Web Key Set (RFC 7517), the format
  `person-keys` of `contracts/`: `{ "keys": [{ "kty": "OKP", "crv": "Ed25519", "alg": "Ed25519", "use": "sig", "kid",
  "x" }] }`. The `kid` is the key's JWK thumbprint (RFC 7638, SHA-256). The key object is closed: a key set that holds
  a private part (`d`) or any other member is invalid. The route needs no session, like `/v1/ready`, answers with
  `cache-control: max-age=300`, and answers 404 without `CONSOLE_SIGNING_KEY`.
- **A module knows its issuers** from one setting, `FOREMAN_PERSON_KEYS`, `INTAKE_PERSON_KEYS` and
  `GATEKEEPER_PERSON_KEYS`: `name=url` pairs, comma-separated, as `CONSOLE_LINKS` writes them, like
  `console=http://console:8080/.well-known/jwks.json`. A proof counts only when its `iss` is a name of the setting and
  a key of that name's key set verifies it. The module fetches a key set the first time it needs it, keeps it for 10
  minutes, and fetches it again for a `kid` it does not know, at most once in 30 seconds (`jose`'s
  `createRemoteJWKSet`). A key set that cannot be fetched answers 503 and names the issuer, never a 401: the person
  did nothing wrong.
- **The Compose profile**: `deploy/compose/.env.example` gets `CONSOLE_SIGNING_KEY=`, and `tools/scaffold/setup.ts`
  adds `[A-Z0-9_]*_SIGNING_KEY` to the values `osf init` generates, so `osf init` writes it into a new `.env` and adds
  it to an existing one, as it did for OpenBao's key (ADR 0145). The modules get `<MODULE>_PERSON_KEYS` with the
  console's address on the profile's network.
- **The chart**: the console's Secret that the operator makes gets the key `signing-key` beside `session-secret`; the
  modules get `<MODULE>_PERSON_KEYS` with the console's service address when the console's actions are on.
- **Rotation**: put a new key behind the old one (`old,new`), so it is published while the old one signs; after 10
  minutes, when every module has the new key set, swap them (`new,old`); after one more minute drop the old one. A
  restart of the console with a new key alone also works: a module fetches the key set again for the unknown `kid`;
  only a proof inside the 30 seconds of the fetch cooldown fails, and the person sends the form again.
- **Runs in flight are not touched by a key change.** A proof is checked once, when the call arrives, and the module
  records the actor; a run never holds a proof.

### Lifetime and clocks

A proof lives 30 seconds: the console signs it just before the call. A module refuses one whose `exp` is more than 60
seconds after its `iat`, and allows 10 seconds of clock skew on `iat` and `exp`. Every module reads its clock from
`OSF_NOW` in tests, and `jose` takes it as `currentDate`, so the system tests prove an expired proof with a fixed clock.

### What a module checks

A module checks a proof when its setting `<MODULE>_PERSON_KEYS` is set. Then, on the routes of the table above but
`POST /v1/runs`:

1. The API token, as today: without it 401.
2. A body that names an actor of kind `person` (`requester`, `by`) needs a proof. gatekeeper wants one for every
   decision, whatever kind it names: a gate is decided by a person.
3. Without `OSF-Person`: 401, `send OSF-Person: the console's proof of the person (ADR 0151)`.
4. A proof that does not verify (another `alg` or `typ`, an unknown issuer or key, a bad signature), whose `aud` is not
   this module, whose claims do not validate as `person-proof`, or that has ended: 401 with the reason, like `the
   person proof ended at 2026-11-15T10:00:30Z`.
5. A proof whose `method`, `path` or `bodyDigest` does not match this request, or whose `sub` is not the actor's `id`:
   403 with the claim that does not match.
6. Otherwise the module records the actor with `id` from `sub` and `displayName` from `name`, and goes on as today.

A refused call changes nothing and is logged with its reason and the claimed `sub`, never with the proof. A module
reads the body's bytes for the digest before it parses them. Without the setting a module works as today and logs
once at its start that a caller with the API token names any person.

### A program without the console

A team's own tool keeps every ability of SCN-FACTORY-ACCESS-002: it submits work and reads runs with the module's API
token, as today. When the modules check proofs, it acts **as itself**: an actor of kind `trigger` with an ID that
names the tool, like `{ "kind": "trigger", "id": "tool:acme-portal" }`, as Sentry's alerts are recorded
(`sentry:<rule>`). A tool that acts for people it signed in itself gets a key of its own: it publishes a key set in the
format `person-keys`, signs proofs with its own `iss`, and the team adds `acme-portal=<its key set>` to the modules'
setting. The modules then trust it as they trust the console, so only a tool the team trusts as much gets a name
there. A tool cannot decide a gate without a key of its own.

### The console's three modes

| Mode | What the console proves |
| --- | --- |
| Open, read-only | Nothing: it has no actions, so it signs nothing. It publishes its keys when `CONSOLE_SIGNING_KEY` is set. |
| Behind a proxy | The person of `CONSOLE_USER_HEADER` as `sub`, their role from the access file, or `member` without one. The proof says that the console vouches for the proxy's person; the trust in the proxy stays as ADR 0089 describes it. |
| Own sign-in | The session's email as `sub`, its name as `name`, and the role from the access file at this request. |

With actions on and without `CONSOLE_SIGNING_KEY`, the console sends no proof and its health page says that modules
that check proofs refuse its actions.

### Code

- **One library, `@opensoftware/person-proof`** in `packages/person-proof`, on `jose` and `contracts`, built in the
  console's slice. Its job is the person proof: the console makes a signer from its keys (the key set to publish, and
  a proof for a person, a role, an audience and a request), and each module makes a checker from its setting and its
  clock (a request's headers, method, path, body bytes and actor in, the actor to record or the status and the reason
  out). One library, so the three modules check the same way and DUP finds no clone.
- **The testkit** gets a fake issuer for the modules' system tests: a key set on a loopback port, with a key made for
  the test run and never written down, that signs proofs at the testkit's clock. Fixtures in `contracts/` hold claims
  and public keys only.

### Migration

Modules and console release separately. Each step keeps the factory working:

1. `contracts` with `person-proof` and `person-keys` (a minor version, this slice).
2. `@opensoftware/person-proof` and the console that signs and publishes its keys. The console sends `OSF-Person` on
   every call that names a person; a module before its slice ignores the header.
3. foreman, intake and gatekeeper, each with its check behind `<MODULE>_PERSON_KEYS`; without it they work as before.
4. The profile and the chart, after the releases of steps 2 and 3: they pin the new console and modules, `osf init`
   generates `CONSOLE_SIGNING_KEY`, and they set `<MODULE>_PERSON_KEYS`. A module's setting goes on only together with
   a console that signs, never before: a new module with an old console refuses the console's actions.

A deployment of its own (a team's Compose or chart) follows the same order. Making the check the default without a
setting is a later major version of each module.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A JWT signed with Ed25519, keys published by the console as a JWKS (chosen) | `jose` is already the console's dependency; a module that checks cannot sign; standard claims for person, audience and time; the pattern of the sign-in proxies (Pomerium, Google IAP, Cloudflare Access); rotation without touching the modules | A module reaches the console for the keys; a new library |
| A JWT with a shared HMAC secret (HS256) | No key set to fetch; `osf init` already generates such secrets | Every module that checks can also forge a proof for the others; one secret on four services |
| The public key in each module's setting, not fetched | No call to the console | Two values to keep in step; a rotation restarts every module; `osf init` must write a key pair |
| HTTP Message Signatures (RFC 9421) over the method, path and `Content-Digest` | Binds the whole request by design | No claims for the person, role or end of its own; the Node libraries are young; a person still needs a header that the signature covers |
| mTLS between the console and the modules | Proves the console, not the person | The profile has no TLS inside; certificates to issue and rotate; the person stays a claim of the body |
| PASETO v4.public | No `alg` to choose wrong | The Node library `paseto` is archived; a new dependency; no key set format |
| The proxy's own token (Pomerium's `X-Pomerium-Jwt-Assertion`, oauth2-proxy's ID token) passed on | Nothing to sign | Only behind a proxy; not bound to a module or a request; each proxy's format differs; nothing for the own sign-in |
| A `jti` and a list of seen proofs in each module | No replay at all | State shared across replicas; the binding to one request leaves little to replay |

## Prior art

- **jose** 6.2.17 (MIT, by Filip Skokan, very active; already the console's dependency for its session, ADR 0134):
  `SignJWT`, `jwtVerify` with `currentDate`, `clockTolerance`, `typ` and `algorithms`, `createRemoteJWKSet` with a
  10-minute cache and a 30-second cooldown, `calculateJwkThumbprint`. Verified in this repository's installed copy: it
  signs and checks `alg: "Ed25519"` on Node 24, with a key made from a 32-byte seed, and reports an ended proof as
  `ERR_JWT_EXPIRED`. Adopted.
- **RFC 9864** (fully specified algorithms, October 2025) deprecates the polymorphic `EdDSA` for JOSE in favor of
  `Ed25519`; `jose` 6 accepts both. **RFC 8725** (JWT best practices): explicit `typ`, one allowed `alg`.
- **RFC 9449** (DPoP) binds a proof to `htm` and `htu` of one request; we take its idea with the path instead of the
  whole URL, since a module behind a Kubernetes service sees another host than the console sent to, and add the body's
  digest.
- **Pomerium** (Apache-2.0, active): signs a JWT for the upstream in `X-Pomerium-Jwt-Assertion` and publishes its keys
  at `/.well-known/pomerium/jwks.json`; the upstream checks `aud`, `iss` and `exp`. **Google IAP**
  (`x-goog-iap-jwt-assertion`) and **Cloudflare Access** (`Cf-Access-Jwt-Assertion`) do the same. **oauth2-proxy**
  (MIT, active) hands on `X-Forwarded-Email` and, with an option, the provider's ID token, which names no audience of
  ours. Checked; the console's proof follows the pattern of the first three.
- **HTTP Message Signatures** in Node: `http-message-signatures` (follows the drafts), `http-message-sig`,
  `@misskey-dev/node-http-message-signatures` (marked as work in progress), `@hellocoop/httpsig`. Checked, not adopted.
- **paseto** (MIT, by the author of `jose`): its repository is archived. Not adopted.
- New dependency: none in `contracts`. The library `@opensoftware/person-proof` depends on `jose`, which the lockfile
  already holds at 6.2.17.

## Consequences

- With the profile's setting on, a call with a module's API token and a made-up person is refused by foreman, intake
  and gatekeeper; the console's actions record the person it signed in.
- A leaked API token no longer acts as a person. A leaked `CONSOLE_SIGNING_KEY` acts as anyone for as long as it is
  published: rotate it as above.
- The modules reach the console's key set; a console that is down stops only the actions, which go through it anyway.
- `intake mcp` names `INTAKE_REQUESTER`, a person the developer types, and nothing proves it. It becomes a program
  that acts as itself: intake's slice makes it send `{ "kind": "trigger", "id": "mcp:<requester>" }`, so the work item
  still says whose agent asked, without claiming that a person was proven. A proof for a local agent (a token the
  developer gets from the console) needs its own item.
- `POST /v1/runs` of the foreman and the events on NATS still carry a work item's requester as intake or a program
  made it: they start work, they are no action of a person on a run.
- The console's changes (pull requests that name the person) and secrets (OpenBao) do not go through these modules
  and do not change.
- Revisit when a module needs the role (for example a policy of gatekeeper for risky gates), when a console serves
  several factories, or when the factory is reachable from the internet and a proof needs a `jti`.
