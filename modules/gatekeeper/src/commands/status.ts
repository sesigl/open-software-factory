// gatekeeper status: read the thread, decide, post what is new, and write the record once the gate is decided.
import { decide, marker } from "../domain/gate.ts";
import { approveByPolicy, describe, load, type Options, publishDecided, report, writeRecord } from "./load.ts";

/** Exit codes: 0 approved, 1 rejected or expired, 3 waiting. */
export async function status(options: Options) {
  const loaded = await load(options);
  const { gate, channel } = loaded;
  if (gate.rules.approvers.length === 0) return approveByPolicy(loaded, options);
  const request = await channel.find(marker(gate.id, "requested"));
  if (!request)
    throw new Error(`${channel.name} has no request for the gate ${gate.id}: run "gatekeeper request" first`);
  const { outcome, posts } = decide(gate, request.time, await channel.thread(request), loaded.now, channel);
  for (const post of posts) await channel.answer(request, post.text, post.marker);
  const line = describe(outcome);
  await report(loaded, outcome, line);
  if (outcome.state === "pending") return { lines: [`gate ${gate.id} ${line}`], exitCode: 3 };
  const errors = writeRecord(loaded, options, outcome, request.time);
  if (posts.some((post) => post.marker === marker(gate.id, "decided")))
    await publishDecided(loaded, options.env, outcome);
  return { lines: [`gate ${gate.id} ${line}`], errors, exitCode: outcome.state === "approved" ? 0 : 1 };
}
