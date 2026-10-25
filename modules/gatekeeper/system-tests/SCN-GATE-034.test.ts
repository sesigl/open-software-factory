import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PR, putMergeFiles, requestComment, statuses } from "./gate.ts";

scenario("SCN-GATE-034", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof forge>>;
  await given(
    'the pull request "acme/web#12" from the branch "observer/research-skill-used-1a2b3c4d" on the forge',
    async () => {
      // The comment that the action's request posts is there when its status reads the comments.
      const branch = "observer/research-skill-used-1a2b3c4d";
      const body = await requestComment(sut, fakes, branch);
      http = await forge(fakes, branch, [{ id: 1, body, login: "gatekeeper-bot", at: "2026-01-01T00:00:00Z" }], []);
    },
  );

  await given("the policy and groups files of the workflow", async () => {
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when("a pull request workflow runs the action", async () => {
    run = await sut.action(
      { policy: "merge.rego", groups: "groups.json" },
      { event: { pull_request: { html_url: PR, number: 12 } }, env: forgeEnv(sut, http) },
    );
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    expect(run.skipped).toContain("open-policy-agent/setup-opa@v2");
  });

  await then('the action output "decision" is "pending"', async () => {
    expect(run.outputs.decision).toBe("pending");
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "pending"',
    async () => {
      expect(statuses(http).map((status) => status.state)).toEqual(["pending", "pending"]);
    },
  );
});
