// The run's pull request through the forge port (ADR 0057, ADR 0069). The adapter is a program; the foreman runs its
// `pr` command and reads the checks of the pull request's head commit.
import { execFile } from "node:child_process";

/** A check of the pull request as the port prints it. */
export interface PrintedCheck {
  name: string;
  state: string;
}

/** The checks of the pull request `<repo>#<number>`; a failure names the adapter's error. */
export function pullRequestChecks(
  adapter: string[],
  env: Record<string, string | undefined>,
  repo: string,
  number: string,
): Promise<PrintedCheck[]> {
  const [file, ...args] = adapter as [string, ...string[]];
  return new Promise((resolve, reject) => {
    execFile(file, [...args, "pr", repo, number], { env }, (error, stdout, stderr) => {
      if (error) reject(new Error(`the forge adapter's pr failed: ${stderr.trim() || error.message}`));
      else resolve((JSON.parse(stdout) as { checks?: PrintedCheck[] }).checks ?? []);
    });
  });
}
