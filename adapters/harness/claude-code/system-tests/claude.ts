// What the tests of this adapter share: the real Claude Code behind the adapter, calling the testkit's model gateway.
import type { AcpClient, ModelGateway, Sut } from "@opensoftware/testkit";

/** The environment that points Claude Code at the gateway. The gateway takes any key; this one is no credential. */
export const envOf = (gateway: ModelGateway, extra: Record<string, string> = {}): Record<string, string> => ({
  ANTHROPIC_BASE_URL: gateway.anthropicUrl,
  ANTHROPIC_API_KEY: "testkit-fake-key",
  ...extra,
});

/** Starts the adapter with Claude Code and the gateway and connects a client; `approve: false` refuses every tool call. */
export const connect = (
  sut: Sut,
  gateway: ModelGateway,
  options: { allow?: string; env?: Record<string, string>; approve?: boolean } = {},
): Promise<AcpClient> =>
  sut.acp.connect(["run", ...(options.allow ? ["--allow", options.allow] : [])], {
    env: envOf(gateway, options.env),
    approve: options.approve,
  });

interface Call {
  model?: string;
  messages?: { role: string; content: unknown }[];
}

/** The Messages API calls the gateway received, parsed. */
export const messagesCalls = (gateway: ModelGateway): Call[] =>
  gateway.calls.filter((call) => call.path.startsWith("/v1/messages")).map((call) => JSON.parse(call.body) as Call);

/** The result Claude Code sent back to the model for the tool call with this ID, from the gateway's calls. */
export function toolResult(
  gateway: ModelGateway,
  toolUseId: string,
): { is_error?: boolean; content?: unknown } | undefined {
  for (const call of messagesCalls(gateway).reverse()) {
    for (const message of call.messages ?? []) {
      if (!Array.isArray(message.content)) continue;
      const found = message.content.find(
        (block: { type?: string; tool_use_id?: string }) =>
          block.type === "tool_result" && block.tool_use_id === toolUseId,
      );
      if (found) return found;
    }
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
