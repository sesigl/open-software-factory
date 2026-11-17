import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-126", async ({ fakes, given, when, then }) => {
  // The fake reads the body when it answers. Without the hold it has sent {"count":0} before the test sees the
  // request, so the body is {"count":1} only when the answer waited for `held`.
  const answer = { count: 0 };
  let release = (): void => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let api: FakeHttp;
  await given(
    'fakes.http that holds the answer {"count":0} for "GET /v0.1/servers?search=tracker" until a promise settles',
    async () => {
      api = await fakes.http([{ path: "/v0.1/servers?search=tracker", body: answer, until: held }]);
    },
  );

  let body = "";
  await when(
    'a module gets "/v0.1/servers?search=tracker" from the fake, and the test changes the answer to {"count":1} once the fake has the request, then settles the promise',
    async () => {
      const response = fetch(`${api.url}/v0.1/servers?search=tracker`);
      await expect.poll(() => api.requests().length).toBe(1);
      expect(api.requests()).toEqual(["GET /v0.1/servers?search=tracker"]);
      answer.count = 1;
      release();
      body = await (await response).text();
    },
  );

  await then('the body is {"count":1}', async () => {
    expect(body).toBe('{"count":1}');
  });
});
