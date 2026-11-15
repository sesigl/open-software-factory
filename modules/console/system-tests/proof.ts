// Shared setup of the person proof scenarios (ADR 0151): the console's signing keys, and the proofs a fake received.
import type { FakeHttp } from "@opensoftware/testkit";

/** Made-up seeds of Ed25519 keys, values of the test only: no console signs with them. */
export const SIGNING_KEY = "0123456789abcdef".repeat(4);
export const NEXT_SIGNING_KEY = "fedcba9876543210".repeat(4);

/** The testkit's clock in seconds since 1970, the `iat` of every proof the console signs. */
export const IAT = Date.parse("2026-01-01T00:00:00Z") / 1000;

/** Each POST a fake received: its path, the header OSF-Person and the body's text as it arrived. */
export const posted = (fake: FakeHttp): { path: string; proof?: string; text: string }[] => {
  const texts = fake.texts().filter(({ method }) => method === "POST");
  return fake
    .headers()
    .filter(({ method }) => method === "POST")
    .map(({ path, headers }, index) => ({ path, proof: headers["osf-person"], text: texts[index]?.text ?? "" }));
};
