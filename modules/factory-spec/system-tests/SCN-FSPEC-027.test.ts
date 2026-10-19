import { scenario } from "@opensoftware/testkit";
import { applied } from "./applied.ts";

scenario("SCN-FSPEC-027", async ({ sut, given, when, then }) => {
  await given('the factory "web-app" was applied with the agent "triage"', async () => {
    await applied(sut);
  });

  await given('a person edited "AGENTS.md" in the output folder', async () => {
    await sut.files.put("$OUTPUT/AGENTS.md", "# triage\n\nEdited by hand.\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "! AGENTS.md changed outside \\"factory apply\\""', async () => {
    expect(run.stdout).toContain('! AGENTS.md changed outside "factory apply"');
  });

  await then('the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."', async () => {
    expect(run.stdout).toContain("Plan: 0 to add, 0 to change, 0 to remove, 1 drifted.");
  });
});
