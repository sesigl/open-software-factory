// What the system tests of this adapter share: the test provider, configs, and gateways that are stopped when the
// scenario ends. Each helper only calls the adapter's CLI through sut, or the gateway's API at the URL start printed.
import type { FakeHttp, HttpRoute, ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

/**
 * The test provider: an OpenAI-compatible API for containers that answers `calls` chat completions with `reply`,
 * 1000 prompt tokens and 200 completion tokens, each with its own ID, as LiteLLM keys its spend rows by it. LiteLLM may
 * also list the provider's models in the background; the list is empty.
 */
export function provider(fakes: Fakes, calls = 3, reply = "done") {
  const routes: HttpRoute[] = [{ path: "/v1/models", body: { object: "list", data: [] } }];
  for (let index = 0; index < calls; index++) {
    routes.push({
      method: "POST",
      path: "/v1/chat/completions",
      times: 1,
      body: {
        id: `chatcmpl-${index + 1}`,
        object: "chat.completion",
        created: 1_767_225_600,
        model: "provider",
        choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      },
    });
  }
  return fakes.http(routes, { containers: true });
}

/** A LiteLLM config line by line: each alias routes to a model of the API at `base` with the given extra params. */
export function config(base: string, routes: { alias: string; model: string; params?: string[] }[]): string {
  const lines = ["model_list:"];
  for (const route of routes) {
    lines.push(`  - model_name: ${route.alias}`, "    litellm_params:", `      model: openai/${route.model}`);
    lines.push(`      api_base: ${base}/v1`, ...(route.params ?? ["      api_key: unused"]));
  }
  return `${lines.join("\n")}\n`;
}

/** The chat completions calls the provider received, in order, with their bodies and headers. */
export function calls(api: FakeHttp) {
  const headers = api.headers();
  return api
    .received()
    .map((request, index) => ({ ...request, headers: headers[index]?.headers ?? {} }))
    .filter((request) => request.method === "POST");
}

/** The models of the chat completions calls the provider received, in order. */
export function models(api: FakeHttp): string[] {
  return calls(api).map((request) => (request.body as { model: string }).model);
}

export interface Gateways {
  /** Writes the config to $INPUT/config.yaml and starts a gateway from it; gives its ID and URL. */
  start(config: string, env?: Record<string, string>): Promise<{ id: string; url: string }>;
  /** A key for the run, with a budget in USD when one is given. */
  key(id: string, run: string, budget?: string): Promise<string>;
  /** Stops every gateway this scenario started. */
  stopAll(): Promise<void>;
}

export function gateways(sut: Sut): Gateways {
  const started: string[] = [];
  return {
    async start(config, env = {}) {
      await sut.files.put("$INPUT/config.yaml", config);
      const run = await sut.cli(["start", "config.yaml"], { env });
      if (run.exitCode !== 0) throw new Error(`start exited with ${run.exitCode}: ${run.stderr}`);
      const gateway = JSON.parse(run.stdout) as { id: string; url: string };
      started.push(gateway.id);
      return gateway;
    },
    async key(id, run, budget) {
      const result = await sut.cli(["key", id, run, ...(budget ? ["--budget", budget] : [])]);
      if (result.exitCode !== 0) throw new Error(`key exited with ${result.exitCode}: ${result.stderr}`);
      return result.stdout.trim();
    },
    async stopAll() {
      for (const id of started) await sut.cli(["stop", id]);
    },
  };
}

/** One chat completions call to the gateway: its status and JSON answer. */
export async function call(url: string, key: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }], ...body }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
