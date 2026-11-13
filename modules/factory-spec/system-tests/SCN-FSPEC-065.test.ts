import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-065", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with the scorer "pr-quality" on line 13 and the benchmark "smoke" on line 16',
    async () => {
      const rest = [
        "scorers:",
        "  pr-quality:",
        "    judge: ./scorers/pr-quality.md",
        "benchmarks:",
        "  smoke:",
        "    suite: ./benchmarks/smoke",
      ];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage"), rest }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
      await sut.files.put("$INPUT/scorers/pr-quality.md", "# Score the pull request\n");
      await sut.files.put("$INPUT/benchmarks/smoke/task.toml", 'version = "1.0"\n');
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is "factory.yaml:13:3 warning /scorers/pr-quality: no job of the profile runs a scorer yet, so it has no effect" and then "factory.yaml:16:3 warning /benchmarks/smoke: no job of the profile runs a benchmark yet, so it has no effect" and then "factory.yaml: no problems, 2 warnings"',
    async () => {
      expect(run.stdout).toBe(
        "factory.yaml:13:3 warning /scorers/pr-quality: no job of the profile runs a scorer yet, so it has no effect\n" +
          "factory.yaml:16:3 warning /benchmarks/smoke: no job of the profile runs a benchmark yet, so it has no effect\n" +
          "factory.yaml: no problems, 2 warnings\n",
      );
    },
  );
});
