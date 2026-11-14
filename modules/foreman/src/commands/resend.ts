// foreman resend: sends the events that failed 5 times, the dead letters of the consumer "foreman", again (ADR 0116).
import { UsageError } from "@opensoftware/cli";
import { openBus } from "../adapters/nats.ts";
import { type Env, streamMaxAge } from "./serve.ts";

export async function resend(env: Env) {
  const url = env.FOREMAN_NATS_URL;
  if (!url) throw new UsageError("set FOREMAN_NATS_URL: the NATS server whose stream OSF keeps the dead letters");
  const bus = await openBus(url, (text) => process.stderr.write(`foreman: ${text}\n`), streamMaxAge(env));
  const subjects = await bus.resend("foreman").finally(() => bus.close());
  return {
    lines: [...subjects.map((subject) => `resent ${subject}`), `foreman resent ${subjects.length} dead letters`],
  };
}
