import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PULL_GATE, putMergeFiles, requestComment, statuses } from "./gate.ts";

const BRANCH = "observer/research-skill-used-1a2b3c4d";
const SECOND = "2026-01-01T01:00:00Z";

scenario("SCN-GATE-117", async ({ sut, fakes, given, when, then }) => {
  let reject = { id: 0, body: "", login: "", at: "" };
  await given(
    'the pull request "acme/web#12" with the comment "/reject Too early" by "github:sesigl" of "maintainers" at "2026-01-01T01:00:00Z"',
    async () => {
      reject = { id: 1, body: "/reject Too early", login: "sesigl", at: SECOND };
    },
  );

  let http: Awaited<ReturnType<typeof forge>>;
  await given(
    'after it the approval request of gatekeeper and then the comment "/approve" by "github:sesigl", both at "2026-01-01T01:00:00Z"',
    async () => {
      const body = await requestComment(sut, fakes, BRANCH);
      http = await forge(fakes, BRANCH, [
        reject,
        { id: 2, body, login: "gatekeeper-bot", at: SECOND },
        { id: 3, body: "/approve", login: "sesigl", at: SECOND },
      ]);
      await putMergeFiles(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" for the pull request', async () => {
    run = await sut.cli(["status", ...PULL_GATE], { env: forgeEnv(sut, http) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "success" and the description "approved by github:sesigl"',
    async () => {
      expect(statuses(http)).toMatchObject([
        { state: "success", context: "gatekeeper", description: "approved by github:sesigl" },
      ]);
    },
  );
});
