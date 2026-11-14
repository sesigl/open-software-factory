import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-165", async ({ sut, fakes, given, when, then }) => {
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

  let first: Awaited<ReturnType<typeof sut.pages.open>>;
  let landed: Awaited<ReturnType<typeof sut.pages.open>>;
  await when('the person opens "/factory" and presses "Sign in"', async () => {
    first = await sut.pages.open("/factory");
    landed = await first.follow("Sign in");
  });

  await then('the console first sent the person to "/signin?next=%2Ffactory"', async () => {
    expect(first.path).toBe("/signin?next=%2Ffactory");
  });

  await then('the person lands on "/factory" with the heading "acme"', async () => {
    expect([landed.status, landed.path]).toEqual([200, "/factory"]);
    expect(landed.getByRole("heading", { level: 1 }).text).toBe("acme");
  });
});
