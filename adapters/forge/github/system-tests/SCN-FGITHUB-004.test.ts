import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-004", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let number = 0;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    number = (await openPullRequest(box.forge)).number;
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr tester/web <number> extra" with one word too many', async () => {
    run = await box.run(["pr", "tester/web", String(number), "extra"]);
  });

  await then("pr exits with code 2, prints nothing and writes the usage to the error output", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/^Usage: forge-github <command>\n/);
    expect(run.stderr).toContain("  pr <repo> <number>  ");
  });
});
