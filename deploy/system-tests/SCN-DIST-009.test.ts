import { scenario } from "@opensoftware/testkit";
import { cluster, install, values } from "./chart.ts";

scenario("SCN-DIST-009", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets"', async () => {
    await values(sut);
  });

  await when(
    'the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"',
    async () => {
      const result = await install(helm);
      expect(result.exitCode, result.stderr).toBe(0);
    },
  );

  let page = "";
  await then('the console\'s page "/" answers 200 with the heading "Runs"', async () => {
    const response = await fetch(`${await helm.url("osf-console", 8080)}/`);
    page = await response.text();
    expect(response.status).toBe(200);
    expect(page).toContain("<h1>Runs</h1>");
  });

  await then('the page does not say "did not answer"', async () => {
    expect(page).not.toContain("did not answer");
  });
});
