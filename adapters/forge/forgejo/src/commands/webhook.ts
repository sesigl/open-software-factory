// webhook, hooks and unhook: one Forgejo webhook per URL for the port's events, signed with FORGE_WEBHOOK_SECRET.
import { check, type Outcome } from "@opensoftware/cli";
import { found } from "../adapters/forgejo.ts";
import { forgeEvents, type HookJson, hookLine } from "../domain/hooks.ts";
import { forge, line } from "./forge.ts";

/** webhook <repo> <url> [--event <name>]...: creates the webhook for the URL, or replaces the one that exists. */
export async function webhook(repo: string | undefined, url: string | undefined, names: string[]): Promise<Outcome> {
  const api = forge(repo);
  check(url, "name the URL that receives the deliveries, like webhook tester/web https://intake.example/forge");
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  check(secret, "set FORGE_WEBHOOK_SECRET to the secret the deliveries are signed with");
  const hook = { config: { url, content_type: "json", secret }, events: forgeEvents(names), active: true };
  const hooks = await api.call<HookJson[]>("GET", "/hooks");
  const existing = hooks.find((candidate) => candidate.config.url === url);
  const saved = existing
    ? await api.call<HookJson>("PATCH", `/hooks/${existing.id}`, hook)
    : await api.call<HookJson>("POST", "/hooks", { type: "forgejo", ...hook });
  return line(hookLine(saved));
}

/** hooks <repo>: one line per webhook of the repository. */
export async function hooks(repo: string | undefined): Promise<Outcome> {
  const list = await forge(repo).call<HookJson[]>("GET", "/hooks");
  return { lines: list.map((hook) => JSON.stringify(hookLine(hook))) };
}

/** unhook <repo> <id>: removes the webhook; "removed" is false when the repository has no such webhook. */
export async function unhook(repo: string | undefined, text: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  const id = Number(text);
  check(Number.isInteger(id) && id > 0, "name the webhook by its ID, like unhook tester/web 7");
  return line({ id, removed: await found(api.call("DELETE", `/hooks/${id}`)) });
}
