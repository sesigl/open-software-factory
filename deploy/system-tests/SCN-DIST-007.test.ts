import { scenario } from "@opensoftware/testkit";
import { cluster, install, values, workloads } from "./chart.ts";

scenario("SCN-DIST-007", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('a values file that sets every value under "secrets"', async () => {
    await values(sut);
  });

  let result: Awaited<ReturnType<typeof install>>;
  await when(
    'the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"',
    async () => {
      result = await install(helm);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(result.exitCode, result.stderr).toBe(0);
  });

  await then(
    'the workloads "postgres", "nats", "temporal", "gatekeeper", "intake", "foreman" and "console" are ready',
    async () => {
      const names = ["postgres", "nats", "temporal", "gatekeeper", "intake", "foreman", "console"];
      const ready = await workloads(helm);
      expect(names.map((name) => ({ name, ready: ready[name] }))).toEqual(names.map((name) => ({ name, ready: true })));
    },
  );
});
