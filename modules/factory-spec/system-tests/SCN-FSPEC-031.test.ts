import { isValid } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt, TRACKER_LOCK } from "./factory.ts";

scenario("SCN-FSPEC-031", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "spec" names no agent and whose scorer "redundant-tests" has no sample',
    async () => {
      const rest = [
        "workflow:",
        "  - stage: spec",
        "scorers:",
        "  redundant-tests:",
        "    judge: ./scorers/redundant-tests.md",
      ];
      const yaml = factoryYaml({ agents: agent("spec", ["mcp: [registry:io.github.acme/tracker@1.4]"]), rest });
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/spec.md", prompt("spec"));
      await sut.files.put("$INPUT/scorers/redundant-tests.md", "Does the change add a test that repeats another?\n");
    },
  );

  await given(
    'its agent "spec" uses the MCP server "registry:io.github.acme/tracker@1.4", which factory.lock pins to "1.4.2"',
    async () => {
      await sut.files.put("$INPUT/factory.lock", TRACKER_LOCK);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory resolve"', async () => {
    run = await sut.cli(["resolve"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the printed definition is a valid factory-definition", async () => {
    expect(isValid("factory-definition", JSON.parse(run.stdout))).toBe(true);
  });

  await then('it runs the stage "spec" with the agent "spec"', async () => {
    expect(JSON.parse(run.stdout).workflow).toEqual([{ stage: "spec", agent: "spec" }]);
  });

  await then('it samples the scorer "redundant-tests" at 1', async () => {
    expect(JSON.parse(run.stdout).scorers["redundant-tests"].sample).toBe(1);
  });

  await then('it lists the MCP server "registry:io.github.acme/tracker@1.4.2"', async () => {
    expect(JSON.parse(run.stdout).agents.spec.mcp).toEqual(["registry:io.github.acme/tracker@1.4.2"]);
  });
});
