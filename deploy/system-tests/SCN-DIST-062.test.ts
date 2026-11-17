import { scenario } from "@opensoftware/testkit";
import { cluster, rendered, values } from "./chart.ts";

scenario("SCN-DIST-062", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets"', async () => {
    await values(sut);
  });

  let result: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm template osf deploy/helm/osf --values values.yaml"', async () => {
    result = await helm.run(["template", "osf", helm.chart, "--values", "values.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  await then('the deployment "foreman" sets "FOREMAN_MAX_STAGES" to "2"', async () => {
    expect(rendered(result.stdout, "foreman.yaml")).toMatch(/- name: FOREMAN_MAX_STAGES\n\s+value: "2"\n/);
  });
});
