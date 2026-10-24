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
  return {
    async call<T>(method: string, path: string, body?: unknown): Promise<T> {
      try {
        return await call<T>(method, path, body);
      } catch (error) {
        // A missing repository and a missing pull request both answer 404; only the first is named.
        if (error instanceof ForgeError && error.status === 404 && path !== "") {
          await call("GET", "").catch((missing: unknown) => {
            throw missing instanceof ForgeError && missing.status === 404
              ? new Error(`no repository ${repo}`)
              : missing;
          });
        } else if (error instanceof ForgeError && error.status === 404) {
          throw new Error(`no repository ${repo}`);
        }
        throw error;
      }
    },
  };
}

function message(text: string): string {
  try {
    return (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    return text;
  }
}
