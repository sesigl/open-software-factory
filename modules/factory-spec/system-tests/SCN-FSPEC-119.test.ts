import { scenario } from "@opensoftware/testkit";

scenario("SCN-FSPEC-119", async ({ sut, when, then }) => {
  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when('the user runs "factory deploy", "factory toString" and "factory constructor"', async () => {
    runs = [await sut.cli(["deploy"]), await sut.cli(["toString"]), await sut.cli(["constructor"])];
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
  });

  await then(
    'each output starts with "factory: one factory.yaml rendered for every harness" and lists the command "lint"',
    async () => {
      for (const run of runs) {
        expect(run.stdout).toMatch(/^factory: one factory\.yaml rendered for every harness/);
        expect(run.stdout).toMatch(/^ {2}factory lint\b/m);
      }
      expect(runs.map((run) => run.stderr)).toEqual(["", "", ""]);
    },
  );
});
