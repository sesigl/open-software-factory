// The repository webhooks of a Forgejo forge at FACTORY_FORGE_URL (ADR 0022). Moves behind the forge port in T-15.
import type { Hook } from "../domain/hooks.ts";

export interface Forgejo {
  /** The webhook of the repository that targets `url`, if there is one. */
  find(repository: string, url: string): Promise<Hook | undefined>;
  get(repository: string, id: number): Promise<Hook | undefined>;
  /** Creates the webhook, or updates the given one, and returns it as the forge stores it. */
  put(repository: string, hook: { url: string; events: string[] }, id?: number): Promise<Hook>;
  remove(repository: string, id: number): Promise<void>;
}

interface Answer {
  id: number;
  config: { url: string };
  events: string[];
  active: boolean;
}

const hook = (answer: Answer): Hook => ({
  id: answer.id,
  url: answer.config.url,
  events: answer.events,
  active: answer.active,
});

/** The forge, or the message that names the missing variable. */
export function forgejo(): Forgejo | string {
  const base = process.env.FACTORY_FORGE_URL?.replace(/\/$/, "");
  if (!base) return "set FACTORY_FORGE_URL and FACTORY_FORGE_TOKEN to the Forgejo that holds the repositories";
  const secret = process.env.FACTORY_WEBHOOK_SECRET;
  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(`${base}/api/v1/repos/${path}`, {
      method,
      headers: { authorization: `token ${process.env.FACTORY_FORGE_TOKEN ?? ""}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 404 && method !== "POST" && method !== "PATCH") return undefined;
    if (!response.ok)
      throw new Error(`Forgejo answered ${response.status} to ${method} ${path}: ${await response.text()}`);
    return response.status === 204 ? undefined : response.json();
  };
  return {
    async find(repository, url) {
      const list = (await call("GET", `${repository}/hooks`)) as Answer[];
      const found = list.find((answer) => answer.config.url === url);
      return found && hook(found);
    },
    async get(repository, id) {
      const answer = (await call("GET", `${repository}/hooks/${id}`)) as Answer | undefined;
      return answer && hook(answer);
    },
    async put(repository, { url, events }, id) {
      const config = { url, content_type: "json", ...(secret ? { secret } : {}) };
      const body = { type: "forgejo", config, events, active: true };
      const path = id === undefined ? `${repository}/hooks` : `${repository}/hooks/${id}`;
      return hook((await call(id === undefined ? "POST" : "PATCH", path, body)) as Answer);
    },
    async remove(repository, id) {
      await call("DELETE", `${repository}/hooks/${id}`);
    },
  };
}
