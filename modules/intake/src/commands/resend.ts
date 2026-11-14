// intake resend: sends the run events that failed 5 times, the dead letters of the consumer "intake", again (ADR 0116).
import { resendDeadLetters } from "../adapters/nats.ts";
import { type Env, required } from "./env.ts";
import { natsOf } from "./serve.ts";

export async function resend(env: Env) {
  required(env, "INTAKE_NATS_URL", "the NATS server whose stream OSF keeps the dead letters");
  const sent = await resendDeadLetters(natsOf(env) as NonNullable<ReturnType<typeof natsOf>>);
  return { lines: [...sent.map((subject) => `resent ${subject}`), `intake resent ${sent.length} dead letters`] };
}
