import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml } from "./factory.ts";

scenario("SCN-FSPEC-030", async ({ sut, given, when, then }) => {
  await given('two files "v1.yaml" and "v2.yaml" with the same factory', async () => {
    await sut.files.put("$INPUT/v1.yaml", factoryYaml({ agents: agent("triage") }));
    await sut.files.put("$INPUT/v2.yaml", factoryYaml({ agents: agent("triage") }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory diff v1.yaml v2.yaml"', async () => {
    run = await sut.cli(["diff", "v1.yaml", "v2.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "No changes."', async () => {
    expect(run.stdout).toBe("No changes.\n");
  });
});
