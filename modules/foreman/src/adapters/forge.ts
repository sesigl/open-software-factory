// The run's pull request through the forge port (ADR 0057, ADR 0069). The adapter is a program; the foreman runs its
// `pr` command and reads the checks of the pull request's head commit.
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
