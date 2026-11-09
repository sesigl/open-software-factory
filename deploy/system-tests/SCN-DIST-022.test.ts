import { scenario } from "@opensoftware/testkit";
import { cluster, inForeman, install, values } from "./chart.ts";

scenario("SCN-DIST-022", async ({ sut, given, when, then }) => {
  let helm: Awaited<ReturnType<typeof cluster>>;
  await given("a kind cluster with agent-sandbox and the images of the Compose profile", async () => {
    helm = await cluster(sut);
  });

  await given('the operator installed the chart with a values file that sets every value under "secrets"', async () => {
    await values(sut);
    const result = await install(helm);
    expect(result.exitCode, result.stderr).toBe(0);
  });

  const foreman = (...command: string[]) => inForeman(helm, ...command);
  let id = "";
  await when(
    'the deployment "foreman" runs "sandbox-kubernetes create" with a spec of the agents\' template of the reference factory and the egress allowlist "litellm"',
    async () => {
      const factory = await foreman("cat", "/factory/repo/factory.yaml");
      const template = /^\s+template: (\S+)$/m.exec(factory.stdout)?.[1];
      expect(template).toMatch(/\/harness-claude-code:/);
      const spec = JSON.stringify({ template, egress: ["litellm"] });
      const created = await foreman(
        "sh",
        "-c",
        `printf '%s' '${spec}' > /tmp/spec.json && sandbox-kubernetes create /tmp/spec.json`,
      );
      expect(created.exitCode, created.stderr).toBe(0);
      id = created.stdout.trim().split("\n").at(-1) ?? "";
      expect(id).toMatch(/^[0-9a-f]{12}$/);
    },
  );

  const inSandbox = (script: string) => foreman("sandbox-kubernetes", "exec", id, "--", "sh", "-c", script);
  try {
    await then('the sandbox has the programs "harness-claude-code", "gh", "git" and "make"', async () => {
      const found = await inSandbox(
        "for p in harness-claude-code gh git make; do command -v $p >/dev/null && echo $p; done",
      );
      expect(found.stdout.trim().split("\n")).toEqual(["harness-claude-code", "gh", "git", "make"]);
    });

    await then(
      'in the sandbox, "GET http://litellm:4000/health/liveliness" answers 200, and a request to the chart\'s PostgreSQL fails',
      async () => {
        // Node's fetch takes HTTP_PROXY, the sandbox's egress proxy, only with NODE_USE_ENV_PROXY.
        const fetched = (url: string) =>
          inSandbox(
            `NODE_USE_ENV_PROXY=1 node -e 'fetch("${url}").then((r) => console.log(r.status), () => console.log("failed"))'`,
          );
        expect((await fetched("http://litellm:4000/health/liveliness")).stdout.trim()).toBe("200");
        const postgres = `http://osf-postgres.${helm.namespace}.svc.cluster.local:5432`;
        expect((await fetched(postgres)).stdout.trim()).not.toBe("200");
      },
    );
  } finally {
    await then(
      'after "sandbox-kubernetes destroy", "sandbox-kubernetes list" in the deployment "foreman" does not list the sandbox',
      async () => {
        const destroyed = await foreman("sandbox-kubernetes", "destroy", id);
        expect(destroyed.exitCode, destroyed.stderr).toBe(0);
        expect((await foreman("sandbox-kubernetes", "list")).stdout.split("\n")).not.toContain(id);
      },
    );
  }

  await then(
    'the service account of "foreman" may create sandbox claims in the namespace "<release namespace>-sandboxes", and may read no secret of the release namespace',
    async () => {
      const account = `system:serviceaccount:${helm.namespace}:osf-foreman`;
      const may = (verb: string, resource: string, namespace: string) =>
        helm.kubectl(["auth", "can-i", verb, resource, "--namespace", namespace, "--as", account]);
      const sandboxes = `${helm.namespace}-sandboxes`;
      const claims = await may("create", "sandboxclaims.extensions.agents.x-k8s.io", sandboxes);
      const secrets = await may("get", "secrets", helm.namespace);
      expect([claims.stdout.trim(), secrets.stdout.trim()]).toEqual(["yes", "no"]);
    },
  );
});
