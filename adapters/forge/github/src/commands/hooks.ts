// webhook and event: one webhook per URL, and its deliveries as pull request CloudEvents.
import { check, type Outcome, readInputs } from "@opensoftware/cli";
import { type Delivery, toCloudEvent, verified } from "../domain/events.ts";
import { HOOK_EVENTS } from "../domain/repository.ts";
import { connect, print } from "./shared.ts";

/** webhook <repo> <url>: creates the webhook for the URL, or updates the one that exists. */
export async function webhook(repo: string | undefined, url: string | undefined): Promise<Outcome> {
  const api = connect(repo);
  check(url, "name the URL that receives the deliveries, like webhook tester/web https://intake.example/forge");
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  check(secret, "set FORGE_WEBHOOK_SECRET to the secret the deliveries are signed with");
  const settings = {
    active: true,
    events: HOOK_EVENTS,
    config: { url, content_type: "json", secret },
  };
  const hooks = await api.request<{ id: number; config: { url?: string } }[]>("GET", "/hooks");
  const known = hooks.find((hook) => hook.config.url === url);
  const saved = known
    ? await api.request<{ id: number }>("PATCH", `/hooks/${known.id}`, settings)
    : await api.request<{ id: number }>("POST", "/hooks", { name: "web", ...settings });
  return print({ id: saved.id, url });
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
