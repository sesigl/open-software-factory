import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-028", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "OSF_DATA" set to "$OUTPUT/foreman"',
    async () => {
      server = await serving(sut, fakes, { env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") } });
    },
  );

  let runId = "";
  let sessionId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    sessionId = (await server.until(runId, "complete")).stages[0]?.sessionId as string;
  });

  let session: { cwd: string; resource: Record<string, string> };
  await then(
    'the harness adapter\'s record of the "plan" session has the run\'s folder "$OUTPUT/foreman/runs/<id>"',
    async () => {
      const record = await sut.files.read(`$OUTPUT/foreman/harness/acp/sessions/${sessionId}.jsonl`);
      session = JSON.parse(record.split("\n")[0] as string);
      expect(session.cwd).toBe(sut.files.path(`$OUTPUT/foreman/runs/${runId}`));
    },
  );

  await then(
    'its resource attributes name the run, the work item, the stage "plan" and the factory version',
    async () => {
      expect(session.resource).toMatchObject({
        "osf.run.id": runId,
        "osf.work_item.id": readmeWork(fakes).id,
        "osf.stage": "plan",
        "osf.factory.version": server.commit,
      });
    },
  );
});
