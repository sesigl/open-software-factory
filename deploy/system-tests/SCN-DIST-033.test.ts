import { scenario } from "@opensoftware/testkit";
import { cluster, values } from "./chart.ts";

/** The manifests that one template of the chart rendered, from the output of "helm template". */
const rendered = (output: string, template: string) =>
  output
    .split(/^---$/m)
    .filter((document) => document.includes(`# Source: osf/templates/${template}\n`))
    .join("---");

scenario("SCN-DIST-033", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given(
    'a values file that sets every value under "secrets" but the two Slack secrets, and sets "forgeToken"',
    async () => {
      await values(sut, ["gatekeeperSlackToken", "gatekeeperSlackSigningSecret"], { forgeToken: "forge-token-1" });
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
    'the deployment "gatekeeper" runs "gatekeeper serve" without "--channel", with "GATEKEEPER_FORGE_TOKEN" from the key "forge-token" and without a Slack variable',
    async () => {
      const gatekeeper = rendered(result.stdout, "gatekeeper.yaml");
      expect(gatekeeper).toContain(
        "args: [gatekeeper, serve, --policy, /factory/policy/spec.rego, --groups, /factory/groups.json]\n",
      );
      expect(gatekeeper).toMatch(
        /- name: GATEKEEPER_FORGE_TOKEN\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: osf-secrets\n\s+key: forge-token\n/,
      );
      expect(gatekeeper).not.toContain("SLACK");
    },
  );

  await then(
    'the release\'s Secret has no key "gatekeeper-slack-token" or "gatekeeper-slack-signing-secret"',
    async () => {
      const secret = rendered(result.stdout, "secret.yaml");
      expect(secret).toContain('forge-token: "forge-token-1"\n');
      expect(secret).not.toContain("gatekeeper-slack-token");
      expect(secret).not.toContain("gatekeeper-slack-signing-secret");
    },
  );
});
