import { scenario } from "@opensoftware/testkit";
import { forgeEnv, PULL_GATE, putMergeFiles } from "./gate.ts";

scenario("SCN-GATE-061", async ({ sut, fakes, given, when, then }) => {
  let http: Awaited<ReturnType<typeof fakes.http>>;
  await given('a forge whose repository "acme/web" has no pull request 12', async () => {
    http = await fakes.http([
      { path: "/repos/acme/web", body: { full_name: "acme/web" } },
      { path: "/repos/acme/web/pulls/12", status: 404, body: { message: "Not Found" } },
    ]);
    await putMergeFiles(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper request" for the pull request', async () => {
    run = await sut.cli(["request", ...PULL_GATE], { env: forgeEnv(sut, http) });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "no pull request acme/web#12"', async () => {
    expect(run.stderr).toContain("no pull request acme/web#12");
  });
});
