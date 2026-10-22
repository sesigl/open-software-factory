import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull, section } from "./pulls.ts";

scenario("SCN-TASK-052", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"',
    async () => {
      github = await fakes.http([(await commitPull(sut, {})).route]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github);
    },
  );

  await then('"suite/web-7/task.toml" has in "[agent]" the network mode "no-network"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const toml = await sut.files.read("$OUTPUT/suite/web-7/task.toml");
    expect(section(toml, "agent")).toContain('network_mode = "no-network"');
    expect(section(toml, "verifier")).not.toContain('network_mode = "no-network"');
  });
});
