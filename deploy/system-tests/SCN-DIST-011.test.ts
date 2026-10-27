import { scenario } from "@opensoftware/testkit";
import { cluster, install, values } from "./chart.ts";

scenario("SCN-DIST-011", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('the operator installed the chart with a values file that sets every value under "secrets"', async () => {
    await values(sut);
    const result = await install(helm);
    expect(result.exitCode, result.stderr).toBe(0);
  });

  let test: Awaited<ReturnType<typeof helm.run>>;
  await when('the operator runs "helm test osf --logs"', async () => {
    test = await helm.run(["test", "osf", "--logs"]);
  });

  await then("the command exits with code 0", async () => {
    expect(test.exitCode, test.stdout + test.stderr).toBe(0);
  });

  await then('the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."', async () => {
    expect(test.stdout).toContain("Plan: 7 to add, 0 to change, 0 to remove, 0 drifted.");
  });
});
