import "@typespec/json-schema";
import "./common.tsp";
import "./access.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/** 43 characters of base64url without padding: 32 bytes, like a SHA-256 or an Ed25519 public key. */
@pattern("^[A-Za-z0-9_-]{43}$")
scalar Base64url32 extends string;

/**
 * The claims of a person proof (ADR 0151): the JSON Web Token that the console signs for one call of a module API in
 * the name of a person, sent in the header `OSF-Person`, signed with `alg` "Ed25519" and `typ` "osf-person+jwt". It is
 * bound to one module, one request and 30 seconds. Open: a module ignores a claim it does not know.
 */
model PersonProof {
  /** The issuer: "console" for the console, or the name a team gives its own tool in the modules' setting. */
  iss: Name;

  /** The person, as the module records the actor's `id`: an email in lower case, or the sign-in proxy's value. */
  @minLength(1)
  sub: string;

  /** The name to show, recorded as the actor's `displayName`. */
  @minLength(1)
  name?: string;

  /** The person's role from the access file at the time of the call. */
  role: AccessRole;

  /** The module the call goes to: "foreman", "intake" or "gatekeeper". */
  aud: Name;

  /** When it was signed, in seconds since 1970-01-01T00:00:00Z. */
  @minValue(0)
  iat: safeint;

  /** When it ends, in seconds since 1970-01-01T00:00:00Z; at most 60 seconds after `iat`. */
  @minValue(0)
  exp: safeint;

  /** The request's method in upper case. */
  @pattern("^[A-Z]+$")
  method: string;

  /** The request's path as sent in the request line, without the query. */
  @pattern("^/[^?#]*$")
  path: string;

  /** The SHA-256 of the request's body bytes as sent, in base64url without padding. */
  bodyDigest: Base64url32;
}

/**
 * The public keys of an issuer of person proofs (ADR 0151): a JSON Web Key Set (RFC 7517), as the console publishes it
 * at `/.well-known/jwks.json`. The first key of the issuer's setting signs; every key here verifies.
 */
@extension("additionalProperties", Json<false>)
model PersonKeys {
  @minItems(1)
  keys: PersonKey[];
}

/** One Ed25519 public key. Closed: a key with its private part `d` or any other member is invalid. */
@extension("additionalProperties", Json<false>)
model PersonKey {
  kty: "OKP";
  crv: "Ed25519";
  alg: "Ed25519";
  use: "sig";

  /** The key's JWK thumbprint (RFC 7638) with SHA-256; a proof names it in its `kid`. */
  kid: Base64url32;

  /** The public key. */
  x: Base64url32;
}
