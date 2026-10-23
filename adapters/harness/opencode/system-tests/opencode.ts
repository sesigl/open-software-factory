// What the tests of this adapter share: the real opencode behind the adapter, calling the testkit's model gateway on
// the chat completions API.
import type { AcpClient, ModelGateway, Sut } from "@opensoftware/testkit";

/** Starts the adapter with opencode and the gateway and connects a client; `approve: false` refuses every tool call. */
export const connect = (
  sut: Sut,
  gateway: ModelGateway,
  options: { allow?: string; env?: Record<string, string>; approve?: boolean } = {},
): Promise<AcpClient> =>
  sut.acp.connect(["run", ...(options.allow ? ["--allow", options.allow] : [])], {
    // The gateway takes any key; this one is no credential.
    env: { OPENAI_BASE_URL: gateway.url, OPENAI_API_KEY: "testkit-fake-key", OPENAI_MODEL: "scripted", ...options.env },
    approve: options.approve,
  });

interface Call {
  model?: string;
  messages?: { role: string; content: unknown; tool_call_id?: string }[];
}

/** The chat completions calls the gateway received, parsed. */
export const chatCalls = (gateway: ModelGateway): Call[] =>
  gateway.calls
    .filter((call) => call.path.startsWith("/v1/chat/completions"))
    .map((call) => JSON.parse(call.body) as Call);

/** The result opencode sent back to the model for the tool call with this ID, from the gateway's calls. */
export function toolResult(gateway: ModelGateway, callId: string): string | undefined {
  for (const call of chatCalls(gateway).reverse()) {
    const found = call.messages?.find((message) => message.role === "tool" && message.tool_call_id === callId);
    if (found) return JSON.stringify(found.content);
  }
  return undefined;
}

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
