// Forgejo's REST API v1 with fetch (ADR 0057). FORGE_URL and FORGE_TOKEN name the forge.
import { check } from "@opensoftware/cli";

/** An answer of the forge that was not a success: its status and its message. */
export class ForgeError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Repository {
  /** Calls `path` below `/api/v1/repos/<repo>` and gives the JSON answer, or undefined for an empty one. */
  call<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function repository(repo: string, env: NodeJS.ProcessEnv = process.env): Repository {
  const url = env.FORGE_URL;
  const token = env.FORGE_TOKEN;
  check(url, "set FORGE_URL to the forge's base URL");
  check(token, "set FORGE_TOKEN to an API token of the forge");
  const base = url.replace(/\/$/, "");
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${base}/api/v1/repos/${repo}${path}`, {
      method,
      headers: { authorization: `token ${token}`, "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) return (text ? JSON.parse(text) : undefined) as T;
    if (response.status === 401) throw new Error("the forge refused the token");
    throw new ForgeError(response.status, message(text));
  };
  /** Whether the repository exists, asked after a 404 that may be about the repository or about something in it. */
  const exists = () => found(call("GET", ""));
  return {
    async call<T>(method: string, path: string, body?: unknown): Promise<T> {
      try {
        return await call<T>(method, path, body);
      } catch (error) {
        if (error instanceof ForgeError && error.status === 404 && !(await exists()))
          throw new Error(`no repository ${repo}`);
        throw error;
      }
    },
  };
}

/** True when the call answered, false when the forge answered 404; any other error stays an error. */
export function found(answer: Promise<unknown>): Promise<boolean> {
  return answer.then(
    () => true,
    (error: unknown) => !(error instanceof ForgeError && error.status === 404) && Promise.reject(error),
  );
}

/** The message of Forgejo's error answer, or the whole answer when it has none. */
function message(text: string): string {
  return /"message":\s*"([^"]*)"/.exec(text)?.[1] ?? text;
}
