// Reads the Agent Trace record (https://agent-trace.dev, version 0.1.0) that runlog writes with --agent-trace.

interface Range {
  start_line: number;
  end_line: number;
}
interface Contributor {
  type: string;
  model_id?: string;
}
export interface AgentTrace {
  version: string;
  id: string;
  timestamp: string;
  vcs?: { type: string; revision: string };
  tool?: { name?: string; version?: string };
  files: { path: string; conversations: { contributor?: Contributor; ranges: Range[] }[] }[];
}

export const agentTraceOf = (text: string): AgentTrace => JSON.parse(text) as AgentTrace;

/** Every attributed range as "<path>:<start>-<end> <type> <model>", in file order. */
export const attributed = (record: AgentTrace): string[] =>
  record.files.flatMap((file) =>
    file.conversations.flatMap((conversation) =>
      conversation.ranges.map(
        (range) =>
          `${file.path}:${range.start_line}-${range.end_line} ${conversation.contributor?.type} ${conversation.contributor?.model_id}`,
      ),
    ),
  );
