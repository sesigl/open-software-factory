import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-033", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the prompt "agents/triage.md"', async () => {
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/agent-triage.yaml" in the output folder is a kagent Agent "triage" whose system message is the prompt of "triage"',
    async () => {
      const text = await sut.files.read("$OUTPUT/k8s/agent-triage.yaml");
      expect(lines(text)).toEqual(expect.arrayContaining(["apiVersion: kagent.dev/v1alpha2", "kind: Agent"]));
      expect(lines(text)).toContain("  name: triage");
      expect(text).toContain("    systemMessage: |\n      # triage\n\n      You are the triage agent of web-app.\n");
    },
  );

  await then('the Agent "triage" uses the model config "triage"', async () => {
    expect(lines(await sut.files.read("$OUTPUT/k8s/agent-triage.yaml"))).toContain("    modelConfig: triage");
  });
});
