import { scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

// A stand-in for a Kubernetes API server, in a kubeconfig of its own: it knows the kinds of a sandbox, has the claim of
// one sandbox, and refuses its removal with 403, as a cluster refuses a caller without the right to delete. kubectl
// reads the API's discovery, lists each kind by the sandbox's label and deletes what it found.
const ID = "0123456789ab";
const NAME = `osf-sandbox-${ID}`;
const GROUP = "extensions.agents.x-k8s.io";
const VERSION = "v1beta1";
const REFUSAL = `sandboxclaims.${GROUP} "${NAME}" is forbidden: User "osf-reader" cannot delete resource "sandboxclaims"`;
const SELECTOR = `labelSelector=osf.sandbox.id%3D${ID}`;

/** An API resource of discovery, namespaced, with the verbs kubectl needs. */
const resource = (name: string, kind: string) => ({
  name,
  singularName: kind.toLowerCase(),
  namespaced: true,
  kind,
  verbs: ["get", "list", "delete"],
});
const empty = (kind: string) => ({ kind: `${kind}List`, apiVersion: "v1", metadata: {}, items: [] });
const claim = {
  apiVersion: `${GROUP}/${VERSION}`,
  kind: "SandboxClaim",
  metadata: { name: NAME, namespace: "default", labels: { "osf.sandbox.id": ID, "osf.sandbox.role": "sandbox" } },
};

const KUBECONFIG = (server: string) =>
  JSON.stringify({
    apiVersion: "v1",
    kind: "Config",
    clusters: [{ name: "fake", cluster: { server } }],
    users: [{ name: "osf-reader", user: { token: "osf-reader-token" } }],
    contexts: [{ name: "fake", context: { cluster: "fake", user: "osf-reader", namespace: "default" } }],
    "current-context": "fake",
  });

scenario("SCN-SANDBOX-032", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
  await given("a sandbox that the platform refuses to remove", async () => {
    const core = ["pods", "services", "configmaps", "secrets"];
    const extensions = ["sandboxclaims", "sandboxwarmpools", "sandboxtemplates"];
    const kinds: Record<string, string> = {
      pods: "Pod",
      services: "Service",
      configmaps: "ConfigMap",
      secrets: "Secret",
      sandboxclaims: "SandboxClaim",
      sandboxwarmpools: "SandboxWarmPool",
      sandboxtemplates: "SandboxTemplate",
    };
    const list = (path: string, name: string) => ({
      path: `${path}/namespaces/default/${name}?${SELECTOR}`,
      body: name === "sandboxclaims" ? { ...empty("SandboxClaim"), items: [claim] } : empty(kinds[name] as string),
    });
    api = await fakes.http([
      { path: "/api?timeout=32s", body: { kind: "APIVersions", versions: ["v1"], serverAddressByClientCIDRs: [] } },
      {
        path: "/apis?timeout=32s",
        body: {
          kind: "APIGroupList",
          apiVersion: "v1",
          groups: [
            {
              name: GROUP,
              versions: [{ groupVersion: `${GROUP}/${VERSION}`, version: VERSION }],
              preferredVersion: { groupVersion: `${GROUP}/${VERSION}`, version: VERSION },
            },
          ],
        },
      },
      {
        path: "/api/v1?timeout=32s",
        body: {
          kind: "APIResourceList",
          groupVersion: "v1",
          resources: core.map((name) => resource(name, kinds[name] as string)),
        },
      },
      {
        path: `/apis/${GROUP}/${VERSION}?timeout=32s`,
        body: {
          kind: "APIResourceList",
          apiVersion: "v1",
          groupVersion: `${GROUP}/${VERSION}`,
          resources: extensions.map((name) => resource(name, kinds[name] as string)),
        },
      },
      { path: `/apis/${GROUP}/${VERSION}/namespaces/default/sandboxclaims/${NAME}`, body: claim },
      ...core.map((name) => list("/api/v1", name)),
      ...extensions.map((name) => list(`/apis/${GROUP}/${VERSION}`, name)),
      {
        method: "DELETE",
        path: `/apis/${GROUP}/${VERSION}/namespaces/default/sandboxclaims/${NAME}`,
        status: 403,
        body: { kind: "Status", apiVersion: "v1", status: "Failure", message: REFUSAL, reason: "Forbidden", code: 403 },
      },
    ]);
    await sut.files.put("$INPUT/kubeconfig.json", KUBECONFIG(api.url));
  });

  let run: Awaited<ReturnType<ReturnType<typeof sandboxes>["cli"]>>;
  await when("the client destroys the sandbox", async () => {
    run = await sandboxes(sut, { KUBECONFIG: sut.files.path("$INPUT/kubeconfig.json") }).cli(["destroy", ID]);
  });

  await then(
    'destroy exits with code 1 and writes "the sandbox <ID> was not removed: " and the platform\'s error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(1);
      expect(run.stderr).toContain(`the sandbox ${ID} was not removed: kubectl delete failed: `);
      expect(run.stderr).toContain(REFUSAL);
    },
  );

  await then('it does not print "destroyed <ID>"', async () => {
    expect(run.stdout).not.toContain(`destroyed ${ID}`);
  });
});
