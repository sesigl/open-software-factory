import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-INTAKE-044", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the server runs with "INTAKE_DATABASE_URL" set to a PostgreSQL database and "INTAKE_NATS_URL" set to a NATS server',
    async () => {
      const [db, nats] = await Promise.all([fakes.postgres(), fakes.nats()]);
      await serving(sut, { INTAKE_DATABASE_URL: db.url, INTAKE_NATS_URL: nats.url });
    },
  );

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then('the answer is 200 with the status "ok" and the checks "database" and "nats" ok', async () => {
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({
      status: "ok",
      checks: [
        { name: "database", ok: true },
        { name: "nats", ok: true },
      ],
    });
  });
});
