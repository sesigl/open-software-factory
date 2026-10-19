import { scenario } from "@opensoftware/testkit";
import { applied } from "./applied.ts";
import { agent, factoryYaml } from "./factory.ts";

scenario("SCN-FSPEC-025", async ({ sut, given, when, then }) => {
  await given('the factory "web-app" was applied with the agent "triage" on the model "routes/triage"', async () => {
    await applied(sut, { model: "routes/triage" });
  });

  await given('the factory engineer set the model of "triage" to "routes/fast" in factory.yaml', async () => {
    await sut.files.put(
      "$INPUT/factory.yaml",
      factoryYaml({ agents: agent("triage", [], "claude-code", "routes/fast") }),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output has exactly one change line, "~ agents.triage.model: \\"routes/triage\\" -> \\"routes/fast\\""',
    async () => {
      const changes = run.stdout.split("\n").filter((line) => /^[+~!-] /.test(line));
      expect(changes).toEqual(['~ agents.triage.model: "routes/triage" -> "routes/fast"']);
    },
  );

  await then('the output contains "Plan: 0 to add, 1 to change, 0 to remove, 0 drifted."', async () => {
    expect(run.stdout).toContain("Plan: 0 to add, 1 to change, 0 to remove, 0 drifted.");
  });
});
