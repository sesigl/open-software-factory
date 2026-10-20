// Session files the system tests export. They only build strings; the tests put them into $INPUT through sut.files.

const jsonl = (lines: unknown[]): string => `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;

export const CLAUDE_SESSION_ID = "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d";

/**
 * A Claude Code session: the prompt "Fix the failing login test", three responses of claude-sonnet-5-5 (msg_01 on
 * two lines), "npm test" from 10:00:06 to 10:00:20 and "gh pr create" that prints a pull request link.
 */
export function claudeSession(minute = "2026-01-01T10:00"): string {
  const base = { sessionId: CLAUDE_SESSION_ID, cwd: "/work/web", version: "2.1.0", gitBranch: "main" };
  const user = (timestamp: string, content: unknown) => ({
    ...base,
    type: "user",
    timestamp: `${minute}:${timestamp}.000Z`,
    message: { role: "user", content },
  });
  const assistant = (timestamp: string, id: string, content: unknown[], usage: Record<string, number>) => ({
    ...base,
    type: "assistant",
    timestamp: `${minute}:${timestamp}.000Z`,
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

/** A short Claude Code session of claude-sonnet-5-5: one Bash call at 10:00:01 whose result is `printed`. */
function claudeToolSession(name: string, input: unknown, printed: string, extra: unknown[] = []): string {
  const base = { sessionId: CLAUDE_SESSION_ID, cwd: "/work/web", version: "2.1.0" };
  const usage = { input_tokens: 100, output_tokens: 10 };
  const message = (id: string, content: unknown[]) => ({
    id,
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    usage,
  });
  return jsonl([
    { ...base, type: "user", timestamp: "2026-01-01T10:00:00.000Z", message: { role: "user", content: "Go" } },
    {
      ...base,
      type: "assistant",
      timestamp: "2026-01-01T10:00:01.000Z",
      message: message("msg_01", [{ type: "tool_use", id: "toolu_01", name, input }]),
    },
    {
      ...base,
      type: "user",
      timestamp: "2026-01-01T10:00:02.000Z",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_01", content: printed }] },
    },
    ...extra.map((content, index) => ({
      ...base,
      type: "assistant",
      timestamp: `2026-01-01T10:00:0${index + 3}.000Z`,
      message: message(`msg_0${index + 2}`, [content]),
    })),
  ]);
}

/** A Claude Code session whose Bash call printed a Linear issue link and a GitHub issue link. */
export function claudeIssueSession(): string {
  const printed = "Created https://linear.app/acme/issue/WEB-42/fix-login\nSee https://github.com/acme/web/issues/12.";
  return claudeToolSession("Bash", { command: "make issues" }, printed);
}

/** src/login.ts after the session of claudeEditSession and openCodeSession: lines 3 and 4 are the agent's. */
export const LOGIN_TS =
  "export function login(user) {\n  // check the user\n  if (!user) return false;\n  return user.active;\n}\n";

/** src/logout.ts as claudeEditSession wrote it: 3 lines. */
export const LOGOUT_TS = "export function logout() {\n  return true;\n}\n";

/** A Claude Code session that edited lines 3 to 4 of src/login.ts and wrote src/logout.ts. */
export function claudeEditSession(): string {
  const edit = {
    file_path: "/work/web/src/login.ts",
    old_string: "  return false;",
    new_string: "  if (!user) return false;\n  return user.active;",
  };
  const write = {
    type: "tool_use",
    id: "toolu_02",
    name: "Write",
    input: { file_path: "/work/web/src/logout.ts", content: LOGOUT_TS },
  };
  return claudeToolSession("Edit", edit, "The file has been updated.", [write]);
}

/** A Codex rollout of gpt-5-codex whose apply_patch added src/session.ts with the 2 lines of SESSION_TS. */
export const SESSION_TS = 'export const ttl = 3600;\nexport const name = "sid";\n';

export function codexPatchSession(): string {
  const at = (seconds: string) => `2026-01-01T10:00:${seconds}.000Z`;
  const patch = `*** Begin Patch\n*** Add File: src/session.ts\n${SESSION_TS.trimEnd()
    .split("\n")
    .map((line) => `+${line}`)
    .join("\n")}\n*** End Patch\n`;
  return jsonl([
    {
      timestamp: at("00"),
      type: "session_meta",
      payload: { id: CODEX_SESSION_ID, timestamp: at("00"), cwd: "/work/web", cli_version: "0.50.0" },
    },
    { timestamp: at("00"), type: "turn_context", payload: { cwd: "/work/web", model: "gpt-5-codex" } },
    {
      timestamp: at("02"),
      type: "response_item",
      payload: { type: "custom_tool_call", name: "apply_patch", input: patch, call_id: "call_01", status: "completed" },
    },
    {
      timestamp: at("03"),
      type: "response_item",
      payload: { type: "custom_tool_call_output", call_id: "call_01", output: "Success." },
    },
  ]);
}

export const OPENCODE_SESSION_ID = "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy";

/**
 * What "opencode export" prints for a session of claude-sonnet-5-5: the prompt "Fix the failing login test", the
 * assistant message msg_a1 with an "edit" of src/login.ts and "npm test" from 10:00:06 to 10:00:15, then msg_a2.
 */
export function openCodeSession(): string {
  const at = (seconds: number) => Date.parse("2026-01-01T10:00:00.000Z") + seconds * 1000;
  const ids = { sessionID: OPENCODE_SESSION_ID };
  const assistant = (id: string, created: number, completed: number, tokens: number[]) => ({
    ...ids,
    id,
    role: "assistant",
    time: { created: at(created), completed: at(completed) },
    modelID: "claude-sonnet-5-5",
    providerID: "anthropic",
    mode: "build",
    path: { cwd: "/work/web", root: "/work/web" },
    cost: 0.004,
    tokens: {
      input: tokens[0],
      output: tokens[1],
      reasoning: 0,
      cache: { read: tokens[2], write: tokens[3] },
    },
  });
  const tool = (messageID: string, callID: string, name: string, input: unknown, output: string, span: number[]) => ({
    ...ids,
    id: `prt_${callID}`,
    messageID,
    type: "tool",
    callID,
    tool: name,
    state: {
      status: "completed",
      input,
      output,
      title: name,
      metadata: {},
      time: { start: at(span[0] ?? 0), end: at(span[1] ?? 0) },
    },
  });
  const text = (messageID: string, id: string, value: string) => ({ ...ids, id, messageID, type: "text", text: value });
  return `${JSON.stringify(
    {
      info: {
        id: OPENCODE_SESSION_ID,
        version: "1.18.2",
        projectID: "4f1d2c3b",
        directory: "/work/web",
        title: "Fix the failing login test",
        time: { created: at(0), updated: at(20) },
      },
      messages: [
        {
          info: { ...ids, id: "msg_u1", role: "user", time: { created: at(0) } },
          parts: [text("msg_u1", "prt_u1", "Fix the failing login test")],
        },
        {
          info: assistant("msg_a1", 1, 15, [800, 60, 400, 100]),
          parts: [
            { ...ids, id: "prt_s1", messageID: "msg_a1", type: "step-start" },
            text("msg_a1", "prt_t1", "I will fix the test and run it."),
            tool(
              "msg_a1",
              "toolu_oc1",
              "edit",
              {
                filePath: "/work/web/src/login.ts",
                oldString: "  return false;",
                newString: "  if (!user) return false;\n  return user.active;",
              },
              "Edit applied successfully.",
              [5, 6],
            ),
            tool("msg_a1", "toolu_oc2", "bash", { command: "npm test" }, "1 passing", [6, 15]),
          ],
        },
        {
          info: assistant("msg_a2", 16, 20, [300, 20, 1200, 0]),
          parts: [text("msg_a2", "prt_t2", "The test passes now.")],
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/** The quick start's session: the first ```jsonl code block of the README. */
export function readmeSession(readme: string): string {
  const match = readme.match(/^```jsonl session\.jsonl\n([\s\S]*?)^```$/m);
  if (!match?.[1]) throw new Error("the README has no ```jsonl session.jsonl block");
  return match[1];
}
