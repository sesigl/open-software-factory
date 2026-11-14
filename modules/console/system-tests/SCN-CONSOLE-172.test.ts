import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-172", async ({ sut, fakes, given, when, then }) => {
  let port = "";
  await given('a console that signs in with OpenID Connect at the address "http://localhost:<port>"', async () => {
    const setup = await signInEnv(sut, fakes);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    port = new URL(sut.http.url()).port;
  });

  let answer: Awaited<ReturnType<typeof fetch>>;
  await when('a health check asks for "/v1/ready" at "http://127.0.0.1:<port>"', async () => {
    answer = await fetch(`http://127.0.0.1:${port}/v1/ready`, { redirect: "manual" });
  });

  await then('the answer has the status 200 and the status "ok"', async () => {
    expect([answer.status, await answer.json()]).toEqual([200, { status: "ok" }]);
  });

  await then('the page "/" at "http://127.0.0.1:<port>" is still sent to "http://localhost:<port>/"', async () => {
    const page = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
    expect([page.status, page.headers.get("location")]).toEqual([307, `http://localhost:${port}/`]);
  });
});
