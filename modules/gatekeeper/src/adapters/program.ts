// A port adapter as a program (ADR 0060, ADR 0061): gatekeeper runs its command line with the port's variables and
// reads the JSON lines it prints. The adapter talks to the chat or the forge.
import { spawn } from "node:child_process";

/** Runs one command of the adapter and gives the JSON lines it printed. */
export type Program = (args: string[]) => Promise<Record<string, unknown>[]>;

/** The adapter's command line, like "npx -y @opensoftware/channel-slack", with the port's variables added. */
export function program(command: string, variables: Record<string, string | undefined>): Program {
  const [file = "", ...words] = command.trim().split(/\s+/);
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [name, value] of Object.entries(variables)) if (value !== undefined) env[name] = value;
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(file, [...words, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => (out += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => (err += chunk));
      child.on("error", (error) => reject(new Error(`cannot start the adapter "${command}": ${error.message}`)));
      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(err.trim() || `${command} ${args[0]} exited with code ${code}`));
        resolve(out.split("\n").flatMap((line) => (line.trim() ? [JSON.parse(line) as Record<string, unknown>] : [])));
      });
    });
}
