// The Helm chart as a platform team installs it: a values file in $INPUT that sets every secret (ADR 0075).
import type { CliResult, Helm, Sut } from "@opensoftware/testkit";

/** The secrets of the values file, made up for the tests. */
const SECRETS: Record<string, string> = {
  postgresPassword: "postgres-password-1",
  foremanApiToken: "foreman-token-1",
  intakeApiToken: "intake-token-1",
  gatekeeperApiToken: "gatekeeper-token-1",
  gatekeeperSlackToken: "xoxb-gatekeeper-1",
  gatekeeperSlackSigningSecret: "slack-signing-secret-1",
};

/**
 * The chart on the cluster of KUBECONFIG, in the scenario's namespace. The CI job starts kind and loads the images
 * of the Compose profile into it first (deploy/README.md#helm-chart).
 */
export async function cluster(sut: Sut): Promise<Helm> {
  const helm = sut.helm("helm/osf");
  const account = await helm.kubectl(["get", "serviceaccount", "default"]);
  if (account.exitCode !== 0) throw new Error(`no cluster to install the chart on: ${account.stderr}`);
  return helm;
}

/** Writes `values.yaml` with every secret but `except`. */
export async function values(sut: Sut, except?: string): Promise<void> {
  const lines = Object.entries(SECRETS)
    .filter(([name]) => name !== except)
    .map(([name, value]) => `  ${name}: ${value}`);
  await sut.files.put("$INPUT/values.yaml", ["secrets:", ...lines, ""].join("\n"));
}

/** "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m", with the chart's own path. */
export function install(helm: Helm): Promise<CliResult> {
  return helm.run(["install", "osf", helm.chart, "--values", "values.yaml", "--wait", "--timeout", "10m"]);
}

/** The ready state of each workload of the release, by its component. */
export async function workloads(helm: Helm): Promise<Record<string, boolean>> {
  const result = await helm.kubectl([
    "get",
    "deployments,statefulsets",
    "--selector",
    "app.kubernetes.io/instance=osf",
    "--output",
    "json",
  ]);
  if (result.exitCode !== 0) throw new Error(result.stderr);
  const list = JSON.parse(result.stdout) as {
    items: {
      metadata: { labels: Record<string, string> };
      spec: { replicas: number };
      status: { readyReplicas?: number };
    }[];
  };
  return Object.fromEntries(
    list.items.map((item) => [
      item.metadata.labels["app.kubernetes.io/component"],
      (item.status.readyReplicas ?? 0) === item.spec.replicas,
    ]),
  );
}
