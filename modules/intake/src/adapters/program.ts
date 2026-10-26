// A port's adapter as a program (ADR 0059, ADR 0065): intake runs it with the port's variables, hands it a delivery
// as a file, and reads the JSON lines it prints.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A webhook delivery as the adapters read it: its headers and its body as it arrived. */
export interface Delivery {
  headers: Record<string, string>;
  body: string;
}

export type Lines = Record<string, unknown>[];

export interface Program {
  /** The lines the command printed; a command that fails rejects with what the adapter wrote to its error output. */
  run(args: string[]): Promise<Lines>;
  /** Runs `<command> file` on the delivery; undefined when the adapter refuses its signature. */
  deliver(command: string, delivery: Delivery): Promise<Lines | undefined>;
}

const linesOf = (out: string): Lines =>
  out
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

export function program(command: string, variables: Record<string, string | undefined>): Program {
  const [file = "", ...prefix] = command.split(" ");
  const env = { ...process.env, ...variables };
  const run = (args: string[]) =>
    new Promise<Lines>((done, fail) => {
      execFile(file, [...prefix, ...args], { env, encoding: "utf8" }, (error, out, err) =>
        error ? fail(new Error(`${command} ${args[0]}: ${err}`)) : done(linesOf(out)),
      );
    });
  return {
    run,
    async deliver(name, delivery) {
      const folder = await mkdtemp(join(tmpdir(), "intake-"));
      const path = join(folder, "delivery.json");
      await writeFile(path, JSON.stringify(delivery));
      const refused = (error: Error) => (/signature/i.test(error.message) ? undefined : Promise.reject(error));
      return run([name, path])
        .catch(refused)
        .finally(() => rm(folder, { recursive: true, force: true }));
    },
  };
}
