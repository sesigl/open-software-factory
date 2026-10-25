import { scenario } from "@opensoftware/testkit";
import { forgeEnv, PULL_GATE, putMergeFiles } from "./gate.ts";

scenario("SCN-GATE-060", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'the pull request "acme/web#12" from the branch "observer/research-skill-used-1a2b3c4d" on the forge',
    async () => {
      // The forge answers 401 for any token but its own, so the pull request stays out of reach.
      http = await fakes.http([
        { path: "/repos/acme/web/pulls/12", status: 401, body: { message: "Bad credentials" } },
      ]);
    },
  );

  await given('a policy that asks "maintainers" for a pull request from a branch "observer/"', async () => {
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the pull request with a token the forge refuses', async () => {
    run = await sut.cli(["request", ...PULL_GATE], {
      env: { ...forgeEnv(sut, http), GATEKEEPER_FORGE_TOKEN: "not-a-token" },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "the forge refused the token"', async () => {
    expect(run.stderr).toContain("the forge refused the token");
  });
});
