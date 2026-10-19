// The scripted ACP agent that fakes.harness() starts as a process: node harness-agent.ts <script.json> <log.jsonl>.
// For each prompt it applies the edits of the first unused turn whose `when` the prompt contains, streams the reply
// and ends the turn. It logs every prompt so the testkit can show the ones nobody scripted.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { agent, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type { HarnessTurn } from "./harness.ts";

const [scriptFile, logFile] = process.argv.slice(2) as [string, string];
const script = JSON.parse(readFileSync(scriptFile, "utf8")) as HarnessTurn[];
const used = new Set<number>();
const sessions = new Map<string, string>();
let writesThroughClient = false;
const log = (entry: { prompt: string; scripted: boolean }): void =>
  appendFileSync(logFile, `${JSON.stringify(entry)}\n`);

agent({ name: "testkit-scripted-harness" })
  .onRequest("initialize", ({ params }) => {
    writesThroughClient = params.clientCapabilities?.fs?.writeTextFile === true;
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
      agentInfo: { name: "testkit-scripted-harness", version: "0.0.0" },
      authMethods: [],
    };
  })
  .onRequest("session/new", ({ params }) => {
    const sessionId = `session-${sessions.size + 1}`;
    sessions.set(sessionId, params.cwd);
    return { sessionId };
  })
  .onRequest("session/prompt", async ({ params, client }) => {
    const prompt = params.prompt.map((block) => (block.type === "text" ? block.text : "")).join("\n");
    const index = script.findIndex((turn, at) => !used.has(at) && prompt.includes(turn.when));
    log({ prompt, scripted: index >= 0 });
    const turn = script[index];
    if (!turn) return { stopReason: "refusal" };
    used.add(index);
    const cwd = sessions.get(params.sessionId) ?? process.cwd();
    for (const [path, content] of Object.entries(turn.edits ?? {})) {
      const full = isAbsolute(path) ? path : resolve(cwd, path);
      if (writesThroughClient) {
        await client.request("fs/write_text_file", { sessionId: params.sessionId, path: full, content });
      } else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
    }
    if (turn.reply) {
      await client.notify("session/update", {
        sessionId: params.sessionId,
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: turn.reply } },
      });
    }
    return { stopReason: "end_turn" };
  })
  .connect(
    ndJsonStream(
      Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
      Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
    ),
  );
