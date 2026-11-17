import { scenario } from "@opensoftware/testkit";
import { cluster, install, values, workloads } from "./chart.ts";

const MODULES = ["gatekeeper", "intake", "foreman", "console"];

scenario("SCN-DIST-060", async ({ sut, given, when, then }) => {
  // test:system runs scripts/images.ts before the tests: it builds the module images and loads them into kind.
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given(
    'a kind cluster with the images of the Compose profile, the module images built from this workspace with "node scripts/images.ts"',
    async () => {
      helm = await cluster(sut);
    },
  );

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
    'the workloads "postgres", "nats", "temporal", "litellm", "gatekeeper", "intake", "foreman" and "console" are ready',
    async () => {
      const names = ["postgres", "nats", "temporal", "litellm", "gatekeeper", "intake", "foreman", "console"];
      const ready = await workloads(helm);
      expect(names.map((name) => ({ name, ready: ready[name] }))).toEqual(names.map((name) => ({ name, ready: true })));
    },
  );

  await then(
    'the containers "gatekeeper", "intake", "foreman" and "console" each hold the pack of their own package in "/opt/osf/packs"',
    async () => {
      for (const name of MODULES) {
        // A released image installs from npm and has no /opt/osf; an image of the commit has its packs there.
        const listed = await helm.kubectl([
          "exec",
          `deployment/osf-${name}`,
          "--container",
          name,
          "--",
          "ls",
          "/opt/osf/packs",
        ]);
        expect(listed.exitCode, `${name}: ${listed.stderr}`).toBe(0);
        expect(listed.stdout.split("\n"), name).toContainEqual(
          expect.stringMatching(new RegExp(`^opensoftware-${name}-\\d+\\.\\d+\\.\\d+\\.tgz$`)),
        );
      }
    },
  );
});
