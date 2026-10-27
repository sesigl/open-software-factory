import { scenario } from "@opensoftware/testkit";
import { cluster, install, values } from "./chart.ts";

scenario("SCN-DIST-008", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets" except "foremanApiToken"', async () => {
    await values(sut, "foremanApiToken");
  });

  let result: Awaited<ReturnType<typeof install>>;
  await when(
    'the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"',
    async () => {
      result = await install(helm);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(result.exitCode).toBe(1);
  });

  await then('the output contains "set secrets.foremanApiToken or secrets.existingSecret"', async () => {
    expect(result.stdout + result.stderr).toContain("set secrets.foremanApiToken or secrets.existingSecret");
  });
});
