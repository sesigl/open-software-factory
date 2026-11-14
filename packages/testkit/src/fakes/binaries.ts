// Temporal's dev server and NATS as processes on the host (ADR 0067): the real servers, each a single binary that
// starts in about a second, without Docker. `make install` pins both in .tools/bin; elsewhere they must be on PATH.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot, workspaceOf } from "../support/module.ts";
import { freePort, SERVICE_PORTS } from "../support/server.ts";
import { tempFolder } from "../support/temp.ts";
import type { Nats, Temporal } from "./services.ts";

interface Running<T> {
  service: T;
  close(): Promise<string[]>;
  /** Stops the server without waiting, for the end of the test process. */
  kill(): void;
}

// A server is ready in under a second, also with a dozen starting at once. One that is not ready after this time
// hangs, as Temporal did once under Stryker's parallel runners, and starts again on new ports.
const START_TIMEOUT_MS = 10_000;
const servicePort = () => freePort(SERVICE_PORTS);
const START_ATTEMPTS = 3;

/**
 * Starts a server on free ports, and again on new ones when another process took a port between the pick and the
 * bind, or when the server did not get ready: scenarios in parallel workers pick ports at the same time.
 */
async function onFreePorts<T>(attempt: () => Promise<Running<T>>): Promise<Running<T>> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      const retry = /address already in use|did not start within/.test((error as Error).message);
      if (tries >= START_ATTEMPTS || !retry) throw error;
    }
  }
}

/**
 * Started by the first scenario of this process that asks for Temporal (ADR 0129), and stopped when the process ends.
 */
let temporal: Promise<Running<Temporal>> | undefined;
let namespaces = 0;

/** A new namespace in the Temporal dev server of this process, started on the first call. */
export async function startTemporal(): Promise<Temporal> {
  temporal ??= onFreePorts(startTemporalOnce).then(
    (server) => {
      // Vitest ends a test process with SIGTERM, which runs no "exit" handler by itself.
      process.once("exit", server.kill);
      process.once("SIGTERM", () => process.exit());
      return server;
    },
    (error: unknown) => {
      temporal = undefined;
      throw error;
    },
  );
  const { service } = await temporal;
  const namespace = `scenario-${++namespaces}`;
  const created = await fetch(`${service.httpUrl}/api/v1/namespaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ namespace, workflowExecutionRetentionPeriod: "86400s" }),
  });
  if (!created.ok) throw new Error(`fakes.temporal could not create ${namespace}: ${await created.text()}`);
  return { ...service, namespace };
}

async function startTemporalOnce(): Promise<Running<Temporal>> {
  const [port, httpPort, metricsPort] = [await servicePort(), await servicePort(), await servicePort()];
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

export function startNats(): Promise<Running<Nats>> {
  return onFreePorts(startNatsOnce);
}

async function startNatsOnce(): Promise<Running<Nats>> {
  const [port, monitorPort] = [await servicePort(), await servicePort()];
  return start(
    "nats-server",
    (home) => ["-js", "-a", "127.0.0.1", "-p", String(port), "-m", String(monitorPort), "-sd", home],
    `http://127.0.0.1:${monitorPort}/healthz?js-enabled-only=true`,
    { url: `nats://127.0.0.1:${port}` },
  );
}

/** The pinned binary of the workspace that runs the scenario or holds the testkit, else the name for PATH. */
export function program(name: string): string {
  const roots = [repoRoot(), workspaceOf(dirname(fileURLToPath(import.meta.url))) ?? repoRoot()];
  return roots.map((root) => join(root, ".tools", "bin", name)).find(existsSync) ?? name;
}

async function start<T>(
  name: string,
  args: (home: string) => string[],
  readyUrl: string,
  service: T,
): Promise<Running<T>> {
  const home = tempFolder(`osf-${name}-`);
  const child = spawn(program(name), args(home), {
    env: { PATH: process.env.PATH ?? "", HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Both streams, so that an error names what the server wrote on either.
  let output = "";
  child.stdout?.on("data", (chunk) => (output += chunk));
  child.stderr?.on("data", (chunk) => (output += chunk));
  const kill = () => {
    child.kill("SIGKILL");
    rmSync(home, { recursive: true, force: true });
  };
  const close = async () => {
    await stop(child);
    rmSync(home, { recursive: true, force: true });
    return [];
  };
  try {
    await ready(child, readyUrl, () => `${name} ${output}`.trim());
  } catch (error) {
    await close();
    throw error;
  }
  return { service, close, kill };
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
