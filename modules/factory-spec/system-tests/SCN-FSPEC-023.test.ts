import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-023", async ({ sut, given, when, then }) => {
  await given('a factory.yaml of the factory "web-app" with the agent "triage"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output starts with "Applied factory web-app, digest "', async () => {
    expect(run.stdout).toMatch(/^Applied factory web-app, digest [0-9a-f]{12}\n$/);
  });

  await then('the output folder contains "AGENTS.md" and ".mcp.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual(expect.arrayContaining(["AGENTS.md", ".mcp.json"]));
  });
});
