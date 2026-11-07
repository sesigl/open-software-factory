// Waits until a published port of a container accepts connections on the host.
import { connect } from "node:net";

/**
 * Resolves when `host:port` accepts a TCP connection, at the latest after `timeoutMs`. Docker on Linux publishes a
 * port when the container starts; Rancher Desktop forwards it to the host a moment later.
 */
export async function reachable(host: string, port: number, timeoutMs = 15_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect({ host, port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (open) return;
    if (Date.now() > until) throw new Error(`port ${host}:${port} accepts no connection after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
