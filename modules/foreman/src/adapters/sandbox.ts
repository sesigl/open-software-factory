// A stage's sandbox through the sandbox port (ADR 0054, ADR 0068). The adapter is a program; the foreman creates a
// sandbox from the spec, copies the run's folder in, runs the harness with exec, copies the folder out and destroys it.
// At its start it destroys the sandboxes of its owner that a foreman before it left (ADR 0158).
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import type { SandboxSpec } from "@opensoftware/contracts";
import { OWNER_LABEL } from "../domain/definition.ts";
import { adapterRun, lastLine } from "./program.ts";

/**
 * Destroys each sandbox that the adapter lists with the owner's label; none of them belongs to a stage of this process,
 * which runs no stage yet. A list or a destroy that fails is a warning: the next start tries again.
 */
export async function removeLeftovers(
  adapter: string[],
  owner: string,
  env: Record<string, string | undefined>,
  warn: (text: string) => void,
): Promise<void> {
  const run = adapterRun("sandbox", adapter, env);
  const listed = await run("list", "--label", `${OWNER_LABEL}=${owner}`).catch((failure: Error) => {
    warn(`the sandboxes of "${owner}" that a foreman before left stay: ${failure.message}`);
    return "";
  });
  for (const id of listed.split("\n").filter(Boolean))
    await run("destroy", id).then(
      () => warn(`destroyed the sandbox ${id} of "${owner}" that a foreman before left`),
      (failure: Error) => warn(`the sandbox ${id} of "${owner}" that a foreman before left stays: ${failure.message}`),
    );
}

export interface StageSandbox {
  /** Copies the run's folder into the sandbox; returns where it is there. */
  copyIn(): Promise<string>;
  /** The command line that runs `command` in the sandbox, with its standard input and output. */
  exec(command: string[]): string[];
  /** Puts the files of the sandbox's folder in the run's folder. */
  copyOut(): Promise<void>;
  /**
   * Runs `command transcript <session ID>`, a harness adapter's, in the sandbox and copies the folder it wrote to
   * `output`, so the session's run record leaves the sandbox before it is destroyed (ADR 0121).
   */
  transcript(command: string[], sessionId: string, output: string): Promise<void>;
  destroy(): Promise<void>;
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
  const run = adapterRun("sandbox", adapter, env);
  const temporary = mkdtempSync(join(tmpdir(), "foreman-sandbox-"));
  let id: string;
  try {
    writeFileSync(join(temporary, "spec.json"), JSON.stringify(spec));
    id = lastLine(await run("create", join(temporary, "spec.json")));
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
    async transcript(command, sessionId, output) {
      // A folder of the working folder, beside the run's folder: the run's files stay as the agent left them.
      const inside = `.osf-transcripts/${sessionId}`;
      await run("exec", id, "--", "env", `OUTPUT=${inside}`, ...command, "transcript", sessionId);
      rmSync(output, { recursive: true, force: true });
      mkdirSync(dirname(output), { recursive: true });
      await run("copy", `${id}:${inside}`, output);
    },
    destroy: async () => void (await run("destroy", id)),
  };
}
