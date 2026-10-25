import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PULL_GATE, putMergeFiles, statuses } from "./gate.ts";

scenario("SCN-GATE-030", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof forge>>;
  await given('the pull request "acme/web#13" from the branch "claude/todo-t-11-gatekeeper" on the forge', async () => {
    http = await forge(fakes, "claude/todo-t-11-gatekeeper");
  });

  await given('a policy that asks "maintainers" for a pull request from a branch "observer/"', async () => {
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" for the pull request', async () => {
    run = await sut.cli(["status", ...PULL_GATE], { env: forgeEnv(sut, http) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "success"',
    async () => {
      expect(statuses(http)).toMatchObject([
        { state: "success", context: "gatekeeper", description: "approved by the policy" },
      ]);
    },
  );

  await then("the pull request has no comment", async () => {
    expect(http.received().filter((call) => call.method === "POST" && call.path.endsWith("/comments"))).toEqual([]);
  });
});
