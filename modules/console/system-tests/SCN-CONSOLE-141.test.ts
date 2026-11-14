import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-141", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given('a person "ada@acme.dev" signed in to a console that signs in with OpenID Connect', async () => {
    setup = await signInEnv(sut, fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    setup.oidc.signIn({ email: "ada@acme.dev" });
    expect((await signedIn(sut)).path).toBe("/");
  });

  let again: Awaited<ReturnType<typeof signedIn>>;
  await when('the person presses "Sign out" and opens "/" again', async () => {
    const out = await (await sut.pages.open("/")).submit("Sign out");
    expect(out.path).toBe("/signin");
    again = await sut.pages.open("/");
  });

  await then("the console asks the person to sign in", async () => {
    expect([again.path, again.getByRole("heading", { level: 1 }).text]).toEqual(["/signin?next=%2F", "Sign in"]);
  });
});
