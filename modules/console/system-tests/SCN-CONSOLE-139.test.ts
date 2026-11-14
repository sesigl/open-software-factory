import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-139", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  await given('the provider signs in "ada@acme.dev" without verifying the email', async () => {
    setup.oidc.signIn({ email: "ada@acme.dev", verified: false });
  });

  let page: Awaited<ReturnType<typeof signedIn>>;
  await when('the person opens "/" and presses "Sign in"', async () => {
    page = await signedIn(sut);
  });

  await then('the page answers 403 and says "The provider has not verified ada@acme.dev"', async () => {
    expect([page.status, page.getByRole("alert").text]).toEqual([403, "The provider has not verified ada@acme.dev"]);
  });
});
