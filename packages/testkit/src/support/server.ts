// A long-running child process that listens on a port, for modules that run as servers.
import { type ChildProcess, spawn } from "node:child_process";
import { connect, createServer } from "node:net";

export interface Server {
  port: number;
  /** Stops the process and returns what it printed. */
  stop(): Promise<{ stdout: string; stderr: string }>;
}

// Below the kernel's range of ephemeral ports (32768 and up on Linux), where the fakes, Docker and every port 0 land.
// A port the OS hands out there could be taken by a fake of a parallel scenario between this check and the module's
// listen, and the module's readiness check would then reach the fake.
const MODULE_PORTS = { from: 20_000, to: 32_767 };

/** A port that was free a moment ago on 127.0.0.1, outside the ephemeral range. */
export async function freePort(): Promise<number> {
  for (;;) {
    const port = MODULE_PORTS.from + Math.floor(Math.random() * (MODULE_PORTS.to - MODULE_PORTS.from + 1));
    if (await bindable(port)) return port;
  }
}

function bindable(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once("error", () => resolvePromise(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolvePromise(true)));
  });
}

/** Starts the command with `PORT` set and waits until 127.0.0.1:PORT accepts a connection. */
export async function startServer(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs = 20_000,
): Promise<Server> {
  const port = await freePort();
  const child = spawn(command, args, { cwd, env: { ...env, PORT: String(port) } });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const exited = new Promise<number>((resolvePromise) => child.on("close", (code) => resolvePromise(code ?? 1)));

  const deadline = Date.now() + timeoutMs;
  while (!(await accepts(port))) {
    if (child.exitCode !== null) {
      throw new Error(`the server exited with code ${await exited} before it listened on PORT ${port}:\n${stderr}`);
    }
    if (Date.now() > deadline) {
      await stop(child, exited);
      throw new Error(`the server did not listen on PORT ${port} within ${timeoutMs} ms:\n${stderr}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  return {
    port,
    async stop() {
      await stop(child, exited);
      return { stdout, stderr };
    },
  };
}

function accepts(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once("error", () => resolvePromise(false));
  });
}

async function stop(child: ChildProcess, exited: Promise<number>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await exited;
  clearTimeout(timer);
}
