// What the system tests of this adapter share: the test template, specs, and sandboxes that are destroyed when
// the scenario ends. Each helper only calls the adapter's CLI through sut.
import type { ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];

/** An image with a shell and curl, pinned by digest. */
export const TEMPLATE =
  "curlimages/curl:8.17.0@sha256:935d9100e9ba842cdb060de42472c7ca90cfe9a7c96e4dacb55e79e560b3ff40";

/** A host that does not exist; the egress proxy refuses it before any lookup. */
export const OUTSIDE = "api.example.invalid";

export interface Sandboxes {
  /** Writes the spec to $INPUT/spec.json and runs create with it. */
  run(spec: Record<string, unknown>): ReturnType<Sut["cli"]>;
  /** Writes the spec to $INPUT/spec.json, creates the sandbox and gives its ID. */
  create(spec: Record<string, unknown>): Promise<string>;
  /** Runs `sh -c <script>` in the sandbox. */
  sh(id: string, script: string): Promise<Awaited<ReturnType<Sut["cli"]>>>;
  /** The egress log of the sandbox, parsed. */
  egressLog(id: string): Promise<Record<string, unknown>[]>;
  /** Destroys every sandbox this scenario created. */
  destroyAll(): Promise<void>;
}

export function sandboxes(sut: Sut, env: Record<string, string> = {}): Sandboxes {
  const created: string[] = [];
  return {
    async run(spec) {
      await sut.files.put("$INPUT/spec.json", JSON.stringify(spec));
      return sut.cli(["create", "spec.json"], { env });
    },
    async create(spec) {
      await sut.files.put("$INPUT/spec.json", JSON.stringify(spec));
      const run = await sut.cli(["create", "spec.json"], { env });
      if (run.exitCode !== 0) throw new Error(`create exited with ${run.exitCode}: ${run.stderr}`);
      const id = run.stdout.trim();
      created.push(id);
      return id;
    },
    sh: (id, script) => sut.cli(["exec", id, "--", "sh", "-c", script], { env }),
    async egressLog(id) {
      const run = await sut.cli(["egress-log", id], { env });
      return run.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
    async destroyAll() {
      for (const id of created) await sut.cli(["destroy", id], { env });
    },
  };
}

/** An MCP `tools/call` of the tool, sent with curl to the URL; prints the answer. */
export function mcpCall(url: string, tool: string): string {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: {} } });
  return [
    "curl -sS -o - -w ' %{http_code}'",
    "-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'",
    `-d '${body}' ${url}`,
  ].join(" ");
}

/** An MCP server's answer to any call, for fakes.http. */
export const MCP_RESULT = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "found" }] } };
