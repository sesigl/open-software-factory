// The secrets port's adapter as a program (ADR 0137), like the forge's: the console runs `list`, `put`, `delete` and
// `probe` and reads the JSON lines they print. A value goes only to `put`'s standard input: never into an argument, a
// variable, a log line or an error. The adapter gets the console's environment, with OSF_OPENBAO_ADDR,
// OSF_OPENBAO_TOKEN and OSF_OPENBAO_MOUNT. A failure is a note with the adapter's error, never an exception.
import { execFile } from "node:child_process";
import type { Stored } from "../domain/secrets.ts";

export type Outcome<T> = { ok: true; body: T } | { ok: false; usage: boolean; note: string };

/** What `probe` prints: how many seconds the token still lives (0 for no end), and when it ends. */
export interface Probe {
  ttl: number;
  expires: string | null;
}

/** Runs the adapter with these arguments and this standard input, and reads the JSON lines it prints. */
function run<T>(command: string, args: string[], input = ""): Promise<Outcome<T[]>> {
  const [file = "", ...words] = command.trim().split(/\s+/);
  return new Promise((resolve) => {
    const child = execFile(file, [...words, ...args], (error, stdout, stderr) => {
      try {
        // The adapter names itself before its error, like "secrets-openbao: the store refused the token". Its errors
        // never hold a value (ports/secrets/README.md); exit code 2 is a usage error, like a name it refuses.
        if (error) {
          const note =
            stderr
              .trim()
              .split("\n")[0]
              ?.replace(/^[\w-]+: /, "") || error.message;
          return resolve({ ok: false, usage: error.code === 2, note });
        }
        const lines = stdout.split("\n").filter((line) => line.trim());
        resolve({ ok: true, body: lines.map((line) => JSON.parse(line) as T) });
      } catch (failure) {
        resolve({ ok: false, usage: false, note: (failure as Error).message });
      }
    });
    // An adapter that ends before it reads its input closes the pipe; that is its error, not the console's.
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}

/** The secrets in the store, sorted by name. */
export const listSecrets = (command: string) => run<Stored>(command, ["list"]);

/**
 * Stores the value as a new version of the secret, in the name of the person. The name comes after "--", so a name
 * like "--help" is a name and not an option.
 */
export const putSecret = (command: string, name: string, person: string, value: string) =>
  run(command, ["put", `--by=${person}`, "--", name], value);

/** Removes the secret with every version. */
export const deleteSecret = (command: string, name: string) => run(command, ["delete", "--", name]);

/** Whether the store answers to the token, and how long the token still lives. */
export const probeStore = (command: string) => run<Probe>(command, ["probe"]);
