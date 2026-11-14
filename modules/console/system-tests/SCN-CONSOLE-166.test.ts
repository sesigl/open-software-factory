import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-166", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given('a person "ada@acme.dev" signed in to a console whose sessions last 12 hours', async () => {
    setup = await signInEnv(sut, fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    setup.oidc.signIn({ email: "ada@acme.dev" });
    expect((await signedIn(sut)).path).toBe("/");
  });

  let again: Awaited<ReturnType<typeof signedIn>>;
  await when('the console runs 11 hours later and the person opens "/"', async () => {
    await sut.http.stop();
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, OSF_NOW: "2026-01-01T11:00:00Z" });
    again = await sut.pages.open("/");
  });

  await then("the person sees the runs", async () => {
    expect([again.status, again.path]).toEqual([200, "/"]);
    expect(again.getByRole("heading", { level: 1 }).text).toBe("Runs");
  });
});
