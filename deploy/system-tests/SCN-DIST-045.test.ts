import { scenario } from "@opensoftware/testkit";
import { cluster, rendered, values } from "./chart.ts";

const REPOSITORY = "git+https://github.com/acme/factory.git#main";

/** An environment variable of a container that names its value, as "helm template" renders it. */
const value = (name: string, text: string) => new RegExp(`- name: ${name}\\n\\s+value: "?${text}"?\\n`);
/** An environment variable of a container from the key factory-token of the chart's Secret, osf-secrets. */
const fromToken = (name: string) =>
  new RegExp(
    `- name: ${name}\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+name: osf-secrets\\n\\s+key: factory-token\\n\\s+optional: true\\n`,
  );
/** The init containers of a Deployment, by their names, from the text "helm template" renders. */
const initContainers = (manifest: string) =>
  [
    ...(/\n {6}initContainers:\n([\s\S]*?)\n {6}containers:\n/.exec(manifest)?.[1] ?? "").matchAll(
      /^ {8}- name: (\S+)$/gm,
    ),
  ].map((found) => found[1]);

scenario("SCN-DIST-045", async ({ sut, fakes, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given(
    'a values file that sets every value under "secrets" with "factoryToken", under "factory" the repository "git+https://github.com/acme/factory.git#main" and the user "github:acme-factory"',
    async () => {
      await values(
        sut,
        [],
        { factoryToken: "factory-token-1" },
        ["factory:", `  repository: ${REPOSITORY}`, "  user: github:acme-factory", ""].join("\n"),
      );
    },
  );

  let result: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm template osf deploy/helm/osf --values values.yaml"', async () => {
    result = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  /** The Deployment of a template: the last manifest it renders, after its Service. */
  const deployment = (template: string) =>
    rendered(result.stdout, template)
      .split("---")
      .find((manifest) => /^kind: Deployment$/m.test(manifest)) ?? "";

  await then(
    'the deployment "foreman" sets "FOREMAN_FACTORY" to the repository and "FOREMAN_FACTORY_TOKEN" from the key "factory-token" of the chart\'s Secret, and has no init container that commits the chart\'s files',
    async () => {
      const foreman = deployment("foreman.yaml");
      expect(foreman).toMatch(value("FOREMAN_FACTORY", REPOSITORY.replaceAll("+", "\\+")));
      expect(foreman).toMatch(fromToken("FOREMAN_FACTORY_TOKEN"));
      expect(initContainers(foreman)).toEqual(["temporal-namespace"]);
    },
  );

  await then(
    'the deployments "gatekeeper" and "console" clone the repository with "FACTORY_TOKEN" from that key into their volume "factory-source" in the init container "factory-repo", which runs the profile\'s "factory-repo.sh"',
    async () => {
      const script = fakes.fromRepository("deploy/compose/factory-repo")["factory-repo.sh"] ?? "";
      for (const template of ["gatekeeper.yaml", "console.yaml"]) {
        const manifest = deployment(template);
        expect(initContainers(manifest)).toContain("factory-repo");
        expect(manifest).toContain(`command: [sh, -c, ${JSON.stringify(script)}, factory-repo, /factory]\n`);
        expect(manifest).toMatch(value("FACTORY_REPOSITORY", REPOSITORY.replaceAll("+", "\\+")));
        expect(manifest).toMatch(fromToken("FACTORY_TOKEN"));
        expect(manifest).toMatch(/- name: factory-source\n\s+mountPath: \/factory\n/);
        expect(manifest).toMatch(/- name: factory-source\n\s+emptyDir: \{\}\n/);
      }
    },
  );

  await then(
    'the deployment "console" sets "CONSOLE_FACTORY_REPOSITORY" to the repository, "CONSOLE_FACTORY_USER" to the user, "CONSOLE_FACTORY_TOKEN" from that key and "CONSOLE_FACTORY_COMMAND" to "factory"',
    async () => {
      const console = deployment("console.yaml");
      expect(console).toMatch(value("CONSOLE_FACTORY_REPOSITORY", REPOSITORY.replaceAll("+", "\\+")));
      expect(console).toMatch(value("CONSOLE_FACTORY_USER", "github:acme-factory"));
      expect(console).toMatch(fromToken("CONSOLE_FACTORY_TOKEN"));
      expect(console).toMatch(value("CONSOLE_FACTORY_COMMAND", "factory"));
    },
  );

  await then("the chart renders no ConfigMap of the reference factory", async () => {
    const maps = result.stdout.split(/^---$/m).filter((manifest) => /^kind: ConfigMap$/m.test(manifest));
    expect(maps.length).toBeGreaterThan(0);
    expect(maps.filter((map) => /^ {2}name: osf-factory$/m.test(map))).toEqual([]);
  });
});
