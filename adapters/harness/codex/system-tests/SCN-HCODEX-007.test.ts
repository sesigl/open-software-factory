import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HCODEX-007", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "--help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then(
    'the command exits with code 0 and prints "harness-codex run [--allow <kinds>]" and "harness-codex transcript <session ID>"',
    async () => {
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("harness-codex run [--allow <kinds>]");
      expect(run.stdout).toContain("harness-codex transcript <session ID>");
    },
  );
});
