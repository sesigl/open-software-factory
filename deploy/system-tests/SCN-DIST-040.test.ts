import { scenario } from "@opensoftware/testkit";
import { cluster, rendered, values } from "./chart.ts";

/** An environment variable of a container that names its value, as "helm template" renders it. */
const value = (name: string, text: string) => new RegExp(`- name: ${name}\\n\\s+value: "?${text}"?\\n`);
/** An environment variable of a container from a key of a Secret. */
const fromSecret = (name: string, secret: string, key: string) =>
  new RegExp(`- name: ${name}\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n\\s+name: ${secret}\\n\\s+key: ${key}\\n`);

scenario("SCN-DIST-040", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given(
    'a values file that sets every value under "secrets", and under "openbao" the address "https://bao.acme.dev", the mount "factory" and the Secret "osf-openbao"',
    async () => {
      await values(
        sut,
        [],
        {},
        ["openbao:", "  address: https://bao.acme.dev", "  mount: factory", "  secret: osf-openbao", ""].join("\n"),
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

  await then(
    'the deployment "console" sets "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_MOUNT" to the values, "CONSOLE_SECRETS_ADAPTER" to "secrets-openbao", and "OSF_OPENBAO_TOKEN" from the key "console-token" of the Secret "osf-openbao"',
    async () => {
      const console = rendered(result.stdout, "console.yaml");
      expect(console).toMatch(value("OSF_OPENBAO_ADDR", "https://bao.acme.dev"));
      expect(console).toMatch(value("OSF_OPENBAO_MOUNT", "factory"));
      expect(console).toMatch(value("CONSOLE_SECRETS_ADAPTER", "secrets-openbao"));
      expect(console).toMatch(fromSecret("OSF_OPENBAO_TOKEN", "osf-openbao", "console-token"));
    },
  );

  await then(
    'the deployment "foreman" sets "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_MOUNT" to the values, "FOREMAN_SECRETS" to the adapter "secrets-openbao" for "openbao", and "OSF_OPENBAO_TOKEN" from the key "egress-token" of the Secret "osf-openbao"',
    async () => {
      const foreman = rendered(result.stdout, "foreman.yaml");
      expect(foreman).toMatch(value("OSF_OPENBAO_ADDR", "https://bao.acme.dev"));
      expect(foreman).toMatch(value("OSF_OPENBAO_MOUNT", "factory"));
      expect(foreman).toMatch(/- name: FOREMAN_SECRETS\n\s+value: '\{"openbao": "secrets-openbao"\}'\n/);
      expect(foreman).toMatch(fromSecret("OSF_OPENBAO_TOKEN", "osf-openbao", "egress-token"));
    },
  );

  await then("no manifest of the chart is an OpenBao server or a Secret with a key of OpenBao's tokens", async () => {
    const documents = result.stdout.split(/^---$/m);
    expect(documents.filter((document) => /image: .*openbao/.test(document))).toEqual([]);
    const secrets = documents.filter((document) => /^kind: Secret$/m.test(document));
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.filter((secret) => /console-token|egress-token|osf-openbao/.test(secret))).toEqual([]);
  });
});
