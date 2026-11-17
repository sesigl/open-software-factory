import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-083", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given('fakes.http with the route "POST /v1/hooks"', async () => {
    api = await fakes.http([{ method: "POST", path: "/v1/hooks", body: {} }]);
  });

  await when(`a module posts the body '{ "n": 1 }' with its spaces to "/v1/hooks" of the fake`, async () => {
    await fetch(`${api.url}/v1/hooks`, { method: "POST", body: '{ "n": 1 }' });
  });

  await then(`"texts" of the fake gives '{ "n": 1 }' for that request`, async () => {
    expect(api.texts()).toEqual([{ method: "POST", path: "/v1/hooks", text: '{ "n": 1 }' }]);
    expect(api.received()).toEqual([{ method: "POST", path: "/v1/hooks", body: { n: 1 } }]);
  });
});
