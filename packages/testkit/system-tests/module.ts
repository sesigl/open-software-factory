// Text builders for the small modules the system tests create. They only build strings; the tests put them into
// $INPUT through sut.files.

export interface DemoOptions {
  /** The module's CLI, plain JavaScript. */
  bin?: string;
  /** README.md of the module. */
  readme?: string;
  /** Steps of SCN-DEMO-001, one Gherkin line each. */
  steps?: string[];
  /** Body of the test of SCN-DEMO-001; the context gives `sut`, `fakes`, `given`, `when`, `then` and `example`. */
  test?: string[];
  /** A library: package.json has no bin and there is no CLI. */
  library?: boolean;
  /** The rows of an Examples table, header first, one line each: SCN-DEMO-001 is then a Scenario Outline. */
  examples?: string[];
  /** The status of SCN-DEMO-001; "implemented" without it. */
  status?: string;
}

const HELLO: Required<Pick<DemoOptions, "bin" | "steps" | "test">> = {
  bin: 'process.stdout.write("hello\\n");\n',
  steps: ['When the user runs "demo"', 'Then the output is "hello"'],
  test: [
    "let run: Awaited<ReturnType<typeof sut.cli>>;",
    "await when('the user runs \"demo\"', async () => {",
    "  run = await sut.cli([]);",
    "});",
    "await then('the output is \"hello\"', async () => {",
    '  expect(run.stdout).toBe("hello\\n");',
    "});",
  ],
};

/**
 * The files of module demo with the implemented scenario SCN-DEMO-001 and its system test, keyed by their path
 * below $INPUT. Without options, the CLI prints "hello" and the test expects it.
 */
export function demoModule(options: DemoOptions = {}): Record<string, string> {
  const { bin, steps, test } = { ...HELLO, ...options };
  const manifest = {
    name: "demo",
    version: "0.1.0",
    type: "module",
    ...(options.library ? {} : { bin: { demo: "bin/demo.js" } }),
  };
  const files: Record<string, string> = {
    "$INPUT/package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    ...(options.library ? {} : { "$INPUT/bin/demo.js": bin }),
    "$INPUT/features/a.feature": [
      "Feature: Demo",
      "",
      `  @id=SCN-DEMO-001 @status=${options.status ?? "implemented"}`,
      options.examples ? "  Scenario Outline: Demo" : "  Scenario: Demo",
      ...steps.map((step) => `    ${step}`),
      ...(options.examples ? ["", "    Examples:", ...options.examples.map((row) => `      ${row}`)] : []),
      "",
    ].join("\n"),
    "$INPUT/system-tests/SCN-DEMO-001.test.ts": [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      'scenario("SCN-DEMO-001", async ({ sut, fakes, given, when, then, example }) => {',
      ...test.map((line) => `  ${line}`),
      "});",
      "",
    ].join("\n"),
  };
  if (options.readme) files["$INPUT/README.md"] = options.readme;
  return files;
}

/**
 * Module demo whose SCN-DEMO-001 is a Scenario Outline with the rows `examples` (header first): `When the user runs
 * "demo <word>"` and `Then the output is <column>`, with `output` as that `<column>`. The CLI prints its arguments;
 * the test's lines `before` run first in each row.
 */
export function outlineModule(
  examples: string[],
  output: string,
  before: string[] = [],
  status = "implemented",
): Record<string, string> {
  const column = output.slice(1, -1);
  return demoModule({
    bin: 'process.stdout.write(`${process.argv.slice(2).join(" ")}\\n`);\n',
    status,
    examples,
    steps: ['When the user runs "demo <word>"', `Then the output is ${output}`],
    test: [
      ...before,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo <word>\"', async () => {",
      "  run = await sut.cli([example.word]);",
      "});",
      `await then('the output is ${output}', async () => {`,
      `  expect(run.stdout).toBe(\`\${example["${column}"]}\\n\`);`,
      "});",
    ],
  });
}

/**
 * Module demo whose CLI gets `/v0.1/servers?search=tracker` from `DEMO_API_URL` and prints the body; its test scripts
 * `fakes.http` with `routes` (TypeScript source) and expects the body `{"count":1}`. `before` (TypeScript lines) runs
 * before the fake starts, and `run` replaces the plain run of the CLI.
 */
export function apiModule(
  routes: string,
  before: string[] = [],
  run: string[] = ["run = await sut.cli([], { env: { DEMO_API_URL: api.url } });"],
): Record<string, string> {
  return demoModule({
    bin: [
      "const response = await fetch(`${process.env.DEMO_API_URL}/v0.1/servers?search=tracker`);",
      "process.stdout.write(await response.text());",
      "",
    ].join("\n"),
    readme:
      "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
    steps: ['When the user runs "demo"', 'Then the output is {"count":1}'],
    test: [
      ...before,
      `const api = await fakes.http(${routes});`,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      ...run.map((line) => `  ${line}`),
      "});",
      "await then('the output is {\"count\":1}', async () => {",
      "  expect(run.stdout).toBe('{\"count\":1}');",
      "});",
    ],
  });
}

/** The test cases of a JUnit report: name and whether it has a failure. */
export function testCases(report: string): { name: string; failed: boolean }[] {
  return [...report.matchAll(/<testcase [^>]*name="([^"]+)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)].map((match) => ({
    name: match[1] as string,
    failed: /<failure|<error/.test(match[3] ?? ""),
  }));
}

/**
 * An adapter in $INPUT whose port features in `port/features/` have these implemented @conformance scenarios, and
 * whose system tests pass the scenarios in `tested`.
 */
export function demoAdapter(scenarios: string[], tested: string[]): Record<string, string> {
  const files: Record<string, string> = {
    "$INPUT/package.json": `${JSON.stringify({ name: "demo-adapter", version: "0.1.0", type: "module", bin: { demo: "bin/demo.js" } }, null, 2)}\n`,
    "$INPUT/bin/demo.js": 'process.stdout.write("hello\\n");\n',
    "$INPUT/port/features/demo.feature": [
      "Feature: Demo port",
      "",
      ...scenarios.flatMap((id) => [
        `  @id=${id} @status=implemented @conformance`,
        `  Scenario: ${id}`,
        '    When the user runs "demo"',
        '    Then the output is "hello"',
        "",
      ]),
    ].join("\n"),
  };
  for (const id of tested) {
    files[`$INPUT/system-tests/${id}.test.ts`] = [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      `scenario("${id}", async ({ sut, when, then }) => {`,
      ...HELLO.test.map((line) => `  ${line}`),
      "});",
      "",
    ].join("\n");
  }
  return files;
}

/** Call counts of the functions of the script whose URL ends with `suffix`, from V8 coverage files. */
export function functionCounts(reports: string[], suffix: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const report of reports) {
    const { result } = JSON.parse(report) as {
      result: { url: string; functions: { functionName: string; ranges: { count: number }[] }[] }[];
    };
    for (const script of result.filter((entry) => entry.url.endsWith(suffix))) {
      for (const fn of script.functions) counts[fn.functionName] = fn.ranges[0]?.count ?? 0;
    }
  }
  return counts;
}

/**
 * Module demo whose CLI posts `{"n":1}` to `/v1/traces` at `DEMO_API_URL` twice and prints both status codes; its
 * test scripts `fakes.http` with `routes` (TypeScript source) and runs `expectations` (TypeScript lines with `run`
 * and `api`).
 */
export function postModule(routes: string, expectations: string[]): Record<string, string> {
  return demoModule({
    bin: [
      "const codes = [];",
      "for (const _ of [1, 2]) {",
      '  const response = await fetch(`${process.env.DEMO_API_URL}/v1/traces`, { method: "POST", body: \'{"n":1}\' });',
      "  codes.push(response.status);",
      "}",
      'process.stdout.write(codes.join(" "));',
      "",
    ].join("\n"),
    readme:
      "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
    steps: ['When the user runs "demo"', "Then the fake answered as scripted"],
    test: [
      `const api = await fakes.http(${routes});`,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      "  run = await sut.cli([], { env: { DEMO_API_URL: api.url } });",
      "});",
      "await then('the fake answered as scripted', async () => {",
      ...expectations.map((line) => `  ${line}`),
      "});",
    ],
  });
}

/** A Collector config that receives OTLP/HTTP on 4318, runs the one `processor` (YAML lines) and exports as JSON. */
export function collectorConfig(processor: string[]): string {
  const name = (processor[0] ?? "").replace(":", "");
  return [
    "receivers:",
    "  otlp:",
    "    protocols:",
    "      http:",
    "        endpoint: 0.0.0.0:4318",
    "processors:",
    ...processor.map((line) => `  ${line}`),
    "exporters:",
    "  otlphttp:",
    "    endpoint: ${env:OTEL_EXPORTER_OTLP_ENDPOINT}",
    "    encoding: json",
    "service:",
    "  pipelines:",
    "    traces:",
    "      receivers: [otlp]",
    `      processors: [${name}]`,
    "      exporters: [otlphttp]",
    "",
  ].join("\n");
}

/** One OTLP/JSON request with the span "work". */
export const WORK_SPAN = {
  resourceSpans: [
    {
      resource: { attributes: [] },
      scopeSpans: [
        {
          spans: [
            {
              traceId: "5b8e0c7e1d2a4f009a7e0d1f2a3b4c5d",
              spanId: "0000000000000001",
              name: "work",
              kind: 1,
              startTimeUnixNano: "1767225600000000000",
              endTimeUnixNano: "1767225660000000000",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Module demo with a composite GitHub Action: `action.yml` holds the `steps` (YAML lines below `steps:`), the input
 * `name` without a default and the input `command`; the CLI prints "hello <first argument>". Its test runs `test` (TypeScript lines).
 */
export function actionModule(actionSteps: string[], steps: string[], test: string[]): Record<string, string> {
  return {
    ...demoModule({ bin: "process.stdout.write(`hello ${process.argv[2]}\\n`);\n", steps, test }),
    "$INPUT/action.yml": [
      "name: demo",
      "description: Greets.",
      "inputs:",
      "  name:",
      "    description: Who to greet.",
      "  command:",
      "    description: The demo command.",
      "    default: npx demo",
      "runs:",
      "  using: composite",
      "  steps:",
      ...actionSteps.map((line) => `    ${line}`),
      "",
    ].join("\n"),
  };
}

/**
 * Module demo whose CLI is an ACP client of the agent in `DEMO_AGENT_COMMAND` (a JSON array of the command and its
 * arguments). It opens one session in $INPUT and runs its arguments in order: `prompt:<text>` sends a prompt and waits
 * for its turn, `send:<text>` sends one without waiting, `steer:<text>` sends the request `_session/steering` with the
 * text and prints `steered <outcome>`, `sleep:<ms>` waits, `cancel` cancels the session, and `kill` stops the agent and
 * exits. Then it waits for every turn and stops the agent. It prints `<text>: <stop reason>` when a
 * turn ends and `reply <text>` for each message chunk. `--refuse` as the first argument refuses every tool call; it
 * allows them otherwise. Its README documents `variables` too. Its test runs `test` (TypeScript lines) for SCN-DEMO-001
 * with `steps`.
 */
export function acpClientModule(steps: string[], test: string[], variables: string[] = []): Record<string, string> {
  return demoModule({
    bin: [
      'import { spawn } from "node:child_process";',
      'import { createInterface } from "node:readline";',
      "const [command, ...args] = JSON.parse(process.env.DEMO_AGENT_COMMAND);",
      'const agent = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"] });',
      "const actions = process.argv.slice(2);",
      'const refuse = actions[0] === "--refuse";',
      "if (refuse) actions.shift();",
      "const pending = new Map();",
      "let next = 0;",
      'const send = (message) => agent.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\\n`);',
      "const request = (method, params) =>",
      "  new Promise((resolve, reject) => {",
      "    const id = ++next;",
      "    pending.set(id, { resolve, reject });",
      "    send({ id, method, params });",
      "  });",
      'createInterface({ input: agent.stdout }).on("line", (line) => {',
      "  const message = JSON.parse(line);",
      '  if (message.method === "session/update") {',
      "    const { update } = message.params;",
      '    if (update.sessionUpdate === "agent_message_chunk") process.stdout.write(`reply ${update.content.text}\\n`);',
      '    if (update.sessionUpdate === "usage_update" && update.cost) {',
      "      process.stdout.write(`cost ${update.cost.amount} ${update.cost.currency}\\n`);",
      "    }",
      '  } else if (message.method === "session/request_permission") {',
      '    const optionId = refuse ? "reject" : "allow";',
      '    send({ id: message.id, result: { outcome: { outcome: "selected", optionId } } });',
      "  } else if (message.method) {",
      '    send({ id: message.id, error: { code: -32601, message: "not supported" } });',
      "  } else {",
      "    const { resolve, reject } = pending.get(message.id);",
      "    if (message.error) reject(new Error(message.error.message));",
      "    else resolve(message.result);",
      "  }",
      "});",
      'await request("initialize", { protocolVersion: 1, clientCapabilities: {} });',
      'const { sessionId } = await request("session/new", { cwd: process.cwd(), mcpServers: [] });',
      "const turns = [];",
      "const prompt = (text) =>",
      '  request("session/prompt", { sessionId, prompt: [{ type: "text", text }] }).then(({ stopReason, usage }) => {',
      "    process.stdout.write(`${text}: ${stopReason}\\n`);",
      "    if (usage) process.stdout.write(`usage ${usage.inputTokens} ${usage.outputTokens} ${usage.totalTokens}\\n`);",
      "  });",
      "for (const action of actions) {",
      '  const [verb, ...rest] = action.split(":");',
      '  const text = rest.join(":");',
      '  if (verb === "prompt") await prompt(text);',
      '  else if (verb === "send") turns.push(prompt(text));',
      '  else if (verb === "steer") {',
      '    const { outcome } = await request("_session/steering", { sessionId, prompt: [{ type: "text", text }] });',
      "    process.stdout.write(`steered ${outcome}\\n`);",
      "  }",
      '  else if (verb === "sleep") await new Promise((resolve) => setTimeout(resolve, Number(text)));',
      '  else if (verb === "cancel") send({ method: "session/cancel", params: { sessionId } });',
      '  else if (verb === "kill") {',
      "    agent.kill();",
      "    process.exit(0);",
      "  }",
      "}",
      "await Promise.all(turns);",
      "agent.kill();",
      "",
    ].join("\n"),
    readme: [
      "# demo",
      "",
      "## Configuration",
      "",
      "| Variable | Meaning |",
      "| --- | --- |",
      "| `DEMO_AGENT_COMMAND` | The ACP agent to start, as a JSON array of the command and its arguments. |",
      ...variables.map((name) => `| \`${name}\` | Passed on to the agent. |`),
      "",
    ].join("\n"),
    steps,
    test,
  });
}

/**
 * The ACP client module whose test starts it with the variables `env` and the scripted harness, sends "fix the typo"
 * and expects one session in $INPUT whose recorded variables include `env`.
 */
export function recordingClientModule(env: Record<string, string>): Record<string, string> {
  const variables = JSON.stringify(env);
  return acpClientModule(
    ['When the user runs "demo prompt:fix the typo"', "Then the agent recorded the session's folder and variables"],
    [
      'const harness = await fakes.harness([{ when: "fix the typo", reply: "done" }]);',
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo prompt:fix the typo\"', async () => {",
      `  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]), ...${variables} };`,
      '  run = await sut.cli(["prompt:fix the typo"], { env });',
      "});",
      'await then("the agent recorded the session\'s folder and variables", async () => {',
      "  expect(run.exitCode, run.stderr).toBe(0);",
      "  const sessions = harness.sessions();",
      "  expect(sessions).toHaveLength(1);",
      '  expect(sessions[0]?.cwd).toBe(sut.files.path("$INPUT"));',
      `  expect(sessions[0]?.env).toMatchObject(${variables});`,
      "});",
    ],
    Object.keys(env),
  );
}

/**
 * Module demo whose bin is an ACP agent on stdio named "demo" 0.1.0. Its one session is "s1". It answers the prompt
 * `greet <name>` with the reply "hello <name> from <name of the session's folder>"; for "clean up" it asks the client
 * to approve the tool "rm -rf build" of kind "execute" and replies with the option the client chose; for "bye" it answers
 * and exits with code 3; for "wait" it keeps
 * the turn running until the session is cancelled. Every turn ends with "end_turn", a cancelled one with "cancelled".
 * Its test runs `test` (TypeScript lines) for SCN-DEMO-001 with `steps`.
 */
export function acpAgentModule(steps: string[], test: string[]): Record<string, string> {
  return demoModule({
    bin: [
      'import { basename } from "node:path";',
      'import { createInterface } from "node:readline";',
      'const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\\n`);',
      "const chunk = (text) =>",
      '  send({ method: "session/update", params: { sessionId: "s1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } } });',
      'let cwd = "";',
      "let cancel;",
      "let approved;",
      'createInterface({ input: process.stdin }).on("line", (line) => {',
      "  const message = JSON.parse(line);",
      '  if (message.method === "initialize") {',
      '    send({ id: message.id, result: { protocolVersion: 1, agentCapabilities: {}, agentInfo: { name: "demo", version: "0.1.0" }, authMethods: [] } });',
      '  } else if (message.method === "session/new") {',
      "    cwd = message.params.cwd;",
      '    send({ id: message.id, result: { sessionId: "s1" } });',
      '  } else if (message.method === "session/cancel") {',
      "    cancel?.();",
      '  } else if (message.method === "session/prompt") {',
      "    const text = message.params.prompt[0].text;",
      '    if (text.startsWith("greet ")) {',
      '      chunk(`hello ${text.slice("greet ".length)} from ${basename(cwd)}`);',
      '      send({ id: message.id, result: { stopReason: "end_turn" } });',
      '    } else if (text === "bye") {',
      '      send({ id: message.id, result: { stopReason: "end_turn" } });',
      "      setTimeout(() => process.exit(3), 50);",
      '    } else if (text === "clean up") {',
      "      approved = (optionId) => {",
      "        chunk(optionId);",
      '        send({ id: message.id, result: { stopReason: "end_turn" } });',
      "      };",
      "      const options = [",
      '        { optionId: "allow", name: "Allow", kind: "allow_once" },',
      '        { optionId: "reject", name: "Reject", kind: "reject_once" },',
      "      ];",
      '      const toolCall = { toolCallId: "t1", title: "rm -rf build", kind: "execute" };',
      '      send({ id: "p1", method: "session/request_permission", params: { sessionId: "s1", toolCall, options } });',
      "    } else {",
      '      cancel = () => send({ id: message.id, result: { stopReason: "cancelled" } });',
      "    }",
      '  } else if (message.id === "p1") {',
      "    approved(message.result.outcome.optionId);",
      "  } else if (message.id !== undefined) {",
      '    send({ id: message.id, error: { code: -32601, message: "Method not found" } });',
      "  }",
      "});",
      "",
    ].join("\n"),
    readme: ["# demo", "", "## Configuration", "", "| Variable | Meaning |", "| --- | --- |", ""].join("\n"),
    steps,
    test,
  });
}

/** README of module demo whose CLI reaches a forge at `DEMO_FORGE_URL` with the token `DEMO_FORGE_TOKEN`. */
export const FORGE_README = [
  "# demo",
  "",
  "## Configuration",
  "",
  "| Variable | Meaning |",
  "| --- | --- |",
  "| `DEMO_FORGE_URL` | Forge base URL. |",
  "| `DEMO_FORGE_TOKEN` | Forge API token. |",
  "",
].join("\n");

/** The CLI's first lines: `api(method, path, body)` calls the forge's API v1 below `/repos/<first argument>`. */
export const FORGE_API = [
  "const [repository, ...rest] = process.argv.slice(2);",
  "const api = (method, path, body) =>",
  "  fetch(`${process.env.DEMO_FORGE_URL}/api/v1/repos/${repository}${path}`, {",
  "    method,",
  '    headers: { authorization: `token ${process.env.DEMO_FORGE_TOKEN}`, "content-type": "application/json" },',
  "    body: body && JSON.stringify(body),",
  "  }).then((response) => response.json());",
];

export const GITHUB_README = [
  "# demo",
  "",
  "## Configuration",
  "",
  "| Variable | Meaning |",
  "| --- | --- |",
  "| `DEMO_GITHUB_URL` | GitHub API base URL. |",
  "| `DEMO_GITHUB_TOKEN` | GitHub API token. |",
  "",
].join("\n");

/**
 * The CLI's first lines: `api(method, path, body)` calls GitHub's REST API below `/repos/<first argument>` and gives
 * `{ status, json }`.
 */
export const GITHUB_API = [
  "const [repository, ...rest] = process.argv.slice(2);",
  "const api = (method, path, body) =>",
  "  fetch(`${process.env.DEMO_GITHUB_URL}/repos/${repository}${path}`, {",
  "    method,",
  '    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}`, "content-type": "application/json" },',
  "    body: body && JSON.stringify(body),",
  "  }).then(async (response) => ({ status: response.status, json: await response.json() }));",
];

/** The CLI's lines that require "verify" on "main" and give `graphql(query, variables)` and `enable(method)`. */
export const AUTO_MERGE: string[] = [
  ...GITHUB_API,
  "const graphql = (query, variables) =>",
  "  fetch(`${process.env.DEMO_GITHUB_URL}/graphql`, {",
  '    method: "POST",',
  "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
  "    body: JSON.stringify({ query, variables }),",
  "  }).then((response) => response.json());",
  'await api("PUT", "/branches/main/protection", {',
  '  required_status_checks: { strict: false, contexts: ["verify"] },',
  "  enforce_admins: true,",
  "  required_pull_request_reviews: null,",
  "  restrictions: null,",
  "});",
  "const state = () =>",
  "  graphql(",
  '    "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { autoMergeAllowed pullRequest(number: $number) { id mergeStateStatus autoMergeRequest { enabledAt mergeMethod } } } }",',
  '    { owner: "tester", name: "demo", number: 1 },',
  "  ).then((answer) => answer.data.repository.pullRequest);",
  "const enable = async (method) =>",
  "  graphql(",
  '    "mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }",',
  "    { id: (await state()).id, method },",
  "  );",
];

/**
 * Module demo whose CLI runs `bin` (JavaScript lines) with `sandbox(...args)`, which runs the sandbox adapter in
 * `DEMO_SANDBOX_COMMAND` and returns its result; its test starts `fakes.sandbox(<options>)` and runs `expectations`
 * (TypeScript lines with `run` and `sandbox`) in the step "Then the fake sandbox answered as scripted".
 */
export function sandboxModule(bin: string[], expectations: string[], options = ""): Record<string, string> {
  return demoModule({
    bin: [
      'import { spawnSync } from "node:child_process";',
      'import { mkdirSync, writeFileSync } from "node:fs";',
      "const [command, ...args] = JSON.parse(process.env.DEMO_SANDBOX_COMMAND);",
      'const sandbox = (...rest) => spawnSync(command, [...args, ...rest], { encoding: "utf8" });',
      ...bin,
      "",
    ].join("\n"),
    readme: [
      "# demo",
      "",
      "## Configuration",
      "",
      "| Variable | Meaning |",
      "| --- | --- |",
      "| `DEMO_SANDBOX_COMMAND` | The sandbox adapter, as a JSON array of the command and its arguments. |",
      "",
    ].join("\n"),
    steps: ['When the user runs "demo"', "Then the fake sandbox answered as scripted"],
    test: [
      `const sandbox = await fakes.sandbox(${options});`,
      "const adapter = JSON.stringify([sandbox.command, ...sandbox.args]);",
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      "  run = await sut.cli([], { env: { DEMO_SANDBOX_COMMAND: adapter } });",
      "});",
      "await then('the fake sandbox answered as scripted', async () => {",
      ...expectations.map((line) => `  ${line}`),
      "});",
    ],
  });
}

/**
 * Module demo whose CLI, plain JavaScript in `bin`, runs the inference adapter in `DEMO_INFERENCE_COMMAND` (a JSON array
 * of the command and its arguments) with `inference(...args)`; its test starts fakes.inference with `options` and runs
 * `expectations` (TypeScript lines) on the run and the fake.
 */
export function inferenceModule(bin: string[], expectations: string[], options = ""): Record<string, string> {
  return demoModule({
    bin: [
      'import { spawnSync } from "node:child_process";',
      'import { writeFileSync } from "node:fs";',
      "const [command, ...args] = JSON.parse(process.env.DEMO_INFERENCE_COMMAND);",
      'const inference = (...rest) => spawnSync(command, [...args, ...rest], { encoding: "utf8" });',
      ...bin,
      "",
    ].join("\n"),
    readme: [
      "# demo",
      "",
      "## Configuration",
      "",
      "| Variable | Meaning |",
      "| --- | --- |",
      "| `DEMO_INFERENCE_COMMAND` | The inference adapter, as a JSON array of the command and its arguments. |",
      "",
    ].join("\n"),
    steps: ['When the user runs "demo"', "Then the fake inference adapter answered as scripted"],
    test: [
      `const inference = await fakes.inference(${options});`,
      "const adapter = JSON.stringify([inference.command, ...inference.args]);",
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      "  run = await sut.cli([], { env: { DEMO_INFERENCE_COMMAND: adapter } });",
      "});",
      "await then('the fake inference adapter answered as scripted', async () => {",
      ...expectations.map((line) => `  ${line}`),
      "});",
    ],
  });
}

/**
 * A Docker CLI plugin "docker-compose" that answers Docker's metadata call and appends every other call to the file
 * `log`; with `failUp`, it fails "up" with that text and exit code 1.
 */
export function composePlugin(log: string, failUp?: string): string {
  return [
    "#!/bin/sh",
    'if [ "$1" = docker-cli-plugin-metadata ]; then',
    '  echo \'{"SchemaVersion":"0.1.0","Vendor":"testkit","Version":"9.9.9","ShortDescription":"fake"}\'',
    "  exit 0",
    "fi",
    `echo "$*" >> '${log}'`,
    ...(failUp ? [`case " $* " in *" up "*) echo "${failUp}" >&2; exit 1 ;; esac`] : []),
    "exit 0",
    "",
  ].join("\n");
}

/** The calls of `composePlugin`'s log, each as its project and its command, like "up", without the Compose file. */
export function composeCalls(log: string): { project: string; command: string }[] {
  return log
    .split("\n")
    .filter((line) => line.includes("--project-name"))
    .map((line) => {
      const words = line.split(" ");
      const project = words[words.indexOf("--project-name") + 1] as string;
      const rest = words.slice(words.indexOf("--project-name") + 2);
      while (rest[0]?.startsWith("--")) rest.splice(0, 2);
      return { project, command: rest[0] ?? "" };
    });
}

/** A scenario of `groupModule`: its tags after `@id` and `@status`, its steps and the body of its test. */
export interface GroupScenario {
  tags: string;
  steps: string[];
  test: string[];
}

/**
 * A scenario of the group "profile": its shared start runs "up" on "compose.yaml" and fails when "up" fails; then the
 * test runs "ps" on the shared project.
 */
export const sharedCompose: GroupScenario = {
  tags: "@shared=profile",
  steps: [
    'Given the shared start "profile", which runs "up" on "compose.yaml"',
    "Then the shared project lists its services",
  ],
  test: [
    "let shared!: Awaited<ReturnType<typeof sut.shared>>;",
    'await given(\'the shared start "profile", which runs "up" on "compose.yaml"\', async () => {',
    '  shared = await sut.shared("profile", async (start) => {',
    '    const up = await start.compose("compose.yaml").run(["up"]);',
    "    if (up.exitCode !== 0) throw new Error(`up exited with code ${up.exitCode}: ${up.stderr.trim()}`);",
    "    return up.exitCode;",
    "  });",
    "});",
    'await then("the shared project lists its services", async () => {',
    "  expect(shared.result).toBe(0);",
    '  const ps = await shared.sut.compose("compose.yaml").run(["ps"]);',
    "  expect(ps.exitCode, ps.stderr).toBe(0);",
    "});",
  ],
};

/**
 * Module demo with the implemented scenarios SCN-DEMO-001, SCN-DEMO-002 and so on in one feature file, each with a
 * test file of its own, like the scenarios of a group that share a start.
 */
export function groupModule(scenarios: GroupScenario[]): Record<string, string> {
  const files = demoModule();
  const id = (index: number) => `SCN-DEMO-${String(index + 1).padStart(3, "0")}`;
  files["$INPUT/features/a.feature"] = [
    "Feature: Demo",
    "",
    ...scenarios.flatMap(({ tags, steps }, index) => [
      `  @id=${id(index)} @status=implemented${tags ? ` ${tags}` : ""}`,
      `  Scenario: Demo ${index + 1}`,
      ...steps.map((step) => `    ${step}`),
      "",
    ]),
  ].join("\n");
  for (const [index, { test }] of scenarios.entries()) {
    files[`$INPUT/system-tests/${id(index)}.test.ts`] = [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      `scenario("${id(index)}", async ({ sut, fakes, given, when, then }) => {`,
      ...test.map((line) => `  ${line}`),
      "});",
      "",
    ].join("\n");
  }
  return files;
}

/**
 * Module demo whose server answers each path in `pages` with that HTML and every other request with `routes`, plain
 * JavaScript statements that see `request`, `response`, `url` (a URL) and `form` (the sent fields, URLSearchParams).
 * Its README documents `PORT`.
 */
export function pageModule(
  pages: Record<string, string>,
  routes: string[],
  steps: string[],
  test: string[],
): Record<string, string> {
  return demoModule({
    bin: [
      'import { createServer } from "node:http";',
      `const pages = ${JSON.stringify(pages)};`,
      "createServer(async (request, response) => {",
      '  const url = new URL(request.url, "http://127.0.0.1");',
      "  let sent = '';",
      "  for await (const chunk of request) sent += chunk;",
      "  const form = new URLSearchParams(sent);",
      "  if (pages[url.pathname] !== undefined) {",
      '    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });',
      "    return response.end(pages[url.pathname]);",
      "  }",
      ...routes.map((line) => `  ${line}`),
      "  response.writeHead(404);",
      "  response.end();",
      '}).listen(Number(process.env.PORT), "127.0.0.1");',
      "",
    ].join("\n"),
    readme: [
      "# demo",
      "",
      "## Configuration",
      "",
      "| Variable | Meaning |",
      "| --- | --- |",
      "| `PORT` | Port. |",
      "",
    ].join("\n"),
    steps,
    test,
  });
}
