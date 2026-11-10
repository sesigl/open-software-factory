import { scenario } from "@opensoftware/testkit";

scenario("SCN-TK-140", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit timed node -e process.exit(0)" without the environment variable "CI"',
    async () => {
      run = await sut.cli(["timed", "node", "-e", "process.exit(0)"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('there is no file "reports/runner-speed.json"', async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("reports/runner-speed.json");
  });
});
