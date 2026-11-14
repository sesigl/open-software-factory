import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, serving } from "./foreman.ts";

scenario("SCN-FORE-162", async ({ sut, fakes, given, when, then }) => {
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      const server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  const id = "ping_6b86b273ff34fce19d6b";
  await when(
    'the console publishes "doctor.ping@v1" with the ID "ping_6b86b273ff34fce19d6b" on "osf.doctor.ping.v1"',
    async () => {
      await events.publish("osf.doctor.ping.v1", {
        specversion: "1.0",
        id,
        source: "/osf/console",
        type: "doctor.ping@v1",
        time: "2026-01-01T00:00:00Z",
        data: {},
      });
    },
  );

  const ping = (path: string) => sut.http.request("GET", path, { headers: { authorization: `Bearer ${API_TOKEN}` } });
  await then(
    'within 5 seconds "/v1/doctor/pings/ping_6b86b273ff34fce19d6b" with the token answers 200 with the ID and the time it was received',
    async () => {
      await expect.poll(async () => (await ping(`/v1/doctor/pings/${id}`)).status, { timeout: 5_000 }).toBe(200);
      expect((await ping(`/v1/doctor/pings/${id}`)).body).toEqual({ id, receivedAt: "2026-01-01T00:00:00.000Z" });
    },
  );

  await then('"/v1/doctor/pings/ping_0000000000000000000a" answers 404', async () => {
    const answer = await ping("/v1/doctor/pings/ping_0000000000000000000a");
    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ title: "No such ping" });
  });
});
