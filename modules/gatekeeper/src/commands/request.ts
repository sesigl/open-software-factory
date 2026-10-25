// gatekeeper request: ask the policy's groups in the channel, once per gate.
import { marker, requestText } from "../domain/gate.ts";
import { approveByPolicy, load, type Options, publishRequested, report, writeJson } from "./load.ts";

export async function request(options: Options) {
  const loaded = await load(options);
  const { gate, channel } = loaded;
  if (gate.rules.approvers.length === 0) return approveByPolicy(loaded, options);
  writeJson(options.out, {
    gate: gate.id,
    workItem: gate.request.workItem,
    stage: gate.request.stage,
    policy: gate.policy,
    risk: gate.rules.risk,
    approvers: gate.rules.approvers,
    escalateTo: gate.rules.escalation?.to,
    channel: channel.name,
  });
  const mark = marker(gate.id, "requested");
  if (await channel.find(mark)) return { lines: [`gate ${gate.id} already requested in ${channel.name}`] };
  const posted = await channel.ask(requestText(gate, channel), mark);
  const waiting = { state: "pending", waitingFor: gate.rules.approvers } as const;
  await report(loaded, waiting, `waiting for ${gate.rules.approvers.join(", ")}`);
  await publishRequested(loaded, options.env, posted.time ?? loaded.now);
  const risk = gate.rules.risk === undefined ? "" : ` (risk ${gate.rules.risk})`;
  return { lines: [`gate ${gate.id} asks ${gate.rules.approvers.join(", ")} in ${channel.name}${risk}`] };
}
