// Webhooks on a Forgejo forge through its API v1 (ADR 0022). FACTORY_FORGE_URL and FACTORY_FORGE_TOKEN name it.
import { fail } from "../domain/errors.ts";

/** A webhook as factory-spec records and compares it. */
export interface Hook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
}

export interface Forgejo {
  /** The webhook, or undefined when the forge no longer has it. */
  get(repository: string, id: number): Promise<Hook | undefined>;
  create(repository: string, url: string, events: string[]): Promise<Hook>;
  update(repository: string, id: number, url: string, events: string[]): Promise<Hook>;
  remove(repository: string, id: number): Promise<void>;
}

interface RawHook {
  id: number;
  config: { url: string };
  events: string[];
  active: boolean;
}

export function forgejo(): Forgejo {
  const base =
    process.env.FACTORY_FORGE_URL ?? fail("set FACTORY_FORGE_URL to manage the webhooks of forgejo automations");
  const token =
    process.env.FACTORY_FORGE_TOKEN ?? fail("set FACTORY_FORGE_TOKEN to manage the webhooks of forgejo automations");
  const call = async (method: string, path: string, body?: unknown): Promise<Response> => {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/repos/${path}`, {
      method,
      headers: { authorization: `token ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Forgejo answered ${response.status} to ${method} ${path}: ${await response.text()}`);
    }
    return response;
  };
  const hook = async (response: Response): Promise<Hook> => {
    const raw = (await response.json()) as RawHook;
    return { id: raw.id, url: raw.config.url, events: [...raw.events].sort(), active: raw.active };
  };
  const config = (url: string, events: string[]) => ({ config: { url, content_type: "json" }, events, active: true });
  return {
    async get(repository, id) {
      const response = await call("GET", `${repository}/hooks/${id}`);
      return response.status === 404 ? undefined : hook(response);
    },
    async create(repository, url, events) {
      return hook(await call("POST", `${repository}/hooks`, { type: "forgejo", ...config(url, events) }));
    },
    async update(repository, id, url, events) {
      return hook(await call("PATCH", `${repository}/hooks/${id}`, config(url, events)));
    },
    async remove(repository, id) {
      await call("DELETE", `${repository}/hooks/${id}`);
    },
  };
}
