import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-027", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given('fakes.http with the answer {"count":1} for "GET /v0.1/servers?search=tracker"', async () => {
    api = await fakes.http([{ path: "/v0.1/servers?search=tracker", body: { count: 1 } }]);
  });

  let body = "";
  await when('a module gets "/v0.1/servers?search=tracker" from the fake', async () => {
    body = await (await fetch(`${api.url}/v0.1/servers?search=tracker`)).text();
  });

  await then('the body is {"count":1}', async () => {
    expect(body).toBe('{"count":1}');
  });
});
