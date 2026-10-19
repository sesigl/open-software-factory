import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-034", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" uses the model "routes/triage"', async () => {
    await sut.files.put(
      "$INPUT/factory.yaml",
      factoryYaml({ agents: agent("triage", [], "claude-code", "routes/triage") }),
    );
    await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  });

  const env: Record<string, string> = {};
  await given('FACTORY_INFERENCE_URL is "http://inference.osf.svc:4000/v1"', async () => {
    env.FACTORY_INFERENCE_URL = "http://inference.osf.svc:4000/v1";
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"k8s/modelconfig-triage.yaml" in the output folder is a ModelConfig "triage" with the model "routes/triage" and the base URL "http://inference.osf.svc:4000/v1"',
    async () => {
      const text = lines(await sut.files.read("$OUTPUT/k8s/modelconfig-triage.yaml"));
      expect(text).toEqual(
        expect.arrayContaining([
          "kind: ModelConfig",
          "  name: triage",
          "  provider: OpenAI",
          "  model: routes/triage",
          "    baseUrl: http://inference.osf.svc:4000/v1",
        ]),
      );
    },
  );
});
