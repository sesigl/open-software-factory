// NOREAL: loaded with --import into every Node process of the module under test. A TCP connection may go only to a
// loopback address or to a host of the testkit's containers; local sockets (such as Docker's) are allowed. Any
// other connection fails like an unreachable host and is logged, and the testkit fails the scenario.
import { appendFileSync } from "node:fs";
import net from "node:net";

const LOG = process.env.OSF_TESTKIT_NOREAL_LOG;
const ALLOWED = new Set(
  ["localhost", "127.0.0.1", "::1", ...(process.env.OSF_TESTKIT_ALLOWED_HOSTS ?? "").split(",")]
    .filter(Boolean)
    .map((host) => host.toLowerCase()),
);

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guarded(this: net.Socket, ...args: unknown[]) {
  const blocked = refused(args);
  if (!blocked) return Reflect.apply(connect, this, args) as net.Socket;
  const message = `NOREAL: the module tried to reach ${blocked}; system tests reach only the testkit's fakes`;
  if (LOG) appendFileSync(LOG, `${message}\n`);
  process.nextTick(() => this.destroy(new Error(message)));
  return this;
} as typeof connect;

/** `host:port` when the connection goes outside the fakes, else undefined. */
function refused(args: unknown[]): string | undefined {
  // net.connect() passes its normalized arguments as one array.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  let host: unknown;
  let port: unknown;
  if (first !== null && typeof first === "object") {
    const options = first as { host?: unknown; port?: unknown; path?: unknown };
    if (options.path !== undefined) return undefined;
    host = options.host;
    port = options.port;
  } else if (typeof first === "string" && !/^\d+$/.test(first)) {
    return undefined; // a local socket path
  } else {
    port = first;
    host = typeof args[1] === "string" ? args[1] : undefined;
  }
  const name = String(host ?? "localhost")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (ALLOWED.has(name) || /^127\./.test(name) || name === "::ffff:127.0.0.1") return undefined;
  return `${name}:${String(port)}`;
}
