// merge <repo> <number> [--method merge|squash|rebase]: merges, or names the forge's reason when its rules refuse.
import { check, type Outcome } from "@opensoftware/cli";
import { ForgeError } from "../adapters/forgejo.ts";
import { MERGE_METHODS } from "../domain/repository.ts";
import { forge, line, type Pull, pullNumber } from "./forge.ts";

/** Forgejo checks whether a new pull request can merge in the background, and asks to try again until it knows. */
const CHECKING = "Please try again later";
const WAIT_MS = 10_000;
const PAUSE_MS = 250;

export async function merge(repo: string | undefined, number: string | undefined, method = "merge"): Promise<Outcome> {
  const api = forge(repo);
  const issue = pullNumber(number);
  check(MERGE_METHODS.includes(method), `--method is one of ${MERGE_METHODS.join(", ")}`);
  const path = `/pulls/${issue}`;
  for (const started = Date.now(); ; ) {
    const refusal = await api.call("POST", `${path}/merge`, { Do: method }).then(
      () => undefined,
      (error: unknown) => {
        if (error instanceof ForgeError && error.status === 405) return error.message;
        throw error;
      },
    );
    if (refusal === undefined) break;
    if (refusal !== CHECKING || Date.now() - started > WAIT_MS)
      throw new Error(`the forge refused to merge #${issue}: ${refusal}`);
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  return line({ sha: (await api.call<Pull>("GET", path)).merge_commit_sha });
}
