// The answer of the Rego policy (`data.gatekeeper`) and the groups file.
import { UsageError } from "@opensoftware/cli";
import { NAME } from "./request.ts";
import { duration } from "./time.ts";

export interface Rules {
  /** The groups whose members may decide. Empty: the policy approves without a person. */
  approvers: string[];
  risk?: string;
  escalation?: { after: number; text: string; to: string[] };
  expireAfter?: number;
}

export type Groups = Record<string, string[]>;

function groupNames(value: unknown, rule: string): string[] {
  if (!Array.isArray(value) || !value.every((name) => typeof name === "string" && NAME.test(name)))
    throw new UsageError(`the policy's ${rule} must be a set of group names like "maintainers"`);
  return [...value].sort();
}

export function parseRules(value: unknown, policy: string): Rules {
  if (!value || typeof value !== "object" || Object.keys(value).length === 0)
    throw new UsageError(`${policy} has no rules in the package gatekeeper`);
  const answer = value as Record<string, unknown>;
  if (answer.approvers === undefined) throw new UsageError(`${policy} sets no approvers`);
  if (answer.risk !== undefined && typeof answer.risk !== "string")
    throw new UsageError("the policy's risk must be a text");
  if ((answer.escalate_after === undefined) !== (answer.escalate_to === undefined))
    throw new UsageError("the policy sets escalate_after and escalate_to together or not at all");
  return {
    approvers: groupNames(answer.approvers, "approvers"),
    risk: answer.risk as string | undefined,
    escalation:
      answer.escalate_to === undefined
        ? undefined
        : {
            after: duration(answer.escalate_after, "escalate_after"),
            text: answer.escalate_after as string,
            to: groupNames(answer.escalate_to, "escalate_to"),
          },
    expireAfter: answer.expire_after === undefined ? undefined : duration(answer.expire_after, "expire_after"),
  };
}

/** Each group lists its members as identities like "slack:U024BE7LH" or "github:octocat". */
export function parseGroups(value: unknown, file: string, rules: Rules): Groups {
  const valid =
    value &&
    typeof value === "object" &&
    Object.values(value).every(
      (members) => Array.isArray(members) && members.every((id) => /^[a-z]+:\S+$/.test(String(id))),
    );
  if (!valid) throw new UsageError(`${file} must map each group to its members, like {"maintainers": ["slack:U0ADA"]}`);
  const groups = value as Groups;
  for (const name of [...rules.approvers, ...(rules.escalation?.to ?? [])]) {
    if (!Object.hasOwn(groups, name))
      throw new UsageError(`the policy names the group "${name}", which ${file} does not define`);
  }
  return groups;
}
