// GitHub's REST API with fetch (ADR 0058). FORGE_URL names the API, by default https://api.github.com; FORGE_TOKEN is
// sent as a bearer token.
import { check } from "@opensoftware/cli";

const API_VERSION = "2022-11-28";

/** An answer of GitHub that was not a success: its status and its message. */
export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface GitHub {
  /** Calls `path` below `/repos/<owner>/<name>` and gives the JSON answer. */
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function github(repo: string, env: NodeJS.ProcessEnv = process.env): GitHub {
  const token = env.FORGE_TOKEN;
  check(token, "set FORGE_TOKEN to a GitHub token");
  const root = (env.FORGE_URL || "https://api.github.com").replace(/\/+$/, "");
  const send = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${root}/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "x-github-api-version": API_VERSION,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const answer = (await response.text()) || "{}";
    if (response.status === 401) throw new Error("the forge refused the token");
    if (!response.ok) throw new GitHubError(response.status, reason(answer));
    return JSON.parse(answer) as T;
  };
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      try {
        return await send<T>(method, path, body);
      } catch (error) {
        // A 404 may be about the repository or about something in it; only a second look tells them apart.
        const missing = error instanceof GitHubError && error.status === 404;
        if (missing && !(await send("GET", "").then(Boolean, () => false))) throw new Error(`no repository ${repo}`);
        throw error;
      }
    },
  };
}

/** GitHub's message, or the whole answer when it has none. */
function reason(answer: string): string {
  return (JSON.parse(answer) as { message?: string }).message ?? answer;
}
