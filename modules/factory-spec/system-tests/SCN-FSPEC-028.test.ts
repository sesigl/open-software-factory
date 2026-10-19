import { scenario } from "@opensoftware/testkit";
import { applied } from "./applied.ts";

scenario("SCN-FSPEC-028", async ({ sut, given, when, then }) => {
  await given('the factory "web-app" was applied with the prompt text "Version two"', async () => {
    await applied(sut, { promptText: "Version two" });
  });

  await given('the factory engineer restored the prompt text "Version one"', async () => {
    await sut.files.put("$INPUT/agents/triage.md", "Version one");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"AGENTS.md" in the output folder is "Version one"', async () => {
    expect(await sut.files.read("$OUTPUT/AGENTS.md")).toBe("Version one");
  });
});
