// webhook, hooks, unhook and event: one webhook per URL, and its deliveries as pull request CloudEvents.
import { check, type Outcome, readInputs } from "@opensoftware/cli";
import { GitHubError } from "../adapters/github.ts";
import { type Delivery, toCloudEvent, verified } from "../domain/events.ts";
import { githubEvents, type HookJson, hookLine } from "../domain/repository.ts";
import { connect, count, print } from "./shared.ts";

/** webhook <repo> <url> [--event <name>]...: creates the webhook for the URL, or replaces the one that exists. */
export async function webhook(repo: string | undefined, url: string | undefined, names: string[]): Promise<Outcome> {
  const api = connect(repo);
  check(url, "name the URL that receives the deliveries, like webhook tester/web https://intake.example/forge");
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  check(secret, "set FORGE_WEBHOOK_SECRET to the secret the deliveries are signed with");
  const settings = {
    active: true,
    events: githubEvents(names),
    config: { url, content_type: "json", secret },
  };
  const hooks = await api.request<HookJson[]>("GET", "/hooks");
  const known = hooks.find((hook) => hook.config.url === url);
  const saved = known
    ? await api.request<HookJson>("PATCH", `/hooks/${known.id}`, settings)
    : await api.request<HookJson>("POST", "/hooks", { name: "web", ...settings });
  return print(hookLine(saved));
}

/** hooks <repo>: one line per webhook of the repository. */
export async function hooks(repo: string | undefined): Promise<Outcome> {
  const list = await connect(repo).request<HookJson[]>("GET", "/hooks");
  return { lines: list.map((hook) => JSON.stringify(hookLine(hook))) };
}

/** unhook <repo> <id>: removes the webhook; "removed" is false when the repository has no such webhook. */
export async function unhook(repo: string | undefined, text: string | undefined): Promise<Outcome> {
  const api = connect(repo);
  const id = count(text, 1, "name the webhook by its ID, like unhook tester/web 7");
  const removed = await api.request("DELETE", `/hooks/${id}`).then(
    () => true,
    (error: unknown) => !(error instanceof GitHubError && error.status === 404) && Promise.reject(error),
  );
  return print({ id, removed });
}

/** event <delivery.json>: the pull request CloudEvent of one delivery, or nothing. */
export function event(file: string | undefined): Outcome {
  check(file, "name the delivery file, like event delivery.json");
  const [input] = readInputs([file], /./);
  const delivery = JSON.parse((input as { text: string }).text) as Delivery;
  check(
    typeof delivery.body === "string" && typeof delivery.headers === "object",
    `${file} holds {"headers": {...}, "body": "<the body as it arrived>"}`,
  );
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  if (secret && !verified(delivery, secret))
    throw new Error("the delivery's signature does not match FORGE_WEBHOOK_SECRET");
  const cloudEvent = toCloudEvent(delivery);
  return { lines: cloudEvent ? [JSON.stringify(cloudEvent)] : [] };
}
