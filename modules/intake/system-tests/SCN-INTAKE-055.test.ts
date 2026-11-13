import { scenario } from "@opensoftware/testkit";
import { labeledFollowing, runEvent } from "./server.ts";

scenario("SCN-INTAKE-055", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof labeledFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" succeeded',
    async () => {
      server = await labeledFollowing(sut, fakes, [runEvent("", "succeeded")]);
    },
  );

  await when('"tester" removes the label "factory" from the issue and adds it again', async () => {
    await server.relabel();
    await server.settled();
  });

  await then('no event arrives on "osf.work.retry-requested.v1"', async () => {
    expect(await server.retries.received("work.retry-requested@v1", { count: 0 })).toEqual([]);
  });
});
