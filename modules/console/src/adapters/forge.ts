// The forge port's adapter as a program (ADR 0073): the console runs only its read-only command `prs` and reads the
// JSON lines it prints. A failure is a note with the adapter's error, never an exception.
import { execFile } from "node:child_process";
import type { Answer } from "./apis.ts";

/** A pull request as `prs` prints it. */
export interface Proposal {
  number: number;
  url: string;
  title: string;
  head: string;
  author: string;
  created: string;
  review: string;
}

export interface Forge {
  /** The command line of the adapter, like "npx -y @opensoftware/forge-github". */
  command: string;
  url?: string;
  token?: string;
}

/** The open pull requests of the repository whose branch starts with the prefix, newest first. */
export function proposals(forge: Forge, repository: string, prefix: string): Promise<Answer<Proposal[]>> {
  const [file = "", ...words] = forge.command.trim().split(/\s+/);
  const env = { ...process.env, FORGE_URL: forge.url, FORGE_TOKEN: forge.token };
  return new Promise((resolve) => {
    execFile(file, [...words, "prs", repository, "--head", prefix], { env }, (error, stdout, stderr) => {
      try {
        // The adapter names itself before its error, like "forge-github: the forge refused the token".
        if (error) throw new Error(stderr.trim().replace(/^[\w-]+: /, "") || error.message);
        const lines = stdout.split("\n").filter((line) => line.trim());
        resolve({ ok: true, body: lines.map((line) => JSON.parse(line) as Proposal) });
      } catch (failure) {
        resolve({ ok: false, status: 0, note: `the forge did not answer: ${(failure as Error).message}` });
      }
    });
  });
}
