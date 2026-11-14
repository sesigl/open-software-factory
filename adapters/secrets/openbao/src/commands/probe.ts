// probe: the store answers to the token, how long the token still lives, and that the mount is KV version 2. It asks
// for the mount as OpenBao's own CLI does, through sys/internal/ui/mounts.
import type { Outcome } from "@opensoftware/cli";
import { openBao, REFUSED_TOKEN } from "../adapters/openbao.ts";
import { noMount } from "../domain/names.ts";

export async function probe(): Promise<Outcome> {
  const bao = openBao();
  const self = await bao.call<{ data: { ttl: number; expire_time: string | null } }>(
    "GET",
    "auth/token/lookup-self",
    REFUSED_TOKEN,
  );
  const mount = await bao.call<{ data: { options: { version?: string } | null } }>(
    "GET",
    `sys/internal/ui/mounts/${bao.mount}`,
    noMount(bao.mount),
  );
  if ((mount as { data: { options: { version?: string } | null } }).data.options?.version !== "2")
    throw new Error(noMount(bao.mount));
  const { ttl, expire_time: expires } = (self as { data: { ttl: number; expire_time: string | null } }).data;
  return { lines: [JSON.stringify({ ttl, expires })] };
}
