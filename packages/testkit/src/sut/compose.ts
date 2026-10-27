// sut.compose: a Compose file of the unit, run with `docker compose` as a project of the scenario (ADR 0074).
import { existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { moduleEnv, repoRoot } from "../support/module.ts";
import { baseEnv, type CliResult, run } from "../support/process.ts";
import { isDocumented } from "../support/readme.ts";
import type { Folders } from "./sut.ts";

export interface ComposeService {
  service: string;
  /** Like "running" or "exited". */
  state: string;
  /** "healthy", "unhealthy", "starting", or "" for a service without a health check. */
  health: string;
  exitCode: number;
}

export interface Compose {
  /**
   * Runs `docker compose <args>` on the Compose file, as the scenario's own project, with `$INPUT/.env` as its
   * `.env` (empty when the test wrote none). `env` adds variables for the interpolation; each must be documented in
   * the unit's README. The project is taken down with its volumes when the scenario ends.
   */
  run(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
  /** The services of the project, one-shots that exited included. */
  services(): Promise<ComposeService[]>;
  /** `http://127.0.0.1:<port>`, where the project publishes this container port of the service. */
  url(service: string, port: number): Promise<string>;
}

/** Docker's error when the host port it picked for a published port is taken by another process. */
const PORT_TAKEN = /failed to bind host port .* address already in use/;

export function makeCompose(
  moduleRoot: string,
  dirs: Folders,
  onStop: (stop: () => Promise<unknown>) => void,
): (file: string) => Compose {
  const documented = moduleEnv(moduleRoot);
  // The workspace's random name keeps parallel scenarios apart; a project name is lower case.
  const project = basename(dirname(dirs.input)).toLowerCase();
  const env = { ...baseEnv(dirs.input), ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}) };
  let started = false;
  return (file) => {
    const path = resolve(moduleRoot, file);
    if (!path.startsWith(moduleRoot + sep) || !existsSync(path)) {
      throw new Error(`sut.compose: no Compose file ${file} in ${relative(repoRoot(), moduleRoot)}`);
    }
    const envFile = join(dirs.input, ".env");
    const compose = (args: string[], extra: Record<string, string> = {}): Promise<CliResult> => {
      if (!existsSync(envFile)) writeFileSync(envFile, "");
      const argv = ["compose", "--project-name", project, "--file", path, "--env-file", envFile, ...args];
      return run("docker", argv, dirs.input, { ...env, ...extra });
    };
    if (!started) {
      started = true;
      // Without the file: a project whose .env misses a value can still be taken down.
      onStop(() =>
        run("docker", ["compose", "--project-name", project, "down", "--volumes", "--timeout", "5"], dirs.input, env),
      );
    }
    return {
      async run(args, options = {}) {
        for (const name of Object.keys(options.env ?? {})) {
          if (!isDocumented(documented, name)) {
            throw new Error(
              `BOUNDARY-ENV: ${name} is not documented in ${relative(repoRoot(), join(moduleRoot, "README.md"))}#configuration`,
            );
          }
        }
        // Docker picks a published port from the ephemeral range, where the fakes and outgoing connections of
        // parallel scenarios also land; when another process took it first, `up` again picks a new one.
        let result = await compose(args, options.env);
        for (let retry = 0; retry < 3 && args[0] === "up" && PORT_TAKEN.test(result.stderr); retry++) {
          result = await compose(args, options.env);
        }
        return result;
      },
      async services() {
        const result = await compose(["ps", "--all", "--format", "json"]);
        if (result.exitCode !== 0) throw new Error(`sut.compose: docker compose ps failed: ${result.stderr}`);
        // Compose prints one JSON object per line; older versions print one array.
        const text = result.stdout.trim();
        const rows = (
          text.startsWith("[")
            ? JSON.parse(text)
            : text
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line))
        ) as {
          Service: string;
          State: string;
          Health: string;
          ExitCode: number;
        }[];
        return rows.map((row) => ({
          service: row.Service,
          state: row.State,
          health: row.Health,
          exitCode: row.ExitCode,
        }));
      },
      async url(service, port) {
        const result = await compose(["port", service, String(port)]);
        const published = /:(\d+)\s*$/.exec(result.stdout)?.[1];
        if (result.exitCode !== 0 || !published) {
          throw new Error(`sut.compose: ${service} publishes no port ${port}: ${result.stderr}`);
        }
        return `http://127.0.0.1:${published}`;
      },
    };
  };
}
