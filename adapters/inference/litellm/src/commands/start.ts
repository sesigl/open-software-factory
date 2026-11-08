// start <config>: PostgreSQL and the LiteLLM proxy on a network of their own, the proxy published on 127.0.0.1. A
// config with osf.proxy attaches to a proxy that already runs instead (attach.ts).
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import { docker, errors } from "../adapters/docker.ts";
import { ready } from "../adapters/litellm.ts";
import { attachedProxy, gatewayConfig } from "../domain/config.ts";
import {
  CONFIG_DIR,
  databaseName,
  GATEWAY_LABEL,
  gatewayName,
  HOST_LABEL,
  ID_LABEL,
  LITELLM_IMAGE,
  OWNER_LABEL,
  POSTGRES_IMAGE,
  PROXY_PORT,
} from "../domain/names.ts";
import { attach } from "./attach.ts";
import { origin } from "./gateway.ts";
import { removeGateway } from "./stop.ts";

const READY_TIMEOUT_MS = 180_000;

/** Whether the process lives: signal 0 checks without sending; EPERM means it lives under another user. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Removes the gateways whose owner ran on this host and no longer runs, once they are older than
 * OSF_INFERENCE_ORPHAN_AGE seconds (default 120): a foreman that was killed leaves its gateway behind otherwise (ADR
 * 0090). The age leaves a gateway alone while another start still creates it. A gateway without an owner, or of
 * another host, is never touched.
 */
async function removeOrphans(): Promise<void> {
  const age = Number(process.env.OSF_INFERENCE_ORPHAN_AGE || 120) * 1000;
  const format = `{{.Label "${ID_LABEL}"}} {{.Label "${OWNER_LABEL}"}} {{.Label "${HOST_LABEL}"}} {{.ID}}`;
  const rows = await docker(["ps", "--all", "--filter", `label=${GATEWAY_LABEL}`, "--format", format]);
  for (const row of rows.split("\n").filter(Boolean)) {
    const [id, owner, host, container] = row.split(" ");
    const pid = Number(owner);
    if (!id || !container || host !== hostname() || !(pid > 0) || alive(pid)) continue;
    const created = Date.parse(await docker(["container", "inspect", "--format", "{{.Created}}", container]));
    if (Date.now() - created >= age) await removeGateway(id);
  }
}

export async function start(file: string | undefined): Promise<Outcome> {
  check(file, "name the LiteLLM config, like start litellm-config.yaml");
  const text = readFileSync(file as string, "utf8");
  const proxy = attachedProxy(text);
  if (proxy) return attach(proxy);
  const config = gatewayConfig(text);
  await removeOrphans();
  const id = randomBytes(6).toString("hex");
  const name = gatewayName(id);
  const password = randomBytes(18).toString("hex");
  // Only in the containers' environment: the Docker CLI copies them from its own, so no value is on a command line.
  const secrets = {
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgresql://litellm:${password}@db:5432/litellm`,
    LITELLM_MASTER_KEY: `sk-osf-${randomBytes(24).toString("hex")}`,
  };
  const owner = process.env.OSF_INFERENCE_OWNER;
  const ownerLabels = owner ? ["--label", `${OWNER_LABEL}=${owner}`, "--label", `${HOST_LABEL}=${hostname()}`] : [];
  const labels = ["--label", `${ID_LABEL}=${id}`, ...ownerLabels];
  try {
    await docker(["network", "create", ...labels, name]);
    await docker(
      ["run", "--detach", "--name", databaseName(id), "--network", name, "--network-alias", "db", ...labels]
        .concat(["--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_USER=litellm", "--env", "POSTGRES_DB=litellm"])
        .concat([POSTGRES_IMAGE]),
      secrets,
    );
    const passed = ["DATABASE_URL", "LITELLM_MASTER_KEY", ...config.variables].flatMap((variable) => [
      "--env",
      variable,
    ]);
    await docker(
      ["create", "--name", name, "--network", name, ...labels, "--label", GATEWAY_LABEL]
        .concat(["--add-host", "host.docker.internal:host-gateway", "--publish", `127.0.0.1::${PROXY_PORT}`])
        .concat(["--env", "LITELLM_LOCAL_MODEL_COST_MAP=True", ...passed, LITELLM_IMAGE])
        .concat(["--config", `${CONFIG_DIR}/config.yaml`, "--port", String(PROXY_PORT)]),
      secrets,
    );
    const folder = mkdtempSync(join(tmpdir(), "osf-inference-"));
    try {
      writeFileSync(join(folder, "config.yaml"), config.text);
      await docker(["cp", folder, `${name}:${CONFIG_DIR}`]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
    await docker(["start", name]);
    const url = await waitUntilReady(name);
    return { lines: [JSON.stringify({ id, url: `${url}/v1` })] };
  } catch (error) {
    await removeGateway(id);
    throw new Error(`the gateway ${id} did not start and was removed: ${(error as Error).message}`);
  }
}

/** Waits until the proxy answers and reaches its database; gives its address. */
async function waitUntilReady(name: string): Promise<string> {
  const address = await origin(name);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!(await ready(address))) {
    const state = await docker(["container", "inspect", "--format", "{{.State.Status}}", name]);
    if (state !== "running" || Date.now() > deadline) {
      throw new Error(`LiteLLM is ${state}:\n${await errors(name)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return address;
}
