import { type FakeOidc, scenario } from "@opensoftware/testkit";
import { signIn } from "./oidc.ts";

scenario("SCN-TK-161", async ({ fakes, given, when, then }) => {
  let oidc: FakeOidc;
  await given('fakes.oidc that signs in "ada@acme.dev" named "Ada"', async () => {
    oidc = await fakes.oidc();
    oidc.signIn({ email: "ada@acme.dev", name: "Ada" });
  });

  let answer: Record<string, unknown> = {};
  await when(
    "a module signs in at the provider with the authorization code flow and PKCE, and verifies the ID token with the provider's keys",
    async () => {
      answer = await signIn(oidc);
    },
  );

  await then(
    "the module has the state, that email as verified, the name, the nonce, the client as audience, the time 2026-01-01T00:00:00Z and a valid signature",
    async () => {
      expect(answer).toEqual({
        state: "state-1",
        valid: true,
        issuer: true,
        email: "ada@acme.dev",
        verified: true,
        name: "Ada",
        nonce: "nonce-1",
        aud: "testkit-console",
        iat: "2026-01-01T00:00:00.000Z",
      });
    },
  );
});
