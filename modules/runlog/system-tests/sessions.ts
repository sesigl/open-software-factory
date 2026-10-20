// Session files the system tests export. They only build strings; the tests put them into $INPUT through sut.files.

const jsonl = (lines: unknown[]): string => `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;

export const CLAUDE_SESSION_ID = "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d";

/**
 * A Claude Code session: the prompt "Fix the failing login test", three responses of claude-sonnet-5-5 (msg_01 on
 * two lines), "npm test" from 10:00:06 to 10:00:20 and "gh pr create" that prints a pull request link.
 */
export function claudeSession(): string {
  const base = { sessionId: CLAUDE_SESSION_ID, cwd: "/work/web", version: "2.1.0", gitBranch: "main" };
  const user = (timestamp: string, content: unknown) => ({
    ...base,
    type: "user",
    timestamp: `2026-01-01T10:00:${timestamp}.000Z`,
    message: { role: "user", content },
  });
  const assistant = (timestamp: string, id: string, content: unknown[], usage: Record<string, number>) => ({
    ...base,
    type: "assistant",
    timestamp: `2026-01-01T10:00:${timestamp}.000Z`,
    message: { id, type: "message", role: "assistant", model: "claude-sonnet-5-5", content, usage },
  });
  const usage = (input: number, write: number, read: number, output: number) => ({
    input_tokens: input,
    cache_creation_input_tokens: write,
    cache_read_input_tokens: read,
    output_tokens: output,
  });
  const result = (id: string, content: unknown) => [{ type: "tool_result", tool_use_id: id, content }];
  return jsonl([
    { type: "summary", summary: "Fix the login test", leafUuid: "a1" },
    user("00", "Fix the failing login test"),
    assistant("05", "msg_01", [{ type: "text", text: "I will run the tests." }], usage(1000, 200, 300, 50)),
    assistant(
      "06",
      "msg_01",
      [{ type: "tool_use", id: "toolu_01", name: "Bash", input: { command: "npm test" } }],
      usage(1000, 200, 300, 50),
    ),
    user("20", result("toolu_01", "1 failing")),
    assistant(
      "30",
      "msg_02",
      [{ type: "tool_use", id: "toolu_02", name: "Bash", input: { command: "gh pr create --fill" } }],
      usage(1500, 0, 1200, 80),
    ),
    user("40", result("toolu_02", [{ type: "text", text: "https://github.com/acme/web/pull/7\n" }])),
    assistant("45", "msg_03", [{ type: "text", text: "Opened the pull request." }], usage(1700, 0, 1500, 20)),
  ]);
}

export const CODEX_SESSION_ID = "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69";

/**
 * A Codex rollout: the prompt "Fix the failing login test", two responses of gpt-5-codex and the shell call
 * "npm test" from 10:00:05 to 10:00:13.
 */
export function codexSession(): string {
  const at = (seconds: string) => `2026-01-01T10:00:${seconds}.000Z`;
  const tokens = (seconds: string, total: number[], last: number[]) => ({
    timestamp: at(seconds),
    type: "event_msg",
    payload: { type: "token_count", info: { total_token_usage: usage(total), last_token_usage: usage(last) } },
  });
  const usage = ([input, cached, output]: number[]) => ({
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: 0,
    total_tokens: (input ?? 0) + (output ?? 0),
  });
  return jsonl([
    {
      timestamp: at("00"),
      type: "session_meta",
      payload: {
        id: CODEX_SESSION_ID,
        timestamp: at("00"),
        cwd: "/work/web",
        originator: "codex_cli_rs",
        cli_version: "0.50.0",
      },
    },
    {
      timestamp: at("00"),
      type: "turn_context",
      payload: { cwd: "/work/web", model: "gpt-5-codex", effort: "medium" },
    },
    {
      timestamp: at("01"),
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Fix the failing login test" }] },
    },
    {
      timestamp: at("05"),
      type: "response_item",
      payload: { type: "function_call", name: "shell", arguments: '{"command":["npm","test"]}', call_id: "call_01" },
    },
    tokens("05", [1200, 200, 40], [1200, 200, 40]),
    tokens("05", [1200, 200, 40], [1200, 200, 40]),
    {
      timestamp: at("13"),
      type: "response_item",
      payload: { type: "function_call_output", call_id: "call_01", output: "1 failing" },
    },
    {
      timestamp: at("20"),
      type: "response_item",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Fixed the test." }] },
    },
    tokens("20", [2600, 1300, 100], [1400, 1100, 60]),
  ]);
}

/** The quick start's session: the first ```jsonl code block of the README. */
export function readmeSession(readme: string): string {
  const match = readme.match(/^```jsonl session\.jsonl\n([\s\S]*?)^```$/m);
  if (!match?.[1]) throw new Error("the README has no ```jsonl session.jsonl block");
  return match[1];
}
