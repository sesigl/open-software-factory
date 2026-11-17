import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-030", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given('fakes.http with the route "POST /v1/traces"', async () => {
    api = await fakes.http([{ method: "POST", path: "/v1/traces", body: {} }]);
  });

  await when('a module posts {"n":1} to "/v1/traces" of the fake twice', async () => {
    for (const _ of [1, 2]) await fetch(`${api.url}/v1/traces`, { method: "POST", body: '{"n":1}' });
  });

  await then('the fake has received the body {"n":1} at "POST /v1/traces" twice', async () => {
    const request = { method: "POST", path: "/v1/traces", body: { n: 1 } };
    expect(api.received()).toEqual([request, request]);
  });
});
