// A stage's sandbox through the sandbox port (ADR 0054, ADR 0068). The adapter is a program; the foreman creates a
// sandbox from the spec, copies the run's folder in, runs the harness with exec, copies the folder out and destroys it.
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import type { SandboxSpec } from "@opensoftware/contracts";

export interface StageSandbox {
  /** Copies the run's folder into the sandbox; returns where it is there. */
  copyIn(): Promise<string>;
  /** The command line that runs `command` in the sandbox, with its standard input and output. */
  exec(command: string[]): string[];
  /** Puts the files of the sandbox's folder in the run's folder. */
  copyOut(): Promise<void>;
  destroy(): Promise<void>;
}

/** Runs one command of the adapter; a failure names the command and what the adapter wrote to standard error. */
function adapterRun(adapter: string[], env: Record<string, string | undefined>) {
  const [file, ...args] = adapter as [string, ...string[]];
  return (...command: string[]) =>
    new Promise<string>((resolve, reject) => {
      execFile(file, [...args, ...command], { env }, (error, stdout, stderr) => {
        if (error) reject(new Error(`the sandbox adapter's ${command[0]} failed: ${stderr.trim() || error.message}`));
        else resolve(stdout.trim());
      });
    });
}

/**
 * A new sandbox from the spec for the files of `local`, the run's folder, which it holds at `<working folder>/<name>`
 * after `copyIn`. The caller destroys it.
 */
export async function createSandbox(
  adapter: string[],
  spec: SandboxSpec,
  local: string,
  name: string,
  env: Record<string, string | undefined>,
): Promise<StageSandbox> {
  const run = adapterRun(adapter, env);
  const temporary = mkdtempSync(join(tmpdir(), "foreman-sandbox-"));
  let id: string;
  try {
    writeFileSync(join(temporary, "spec.json"), JSON.stringify(spec));
    id = (await run("create", join(temporary, "spec.json"))).split("\n").pop() as string;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return {
    async copyIn() {
      const working = await run("exec", id, "--", "pwd");
      // The path does not exist in the sandbox yet, so every adapter copies the folder itself, not into it.
      await run("copy", local, `${id}:${name}`);
      return posix.join(working, name);
    },
    exec: (command) => [...adapter, "exec", id, "--", ...command],
    async copyOut() {
      const out = mkdtempSync(join(tmpdir(), "foreman-sandbox-out-"));
      try {
        await run("copy", `${id}:${name}`, join(out, name));
        rmSync(local, { recursive: true, force: true });
        cpSync(join(out, name), local, { recursive: true });
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    },
    destroy: async () => void (await run("destroy", id)),
  };
}
