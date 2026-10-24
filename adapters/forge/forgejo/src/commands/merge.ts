// merge <repo> <number> [--method merge|squash|rebase]: merges, or names the forge's reason when it refuses.
import { check, type Outcome } from "@opensoftware/cli";
import { MERGE_METHODS } from "../domain/repository.ts";
import { forge, line, type Pull, pullNumber, settle } from "./forge.ts";

/** Forgejo's answer while it checks a pull request, and for one that conflicts with its base. */
const CHECKING = "Please try again later";

export async function merge(repo: string | undefined, number: string | undefined, method = "merge"): Promise<Outcome> {
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
  if (refusal) throw new Error(`the forge refused to merge #${issue}: ${refusal}`);
  return line({ sha: (await api.call<Pull>("GET", path)).merge_commit_sha });
}
