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
  let url = "";
  await then('the console\'s page "/" answers 200 with the heading "Runs"', async () => {
    url = `${await helm.url("osf-console", 8080)}/`;
    const response = await fetch(url);
    page = await response.text();
    expect(response.status).toBe(200);
    expect(page).toContain("<h1>Runs</h1>");
  });

  await then('the page does not say "did not answer"', async () => {
    // A Service reaches a pod a moment after the pod is ready, so the page is read again until it is current.
    const current = async () => {
      page = await (await fetch(url)).text();
      return page.includes("did not answer");
    };
    await expect
      .poll(current, { timeout: 30_000, interval: 1_000 })
      .toBe(false)
      .catch(async (error: Error) => {
        const pods = await helm.kubectl(["get", "pods", "--selector", "app.kubernetes.io/instance=osf"]);
        throw new Error(`${error.message}\n${pods.stdout}`, { cause: error });
      });
    expect(page).not.toContain("did not answer");
  });
});
