// The tool allowlist: the ACP tool kinds a client may approve. Without one, the client decides every tool call.
import type { PermissionOption, RequestPermissionOutcome, ToolKind } from "@agentclientprotocol/sdk";
import type { Decision } from "./session.ts";

export type Allowlist = ReadonlySet<string> | undefined;

/** The kinds of `--allow read,edit`, or no allowlist when the option is missing. */
export const allowlistOf = (text: string | undefined): Allowlist =>
  text === undefined ? undefined : new Set(text.split(",").map((kind) => kind.trim()));

/** Whether the client may be asked to approve a tool call of this kind. A tool call without a kind is "other". */
export const permits = (allowlist: Allowlist, kind: ToolKind | null | undefined): boolean =>
  allowlist === undefined || allowlist.has(kind ?? "other");

/** The answer the adapter gives itself for a tool call the allowlist refuses: the agent's reject option. */
export function refusal(options: PermissionOption[]): RequestPermissionOutcome {
  const reject = options.find((option) => option.kind.startsWith("reject"));
  return reject ? { outcome: "selected", optionId: reject.optionId } : { outcome: "cancelled" };
}

/** What the client's answer means for the tool call. */
export function decisionOf(options: PermissionOption[], outcome: RequestPermissionOutcome): Decision {
  if (outcome.outcome === "cancelled") return "cancelled";
  const chosen = options.find((option) => option.optionId === outcome.optionId);
  return chosen?.kind.startsWith("allow") ? "allowed" : "refused";
}
