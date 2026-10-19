import { scenario } from "@opensoftware/testkit";
import { applied } from "./applied.ts";

scenario("SCN-FSPEC-026", async ({ sut, given, when, then }) => {
  await given('the factory "web-app" was applied with the agent "triage"', async () => {
    await applied(sut);
  });

  await given('the factory engineer changed the text of "agents/triage.md"', async () => {
    await sut.files.put("$INPUT/agents/triage.md", "# triage\n\nTriage every new issue within one hour.\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "~ prompts.agents/triage.md:"', async () => {
    expect(run.stdout).toContain("~ prompts.agents/triage.md:");
  });
});
