// The Helm chart as a platform team installs it: a values file in $INPUT that sets every secret (ADR 0075).
import type { CliResult, Helm, Shared, SharedSut, Sut } from "@opensoftware/testkit";

/** The seed of gatekeeper's Ed25519 key, 64 hex digits, made up for the tests. */
export const GATEKEEPER_SIGNING_KEY = "5eed".repeat(16);

/** The secrets of the values file, made up for the tests. */
const SECRETS: Record<string, string> = {
  gatekeeperSigningKey: GATEKEEPER_SIGNING_KEY,
  postgresPassword: "postgres-password-1",
  foremanApiToken: "foreman-token-1",
  intakeApiToken: "intake-token-1",
  gatekeeperApiToken: "gatekeeper-token-1",
  gatekeeperSlackToken: "xoxb-gatekeeper-1",
  gatekeeperSlackSigningSecret: "slack-signing-secret-1",
  litellmMasterKey: "sk-litellm-master-1",
  githubToken: "github-token-1",
  claudeCodeOauthToken: "claude-code-token-1",
};

/**
 * The chart on the cluster of KUBECONFIG, in the scenario's namespace. The CI job starts kind; test:system's
 * scripts/images.ts loads the chart's images into it, the module images of the commit (deploy/README.md).
 */
export async function cluster(sut: SharedSut): Promise<Helm> {
  const helm = sut.helm("helm/osf");
  // Kubernetes creates the "default" service account of a new namespace a moment after the namespace, so the step
  // asks again, once a second for up to 30 s.
  let account = await helm.kubectl(["get", "serviceaccount", "default"]);
  for (let attempt = 1; account.exitCode !== 0 && attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    account = await helm.kubectl(["get", "serviceaccount", "default"]);
  }
  if (account.exitCode !== 0) throw new Error(`no cluster to install the chart on: ${account.stderr}`);
  return helm;
}

/** Writes `values.yaml` with every secret but those in `except`, the secrets of `more`, and the YAML of `rest`. */
export async function values(
  sut: SharedSut,
  except: string[] | string = [],
  more: Record<string, string> = {},
  rest = "",
): Promise<void> {
  const lines = Object.entries({ ...SECRETS, ...more })
    .filter(([name]) => ![except].flat().includes(name))
    .map(([name, value]) => `  ${name}: ${value}`);
  await sut.files.put("$INPUT/values.yaml", ["secrets:", ...lines, rest].join("\n"));
}

/** "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m", with the chart's own path. */
export function install(helm: Helm): Promise<CliResult> {
  return helm.run(["install", "osf", helm.chart, "--values", "values.yaml", "--wait", "--timeout", "10m"]);
}

/**
 * The one install of the chart for the scenarios tagged `@shared=helm-chart`, which only read it (ADR 0157): a values
 * file that sets every secret and "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m" in the
 * group's namespace. Its result is that command's.
 */
export function sharedChart(sut: Sut): Promise<Shared<CliResult>> {
  return sut.shared("helm-chart", async (start) => {
    const helm = await cluster(start);
    await values(start);
    const result = await install(helm);
    if (result.exitCode !== 0)
      throw new Error(`"helm install osf" exited with code ${result.exitCode}: ${result.stderr}`);
    return result;
  });
}

/** The secrets that the values file in $INPUT does not set under "secrets"; none in the file that `values` writes. */
export async function unsetSecrets(sut: SharedSut): Promise<string[]> {
  const file = await sut.files.read("$INPUT/values.yaml");
  return Object.keys(SECRETS).filter((name) => !file.includes(`\n  ${name}: `));
}

/** The manifests that one template of the chart rendered, from the output of "helm template". */
export const rendered = (output: string, template: string) =>
  output
    .split(/^---$/m)
    .filter((document) => document.includes(`# Source: osf/templates/${template}\n`))
    .join("---");

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

/** Runs a command in the container of the deployment foreman. */
export function inForeman(helm: Helm, ...command: string[]): Promise<CliResult> {
  return helm.kubectl(["exec", "deployment/osf-foreman", "--container", "foreman", "--", ...command]);
}
