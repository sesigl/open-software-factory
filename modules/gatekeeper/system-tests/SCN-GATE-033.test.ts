import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PULL_GATE, putMergeFiles, requestComment, statuses } from "./gate.ts";

const BRANCH = "observer/research-skill-used-1a2b3c4d";

scenario("SCN-GATE-033", async ({ sut, fakes, given, when, then }) => {
  let body = "";
  await given('the pull request "acme/web#12" with the approval request of gatekeeper in a comment', async () => {
    body = await requestComment(sut, fakes, BRANCH);
  });

  let http: Awaited<ReturnType<typeof forge>>;
  await given('the later comment "/reject Breaks the release" by "github:sesigl" of "maintainers"', async () => {
    http = await forge(fakes, BRANCH, [
      { id: 1, body, login: "gatekeeper-bot", at: "2026-01-01T00:00:00Z" },
      { id: 2, body: "/reject Breaks the release", login: "sesigl", at: "2026-01-01T00:10:00Z" },
    ]);
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" for the pull request', async () => {
    run = await sut.cli(["status", ...PULL_GATE], { env: forgeEnv(sut, http) });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "failure"',
    async () => {
      expect(statuses(http)).toMatchObject([
        { state: "failure", description: "rejected by github:sesigl: Breaks the release" },
      ]);
    },
  );
});
