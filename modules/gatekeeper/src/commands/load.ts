// What request and status share: the request, the policy's answer, the groups and the channel.
import { UsageError } from "@opensoftware/cli";
import type { GateDecided, GateRequested } from "@opensoftware/contracts";
import { readJson, readText, writeJson } from "../adapters/files.ts";
import { type Forge, forgeApi, pullRequestChannel, readPull, setStatus } from "../adapters/forge.ts";
import { publish } from "../adapters/nats.ts";
import { evaluate } from "../adapters/opa.ts";
import { slackChannel } from "../adapters/slack.ts";
import type { Channel, Decided, Gate, Outcome } from "../domain/gate.ts";
import { parseGroups, parseRules } from "../domain/policy.ts";
import { type PullRequest, parsePullRequest, requestOf } from "../domain/pull-request.ts";
import { buildRecord, signRecord } from "../domain/record.ts";
import { gateId, parseRequest } from "../domain/request.ts";
import { fromIso, toIso } from "../domain/time.ts";

export interface Options {
  policy: string;
  groups: string;
  /** "slack:<channel ID>". Default with --pull-request: the pull request's comments. */
  channel?: string;
  pullRequest?: string;
  /** The request file, unless --pull-request builds the request. */
  file?: string;
  out: string;
  record: string;
  env: Record<string, string | undefined>;
}

export interface Loaded {
  gate: Gate;
  policyText: string;
  channel: Channel;
  pr?: { ref: PullRequest; forge: Forge; sha: string };
  now: number;
}

export async function load(options: Options): Promise<Loaded> {
  const { env } = options;
  let request: Gate["request"];
  let pr: Loaded["pr"];
  if (options.pullRequest) {
    const ref = parsePullRequest(options.pullRequest, env.GATEKEEPER_FORGE_URL || undefined);
    const forge = forgeApi(ref, env.GATEKEEPER_FORGE_TOKEN || undefined);
    const { pull, paths } = await readPull(ref, forge);
    request = requestOf(ref, pull, paths);
    pr = { ref, forge, sha: pull.head.sha };
  } else {
    if (!options.file) throw new UsageError("name a request file, or use --pull-request");
    request = parseRequest(readJson(options.file), options.file);
  }
  const policyText = readText(options.policy);
  const rules = parseRules(await evaluate(env.GATEKEEPER_OPA || "opa", options.policy, request), options.policy);
  const groups = parseGroups(readJson(options.groups), options.groups, rules);
  const gate: Gate = { id: gateId(request), request, rules, groups, policy: options.policy };
  return { gate, policyText, channel: channelOf(options, pr), pr, now: nowOf(env.OSF_NOW) };
}

function channelOf(options: Options, pr: Loaded["pr"]): Channel {
  const { channel, env } = options;
  if (channel === undefined) {
    if (!pr) throw new UsageError("name the channel, like --channel slack:C0GATES");
    return pullRequestChannel(pr.ref, pr.forge);
  }
  const slack = /^slack:([A-Z0-9]+)$/.exec(channel);
  if (!slack) throw new UsageError(`${channel} is no channel like slack:C0GATES`);
  if (!env.GATEKEEPER_SLACK_TOKEN) throw new UsageError("set GATEKEEPER_SLACK_TOKEN for a slack: channel");
  return slackChannel(slack[1] as string, {
    url: env.GATEKEEPER_SLACK_URL || "https://slack.com/api/",
    token: env.GATEKEEPER_SLACK_TOKEN,
  });
}

const nowOf = (text: string | undefined): number => (text ? fromIso(text) : Date.now() * 1000);

const STATES = { pending: "pending", approved: "success", rejected: "failure", expired: "failure" } as const;

/** The commit status "gatekeeper" of a pull request's head commit. */
export async function report(loaded: Loaded, outcome: Outcome, description: string): Promise<void> {
  if (loaded.pr) await setStatus(loaded.pr.ref, loaded.pr.forge, loaded.pr.sha, STATES[outcome.state], description);
}

export function describe(outcome: Outcome): string {
  if (outcome.state === "pending") return `waiting for ${outcome.waitingFor.join(", ")}`;
  if (outcome.state === "expired") return `expired at ${toIso(outcome.at)}`;
  if (outcome.by.startsWith("policy:")) return "approved by the policy: no approver group needed";
  return `${outcome.state} by ${outcome.by}${outcome.reason ? `: ${outcome.reason}` : ""}`;
}

/** Writes the record, signed when GATEKEEPER_SIGNING_KEY is set, and says when it is not. */
export function writeRecord(loaded: Loaded, options: Options, outcome: Decided, requestedAt: number): string[] {
  const record = buildRecord(
    loaded.gate,
    { policyText: loaded.policyText, channel: loaded.channel.name, requestedAt },
    outcome,
  );
  const key = options.env.GATEKEEPER_SIGNING_KEY;
  writeJson(options.record, key ? signRecord(record, key) : record);
  return key ? [] : ["the record is not signed: set GATEKEEPER_SIGNING_KEY"];
}

const event = (type: string, gate: string, now: number, data: unknown) => ({
  specversion: "1.0",
  id: `${gate}.${type.split(".")[1]?.split("@")[0]}`,
  source: "/osf/gatekeeper",
  type,
  time: toIso(now),
  subject: gate,
  datacontenttype: "application/json",
  data,
});

export async function publishRequested(loaded: Loaded, env: Options["env"], requestedAt: number): Promise<void> {
  if (!env.GATEKEEPER_NATS_URL) return;
  const { gate } = loaded;
  const { expireAfter } = gate.rules;
  const data: GateRequested["data"] = {
    gateId: gate.id,
    workItemId: gate.request.workItem,
    stage: gate.request.stage,
    policy: gate.policy,
    approvers: gate.rules.approvers,
    summary: gate.request.summary,
    links: gate.request.links.length ? gate.request.links : undefined,
    expiresAt: expireAfter === undefined ? undefined : toIso(requestedAt + expireAfter),
  };
  await publish(
    env.GATEKEEPER_NATS_URL,
    "osf.gate.requested.v1",
    event("gate.requested@v1", gate.id, loaded.now, data),
  );
}

export async function publishDecided(loaded: Loaded, env: Options["env"], outcome: Decided): Promise<void> {
  if (!env.GATEKEEPER_NATS_URL) return;
  const { gate } = loaded;
  const data: GateDecided["data"] = {
    gateId: gate.id,
    workItemId: gate.request.workItem,
    decision: outcome.state,
    decidedBy:
      outcome.state === "expired"
        ? undefined
        : { kind: outcome.by.startsWith("policy:") ? "trigger" : "person", id: outcome.by },
    decidedAt: toIso(outcome.at),
    reason: outcome.state === "rejected" ? outcome.reason : undefined,
  };
  await publish(env.GATEKEEPER_NATS_URL, "osf.gate.decided.v1", event("gate.decided@v1", gate.id, loaded.now, data));
}

/** A policy without approver groups approves at once, by the policy. */
export async function approveByPolicy(
  loaded: Loaded,
  options: Options,
): Promise<{ lines: string[]; errors: string[]; exitCode: number }> {
  const outcome = { state: "approved", by: `policy:${loaded.gate.policy}`, at: loaded.now } as const;
  const errors = writeRecord(loaded, options, outcome, loaded.now);
  await report(loaded, outcome, "approved by the policy");
  await publishDecided(loaded, options.env, outcome);
  return { lines: [`gate ${loaded.gate.id} ${describe(outcome)}`], errors, exitCode: 0 };
}

export { writeJson };
