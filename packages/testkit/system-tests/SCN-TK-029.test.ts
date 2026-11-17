import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-029", async ({ fakes, given, when, then }) => {
  let api: FakeHttp;
  await given('fakes.http with "POST /v1/traces" scripted to answer 503 once and then 200', async () => {
    api = await fakes.http([
      { method: "POST", path: "/v1/traces", status: 503, body: {}, times: 1 },
      { method: "POST", path: "/v1/traces", body: {} },
    ]);
  });

  let codes = "";
  await when('a module posts {"n":1} to "/v1/traces" of the fake twice', async () => {
    const post = () => fetch(`${api.url}/v1/traces`, { method: "POST", body: '{"n":1}' });
    const first = await post();
    const second = await post();
    codes = `${first.status} ${second.status}`;
  });

  await then('the status codes are "503 200"', async () => {
    expect(codes).toBe("503 200");
  });
});
