// The session record: one JSON line per event of a session, in the order the adapter saw them (ADR 0050).
import type { ContentBlock, PromptResponse, SessionUpdate, ToolKind } from "@agentclientprotocol/sdk";

/** What the adapter did with a tool call the agent asked to approve. */
export type Decision = "allowed" | "refused" | "refused by the allowlist";

export type SessionLine =
  | {
      type: "session";
      sessionId: string;
      cwd: string;
      agent: { name?: string; version?: string };
      resource: Record<string, string>;
    }
  | { type: "prompt"; prompt: ContentBlock[] }
  | { type: "update"; update: SessionUpdate }
  | { type: "permission"; title?: string | null; kind?: ToolKind | null; decision: Decision }
  | { type: "stop"; stopReason: PromptResponse["stopReason"] };
