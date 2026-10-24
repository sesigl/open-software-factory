// The Docker CLI, the adapter's only way to the Docker host (ADR 0056). It follows DOCKER_HOST and the user's Docker
// context like any docker command.
import { execFile } from "node:child_process";

/**
 * `docker <args>`: its standard output, trimmed. `env` adds variables that the Docker CLI hands on with `--env NAME`,
 * so no value is on a command line. A failure rejects with Docker's error.
 */
export function docker(args: string[], env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = { env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 };
    execFile("docker", args, options, (error, stdout, stderr) => {
      if (error) reject(new Error(`docker ${args[0]}: ${stderr.trim() || error.message}`));
      else resolve(stdout.trim());
    });
  });
}

/** The last lines a container wrote to its standard error, where LiteLLM writes why it stopped. */
export function errors(name: string): Promise<string> {
  return new Promise((resolve) => {
    execFile("docker", ["logs", "--tail", "500", name], (_error, _stdout, stderr) =>
      resolve(stderr.trim().split("\n").slice(-4).join("\n")),
    );
  });
}
