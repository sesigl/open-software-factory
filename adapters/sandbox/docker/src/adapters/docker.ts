// The Docker CLI, the adapter's only way to the Docker host (ADR 0054). It follows DOCKER_HOST and the user's
// Docker context like any docker command.
import { spawn } from "node:child_process";

export interface DockerResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

/** Runs `docker <args>` and collects its output; `input` goes to its standard input. */
export function docker(args: string[], input?: Buffer): Promise<DockerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code: code ?? 1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString("utf8") }),
    );
    child.stdin.end(input);
  });
}

/** Runs `docker <args>` and gives its standard output as text; a failure throws with Docker's error. */
export async function dockerText(args: string[], input?: Buffer): Promise<string> {
  const result = await docker(args, input);
  if (result.code !== 0) throw new Error(`docker ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.toString("utf8").trim();
}

/** Runs `docker <args>` on the program's own standard input and output, and gives its exit code. */
export function dockerAttached(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
