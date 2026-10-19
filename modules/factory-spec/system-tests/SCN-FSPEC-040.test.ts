import { scenario } from "@opensoftware/testkit";
import { lines, resource } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-040", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" uses the model "routes/triage" and the prompt "agents/triage.md"',
    async () => {
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/triage.yaml" in the output folder has a kagent "Agent" "triage" whose system message is the prompt',
    async () => {
      const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "Agent", "triage");
      expect(found).toContain("apiVersion: kagent.dev/v1alpha2\n");
      expect(found).toContain(
        lines(
          `
          declarative:
            modelConfig: triage
            systemMessage: |
              # triage

              You are the triage agent of web-app.
        `,
          1,
        ),
      );
    },
  );

  await then(
    'it has a kagent "ModelConfig" "triage" with the model "routes/triage" at "http://litellm:4000/v1"',
    async () => {
      const found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "ModelConfig", "triage");
      expect(found).toContain("  model: routes/triage\n  provider: OpenAI\n");
      expect(found).toContain("  openAI:\n    baseUrl: http://litellm:4000/v1\n");
    },
  );
});
