import { type FakeOidc, scenario } from "@opensoftware/testkit";
import { signIn } from "./oidc.ts";

scenario("SCN-TK-162", async ({ fakes, given, when, then }) => {
  let oidc: FakeOidc;
  await given("fakes.oidc that signs in nobody", async () => {
    oidc = await fakes.oidc();
  });

  let answer: Record<string, unknown> = {};
  await when("a module signs in at the provider with the authorization code flow and PKCE", async () => {
    answer = await signIn(oidc);
  });

  await then('the module has the error "access_denied" with the state', async () => {
    expect(answer).toEqual({ state: "state-1", error: "access_denied" });
  });
});
