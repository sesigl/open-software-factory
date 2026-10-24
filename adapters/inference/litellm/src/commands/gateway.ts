// What every command after start needs: a gateway that exists, found by its ID, with its address and master key.
import { check } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import type { Gateway } from "../adapters/litellm.ts";
import { gatewayName, ID, PROXY_PORT } from "../domain/names.ts";

/** An ID of the wrong form is a usage error, an unknown one an error. */
export async function findGateway(id: string | undefined): Promise<Gateway> {
  check(id && ID.test(id), "name a gateway by the 12 hex digits start printed");
  const name = gatewayName(id as string);
  const env = await docker(["container", "inspect", "--format", "{{json .Config.Env}}", name]).catch(() => {
    throw new Error(`no gateway ${id}`);
  });
  const masterKey = (JSON.parse(env) as string[]).find((entry) => entry.startsWith("LITELLM_MASTER_KEY="));
  return { origin: await origin(name), masterKey: (masterKey as string).slice("LITELLM_MASTER_KEY=".length) };
}

/** The gateway's address on this host: its published port on 127.0.0.1. */
export async function origin(name: string): Promise<string> {
  const address = (await docker(["port", name, `${PROXY_PORT}/tcp`])).split("\n")[0];
  return `http://${address}`;
}
