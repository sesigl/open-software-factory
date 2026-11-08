import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-GATE-091", async ({ sut, fakes, given, when, then }) => {
  await given('the server runs the README\'s files with "GATEKEEPER_NATS_URL" set to a NATS server', async () => {
    const nats = await fakes.nats();
    await serving(sut, fakes, { env: { GATEKEEPER_NATS_URL: nats.url } });
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then('the answer is 200 with the status "ok" and the checks "database", "opa" and "nats" ok', async () => {
    expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    expect(answer.body).toEqual({
      status: "ok",
      checks: [
        { name: "database", ok: true },
        { name: "opa", ok: true },
        { name: "nats", ok: true },
      ],
    });
  });
});
