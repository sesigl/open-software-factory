import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-075", async ({ sut, fakes, given, when, then }) => {
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      await serving(sut, fakes, { nats: true });
    },
  );

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then('the answer is 200 with the status "ok" and the checks "temporal" and "nats" ok', async () => {
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({
      status: "ok",
      checks: [
        { name: "temporal", ok: true },
        { name: "nats", ok: true },
      ],
    });
  });

  await then('"/v1/runs" without a token still answers 401', async () => {
    expect((await sut.http.request("GET", "/v1/runs")).status).toBe(401);
  });
});
