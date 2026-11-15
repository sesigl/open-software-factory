// The secrets port's adapter as a program (ADR 0137), like the forge's: the console runs `list`, `put`, `delete` and
// `probe` and reads the JSON lines they print. A value goes only to `put`'s standard input: never into an argument, a
// variable, a log line or an error. The adapter gets the console's environment, with OSF_OPENBAO_ADDR,
// OSF_OPENBAO_TOKEN and OSF_OPENBAO_MOUNT. A failure is a note with the adapter's error, never an exception; its
// errors never hold a value (ports/secrets/README.md).
import type { Stored } from "../domain/secrets.ts";
import { type Outcome, runProgram } from "./program.ts";

export type { Outcome };

/** What `probe` prints: how many seconds the token still lives (0 for no end), and when it ends. */
export interface Probe {
  ttl: number;
  expires: string | null;
}

/** The JSON lines a command of the adapter printed. */
function lines<T>(stdout: string): T[] {
  try {
    return stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  } catch {
    // The error of JSON.parse would quote the line, and the console shows a note to the person.
    throw new Error("the secrets adapter printed a line that is no JSON");
  }
}

/** Runs the adapter with these arguments and this standard input, and reads the JSON lines it prints. */
const run = <T>(command: string, args: string[], input?: string): Promise<Outcome<T[]>> =>
  runProgram(command, args, lines<T>, input);

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
