// sut.helm: a Helm chart of the unit, installed with `helm` in a Kubernetes namespace of the scenario (ADR 0075).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { program } from "../fakes/binaries.ts";
import { repoRoot } from "../support/module.ts";
import { baseEnv, type CliResult, run } from "../support/process.ts";
import type { Folders } from "./sut.ts";

export interface Helm {
  /** The absolute path of the chart, for `helm install <release> <chart>`. */
  chart: string;
  /** The scenario's namespace, which every command uses. It is deleted when the scenario ends. */
  namespace: string;
  /** Runs `helm <args> --namespace <namespace>` in $INPUT, on the cluster of `KUBECONFIG`. */
  run(args: string[]): Promise<CliResult>;
  /** Runs `kubectl --namespace <namespace> <args>` in $INPUT, on the same cluster. */
  kubectl(args: string[]): Promise<CliResult>;
  /** `http://127.0.0.1:<port>`, forwarded by `kubectl port-forward` to this port of the service until the scenario ends. */
  url(service: string, port: number): Promise<string>;
}

export function makeHelm(
  moduleRoot: string,
  dirs: Folders,
  onStop: (stop: () => Promise<unknown>) => void,
): (chart: string) => Helm {
  // The workspace's random name keeps parallel scenarios apart; a namespace is a lower-case DNS label.
  const namespace = basename(dirname(dirs.input))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  // Helm keeps its cache and repositories outside $INPUT, which belongs to the test.
  const helmHome = join(dirname(dirs.input), "helm");
  const env = {
    ...baseEnv(dirs.input),
    ...(process.env.KUBECONFIG ? { KUBECONFIG: process.env.KUBECONFIG } : {}),
    HELM_CACHE_HOME: join(helmHome, "cache"),
    HELM_CONFIG_HOME: join(helmHome, "config"),
    HELM_DATA_HOME: join(helmHome, "data"),
  };
  const kubectl = (args: string[]): Promise<CliResult> =>
    run(program("kubectl"), ["--namespace", namespace, ...args], dirs.input, env);
  let created: Promise<void> | undefined;
  const ensureNamespace = (): Promise<void> => {
    created ??= (async () => {
      const result = await run(program("kubectl"), ["create", "namespace", namespace], dirs.input, env);
      if (result.exitCode !== 0) throw new Error(`sut.helm: kubectl create namespace failed: ${result.stderr}`);
      onStop(() => run(program("kubectl"), ["delete", "namespace", namespace, "--wait=false"], dirs.input, env));
    })();
    return created;
  };
  return (chart) => {
    const path = resolve(moduleRoot, chart);
    if (!path.startsWith(moduleRoot + sep) || !existsSync(join(path, "Chart.yaml"))) {
      throw new Error(`sut.helm: no chart ${chart} in ${relative(repoRoot(), moduleRoot)}`);
    }
    return {
      chart: path,
      namespace,
      async run(args) {
        await ensureNamespace();
        return run(program("helm"), [...args, "--namespace", namespace], dirs.input, env);
      },
      async kubectl(args) {
        await ensureNamespace();
        return kubectl(args);
      },
      async url(service, port) {
        await ensureNamespace();
        const child = spawn(
          program("kubectl"),
          ["--namespace", namespace, "port-forward", "--address", "127.0.0.1", `service/${service}`, `:${port}`],
          { cwd: dirs.input, env },
        );
        onStop(async () => {
          child.kill();
        });
        const local = await new Promise<string>((resolvePort, reject) => {
          let output = "";
          const timer = setTimeout(
            () => reject(new Error(`sut.helm: no port-forward to ${service}:${port}: ${output}`)),
            30_000,
          );
          const read = (chunk: Buffer): void => {
            output += chunk;
            const forwarded = /Forwarding from 127\.0\.0\.1:(\d+)/.exec(output)?.[1];
            if (forwarded) {
              clearTimeout(timer);
              resolvePort(forwarded);
            }
          };
          child.stdout.on("data", read);
          child.stderr.on("data", read);
          child.on("close", () => {
            clearTimeout(timer);
            reject(new Error(`sut.helm: kubectl port-forward to ${service}:${port} ended: ${output}`));
          });
        });
        return `http://127.0.0.1:${local}`;
      },
    };
  };
}
