// The client of the fakes.forge scenarios: they call the fake in the test's process (ADR 0039), and a module would
// call the forge's API the same way, with the URL and the token the fake gives.
import type { Forge } from "@opensoftware/testkit";

/** Calls the forge's API v1 below `/repos/<owner>/<repository>` as the owner and gives the parsed answer. */
export function forgeClient(forge: Forge, repository: string) {
  return async <T = unknown>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${forge.url}/api/v1/repos/${forge.owner}/${repository}${path}`, {
      method,
      headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
}
