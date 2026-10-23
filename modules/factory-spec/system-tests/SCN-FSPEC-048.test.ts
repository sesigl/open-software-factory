import { scenario } from "@opensoftware/testkit";
import { lines, resource } from "./documents.ts";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-048", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" runs in a sandbox with the template "node:24", the CPU 2 and the memory "4Gi"',
    async () => {
      const sandbox = ["sandbox:", '  template: "node:24"', "  cpu: 2", "  memory: 4Gi"];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage", sandbox) }));
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

  let found: string | undefined;
  await then(
    '"k8s/triage.yaml" in the output folder has a "SandboxTemplate" "triage" whose container "sandbox" runs "node:24"',
    async () => {
      found = resource(await sut.files.read("$OUTPUT/k8s/triage.yaml"), "SandboxTemplate", "triage");
      expect(found).toContain("apiVersion: extensions.agents.x-k8s.io/v1beta1\n");
      expect(found).toContain("        - name: sandbox\n          image: node:24\n");
    },
  );

  await then('the container requests and is limited to the CPU "2" and the memory "4Gi"', async () => {
    expect(found).toContain(
      lines(
        `
        resources:
          requests:
            cpu: "2"
            memory: 4Gi
          limits:
            cpu: "2"
            memory: 4Gi
        `,
        5,
      ),
    );
  });
});
