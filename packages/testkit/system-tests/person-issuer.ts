// The client of the fakes.personIssuer scenarios: they call the issuer in the test's process (ADR 0039), and a module
// would verify a proof the same way, with the key set at the issuer's URL. Web Crypto is a global of Node, so the
// client needs no import for it.

/**
 * Verifies the proof with the first key of the key set at `keysUrl` as a module does, and gives whether it is valid,
 * the number of keys, whether the header's `kid` is that key's, the header's `alg` and `typ`, the claims and whether
 * their `bodyDigest` is the SHA-256 of `body`.
 */
export async function verifyProof(keysUrl: string, proof: string, body: string): Promise<Record<string, unknown>> {
  const [head = "", payload = "", signature = ""] = proof.split(".");
  const { keys } = (await (await fetch(keysUrl)).json()) as {
    keys: { kty: string; crv: string; x: string; kid: string }[];
  };
  const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
  const header = decode(head);
  const claims = decode(payload);
  const [first] = keys;
  if (!first) throw new Error(`the key set at ${keysUrl} has no key`);
  const { kty, crv, x } = first;
  const key = await crypto.subtle.importKey("jwk", { kty, crv, x }, { name: "Ed25519" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${head}.${payload}`);
  const valid = await crypto.subtle.verify("Ed25519", key, Buffer.from(signature, "base64url"), signed);
  const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))).toString(
    "base64url",
  );
  return {
    valid,
    keys: keys.length,
    kid: header.kid === first.kid,
    header: { alg: header.alg, typ: header.typ },
    claims,
    digest: claims.bodyDigest === digest,
  };
}
