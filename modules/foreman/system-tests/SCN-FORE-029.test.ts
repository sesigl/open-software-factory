import { scenario } from "@opensoftware/testkit";
import { PLAN, readmeWork, serving, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-029", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server and a scripted harness that ends the "plan" turn with "refusal"',
    async () => {
      server = await serving(sut, fakes, { nats: true, turns: [{ when: PLAN, stopReason: "refusal" }] });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    expect((await server.start(readmeWork(fakes))).response.status).toBe(201);
  });

  await then('the server publishes "run.completed@v1" with the outcome "failed" and the stage "plan"', async () => {
    const [completed] = await events.received("run.completed@v1", { timeoutMs: WAIT_MS });
    expect(completed?.data).toMatchObject({ stage: "plan", outcome: "failed" });
  });
});
