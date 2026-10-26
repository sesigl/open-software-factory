// Temporal's dev server and NATS as processes on the host (ADR 0067): the real servers, each a single binary that
// starts in about a second, without Docker. `make install` pins both in .tools/bin; elsewhere they must be on PATH.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot, workspaceOf } from "../support/module.ts";
import { freePort } from "../support/server.ts";
import type { Nats, Temporal } from "./services.ts";

interface Running<T> {
  service: T;
  close(): Promise<string[]>;
}

const START_TIMEOUT_MS = 30_000;

export async function startTemporal(): Promise<Running<Temporal>> {
  const [port, httpPort, metricsPort] = [await freePort(), await freePort(), await freePort()];
  const httpUrl = `http://127.0.0.1:${httpPort}`;
  return start(
    "temporal",
    () => [
      ...["server", "start-dev", "--headless", "--ip", "127.0.0.1", "--log-level", "error"],
      ...["--port", String(port), "--http-port", String(httpPort), "--metrics-port", String(metricsPort)],
    ],
    `${httpUrl}/api/v1/namespaces/default`,
    { address: `127.0.0.1:${port}`, namespace: "default", httpUrl },
  );
}

export async function startNats(): Promise<Running<Nats>> {
  const [port, monitorPort] = [await freePort(), await freePort()];
  return start(
    "nats-server",
    (home) => ["-js", "-a", "127.0.0.1", "-p", String(port), "-m", String(monitorPort), "-sd", home],
    `http://127.0.0.1:${monitorPort}/healthz?js-enabled-only=true`,
    { url: `nats://127.0.0.1:${port}` },
  );
}

/** The pinned binary of the workspace that runs the scenario or holds the testkit, else the name for PATH. */
function program(name: string): string {
  const roots = [repoRoot(), workspaceOf(dirname(fileURLToPath(import.meta.url))) ?? repoRoot()];
  return roots.map((root) => join(root, ".tools", "bin", name)).find(existsSync) ?? name;
}

async function start<T>(
  name: string,
  args: (home: string) => string[],
  readyUrl: string,
  service: T,
): Promise<Running<T>> {
  const home = mkdtempSync(join(tmpdir(), `osf-${name}-`));
  const child = spawn(program(name), args(home), {
    env: { PATH: process.env.PATH ?? "", HOME: home },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => (stderr += chunk));
  const close = async () => {
    await stop(child);
    rmSync(home, { recursive: true, force: true });
    return [];
  };
  try {
    await ready(child, readyUrl, () => `${name} ${stderr}`.trim());
  } catch (error) {
    await close();
    throw error;
  }
  return { service, close };
}

async function ready(child: ChildProcess, url: string, output: () => string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let exited = "";
  child.once("exit", (code) => (exited = `exited with code ${code}`));
  child.once("error", (error) => (exited = error.message));
  for (;;) {
    if (exited) throw new Error(`${exited}: ${output()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`did not start within ${START_TIMEOUT_MS} ms: ${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGKILL");
  });
}
