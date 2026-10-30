// SMOKE-PAID: each first-party harness adapter fixes one typo with a real model (ADR 0077). It runs only through
// `make smoke-paid` and spends real money, so it is no system test: no scenario, no fakes, no network guard.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { client, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

// The owner's budget is 20 USD a month for the nightly runs, about 0.66 USD a night: one run may cost 0.20 USD.
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
// Claude Code's default model unless ANTHROPIC_MODEL names one. A subscription is one person's, never CI's.
const { CLAUDE_CODE_OAUTH_TOKEN: token, ANTHROPIC_MODEL: model, CI } = process.env;
if (token && CI) throw new Error("SMOKE-PAID: CLAUDE_CODE_OAUTH_TOKEN is a person's subscription; never set it in CI");
if (token) {
  harnesses.push({
    name: "claude-code",
    env: () => ({ CLAUDE_CODE_OAUTH_TOKEN: token, ...(model ? { ANTHROPIC_MODEL: model } : {}) }),
  });
}

for (const harness of harnesses) {
  test(`harness-${harness.name} fixes a typo with a real model`, async () => {
    const provider = harness.env();

    const root = mkdtempSync(join(tmpdir(), `smoke-paid-${harness.name}-`));
    const [work, output, data] = [join(root, "work"), join(root, "output"), join(root, "data")] as const;
    for (const dir of [work, output, data]) mkdirSync(dir);
    writeFileSync(join(work, "notes.md"), "helo world\n");
    execFileSync("git", ["init", "-q"], { cwd: work });
    // Only what the adapter needs: no settings, logins or keys of the machine reach it.
    const env = { PATH: process.env.PATH ?? "", HOME: root, OUTPUT: output, OSF_DATA: data, ...provider };
    const bin = join(ADAPTERS, harness.name, "dist/cli.js");

    const agent = spawn(process.execPath, [bin, "run", "--allow", "read,edit"], { cwd: work, env });
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
    let sessionId = "";
    let stopReason = "";
    try {
      await connection.agent.request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
      ({ sessionId } = await connection.agent.request("session/new", { cwd: work, mcpServers: [] }));
      const prompt = 'In notes.md, change the word "helo" to "hello". Change nothing else and run no command.';
      ({ stopReason } = await connection.agent.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: prompt }],
      }));
    } finally {
      connection.close();
      agent.kill();
    }

    // The transcript shows what the harness and the model did, so a failed run explains itself.
    execFileSync(process.execPath, [bin, "transcript", sessionId], { cwd: work, env });
    const transcript = readFileSync(join(output, "transcript.jsonl"), "utf8");
    expect(stopReason, `${stderr}\n${transcript}`).toBe("end_turn");
    expect(readFileSync(join(work, "notes.md"), "utf8"), transcript).toBe("hello world\n");

    const { span } = JSON.parse(readFileSync(join(output, "run-record.json"), "utf8"));
    expect(span["osf.outcome"]).toBe("succeeded");
    expect(span["gen_ai.usage.output_tokens"]).toBeGreaterThan(0);
    // Not every harness reports a cost; the credit limit of the key is the hard limit.
    if (span["osf.cost.usd"] !== undefined) expect(span["osf.cost.usd"]).toBeLessThanOrEqual(MAX_USD_PER_RUN);
  });
}
