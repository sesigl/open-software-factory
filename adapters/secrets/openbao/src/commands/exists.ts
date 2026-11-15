// exists <name>: whether the secret has a value, from its metadata only, so the egress proxy's read token may ask and
// no value is read (ADR 0139). A current version that another client deleted or destroyed has no value.
import type { Outcome } from "@opensoftware/cli";
import { openBao } from "../adapters/openbao.ts";
import { mayNot, secretName } from "../domain/names.ts";

interface Metadata {
  current_version: number;
  versions: Record<string, { deletion_time: string; destroyed: boolean }>;
}

export async function exists(name: string | undefined): Promise<Outcome> {
  const secret = secretName(name);
  const bao = openBao();
  const answer = await bao.call<{ data: Metadata }>("GET", `${bao.mount}/metadata/${secret}`, mayNot("read", secret));
  const current = answer?.data.versions[answer.data.current_version];
  const found = current !== undefined && !current.deletion_time && !current.destroyed;
  return { lines: [JSON.stringify({ name: secret, exists: found })] };
}
