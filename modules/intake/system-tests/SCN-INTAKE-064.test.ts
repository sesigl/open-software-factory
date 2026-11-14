import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

const WEEK_MS = 7 * 86_400_000;

scenario("SCN-INTAKE-064", async ({ sut, fakes, given, when, then }) => {
  let nats: Awaited<ReturnType<typeof fakes.nats>>;
  await given('a NATS server whose stream "OSF" keeps its events without a limit of age', async () => {
    nats = await fakes.nats();
    await sut.events.stream(nats, "OSF", { subjects: ["osf.>"] });
  });

  await when(
    'the server starts with "INTAKE_NATS_URL" set to the NATS server and "OSF_STREAM_MAX_AGE" set to "7d"',
    async () => {
      await serving(sut, { INTAKE_NATS_URL: nats.url, OSF_STREAM_MAX_AGE: "7d" });
    },
  );

  await then('the stream "OSF" keeps an event at most 7 days', async () => {
    expect(await sut.events.stream(nats, "OSF")).toMatchObject({ subjects: ["osf.>"], maxAgeMs: WEEK_MS });
  });
});
