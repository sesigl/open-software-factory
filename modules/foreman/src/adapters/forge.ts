// The run's pull request through the forge port (ADR 0057, ADR 0069). The adapter is a program; the foreman runs its
// `pr` command and reads the checks of the pull request's head commit, and its `prs` for the run's branch (ADR 0109).
import { adapterRun } from "./program.ts";

/** A check of the pull request as the port prints it. */
export interface PrintedCheck {
  name: string;
  state: string;
}

/** The checks of the pull request `<repo>#<number>`; a failure names the adapter's error. */
export async function pullRequestChecks(
  adapter: string[],
  env: Record<string, string | undefined>,
  repo: string,
  number: string,
): Promise<PrintedCheck[]> {
  const printed = await adapterRun("forge", adapter, env)("pr", repo, number);
  return (JSON.parse(printed) as { checks?: PrintedCheck[] }).checks ?? [];
}

/** The pull requests of `<repo>` whose branch starts with `head`, in any state, the highest number first (ADR 0109). */
export async function pullRequestsOf(
  adapter: string[],
  env: Record<string, string | undefined>,
  repo: string,
  head: string,
): Promise<{ url: string; head: string }[]> {
  const printed = await adapterRun("forge", adapter, env)("prs", repo, "--head", head, "--state", "all");
  return printed
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { url: string; head: string });
}
