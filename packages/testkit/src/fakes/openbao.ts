// OpenBao's development server as a process on the host (ADR 0137): the real server, with its data in memory, from the
// binary `bao` that `make install` pins. The first scenario of a test process starts it; each scenario gets a KV
// version 2 mount of its own (ADR 0129). The root token stays here: a test gets tokens with the policies it names.
import { perProcess, type Running, servicePort, start } from "./binaries.ts";

export interface OpenBao {
  /** OpenBao's address `http://127.0.0.1:<port>`, for the module's OSF_OPENBAO_ADDR. */
  url: string;
  /** The scenario's KV version 2 mount, for the module's OSF_OPENBAO_MOUNT. No other scenario sees it. */
  mount: string;
  /** A new token with this policy, in OpenBao's policy language. It lives for `ttl`, by default "1h". */
  token(policy: string, options?: { ttl?: string }): Promise<string>;
  /** The current version of the secret in the mount and its data, as another client reads it, or undefined. */
  read(name: string): Promise<{ version: number; data: Record<string, string> } | undefined>;
  /** Stores the data as a new version of the secret in the mount, as another client writes it. */
  write(name: string, data: Record<string, string>): Promise<void>;
}

const ROOT_TOKEN = "osf-testkit-root";

const server = perProcess(startOnce);
let mounts = 0;
let policies = 0;

/** A new KV version 2 mount in the OpenBao of this process, started on the first call. */
export async function startOpenBao(): Promise<OpenBao> {
  const { url } = await server();
  const root = (method: string, path: string, body?: unknown) => asRoot(url, method, path, body);
  const mount = `scenario-${++mounts}`;
  await root("POST", `sys/mounts/${mount}`, { type: "kv", options: { version: "2" } });
  return {
    url,
    mount,
    async token(policy, options = {}) {
      const name = `${mount}-${++policies}`;
      await root("PUT", `sys/policies/acl/${name}`, { policy });
      const created = await root("POST", "auth/token/create", { policies: [name], ttl: options.ttl ?? "1h" });
      return (created as { auth: { client_token: string } }).auth.client_token;
    },
    async read(name) {
      const answer = (await root("GET", `${mount}/data/${name}`)) as
        | { data: { data: Record<string, string>; metadata: { version: number } } }
        | undefined;
      return answer && { version: answer.data.metadata.version, data: answer.data.data };
    },
    async write(name, data) {
      await root("POST", `${mount}/data/${name}`, { data });
    },
  };
}

async function startOnce(): Promise<Running<{ url: string }>> {
  // The development server also listens for its cluster on the next port; another process may hold that one, and the
  // server then fails with "address already in use" and starts again on new ports.
  const port = await servicePort();
  const url = `http://127.0.0.1:${port}`;
  return start(
    "bao",
    () => ["server", "-dev", `-dev-root-token-id=${ROOT_TOKEN}`, `-dev-listen-address=127.0.0.1:${port}`],
    `${url}/v1/sys/health`,
    { url },
  );
}

/** One call of OpenBao's HTTP API with the root token; undefined for 404 and for an empty answer. */
async function asRoot(url: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${url}/v1/${path}`, {
    method,
    headers: { "x-vault-token": ROOT_TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`fakes.openbao: ${method} ${path} answered ${response.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
