// A port's adapter as a program (ADR 0060, ADR 0061): a module names it by a command line, starts it with the
// arguments and the port's variables, and reads the JSON lines it prints.
import { execFile } from "node:child_process";

export interface Adapter {
  /** What the adapter is for people, like "forge adapter". Errors name it. */
  name: string;
  /** The command line, like "npx -y @opensoftware/forge-github" or "node /repo/adapters/forge/github/dist/cli.js". */
  command: string;
  /** The adapter's environment. */
  env: NodeJS.ProcessEnv;
}

/** Runs the adapter with the arguments and gives each line it printed as JSON, in order. */
export function runAdapter(adapter: Adapter, args: string[]): Promise<unknown[]> {
  const [program = "", ...words] = adapter.command.trim().split(/\s+/);
  return new Promise((resolve, reject) =>
    execFile(program, [...words, ...args], { env: adapter.env, encoding: "utf8" }, (error, stdout, stderr) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (typeof code === "string") {
        reject(new Error(`could not start the ${adapter.name} ${adapter.command} (${code})`));
      } else if (error) {
        reject(new Error(`${args.slice(0, 2).join(" ")}: ${stderr.trim() || error.message}`));
      } else {
        resolve(
          stdout
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as unknown),
        );
      }
    }),
  );
}
