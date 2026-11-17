import { scenario } from "@opensoftware/testkit";
import { type cluster, sharedChart, unsetSecrets } from "./chart.ts";

scenario("SCN-DIST-010", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  let shared: Awaited<ReturnType<typeof sharedChart>>;
  await given("a kind cluster with the images of the Compose profile", async () => {
    shared = await sharedChart(sut);
    helm = shared.sut.helm("helm/osf");
  });

  await given('a values file that sets every value under "secrets"', async () => {
    expect(await unsetSecrets(shared.sut)).toEqual([]);
  });

  await when(
    'the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"',
    async () => {
      // The group's one install ran the command; this is its result.
      expect(shared.result.exitCode, shared.result.stderr).toBe(0);
    },
  );

  await then(
    'the console\'s page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"',
    async () => {
      const page = await (await fetch(`${await helm.url("osf-console", 8080)}/factory`)).text();
      const agents = [...page.matchAll(/<a href="\/factory\/agents\/([a-z-]+)">/g)].map((match) => match[1]);
      expect(agents).toEqual(["triage", "spec", "implement", "review", "ship"]);
    },
  );
});
