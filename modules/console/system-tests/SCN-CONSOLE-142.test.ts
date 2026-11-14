import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-142", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given('a person "ada@acme.dev" signed in to a console whose sessions last 12 hours', async () => {
    setup = await signInEnv(sut, fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    setup.oidc.signIn({ email: "ada@acme.dev" });
    expect((await signedIn(sut)).path).toBe("/");
  });

  let again: Awaited<ReturnType<typeof signedIn>>;
  await when('the console runs 13 hours later and the person opens "/"', async () => {
    await sut.http.stop();
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, OSF_NOW: "2026-01-01T13:00:00Z" });
    again = await sut.pages.open("/");
  });

  await then("the console asks the person to sign in", async () => {
    expect(again.path).toBe("/signin?next=%2F");
  });
});
