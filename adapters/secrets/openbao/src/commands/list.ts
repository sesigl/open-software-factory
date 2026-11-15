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

/** OpenBao's answer as a list of one, or no answer (404) as an empty list. */
const present = <T>(answer: T | undefined): T[] => (answer === undefined ? [] : [answer]);

async function walk(bao: OpenBao, folder: string): Promise<unknown[]> {
  const listed = await bao.call<{ data: { keys: string[] } }>("LIST", `${bao.mount}/metadata/${folder}`, MAY_NOT_LIST);
  const found = await Promise.all(
    present(listed)
      .flatMap((answer) => answer.data.keys)
      .map((key) => (key.endsWith("/") ? walk(bao, folder + key) : secret(bao, folder + key))),
  );
  return found.flat();
}

/** The secret's line; none for a secret deleted since the folder was listed, whose metadata is gone. */
async function secret(bao: OpenBao, name: string) {
  const answer = await bao.call<{ data: Metadata }>("GET", `${bao.mount}/metadata/${name}`, MAY_NOT_LIST);
  return present(answer).map(({ data: { current_version: version, versions, custom_metadata } }) => ({
    name,
    version,
    changed: (versions[version] as { created_time: string }).created_time,
    by: custom_metadata?.changed_by ?? null,
  }));
}
