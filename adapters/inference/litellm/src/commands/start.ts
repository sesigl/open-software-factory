// start <config>: PostgreSQL and the LiteLLM proxy on a network of their own, the proxy published on 127.0.0.1.
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import { docker, errors } from "../adapters/docker.ts";
import { ready } from "../adapters/litellm.ts";
import { gatewayConfig } from "../domain/config.ts";
import {
  CONFIG_DIR,
  databaseName,
  GATEWAY_LABEL,
  gatewayName,
  ID_LABEL,
  LITELLM_IMAGE,
  POSTGRES_IMAGE,
  PROXY_PORT,
} from "../domain/names.ts";
import { origin } from "./gateway.ts";
import { removeGateway } from "./stop.ts";

const READY_TIMEOUT_MS = 180_000;

export async function start(file: string | undefined): Promise<Outcome> {
  check(file, "name the LiteLLM config, like start litellm-config.yaml");
  const config = gatewayConfig(readFileSync(file as string, "utf8"));
  const id = randomBytes(6).toString("hex");
  const name = gatewayName(id);
  const password = randomBytes(18).toString("hex");
  // Only in the containers' environment: the Docker CLI copies them from its own, so no value is on a command line.
  const secrets = {
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgresql://litellm:${password}@db:5432/litellm`,
    LITELLM_MASTER_KEY: `sk-osf-${randomBytes(24).toString("hex")}`,
  };
  const labels = ["--label", `${ID_LABEL}=${id}`];
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
