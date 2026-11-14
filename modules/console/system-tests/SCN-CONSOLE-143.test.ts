import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { SESSION_KEY, signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-143", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a person "ada@acme.dev" signed in to a console with the session key "testkit-session-key-1"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
      setup.oidc.signIn({ email: "ada@acme.dev" });
      expect((await signedIn(sut)).path).toBe("/");
    },
  );

  let again: Awaited<ReturnType<typeof signedIn>>;
  await when(
    'the console restarts with the keys "testkit-session-key-2,testkit-session-key-1" and the person opens "/"',
    async () => {
      await sut.http.stop();
      const keys = `testkit-session-key-2,${SESSION_KEY}`;
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, CONSOLE_SESSION_SECRET: keys });
      again = await sut.pages.open("/");
    },
  );

  await then("the person sees the runs", async () => {
    expect([again.path, again.getByRole("heading", { level: 1 }).text]).toEqual(["/", "Runs"]);
  });
});
