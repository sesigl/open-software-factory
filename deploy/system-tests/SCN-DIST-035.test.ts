import { scenario } from "@opensoftware/testkit";
import { cluster, values } from "./chart.ts";

/** The manifests that one template of the chart rendered, from the output of "helm template". */
const rendered = (output: string, template: string) =>
  output
    .split(/^---$/m)
    .filter((document) => document.includes(`# Source: osf/templates/${template}\n`))
    .join("---");

scenario("SCN-DIST-035", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets" and "improve.enabled" to true', async () => {
    await values(sut, [], {}, "improve:\n  enabled: true\n");
  });

  let result: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm template osf deploy/helm/osf --values values.yaml"', async () => {
    result = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  await then(
    'the CronJob "osf-improve" runs "ledger report" and "observer analyze" in the image "observer", with the claim "osf-foreman" read-only and "IMPROVE_SCORERS" empty',
    async () => {
      const improve = rendered(result.stdout, "improve.yaml");
      expect(improve).toMatch(/kind: CronJob\nmetadata:\n\s+name: osf-improve\n/);
      expect(improve).toMatch(/image: ghcr\.io\/sesigl\/open-software-factory\/observer:\d+\.\d+\.\d+(-r\d+)?\n/);
      expect(improve).toContain("ledger report --db");
      expect(improve).toContain("observer analyze --runs");
      expect(improve).toMatch(/claimName: osf-foreman\n\s+readOnly: true\n/);
      expect(improve).toMatch(/- name: IMPROVE_SCORERS\n\s+value: ""\n/);
    },
  );

  await then(
    'the deployment "console" reads "CONSOLE_IMPROVE_DIR" from the claim "osf-improve", read-only',
    async () => {
      const console = rendered(result.stdout, "console.yaml");
      expect(console).toMatch(/- name: CONSOLE_IMPROVE_DIR\n\s+value: \/home\/node\/data\n/);
      expect(console).toMatch(/- name: improve\n\s+mountPath: \/home\/node\/data\n\s+readOnly: true\n/);
      expect(console).toMatch(/claimName: osf-improve\n\s+readOnly: true\n/);
    },
  );
});
