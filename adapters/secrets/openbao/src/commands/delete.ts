// delete <name>: removes the secret with every version and its metadata. A secret the mount does not have is no error.
import type { Outcome } from "@opensoftware/cli";
import { openBao } from "../adapters/openbao.ts";
import { mayNot, secretName } from "../domain/names.ts";

export async function remove(name: string | undefined): Promise<Outcome> {
  const secret = secretName(name);
  const bao = openBao();
  const path = `${bao.mount}/metadata/${secret}`;
  const refused = mayNot("delete", secret);
  const found = await bao.call("GET", path, refused);
  if (found) await bao.call("DELETE", path, refused);
  return { lines: [JSON.stringify({ name: secret, deleted: Boolean(found) })] };
}
