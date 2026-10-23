// create <spec.json>: the sandbox's container on an internal network, and its iron-proxy as the only way out.
import { join } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import type { SandboxSpec } from "@opensoftware/contracts";
import {
  EGRESS_IMAGE,
  memoryBytes,
  PROXY_DIR,
  proxyConfig,
  proxyEnv,
  READY,
  readSpec,
  resolveSecrets,
  type Secret,
  START_SCRIPT,
  sandboxEnv,
  WORKSPACE,
} from "@opensoftware/sandbox-egress";
import { docker, dockerText } from "../adapters/docker.ts";
import { withFolder } from "../adapters/files.ts";
import { EGRESS_URL, egressName, ROLE_LABEL, sandboxName } from "../domain/names.ts";
import { destroySandbox } from "./destroy.ts";

const READY_TIMEOUT_MS = 20_000;

export async function create(file: string | undefined, secretsDir: string): Promise<Outcome> {
  check(file, "name the sandbox spec, like create spec.json");
  const spec = readSpec(file as string);
  const secrets = resolveSecrets(spec, secretsDir);
  const container = await dockerText(["create", ...sandboxArgs(spec), spec.template, "infinity"]);
  const id = container.slice(0, 12);
  try {
    await dockerText(["rename", container, sandboxName(id)]);
    await dockerText(["network", "create", "--internal", "--label", `osf.sandbox.id=${id}`, sandboxName(id)]);
    await startEgress(id, spec, secrets, secretsDir);
    await startSandbox(id);
  } catch (error) {
    await destroySandbox(id);
    throw new Error(`the sandbox ${id} did not start and was removed: ${(error as Error).message}`);
  }
  return { lines: [id] };
}

/** The sandbox's container: no network until its egress proxy runs, the spec's limits and its environment. */
function sandboxArgs(spec: SandboxSpec): string[] {
  const env = Object.entries(sandboxEnv(spec, EGRESS_URL)).flatMap(([name, value]) => ["--env", `${name}=${value}`]);
  return [
    "--network",
    "none",
    "--label",
    ROLE_LABEL,
    ...(spec.cpu ? ["--cpus", String(spec.cpu)] : []),
    ...(spec.memory ? ["--memory", String(memoryBytes(spec.memory))] : []),
    "--security-opt",
    "no-new-privileges",
    "--workdir",
    WORKSPACE,
    "--entrypoint",
    "sleep",
    ...env,
  ];
}

/** The proxy joins the default bridge for the way out and the sandbox's network as "egress". */
async function startEgress(id: string, spec: SandboxSpec, secrets: Secret[], secretsDir: string): Promise<void> {
  const proxy = egressName(id);
  // The Docker CLI copies the proxy's variables from its own environment, so no value is on its command line.
  const variables = proxyEnv(secrets, process.env);
  const passed = Object.keys(variables).flatMap((name) => ["--env", name]);
  await dockerText(
    [
      "create",
      "--name",
      proxy,
      "--label",
      `osf.sandbox.id=${id}`,
      "--add-host",
      "host.docker.internal:host-gateway",
      ...passed,
      "--entrypoint",
      "sh",
      EGRESS_IMAGE,
      `${PROXY_DIR}/start.sh`,
    ],
    undefined,
    variables,
  );
  const config = proxyConfig(spec, secrets, { openbaoMount: process.env.OSF_OPENBAO_MOUNT });
  const files = {
    "proxy.yaml": `${JSON.stringify(config, null, 2)}\n`,
    "start.sh": START_SCRIPT,
    "secrets/.keep": "",
  };
  await withFolder(files, (folder) => dockerText(["cp", `${folder}/.`, `${proxy}:${PROXY_DIR}`]));
  // The Docker CLI copies each secret's file; the adapter never reads it.
  for (const secret of secrets) {
    if (secret.provider !== "file") continue;
    const { variable, file } = secret;
    await dockerText(["cp", "-L", join(secretsDir, file), `${proxy}:${PROXY_DIR}/secrets/${variable}`]);
  }
  await dockerText(["network", "connect", "--alias", "egress", sandboxName(id), proxy]);
  await dockerText(["start", proxy]);
  await waitUntilReady(proxy);
}

async function waitUntilReady(proxy: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const logs = await docker(["logs", proxy]);
    const text = logs.stdout.toString("utf8") + logs.stderr;
    if (text.includes(READY)) return;
    const state = await dockerText(["container", "inspect", "--format", "{{.State.Status}}", proxy]);
    if (state !== "running" || Date.now() > deadline) throw new Error(`the egress proxy did not start: ${text.trim()}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The sandbox trusts the proxy's CA, moves to its network, starts, and owns its working folder. */
async function startSandbox(id: string): Promise<void> {
  const container = sandboxName(id);
  const ca = await docker(["cp", `${egressName(id)}:${PROXY_DIR}/out/osf`, "-"]);
  if (ca.code !== 0) throw new Error(`the egress proxy has no CA: ${ca.stderr.trim()}`);
  await dockerText(["cp", "-", `${container}:/etc`], ca.stdout);
  await dockerText(["network", "disconnect", "none", container]);
  await dockerText(["network", "connect", container, container]);
  await dockerText(["start", container]);
  const owner = `${await dockerText(["exec", container, "id", "-u"])}:${await dockerText(["exec", container, "id", "-g"])}`;
  await dockerText(["exec", "--user", "0", container, "chown", owner, WORKSPACE]);
}
