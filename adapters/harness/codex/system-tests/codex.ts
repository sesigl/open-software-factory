// What the tests of this adapter share: the real Codex behind the adapter, calling the testkit's model gateway on the
// Responses API.
import type { AcpClient, ModelGateway, ScriptedReply, Sut } from "@opensoftware/testkit";

/**
 * The script with the reply to Codex's title call first: after the first turn of a session Codex asks the model for
 * the session's title, with the prompt in the call.
 */
export const withTitle = (script: ScriptedReply[]): ScriptedReply[] => [
  { when: "Return exactly one JSON object", reply: '{"title":"Scripted"}' },
  ...script,
];

/** Starts the adapter with Codex and the gateway and connects a client; `approve: false` refuses every tool call. */
export const connect = (
  sut: Sut,
  gateway: ModelGateway,
  options: { allow?: string; env?: Record<string, string>; approve?: boolean } = {},
): Promise<AcpClient> =>
  sut.acp.connect(["run", ...(options.allow ? ["--allow", options.allow] : [])], {
    // The gateway takes any key; this one is no credential.
    env: { OPENAI_BASE_URL: gateway.url, OPENAI_API_KEY: "testkit-fake-key", ...options.env },
    approve: options.approve,
  });

interface Call {
  model?: string;
  input?: { type?: string; call_id?: string; output?: string; content?: unknown }[];
}

/** The Responses API calls the gateway received, parsed, without the title calls. */
export const responsesCalls = (gateway: ModelGateway): Call[] =>
  gateway.calls
    .filter((call) => call.path.startsWith("/v1/responses") && !call.body.includes("Return exactly one JSON object"))
    .map((call) => JSON.parse(call.body) as Call);

/** The output Codex sent back to the model for the tool call with this ID, from the gateway's calls. */
export function toolOutput(gateway: ModelGateway, callId: string): string | undefined {
  for (const call of responsesCalls(gateway).reverse()) {
    const found = call.input?.find((item) => item.type?.endsWith("_call_output") && item.call_id === callId);
    if (found) return found.output;
  }
  return undefined;
}

/** A patch for Codex's tool apply_patch that changes one line of a file. */
export const patch = (file: string, from: string, to: string): string =>
  `*** Begin Patch\n*** Update File: ${file}\n@@\n-${from}\n+${to}\n*** End Patch\n`;

/** Waits until `ready` holds, checking every 50 milliseconds, for at most 10 seconds. */
export async function until(ready: () => boolean): Promise<void> {
  for (let waited = 0; !ready(); waited += 50) {
    if (waited > 10_000) throw new Error("waited 10 seconds in vain");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** The lines of a transcript file. */
export async function linesOf(sut: Sut, file: string): Promise<Record<string, unknown>[]> {
  return (await sut.files.read(file))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
