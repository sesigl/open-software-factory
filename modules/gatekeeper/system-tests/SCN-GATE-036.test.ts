import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PR, putMergeFiles, requestComment } from "./gate.ts";

const BRANCH = "observer/research-skill-used-1a2b3c4d";

scenario("SCN-GATE-036", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof forge>>;
  await given(
    'the pull request "acme/web#12" with the approval request of gatekeeper and the later comment "/approve" by "github:sesigl"',
    async () => {
      const body = await requestComment(sut, fakes, BRANCH);
      http = await forge(fakes, BRANCH, [
        { id: 1, body, login: "gatekeeper-bot", at: "2026-01-01T00:00:00Z" },
        { id: 2, body: "/approve", login: "sesigl", at: "2026-01-01T00:10:00Z" },
      ]);
    },
  );

  await given("the policy and groups files of the workflow", async () => {
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when("a workflow on the new comment runs the action", async () => {
    run = await sut.action(
      { policy: "merge.rego", groups: "groups.json", record: "gate/record.json" },
      {
        event: { issue: { number: 12, pull_request: { html_url: PR } }, comment: { body: "/approve" } },
        eventName: "issue_comment",
        env: forgeEnv(sut, http.url),
      },
    );
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the record named in the action output "record" has the decision "approved" by the person "github:sesigl"',
    async () => {
      expect(run.outputs).toMatchObject({ decision: "approved", record: "gate/record.json" });
      expect(JSON.parse(await sut.files.read(`$INPUT/${run.outputs.record}`))).toMatchObject({
        decision: "approved",
        decidedBy: { kind: "person", id: "github:sesigl" },
        channel: PR,
      });
    },
  );
});
