// What request and status share: the request, the policy's answer, the groups and the channel.
import { UsageError } from "@opensoftware/cli";
import { readJson, readText, writeJson } from "../adapters/files.ts";
import { type Forge, pullRequestForge } from "../adapters/forge.ts";
import { publish } from "../adapters/nats.ts";
import { evaluate } from "../adapters/opa.ts";
import { type Program, program } from "../adapters/program.ts";
import { slackChannel } from "../adapters/slack.ts";
import { decidedEvent, requestedEvent } from "../domain/events.ts";
import { type Channel, type Decided, describe, type Gate, type Outcome } from "../domain/gate.ts";
import { parseGroups, parseRules } from "../domain/policy.ts";
import {
  commitState,
  defaultForgeAdapter,
  type PullRequest,
  parsePullRequest,
  requestOf,
} from "../domain/pull-request.ts";
import { buildRecord, signWith } from "../domain/record.ts";
import { gateId, parseRequest } from "../domain/request.ts";
import { fromIso } from "../domain/time.ts";

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
  pr?: { forge: Forge; sha: string; channel: Channel };
  now: number;
}

export async function load(options: Options): Promise<Loaded> {
  const { env } = options;
  let request: Gate["request"];
  let pr: Loaded["pr"];
  if (options.pullRequest) {
    const ref = parsePullRequest(options.pullRequest);
    const forge = forgeFor(ref, env);
    const pull = await forge.read();
    request = requestOf(ref, pull);
    pr = { forge, sha: pull.sha, channel: forge.channel(pull) };
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
    return pr.channel;
  }
  return slackOf(channel, env);
}

/** A slack: channel through the channel adapter in GATEKEEPER_SLACK_ADAPTER, and that adapter (ADR 0062). */
export function slackOf(channel: string, env: Options["env"]): Channel & { run: Program } {
  const slack = /^slack:([A-Z0-9]+)$/.exec(channel);
  if (!slack) throw new UsageError(`${channel} is no channel like slack:C0GATES`);
  if (!env.GATEKEEPER_SLACK_TOKEN) throw new UsageError("set GATEKEEPER_SLACK_TOKEN for a slack: channel");
  const run = program(env.GATEKEEPER_SLACK_ADAPTER || "npx -y @opensoftware/channel-slack", {
    CHANNEL_API_URL: env.GATEKEEPER_SLACK_URL || undefined,
    CHANNEL_TOKEN: env.GATEKEEPER_SLACK_TOKEN,
    CHANNEL_SIGNING_SECRET: env.GATEKEEPER_SLACK_SIGNING_SECRET || undefined,
  });
  return { ...slackChannel(slack[1] as string, run), run };
}

/** The pull request through the forge adapter in GATEKEEPER_FORGE_ADAPTER (ADR 0062). */
export function forgeFor(ref: PullRequest, env: Options["env"]): Forge {
  const run = program(env.GATEKEEPER_FORGE_ADAPTER || defaultForgeAdapter(ref), {
    FORGE_URL: env.GATEKEEPER_FORGE_URL || ref.forgeUrl,
    FORGE_TOKEN: env.GATEKEEPER_FORGE_TOKEN || undefined,
  });
  return pullRequestForge(ref, run);
}

export const nowOf = (text: string | undefined): number => (text ? fromIso(text) : Date.now() * 1000);

/** The commit status "gatekeeper" of a pull request's head commit. */
export async function report(loaded: Loaded, outcome: Outcome, description: string): Promise<void> {
  if (loaded.pr) await loaded.pr.forge.status(loaded.pr.sha, commitState(outcome), description);
}

/** Writes the record, signed when GATEKEEPER_SIGNING_KEY is set, and says when it is not. */
export function writeRecord(loaded: Loaded, options: Options, outcome: Decided, requestedAt: number): string[] {
  const record = buildRecord(
    loaded.gate,
    { policyText: loaded.policyText, channel: loaded.channel.name, requestedAt },
    outcome,
  );
  const key = options.env.GATEKEEPER_SIGNING_KEY;
  writeJson(options.record, signWith(record, key));
  return key ? [] : ["the record is not signed: set GATEKEEPER_SIGNING_KEY"];
}

export async function publishRequested(loaded: Loaded, env: Options["env"], requestedAt: number): Promise<void> {
  if (!env.GATEKEEPER_NATS_URL) return;
  const { subject, event } = requestedEvent(loaded.gate, requestedAt, loaded.now);
  await publish(env.GATEKEEPER_NATS_URL, subject, event);
}

export async function publishDecided(loaded: Loaded, env: Options["env"], outcome: Decided): Promise<void> {
  if (!env.GATEKEEPER_NATS_URL) return;
  const { subject, event } = decidedEvent(loaded.gate, outcome, loaded.now);
  await publish(env.GATEKEEPER_NATS_URL, subject, event);
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
