// list: the IDs of the sandboxes in the namespace, one per line, in the order of their claims' names.
import type { Outcome } from "@opensoftware/cli";
import { ID_LABEL, ROLE_LABEL } from "../domain/names.ts";
import type { Context } from "./sandbox.ts";

export async function list({ kube }: Context): Promise<Outcome> {
  // kubectl gets a list of a kind as a List sorted by name, and prints nothing when the list is empty.
  const claims = await kube.get<{ items: { metadata: { labels: Record<string, string> } }[] }>([
    "sandboxclaims",
    "--selector",
    `${ROLE_LABEL}=sandbox`,
  ]);
  return { lines: (claims?.items ?? []).map((item) => item.metadata.labels[ID_LABEL] as string) };
}
