// event <delivery.json>: one webhook delivery as a pull request or issue label CloudEvent, or nothing.
import { check, type Outcome, readInputs } from "@opensoftware/cli";
import { type Delivery, pullRequestEvent, signedWith } from "../domain/events.ts";

export function event(file: string | undefined): Outcome {
  check(file, "name the delivery file, like event delivery.json");
  const [input] = readInputs([file], /./);
  const delivery = JSON.parse((input as { text: string }).text) as Delivery;
  check(typeof delivery.body === "string", `${file} holds {"headers": {...}, "body": "<the body as it arrived>"}`);
  const secret = process.env.FORGE_WEBHOOK_SECRET;
  if (secret && !signedWith(delivery, secret))
    throw new Error("the delivery's signature does not match FORGE_WEBHOOK_SECRET");
  const cloudEvent = pullRequestEvent(delivery);
  return { lines: cloudEvent ? [JSON.stringify(cloudEvent)] : [] };
}
