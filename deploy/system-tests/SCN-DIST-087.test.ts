import { scenario } from "@opensoftware/testkit";
import { cluster, GATEKEEPER_SIGNING_KEY, rendered, values } from "./chart.ts";

scenario("SCN-DIST-087", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets", "gatekeeperSigningKey" among them', async () => {
    await values(sut);
  });

  let result: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm template osf deploy/helm/osf --values values.yaml"', async () => {
    result = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  await then(
    'the chart\'s Secret has the key "gatekeeper-signing-key" with the value of "secrets.gatekeeperSigningKey"',
    async () => {
      expect(rendered(result.stdout, "secret.yaml")).toContain(
        `  gatekeeper-signing-key: "${GATEKEEPER_SIGNING_KEY}"\n`,
      );
    },
  );

  await then(
    'the deployment "gatekeeper" sets "GATEKEEPER_SIGNING_KEY" from the key "gatekeeper-signing-key" of the chart\'s Secret',
    async () => {
      expect(rendered(result.stdout, "gatekeeper.yaml")).toMatch(
        /- name: GATEKEEPER_SIGNING_KEY\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: osf-secrets\n\s+key: gatekeeper-signing-key\n/,
      );
    },
  );

  let without: Awaited<ReturnType<typeof helm.run>>;
  await when(
    'the operator runs it again with a values file that sets every value under "secrets" except "gatekeeperSigningKey"',
    async () => {
      await values(sut, "gatekeeperSigningKey");
      without = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(without.exitCode, without.stderr).toBe(1);
  });

  await then('the output contains "set secrets.gatekeeperSigningKey or secrets.existingSecret"', async () => {
    expect(without.stdout + without.stderr).toContain("set secrets.gatekeeperSigningKey or secrets.existingSecret");
  });
});
