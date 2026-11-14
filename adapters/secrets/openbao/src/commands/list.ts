// list: one line per secret of the mount with its current version, and the time and the person of that version. A
// name may hold "/", so list walks the folders. OpenBao lists the keys of a folder sorted, and a folder's key ends with
// "/", so the walk gives the names sorted.
import type { Outcome } from "@opensoftware/cli";
import { type OpenBao, openBao } from "../adapters/openbao.ts";
import { MAY_NOT_LIST } from "../domain/names.ts";

interface Metadata {
  current_version: number;
  versions: Record<string, { created_time: string }>;
  custom_metadata: { changed_by?: string } | null;
}

export async function list(): Promise<Outcome> {
  const bao = openBao();
  const secrets = await walk(bao, "");
  return { lines: secrets.map((secret) => JSON.stringify(secret)) };
}

async function walk(bao: OpenBao, folder: string): Promise<unknown[]> {
  const listed = await bao.call<{ data: { keys: string[] } }>("LIST", `${bao.mount}/metadata/${folder}`, MAY_NOT_LIST);
  const found = await Promise.all(
    (listed?.data.keys ?? []).map(async (key) =>
      key.endsWith("/") ? walk(bao, folder + key) : [await secret(bao, folder + key)],
    ),
  );
  return found.flat();
}

async function secret(bao: OpenBao, name: string) {
  const answer = await bao.call<{ data: Metadata }>("GET", `${bao.mount}/metadata/${name}`, MAY_NOT_LIST);
  const { current_version: version, versions, custom_metadata } = (answer as { data: Metadata }).data;
  return {
    name,
    version,
    changed: (versions[version] as { created_time: string }).created_time,
    by: custom_metadata?.changed_by ?? null,
  };
}
