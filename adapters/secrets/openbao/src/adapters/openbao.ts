// OpenBao's HTTP API with fetch (ADR 0137). OSF_OPENBAO_ADDR and OSF_OPENBAO_TOKEN name the server and the token,
// OSF_OPENBAO_MOUNT the factory's KV version 2 mount. No request or error carries a value back to the caller.
import { check } from "@opensoftware/cli";

export interface OpenBao {
  /** The factory's mount. */
  mount: string;
  /**
   * Calls `path` below `/v1/` and gives the JSON answer, or undefined for an empty answer and for 404. A refusal
   * (403) of a token OpenBao knows fails with `refused`; of any other token with "the store refused the token".
   */
  call<T>(method: string, path: string, refused: string, body?: unknown): Promise<T | undefined>;
}

export const REFUSED_TOKEN = "the store refused the token";

/** The mount of OSF_OPENBAO_MOUNT, by default "secret", as for the egress proxy. */
export const mountOf = (env: NodeJS.ProcessEnv = process.env): string => env.OSF_OPENBAO_MOUNT || "secret";

export function openBao(env: NodeJS.ProcessEnv = process.env): OpenBao {
  const address = env.OSF_OPENBAO_ADDR;
  const token = env.OSF_OPENBAO_TOKEN;
  check(address, "set OSF_OPENBAO_ADDR to OpenBao's address, like http://127.0.0.1:8200");
  check(token, "set OSF_OPENBAO_TOKEN to an OpenBao token");
  const send = (method: string, path: string, body?: unknown): Promise<Response> =>
    fetch(`${address.replace(/\/$/, "")}/v1/${path}`, {
      method,
      headers: { "x-vault-token": token },
      body: JSON.stringify(body),
    }).catch(() => {
      throw new Error(`the store at ${address} does not answer`);
    });
  return {
    mount: mountOf(env),
    async call<T>(method: string, path: string, refused: string, body?: unknown): Promise<T | undefined> {
      const response = await send(method, path, body);
      const text = await response.text();
      if (response.ok || response.status === 404) return text && response.ok ? (JSON.parse(text) as T) : undefined;
      // Every token OpenBao knows may look itself up, so a refused lookup means a token it does not know.
      if (response.status === 403)
        throw new Error((await send("GET", "auth/token/lookup-self")).ok ? refused : REFUSED_TOKEN);
      throw new Error(`OpenBao answered ${method} ${path} with ${response.status}: ${text.trim()}`);
    },
  };
}
