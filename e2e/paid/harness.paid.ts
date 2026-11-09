// SMOKE-PAID: each first-party harness adapter fixes one typo with a real model (ADR 0077). It runs only through
// `make smoke-paid` and spends real money, so it is no system test: no scenario, no fakes, no network guard.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { client, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

// The owner's budget is 20 USD a month for the weekly paid runs; one run of a harness may cost 0.20 USD.
const MAX_USD_PER_RUN = 0.2;
const ADAPTERS = resolve(import.meta.dirname, "../../adapters/harness");

// opencode calls OpenRouter's chat completions API. The key's credit limit is the hard limit of the budget.
const OPENROUTER = "https://openrouter.ai/api/v1";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`SMOKE-PAID: set ${name}`);
  return value;
}

// codex has no paid run yet: Codex offers its edit tool only to models it knows, and the key allows none of them.
const harnesses: { name: string; env: () => Record<string, string> }[] = [
  {
    name: "opencode",
    env: () => ({
      OPENAI_BASE_URL: OPENROUTER,
      OPENAI_API_KEY: required("OPENROUTER_API_KEY"),
      OPENAI_MODEL: required("OPENAI_MODEL"),
    }),
  },
];

// claude-code runs only on a developer's machine, on that person's subscription: a token of `claude setup-token`, and
// the small model claude-haiku-5-5 unless ANTHROPIC_MODEL names another. A subscription is one person's, never CI's.
// An empty ANTHROPIC_MODEL, as some shells set it, also gets the small model, not Claude Code's default.
const { CLAUDE_CODE_OAUTH_TOKEN: token, CI } = process.env;
const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
if (token && CI) throw new Error("SMOKE-PAID: CLAUDE_CODE_OAUTH_TOKEN is a person's subscription; never set it in CI");
if (token) {
  harnesses.push({
    name: "claude-code",
    env: () => ({ CLAUDE_CODE_OAUTH_TOKEN: token, ANTHROPIC_MODEL: model }),
  });
}

/** One ACP turn of the agent that `command` starts: the prompt to fix the typo in `cwd`'s notes.md. */
async function fixTypo(command: string[], env: Record<string, string>, cwd: string) {
  const [file = "", ...args] = command;
  const agent = spawn(file, args, { env });
  let stderr = "";
  agent.stderr.on("data", (chunk) => (stderr += chunk));
  const connection = client({ name: "smoke-paid" })
    .onRequest("session/request_permission", ({ params }) => {
      const option = params.options.find((candidate) => candidate.kind.startsWith("allow"));
      return { outcome: option ? { outcome: "selected", optionId: option.optionId } : { outcome: "cancelled" } };
    })
    .connect(
      ndJsonStream(
        Writable.toWeb(agent.stdin) as WritableStream<Uint8Array>,
        Readable.toWeb(agent.stdout) as ReadableStream<Uint8Array>,
      ),
    );
  try {
    await connection.agent.request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
    const { sessionId } = await connection.agent.request("session/new", { cwd, mcpServers: [] });
    const prompt = 'In notes.md, change the word "helo" to "hello". Change nothing else and run no command.';
    const { stopReason } = await connection.agent.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: prompt }],
    });
    return { sessionId, stopReason, stderr };
  } finally {
    connection.close();
    agent.kill();
  }
}

/** A folder with notes.md that holds the typo, as a git repository, and empty folders for OUTPUT and OSF_DATA. */
function workspace(name: string) {
  const root = mkdtempSync(join(tmpdir(), `smoke-paid-${name}-`));
  const [work, output, data] = [join(root, "work"), join(root, "output"), join(root, "data")] as const;
  for (const dir of [work, output, data]) mkdirSync(dir);
  writeFileSync(join(work, "notes.md"), "helo world\n");
  execFileSync("git", ["init", "-q"], { cwd: work });
  return { root, work, output, data };
}

/** The turn ended, fixed the typo, and its run record has tokens and a cost inside the budget. */
function expectFixed(turn: { stopReason: string; stderr: string }, notes: string, output: string) {
  const transcript = readFileSync(join(output, "transcript.jsonl"), "utf8");
  expect(turn.stopReason, `${turn.stderr}\n${transcript}`).toBe("end_turn");
  expect(notes, transcript).toBe("hello world\n");
  const { span } = JSON.parse(readFileSync(join(output, "run-record.json"), "utf8"));
  expect(span["osf.outcome"]).toBe("succeeded");
  expect(span["gen_ai.usage.output_tokens"]).toBeGreaterThan(0);
  // Not every harness reports a cost; the credit limit of the key is the hard limit.
  if (span["osf.cost.usd"] !== undefined) expect(span["osf.cost.usd"]).toBeLessThanOrEqual(MAX_USD_PER_RUN);
}

for (const harness of harnesses) {
  test(`harness-${harness.name} fixes a typo with a real model`, async () => {
    const { root, work, output, data } = workspace(harness.name);
    // Only what the adapter needs: no settings, logins or keys of the machine reach it.
    const env = { PATH: process.env.PATH ?? "", HOME: root, OUTPUT: output, OSF_DATA: data, ...harness.env() };
    const bin = join(ADAPTERS, harness.name, "dist/cli.js");
    const turn = await fixTypo([process.execPath, bin, "run", "--allow", "read,edit"], { ...env }, work);
    // The transcript shows what the harness and the model did, so a failed run explains itself.
    execFileSync(process.execPath, [bin, "transcript", turn.sessionId], { cwd: work, env });
    expectFixed(turn, readFileSync(join(work, "notes.md"), "utf8"), output);
  });
}

// claude-code in a sandbox of the agents' template, as the reference factory runs it (ADR 0096): the sandbox holds
// only the placeholder of CLAUDE_CODE_OAUTH_TOKEN, and its egress proxy puts the token in on the way to Anthropic.
const SANDBOX = resolve(import.meta.dirname, "../../adapters/sandbox/docker/dist/cli.js");
const FACTORY = resolve(import.meta.dirname, "../../deploy/compose/factory/factory.yaml");
const PLACEHOLDER = "osf-secret-placeholder-CLAUDE_CODE_OAUTH_TOKEN";

if (token) {
  test("harness-claude-code fixes a typo in a sandbox with the placeholder of its token", async () => {
    const template = /^\s+template: (\S+)$/m.exec(readFileSync(FACTORY, "utf8"))?.[1];
    if (!template) throw new Error(`SMOKE-PAID: no sandbox template in ${FACTORY}`);
    const { root, work, output } = workspace("claude-code-sandbox");
    // The Docker CLI needs the machine's HOME for its context. Only `create` gets the token, which it hands to the
    // egress proxy alone.
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? root,
      ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}),
    };
    const call = (extra: Record<string, string>, args: string[]) =>
      execFileSync(process.execPath, [SANDBOX, ...args], { env: { ...env, ...extra }, encoding: "utf8" }).trim();
    const sandbox = (...args: string[]) => call({}, args);
    const spec = join(root, "spec.json");
    writeFileSync(
      spec,
      JSON.stringify({
        template,
        cpu: 2,
        memory: "4Gi",
        egress: ["api.anthropic.com"],
        env: { ANTHROPIC_MODEL: model, OUTPUT: "/workspace/output", OSF_DATA: "/workspace/data" },
        secrets: { CLAUDE_CODE_OAUTH_TOKEN: "ref:env/CLAUDE_CODE_OAUTH_TOKEN" },
      }),
    );
    const created = call({ OSF_SECRET_CLAUDE_CODE_OAUTH_TOKEN: token }, ["create", spec]);
    const id = created.split("\n").at(-1) ?? "";
    try {
      sandbox("copy", work, `${id}:work`);
      sandbox("exec", id, "--", "mkdir", "-p", "output", "data");
      // Compared without the value in the message, so a failure never prints the token.
      const held = sandbox("exec", id, "--", "printenv", "CLAUDE_CODE_OAUTH_TOKEN");
      expect(held === PLACEHOLDER, "the sandbox's CLAUDE_CODE_OAUTH_TOKEN is not the placeholder").toBe(true);
      const folder = `${sandbox("exec", id, "--", "pwd")}/work`;
      const run = [process.execPath, SANDBOX, "exec", id, "--", "harness-claude-code", "run", "--allow", "read,edit"];
      const turn = await fixTypo(run, env, folder);
      const log = sandbox("egress-log", id);
      sandbox("exec", id, "--", "sh", "-c", `cd work && harness-claude-code transcript ${turn.sessionId}`);
      rmSync(output, { recursive: true });
      sandbox("copy", `${id}:output`, output);
      expectFixed(
        { ...turn, stderr: `${turn.stderr}\n${log}` },
        `${sandbox("exec", id, "--", "cat", "work/notes.md")}\n`,
        output,
      );
      // The model was reached with the token, which only the egress proxy put in.
      const swapped = log
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { host: string; outcome: string; secrets?: string[] })
        .filter((entry) => entry.host === "api.anthropic.com" && entry.outcome === "allowed");
      expect(
        swapped.some((entry) => entry.secrets?.includes("CLAUDE_CODE_OAUTH_TOKEN")),
        log,
      ).toBe(true);
    } finally {
      sandbox("destroy", id);
    }
  });
}
