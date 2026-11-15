---
covers: [packages/person-proof/src/**]
---

# person-proof

Prove the person who acts to a module: the console signs a person proof for each call it makes in a person's name,
and foreman, intake and gatekeeper check it against the key sets of the issuers they know. A library: it has no command
of its own and keeps no state but the key sets it fetched. Decision:
[ADR 0151](../../docs/decisions/0151-the-person-proven-to-every-module.md); the formats `person-proof` and
`person-keys` are in [`contracts/`](../../contracts/README.md).

## Quick start

The issuer, like the console, signs:

```ts
import { PERSON_HEADER, personSigner } from "@opensoftware/person-proof";

const signer = await personSigner(process.env.CONSOLE_SIGNING_KEY ?? ""); // 64 hex digits; "old,new" while rotating
// Publish signer.keys at GET /.well-known/jwks.json.
const body = JSON.stringify({ signal: "approve", by: { kind: "person", id: "ada@acme.dev" } });
const path = "/v1/runs/run_0a1b/signals";
const proof = await signer.prove({
  person: "ada@acme.dev",
  name: "Ada",
  role: "member",
  audience: "foreman",
  method: "POST",
  path,
  body,
});
await fetch(`http://foreman:8080${path}`, {
  method: "POST",
  headers: { authorization: "Bearer …", "content-type": "application/json", [PERSON_HEADER]: proof },
  body,
});
```

A module, like the foreman, checks:

```ts
import { personChecker } from "@opensoftware/person-proof";

const checker = personChecker(process.env.FOREMAN_PERSON_KEYS ?? "", { audience: "foreman" });
// In a route, after the API token, with the body's bytes before they are parsed:
const check = await checker.check({ headers: request.headers, method: "POST", path: request.url, body, actor: signal.by });
if (!check.ok) return reply.code(check.status).send({ title: check.reason }); // log the reason and check.sub
record(check.actor); // { kind: "person", id: "ada@acme.dev", displayName: "Ada" }
```

## API

| Export | What it does |
| --- | --- |
| `personSigner(setting, { issuer, now })` | A signer from Ed25519 seeds, each 64 hex digits, separated by commas: the first signs, every one is published. `issuer` is the proofs' `iss`, "console" by default. Gives `keys`, the key set to publish (format `person-keys`: each key with `kty` "OKP", `crv` and `alg` "Ed25519", `use` "sig", its JWK thumbprint as `kid` and `x`), and `prove({ person, name, role, audience, method, path, body })`, the proof for the header: a JWT with the header `{ alg: "Ed25519", kid, typ: "osf-person+jwt" }` and the claims of `person-proof`, `iat` now and `exp` 30 seconds later, `bodyDigest` the SHA-256 of the body's bytes. A malformed setting is a `SettingError`. |
| `personChecker(setting, { audience, now })` | A checker from a module's setting, `name=url` pairs of the issuers' key sets separated by commas, like `console=http://console:8080/.well-known/jwks.json`. `audience` is the module's name. A malformed setting is a `SettingError`. |
| `checker.check({ headers, method, path, body, actor, always })` | Checks one request (below) and gives `{ ok: true, actor, proof }`, the actor to record, or `{ ok: false, status, reason, sub }`, the status and reason to answer with the person the call claims, for the log. |
| `SettingError` | A setting that cannot be read: `a signing key is 64 hex digits, the seed of an Ed25519 key: key 2 of 2 is not`, or `a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "<pair>" is not`. Its message never holds a key. |
| `PERSON_HEADER` | `OSF-Person`, the request header of a proof. |

## The check

`check` follows ADR 0151, "What a module checks", after the module checked the API token. `headers` are the
request's, a name in any case; `method` is in upper case, as Node gives it; `path` is the request line's target, whose
query is left out; `body` the bytes as they arrived; `actor` the actor the body names, like `requester` or `by`.

1. An actor of kind `trigger` needs no proof: the check gives it as it was named. With `always: true`, as for a gate
   decision, every actor needs one.
2. Without the header: 401 `send OSF-Person: the console's proof of the person (ADR 0151)`.
3. 401, with the reason, for a value that is no JSON Web Token, a `typ` other than `osf-person+jwt`, an `alg` other than
   `Ed25519` (`EdDSA` and `none` too), an `iss` the setting does not name, a `kid` the issuer's key set lacks, a
   signature that does not verify, an `aud` that is not the module, claims that are no valid `person-proof`, an end
   (`exp`) more than 10 seconds ago (`the person proof ended at 2026-11-15T10:00:30Z`), more than 60 seconds from
   `iat` to `exp`, or an `iat` more than 10 seconds after the module's clock.
4. 403 for a valid proof whose `method`, `path` or `bodyDigest` is not this request's, or whose `sub` is not the actor's
   `id`; the reason names the claim.
5. 503 when the issuer's key set cannot be fetched, answers another status than 200, or is no valid `person-keys`
   (a key with its private part `d`, for example): the reason names the issuer and its URL. The person did nothing
   wrong.
6. Otherwise the actor `{ kind: "person", id: sub, displayName: name }`, and the proof's claims.

A key set is fetched when a proof of its issuer first needs it, kept for 10 minutes, and fetched again for a `kid` it
does not hold, at most once in 30 seconds (`jose`'s `createRemoteJWKSet`). No proof is kept: a module with several
replicas needs no shared state.

## Releases

release-please opens a release pull request from the Conventional Commits under `packages/person-proof/`. Merging it
creates the tag `person-proof-v<version>`. The workflow `.github/workflows/publish-person-proof.yml` then builds
`dist/` with `pnpm build` and publishes the package to npm. The first release is `0.1.0`; until `1.0.0`, a breaking
change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../contracts/README.md#releases)).

## Configuration

This library reads no environment variables: its caller passes the signing keys or the key sets from its own
settings, like `CONSOLE_SIGNING_KEY` and `FOREMAN_PERSON_KEYS`.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-PPROOF-001 | implemented | A proof that a signer makes for a person is accepted with that person by the module it is for |
| SCN-PPROOF-002 | implemented | A signer publishes every key of its setting with its thumbprint, signs with the first, and a proof of either key is accepted |
| SCN-PPROOF-003 | implemented | A signing setting that is no list of 64 hex digits is a SettingError that names the key's place, never the key |
| SCN-PPROOF-004 | implemented | A checker setting that is no list of name=url pairs of HTTP is a SettingError that names the pair |
| SCN-PPROOF-005 | implemented | A call for a made-up person without a proof is refused, a trigger passes, and a call that always needs a proof is refused |
| SCN-PPROOF-006 | implemented | A proof is accepted up to 10 seconds after its end and refused after that with its end |
| SCN-PPROOF-007 | implemented | A proof signed up to 10 seconds ahead of the module's clock is accepted, one signed later is refused |
| SCN-PPROOF-008 | implemented | A proof that lives 60 seconds is accepted, one that lives 61 seconds is refused |
| SCN-PPROOF-009 | implemented | A proof for another module is refused with its audience, one not valid yet with the reason of jose |
| SCN-PPROOF-010 | implemented | A proof of an issuer the setting does not name is refused, one of a team's tool that it names is accepted |
| SCN-PPROOF-011 | implemented | A proof signed with a key outside its issuer's key set is refused with the key, and one with another key's "kid" with its signature |
| SCN-PPROOF-012 | implemented | A proof with another type or algorithm, or one without a signature, is refused with what it names |
| SCN-PPROOF-013 | implemented | A header that is no JSON Web Token is refused with the claimed person |
| SCN-PPROOF-014 | implemented | A signed proof whose claims are not valid person-proof is refused with their paths |
| SCN-PPROOF-015 | implemented | A valid proof for another method, path, body or person is refused with 403 and the claim that differs |
| SCN-PPROOF-016 | implemented | A key set that cannot be fetched or is no person-keys answers 503 and names its issuer |
