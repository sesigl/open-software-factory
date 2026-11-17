// The client of the fakes.modelGateway scenarios: they call the fake in the test's process (ADR 0039), and a module
// would call the model APIs the same way, with the base URLs the gateway gives.
import type { ModelGateway } from "@opensoftware/testkit";

/** Posts a chat completions call with one user message and the extra headers, without streaming. */
export function chat(gateway: ModelGateway, content: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${gateway.url}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ model: "demo", messages: [{ role: "user", content }] }),
  });
}

/** Posts a Messages API call with one user message; `extra` adds fields to the body, and `signal` gives up. */
export function messages(
  gateway: ModelGateway,
  content: string,
  extra: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${gateway.anthropicUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "demo", max_tokens: 100, messages: [{ role: "user", content }], ...extra }),
    signal,
  });
}

/** Posts a streamed call to the OpenAI-compatible API below the gateway's URL, like `/responses`. */
export function stream(
  gateway: ModelGateway,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${gateway.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "demo", stream: true, ...body }),
    signal,
  });
}

/** The parsed JSON of an answer. */
// biome-ignore lint/suspicious/noExplicitAny: the scenarios read the answer's JSON as a module would.
export async function json(response: Response | Promise<Response>): Promise<any> {
  return (await response).json();
}

/** The data of each server-sent event of a streamed answer, without the closing `[DONE]`. */
// biome-ignore lint/suspicious/noExplicitAny: the scenarios read the events' JSON as a module would.
export async function events(response: Response): Promise<any[]> {
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)));
}
