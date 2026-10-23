// The gate's state from the messages of its thread: who may decide, the first valid decision, refusals,
// escalation and expiry. No I/O: the command posts what this returns and reads the thread again next time.
import type { Groups, Rules } from "./policy.ts";
import type { GateRequest } from "./request.ts";
import { toIso } from "./time.ts";

export interface Gate {
  id: string;
  request: GateRequest;
  rules: Rules;
  groups: Groups;
  /** The policy file as the user named it. */
  policy: string;
}

/** A message in a channel. `mine` marks the messages gatekeeper posted. */
export interface Message {
  id: string;
  author: string;
  /** Microseconds since 1970. */
  time: number;
  text: string;
  mine: boolean;
}

/** How a channel shows people and how a person decides there. */
export interface Speech {
  mention(identity: string): string;
  /** For example: Reply "approve" or "reject <reason>" in this thread. */
  howToDecide: string;
}

export type Outcome =
  | { state: "pending"; waitingFor: string[] }
  | { state: "approved" | "rejected"; by: string; at: number; reason?: string }
  | { state: "expired"; at: number };

export type Decided = Exclude<Outcome, { state: "pending" }>;

export interface Post {
  text: string;
  marker: string;
}

/** gatekeeper ends each of its messages with a marker; the channel wraps it in brackets or an HTML comment. */
export const marker = (gate: string, kind: string, ref?: string): string =>
  `gatekeeper ${gate} ${kind}${ref === undefined ? "" : ` ${ref}`}`;

const markersIn = (text: string): string[] =>
  [...text.matchAll(/gatekeeper g[0-9a-f]{16} [a-z]+(?: [0-9.]+)?/g)].map((match) => match[0]);

/** "approve", or "reject" and its reason, as the first word, with or without a slash. */
export function decisionIn(text: string): { verb: "approved" | "rejected"; reason?: string } | undefined {
  const match = /^\s*\/?(approve|reject)\b[ \t]*([^\n]*)/i.exec(text);
  if (!match) return undefined;
  const reason = (match[2] ?? "").trim() || undefined;
  return (match[1] as string).toLowerCase() === "approve" ? { verb: "approved" } : { verb: "rejected", reason };
}

export function requestText(gate: Gate, speech: Speech): string {
  const { rules, request } = gate;
  const risk = rules.risk === undefined ? "" : ` (risk ${rules.risk})`;
  const links = request.links.map((link) => `\n- ${link.title ? `${link.title}: ` : ""}${link.url}`).join("");
  return `Approval needed from ${rules.approvers.join(", ")}${risk}: ${request.summary}${links}\n${speech.howToDecide}`;
}

export function outcomeText(outcome: Decided, speech: Speech): string {
  if (outcome.state === "expired") return `Expired at ${toIso(outcome.at)} without a decision.`;
  const verb = outcome.state === "approved" ? "Approved" : "Rejected";
  return `${verb} by ${speech.mention(outcome.by)}${outcome.reason ? `: ${outcome.reason}` : ""}.`;
}

/** Decides the gate from the request's time and the thread after it, in order, at the time `now`. */
export function decide(
  gate: Gate,
  requestedAt: number,
  thread: Message[],
  now: number,
  speech: Speech,
): { outcome: Outcome; posts: Post[] } {
  const { approvers, escalation, expireAfter } = gate.rules;
  const posted = new Set(thread.filter((message) => message.mine).flatMap((message) => markersIn(message.text)));
  const posts: Post[] = [];
  const post = (kind: string, text: string, ref?: string): void => {
    const mark = marker(gate.id, kind, ref);
    if (posted.has(mark)) return;
    posted.add(mark);
    posts.push({ text, marker: mark });
  };
  const escalatedMark = marker(gate.id, "escalated");
  const expiresAt = expireAfter === undefined ? undefined : requestedAt + expireAfter;
  const deciders = (escalated: boolean): string[] =>
    escalated && escalation ? [...new Set([...approvers, ...escalation.to])] : approvers;

  let escalated = false;
  let outcome: Decided | undefined;
  for (const message of thread) {
    if (message.mine) {
      escalated ||= markersIn(message.text).includes(escalatedMark);
      continue;
    }
    const decision = decisionIn(message.text);
    if (!decision || (expiresAt !== undefined && message.time >= expiresAt)) continue;
    const groups = deciders(escalated);
    if (groups.some((group) => gate.groups[group]?.includes(message.author))) {
      outcome = { state: decision.verb, by: message.author, at: message.time, reason: decision.reason };
      break;
    }
    post(
      "refused",
      `${speech.mention(message.author)} is not in ${groups.join(", ")}, so this decision does not count.`,
      message.id,
    );
  }

  if (!outcome && expiresAt !== undefined && now >= expiresAt) outcome = { state: "expired", at: expiresAt };
  if (outcome) {
    post("decided", outcomeText(outcome, speech));
    return { outcome, posts };
  }
  if (escalation && !escalated && now >= requestedAt + escalation.after) {
    escalated = true;
    post(
      "escalated",
      `No decision after ${escalation.text}. Approval needed from ${escalation.to.join(", ")}: ${gate.request.summary}\n${speech.howToDecide}`,
    );
  }
  return { outcome: { state: "pending", waitingFor: deciders(escalated) }, posts };
}

/** Where gatekeeper asks and people decide: a Slack channel or the comments of a pull request. */
export interface Channel extends Speech {
  /** For example "slack:C0GATES" or the pull request's URL. */
  name: string;
  /** gatekeeper's own message that carries the marker, if the channel has one. */
  find(marker: string): Promise<Message | undefined>;
  /** The messages after the request, oldest first. */
  thread(request: Message): Promise<Message[]>;
  /** Posts the text with the marker: in the request's thread when given, else as a new message. */
  post(text: string, marker: string, request?: Message, buttons?: Button[]): Promise<Message>;
}

/** A button under a message; a press decides like a reply with its verb (ADR 0048). */
export interface Button {
  /** "gatekeeper.approve" or "gatekeeper.reject". */
  actionId: string;
  text: string;
  /** The gate's ID. */
  value: string;
  style: "primary" | "danger";
}

const VERBS: Record<string, string> = { "gatekeeper.approve": "approve", "gatekeeper.reject": "reject" };

export const decisionButtons = (gate: string): Button[] => [
  { actionId: "gatekeeper.approve", text: "Approve", value: gate, style: "primary" },
  { actionId: "gatekeeper.reject", text: "Reject", value: gate, style: "danger" },
];

/** A press of a decision button, as the message a reply with its verb would be. */
export function pressMessage(press: { actionId: string; author: string; ts: string; time: number }): Message {
  return { id: press.ts, author: press.author, time: press.time, text: VERBS[press.actionId] ?? "", mine: false };
}

/** The verb of a decision button, or undefined for any other action. */
export const isDecisionButton = (actionId: string): boolean => Object.hasOwn(VERBS, actionId);
