import { scenario } from "@opensoftware/testkit";
import { type cluster, sharedChart, unsetSecrets } from "./chart.ts";

scenario("SCN-DIST-021", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  let shared: Awaited<ReturnType<typeof sharedChart>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    shared = await sharedChart(sut);
    helm = shared.sut.helm("helm/osf");
  });

  await given('the operator installed the chart with a values file that sets every value under "secrets"', async () => {
    // The group's one install; "helm test" below only reads the release.
    expect(await unsetSecrets(shared.sut)).toEqual([]);
    expect(shared.result.exitCode, shared.result.stderr).toBe(0);
  });

  let test: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm test osf --logs"', async () => {
    test = await helm.run(["test", "osf", "--logs"]);
  });

  await then("the command exits with code 0", async () => {
    expect(test.exitCode, test.stdout + test.stderr).toBe(0);
  });

  await then('the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."', async () => {
    expect(test.stdout).toContain("Plan: 8 to add, 0 to change, 0 to remove, 0 drifted.");
  });
});
