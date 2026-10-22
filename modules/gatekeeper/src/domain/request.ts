// The request: what a person is asked to approve, and the facts the policy decides on.
import { UsageError } from "@opensoftware/cli";
import { canonical, sha256 } from "./json.ts";

export interface Link {
  url: string;
  title?: string;
}

export interface GateRequest {
  workItem: string;
  stage: string;
  summary: string;
  links: Link[];
  /** Any facts the policy needs, such as changed paths or labels. */
  change: Record<string, unknown>;
}

export const NAME = /^[a-z][a-z0-9-]{0,62}$/;

export function parseRequest(value: unknown, file: string): GateRequest {
  const fail = (field: string, rule: string): never => {
    throw new UsageError(`${file}: the field "${field}" ${rule}`);
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UsageError(`${file} is no JSON object`);
  const { workItem, stage, summary, links = [], change = {} } = value as Record<string, unknown>;
  if (typeof workItem !== "string" || !workItem || workItem.length > 128)
    fail("workItem", "must be a text of 1 to 128 characters");
  if (typeof stage !== "string" || !NAME.test(stage)) fail("stage", 'must be a lowercase name like "merge"');
  if (typeof summary !== "string" || !summary.trim()) fail("summary", "must say what to approve");
  if (!Array.isArray(links) || !links.every((link) => URL.canParse(link?.url)))
    fail("links", "must be a list of { url, title }");
  if (!change || typeof change !== "object" || Array.isArray(change)) fail("change", "must be a JSON object");
  return { workItem, stage, summary, links, change } as GateRequest;
}

/** The same work item, stage and change are the same gate. */
export const gateId = ({ workItem, stage, change }: GateRequest): string =>
  `g${sha256(canonical({ workItem, stage, change })).slice(0, 16)}`;
