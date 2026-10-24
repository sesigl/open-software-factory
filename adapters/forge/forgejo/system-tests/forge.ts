// What the system tests of this adapter share: the test forge with the repository "tester/web", the adapter's CLI
// with the forge's URL and token, and a receiver for webhook deliveries. Each helper only calls the adapter's CLI
// through sut, or the testkit's fakes.
import type { Forge, ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

export const SECRET = "whsec-51c2";

export interface Setup {
  forge: Forge;
  repo: string;
  /** Runs the adapter with the forge's URL, token and the webhook secret; `env` adds or replaces variables. */
  run(args: string[], env?: Record<string, string>): ReturnType<Sut["cli"]>;
  /** Runs the adapter, expects exit code 0, and gives the JSON of its one line. */
  json(args: string[]): Promise<Record<string, unknown>>;
}

/** The test forge with the repository "tester/web", whose "main" holds "app.js". */
export async function setup(sut: Sut, fakes: Fakes): Promise<Setup> {
  const forge = await fakes.forge();
  await forge.createRepository("web", { "app.js": "export const app = 1;\n" });
  const base = { FORGE_URL: forge.url, FORGE_TOKEN: forge.token, FORGE_WEBHOOK_SECRET: SECRET };
  const run = (args: string[], env: Record<string, string> = {}) => sut.cli(args, { env: { ...base, ...env } });
  return {
    forge,
    repo: `${forge.owner}/web`,
    run,
    async json(args) {
      const result = await run(args);
      if (result.exitCode !== 0) throw new Error(`${args[0]} exited with ${result.exitCode}: ${result.stderr}`);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    },
  };
}

/** A pull request from "fix-checkout" into "main" that changes "checkout.js". */
export function openPullRequest(forge: Forge) {
  return forge.openPullRequest("web", {
    branch: "fix-checkout",
    title: "Fix checkout button on Safari",
    files: { "checkout.js": "export const fixed = true;\n" },
  });
}

/** A receiver for webhook deliveries that the test forge reaches, and the URL to register. */
export async function receiver(fakes: Fakes) {
  const api = await fakes.http([{ method: "POST", path: "/forge", body: {} }], { containers: true });
  return { api, url: `${api.containerUrl}/forge` };
}

/**
 * Waits for the delivery with the event type `type` (and `action`, when given) and writes it to $INPUT/delivery.json
 * as the receiver got it: its headers and its body's text.
 */
export async function delivery(
  sut: Sut,
  api: Awaited<ReturnType<typeof receiver>>["api"],
  type: string,
  action?: string,
): Promise<string> {
  const find = () => {
    const texts = api.texts();
    return api.headers().findIndex((request, index) => {
      const body = JSON.parse(texts[index]?.text || "{}") as { action?: string };
      return request.headers["x-forgejo-event-type"] === type && (action === undefined || body.action === action);
    });
  };
  await expect.poll(find, { timeout: 30_000, interval: 200 }).toBeGreaterThanOrEqual(0);
  const index = find();
  const headers = api.headers()[index]?.headers;
  const body = api.texts()[index]?.text;
  await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers, body }));
  return "delivery.json";
}
