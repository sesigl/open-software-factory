// SMOKE-PAID: each first-party harness adapter fixes one typo with a real model (ADR 0077). It runs only through
// `make smoke-paid`, nightly, and spends real money, so it is no system test: no scenario, no fakes, no network guard.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { client, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

// The owner's budget is 20 USD a month for all three adapters, about 0.66 USD a night: one run may cost 0.20 USD.
const MAX_USD_PER_RUN = 0.2;
const ADAPTERS = resolve(import.meta.dirname, "../../adapters/harness");

// Each adapter gets its provider's key and model from the environment of `make smoke-paid`.
const harnesses = [
  { name: "claude-code", env: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"] },
  { name: "codex", env: ["OPENAI_API_KEY", "OPENAI_MODEL"] },
  { name: "opencode", env: ["OPENAI_API_KEY", "OPENAI_MODEL"] },
];

for (const harness of harnesses) {
  test(`harness-${harness.name} fixes a typo with a real model`, async () => {
    const provider: Record<string, string> = {};
    for (const name of harness.env) {
      const value = process.env[name];
      if (!value) throw new Error(`SMOKE-PAID: set ${name}`);
      provider[name] = value;
    }

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
    try {
      await connection.agent.request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
      ({ sessionId } = await connection.agent.request("session/new", { cwd: work, mcpServers: [] }));
      const prompt = 'In notes.md, change the word "helo" to "hello". Change nothing else and run no command.';
      const { stopReason } = await connection.agent.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: prompt }],
      });
      expect(stopReason, stderr).toBe("end_turn");
    } finally {
      connection.close();
      agent.kill();
    }

    expect(readFileSync(join(work, "notes.md"), "utf8")).toBe("hello world\n");

    execFileSync(process.execPath, [bin, "transcript", sessionId], { cwd: work, env });
    const { span } = JSON.parse(readFileSync(join(output, "run-record.json"), "utf8"));
    expect(span["osf.outcome"]).toBe("succeeded");
    expect(span["gen_ai.usage.output_tokens"]).toBeGreaterThan(0);
    // Not every harness reports a cost; the spend limit on each provider key is the hard limit.
    if (span["osf.cost.usd"] !== undefined) expect(span["osf.cost.usd"]).toBeLessThanOrEqual(MAX_USD_PER_RUN);
  });
}
