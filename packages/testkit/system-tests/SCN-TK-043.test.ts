import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-043", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given('fakes.http with the route "POST /v1/traces"', async () => {
    api = await fakes.http([{ method: "POST", path: "/v1/traces", body: {} }]);
  });

  await when(
    'a module posts {"n":1} to "/v1/traces" of the fake with the header "authorization" set to "Bearer demo"',
    async () => {
      await fetch(`${api.url}/v1/traces`, {
        method: "POST",
        headers: { authorization: "Bearer demo" },
        body: '{"n":1}',
      });
    },
  );

  await then('the fake has received the header "authorization" with "Bearer demo" at "POST /v1/traces"', async () => {
    expect(api.headers()).toMatchObject([
      { method: "POST", path: "/v1/traces", headers: { authorization: "Bearer demo" } },
    ]);
  });
});
