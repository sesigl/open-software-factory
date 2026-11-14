// close <repo> <number> [--delete-branch]: closes the pull request without merging and, when asked, deletes its head
// branch (ADR 0136).
import type { Outcome } from "@opensoftware/cli";
import { forge, line, type Pull, pullNumber } from "./forge.ts";

export async function close(
  repo: string | undefined,
  number: string | undefined,
  deleteBranch = false,
): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  const closed = await api.call<Pull>("PATCH", `/pulls/${issue}`, { state: "closed" });
  if (deleteBranch) await api.call("DELETE", `/branches/${encodeURIComponent(closed.head.ref)}`);
  return line({ number: closed.number, state: closed.merged ? "merged" : closed.state });
}
