import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { labeledFollowing, RUN, runEvent } from "./server.ts";

scenario("SCN-INTAKE-053", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof labeledFollowing>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" failed',
    async () => {
      server = await labeledFollowing(sut, fakes, [runEvent("", "failed")]);
    },
  );

  await when('"tester" removes the label "factory" from the issue and adds it again', async () => {
    await server.relabel();
  });

  await then(
    'the event "work.retry-requested@v1" arrives on "osf.work.retry-requested.v1" with the ID "run_5d41402abc4b2a76b971.retry", the work item, the run "run_5d41402abc4b2a76b971" and the requester "github:tester"',
    async () => {
      const [event] = await server.retries.received("work.retry-requested@v1");
      expect(validate("work-retry-requested", event)).toEqual([]);
      expect(event).toMatchObject({
        id: `${RUN}.retry`,
        source: "/osf/intake",
        subject: server.id,
        data: { workItemId: server.id, runId: RUN, requester: { kind: "person", id: "github:tester" } },
      });
    },
  );
});
