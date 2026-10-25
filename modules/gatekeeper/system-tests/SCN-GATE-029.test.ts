import { scenario } from "@opensoftware/testkit";
import { forge, forgeEnv, PULL_GATE, putMergeFiles, statuses } from "./gate.ts";

scenario("SCN-GATE-029", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof forge>>;
  await given(
    'the pull request "acme/web#12" from the branch "observer/research-skill-used-1a2b3c4d" on the forge',
    async () => {
      http = await forge(fakes, "observer/research-skill-used-1a2b3c4d");
    },
  );

  await given('a policy that asks "maintainers" for a pull request from a branch "observer/"', async () => {
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the pull request', async () => {
    run = await sut.cli(["request", ...PULL_GATE], { env: forgeEnv(sut, http.url) });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the pull request has a comment that asks "maintainers" to approve with "/approve"', async () => {
    const posted = http.received().filter((call) => call.method === "POST" && call.path.endsWith("/comments"));
    expect(posted.map((call) => (call.body as { body: string }).body)).toEqual([
      expect.stringMatching(
        /^Approval needed from maintainers: Merge Fix the research skill\n- Pull request: https:\/\/github\.com\/acme\/web\/pull\/12\nComment "\/approve" or "\/reject <reason>"\.\n\n<!-- gatekeeper g[0-9a-f]{16} requested -->$/,
      ),
    ]);
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "pending"',
    async () => {
      expect(statuses(http)).toEqual([
        {
          state: "pending",
          context: "gatekeeper",
          description: "waiting for maintainers",
          target_url: expect.any(String),
        },
      ]);
    },
  );
});
