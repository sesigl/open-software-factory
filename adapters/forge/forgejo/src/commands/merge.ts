// merge <repo> <number> [--method merge|squash|rebase] [--when-green]: merges, or names the forge's reason when it
// refuses. With --when-green, a merge that the merge rules refuse is scheduled with Forgejo's
// merge_when_checks_succeed instead, which merges once the checks pass (ADR 0136).
import { check, type Outcome } from "@opensoftware/cli";
import { MERGE_METHODS } from "../domain/repository.ts";
import { forge, line, type Pull, pullNumber, settle } from "./forge.ts";

/** Forgejo's answer while it checks a pull request, and for one that conflicts with its base. */
const CHECKING = "Please try again later";

export async function merge(
  repo: string | undefined,
  number: string | undefined,
  method = "merge",
  whenGreen = false,
): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  check(MERGE_METHODS.includes(method), `--method is one of ${MERGE_METHODS.join(", ")}`);
  const path = `/pulls/${issue}`;
  const attempt = () =>
    api.call("POST", `${path}/merge`, { Do: method }).then(
      () => "",
      (error: Error) => error.message,
    );
  const refusal = await settle(attempt, (answer) => answer !== CHECKING);
  if (refusal === CHECKING)
    throw new Error(
      `the forge refused to merge #${issue}: it conflicts with its base, or the forge is still checking it`,
    );
  if (refusal && whenGreen) {
    // Trying a plain merge first is safe: Forgejo holds an admin to the merge rules unless a merge asks for force_merge.
    await api.call("POST", `${path}/merge`, { Do: method, merge_when_checks_succeed: true });
    return line({ queued: true });
  }
  if (refusal) throw new Error(`the forge refused to merge #${issue}: ${refusal}`);
  return line({ sha: (await api.call<Pull>("GET", path)).merge_commit_sha });
}
