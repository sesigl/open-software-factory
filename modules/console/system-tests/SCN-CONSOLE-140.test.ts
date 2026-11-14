import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { type signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-140", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  await given('the provider signs in "ada@acme.dev"', async () => {
    setup.oidc.signIn({ email: "ada@acme.dev" });
  });

  let page: Awaited<ReturnType<typeof signedIn>>;
  await when('the person opens "/signin?next=//evil.example/steal" and presses "Sign in"', async () => {
    page = await (await sut.pages.open("/signin?next=//evil.example/steal")).follow("Sign in");
  });

  await then('the person lands on "/" of the console', async () => {
    expect([page.status, page.path, page.getByRole("heading", { level: 1 }).text]).toEqual([200, "/", "Runs"]);
  });
});
