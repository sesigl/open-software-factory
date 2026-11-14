// The deep checks of `console doctor --deep` (ADR 0120): one model call per route through the gateway, the
// harness's answer to ACP `initialize`, one span from the collector to the trace store, and a sandbox adapter's probe. Each costs, starts or
// writes something, so only `--deep` runs them.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

/** The status of one chat completion of one token with this model, or 0 when the gateway does not answer. */
export async function callRoute(url: string, token: string | undefined, model: string): Promise<number> {
  try {
    const answer = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      signal: AbortSignal.timeout(30_000),
    });
    return answer.status;
  } catch {
    return 0;
  }
}

/**
 * Starts the harness with `sh -c` and sends ACP `initialize`: true when its first line is a result. A harness that
 * ends first, answers an error or takes more than 10 seconds gives false.
 */
export function initializeHarness(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", command], { stdio: ["pipe", "pipe", "ignore"], timeout: 10_000 });
    const done = (ok: boolean) => {
      child.kill();
      resolve(ok);
    };
    createInterface({ input: child.stdout }).once("line", (line) => done("result" in JSON.parse(line)));
    child.on("close", () => done(false));
    // Stryker disable next-line ArrowFunction: a harness that ends before it reads the request breaks the pipe
    child.stdin.on("error", () => undefined);
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: 1, clientCapabilities: {} } })}\n`,
    );
  });
}

/**
 * Sends one span "console doctor" of the service "console" by OTLP/HTTP JSON to the collector, then asks Jaeger's
 * query API for its trace every 250 ms for 5 s: "sent" false when the collector does not take it, "found" whether
 * the trace store has it.
 */
export async function traceRoundTrip(otlpUrl: string, tracesUrl: string): Promise<{ sent: boolean; found: boolean }> {
  const traceId = randomBytes(16).toString("hex");
  const now = BigInt(Date.now()) * 1_000_000n;
  const span = {
    traceId,
    spanId: randomBytes(8).toString("hex"),
    name: "console doctor",
    kind: 1,
    startTimeUnixNano: String(now),
    endTimeUnixNano: String(now + 1_000_000n),
  };
  const resource = { attributes: [{ key: "service.name", value: { stringValue: "console" } }] };
  const sent = await fetch(`${otlpUrl}/v1/traces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resourceSpans: [{ resource, scopeSpans: [{ spans: [span] }] }] }),
    signal: AbortSignal.timeout(10_000),
  }).then(
    (answer) => answer.ok,
    () => false,
  );
  if (!sent) return { sent, found: false };
  const deadline = Date.now() + 5_000;
  do {
    const answer = await fetch(`${tracesUrl}/api/traces/${traceId}`).catch(() => undefined);
    if (answer?.ok) return { sent, found: true };
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  return { sent, found: false };
}

/**
 * Runs `<command> probe <template> <host>` of a sandbox adapter with `sh -c` (ports/sandbox), which starts a sandbox,
 * sends one request to the host and removes the sandbox; gives what it printed. A cluster may take minutes to start it.
 */
export function probeSandbox(
  command: string,
  template: string,
  host: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // The template and the host are sh's $0 and $1, so no quoting of their own is needed.
    // Stryker disable next-line ObjectLiteral: a probe that never ends would take the timeout of 5 minutes to test
    const child = spawn("sh", ["-c", `${command} probe "$0" "$1"`, template, host], { timeout: 300_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", () => resolve({ stdout, stderr }));
  });
}
