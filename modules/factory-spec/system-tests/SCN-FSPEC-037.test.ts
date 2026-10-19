import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { lines } from "./k8s.ts";

scenario("SCN-FSPEC-037", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "implement" has the sandbox template "node-24", 4 CPU, the memory "8Gi" and the egress host "registry.npmjs.org"',
    async () => {
      const sandbox = "sandbox: { template: node-24, cpu: 4, memory: 8Gi, egress: [registry.npmjs.org] }";
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("implement", [sandbox]) }));
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
    },
  );

  const env: Record<string, string> = {};
  await given('FACTORY_SANDBOX_IMAGES is "ghcr.io/acme/sandbox"', async () => {
    env.FACTORY_SANDBOX_IMAGES = "ghcr.io/acme/sandbox";
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --k8s"', async () => {
    run = await sut.cli(["render", "--k8s"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  const file = "$OUTPUT/k8s/sandboxtemplate-implement.yaml";
  await then(
    '"k8s/sandboxtemplate-implement.yaml" in the output folder is a SandboxTemplate "implement" with the image "ghcr.io/acme/sandbox/node-24"',
    async () => {
      expect(lines(await sut.files.read(file))).toEqual(
        expect.arrayContaining([
          "apiVersion: extensions.agents.x-k8s.io/v1alpha1",
          "kind: SandboxTemplate",
          "  name: implement",
          "          image: ghcr.io/acme/sandbox/node-24",
        ]),
      );
    },
  );

  await then('its container requests and is limited to the CPU "4" and the memory "8Gi"', async () => {
    const quantities = '              cpu: "4"\n              memory: 8Gi\n';
    expect(await sut.files.read(file)).toContain(
      `            requests:\n${quantities}            limits:\n${quantities}`,
    );
  });

  await then('it has the annotation "opensoftware.dev/egress" with the value "registry.npmjs.org"', async () => {
    expect(lines(await sut.files.read(file))).toContain("    opensoftware.dev/egress: registry.npmjs.org");
  });
});
