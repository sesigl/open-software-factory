import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-146", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  let answer: Awaited<ReturnType<typeof fetch>>;
  await when('a program asks for "/v1/ready" without a session', async () => {
    const port = new URL(sut.http.url()).port;
    answer = await fetch(`http://localhost:${port}/v1/ready`, { redirect: "manual" });
  });

  await then('the answer has the status 200 and the status "ok"', async () => {
    expect([answer.status, await answer.json()]).toEqual([200, { status: "ok" }]);
  });
});
