// create <spec.json>: the sandbox's container on an internal network, and its iron-proxy as the only way out.
import { join } from "node:path";
import { check, type Outcome, UsageError } from "@opensoftware/cli";
import { type SandboxSpec, validate } from "@opensoftware/contracts";
import { docker, dockerText } from "../adapters/docker.ts";
import { fileExists, readText, withFolder } from "../adapters/files.ts";
import { EGRESS_IMAGE, egressName, ROLE_LABEL, sandboxName, WORKSPACE } from "../domain/names.ts";
import { PROXY_DIR, proxyConfig, READY, START_SCRIPT } from "../domain/proxy-config.ts";
import { memoryBytes, type SecretFile, sandboxEnv, secretFiles } from "../domain/spec.ts";
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

function readSpec(file: string): SandboxSpec {
  const document: unknown = JSON.parse(readText(file));
  const problems = validate("sandbox-spec", document);
  if (problems.length) {
    throw new UsageError(problems.map((problem) => `${file}: ${problem.path} ${problem.message}`).join("\n"));
  }
  return document as SandboxSpec;
}

function resolveSecrets(spec: SandboxSpec, secretsDir: string): SecretFile[] {
  const { files, problems } = secretFiles(spec);
  for (const { variable, file } of files) {
    if (!fileExists(join(secretsDir, file)))
      problems.push(`secret "${variable}" has no file "${file}" in ${secretsDir}`);
  }
  if (problems.length) throw new UsageError(problems.join("\n"));
  return files;
}

/** The sandbox's container: no network until its egress proxy runs, the spec's limits and its environment. */
function sandboxArgs(spec: SandboxSpec): string[] {
  const env = Object.entries(sandboxEnv(spec)).flatMap(([name, value]) => ["--env", `${name}=${value}`]);
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
async function startEgress(id: string, spec: SandboxSpec, secrets: SecretFile[], secretsDir: string): Promise<void> {
  const proxy = egressName(id);
  await dockerText([
    "create",
    "--name",
    proxy,
    "--label",
    `osf.sandbox.id=${id}`,
    "--add-host",
    "host.docker.internal:host-gateway",
    "--entrypoint",
    "sh",
    EGRESS_IMAGE,
    `${PROXY_DIR}/start.sh`,
  ]);
  const files = {
    "proxy.yaml": `${JSON.stringify(proxyConfig(spec, secrets), null, 2)}\n`,
    "start.sh": START_SCRIPT,
    "secrets/.keep": "",
  };
  await withFolder(files, (folder) => dockerText(["cp", `${folder}/.`, `${proxy}:${PROXY_DIR}`]));
  // The Docker CLI copies each secret's file; the adapter never reads it.
  for (const { variable, file } of secrets) {
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
