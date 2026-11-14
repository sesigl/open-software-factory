import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-148", async ({ sut, fakes, given, when, then }) => {
  let nats: Awaited<ReturnType<typeof fakes.nats>>;
  await given('a NATS server without the stream "OSF"', async () => {
    nats = await fakes.nats();
    expect(await sut.events.stream(nats, "OSF")).toBeUndefined();
  });

  await when(
    '"foreman serve" starts with "FOREMAN_NATS_URL" set to the NATS server and "OSF_STREAM_MAX_AGE" set to "7d"',
    async () => {
      await serving(sut, fakes, { env: { FOREMAN_NATS_URL: nats.url, OSF_STREAM_MAX_AGE: "7d" } });
    },
  );

  await then('the stream "OSF" keeps an event at most 7 days', async () => {
    expect(await sut.events.stream(nats, "OSF")).toEqual({
      subjects: ["osf.>"],
      maxAgeMs: 7 * 86_400_000,
      messages: 0,
    });
  });
});
