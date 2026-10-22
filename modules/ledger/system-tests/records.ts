// Builders for the files the ledger tests put into $INPUT: LiteLLM spend rows, OTLP/JSON runs and CloudEvents. They
// only build JSON lines; the tests put them into place through sut.files.

/** A fixed hex ID of a text: its bytes as hex, padded with zeros or cut to `length` digits. */
const hexOf = (text: string, length: number): string =>
  Buffer.from(text).toString("hex").padEnd(length, "0").slice(0, length);

const text = (key: string, value: string) => ({ key, value: { stringValue: value } });

/** One spend log row as LiteLLM's GET /spend/logs returns it; `run` goes into spend_logs_metadata. */
export function spendRow(id: string, usd: number, options: { run?: string; at?: string; model?: string } = {}) {
  return {
    request_id: id,
    call_type: "acompletion",
    spend: usd,
    total_tokens: 1200,
    prompt_tokens: 1000,
    completion_tokens: 200,
    startTime: options.at ?? "2026-01-05T10:00:00.000000+00:00",
    endTime: options.at ?? "2026-01-05T10:00:00.000000+00:00",
    model: options.model ?? "claude-sonnet-5-5",
    user: "",
    metadata: { spend_logs_metadata: options.run ? { "osf.run.id": options.run } : null },
  };
}

export interface RunOptions {
  start?: string;
  hours?: number;
  cost?: number;
  workItem?: string;
  source?: string;
  requester?: string;
  agent?: string;
  harness?: string;
  model?: string;
  pullRequests?: string[];
  /** The token usage of the run's invoke_agent span; input includes the cached tokens. */
  usage?: { input: number; output?: number; cacheRead?: number; cacheWrite?: number };
  /** The trace and span this run's invoke_agent span lies below: a run started by another run. */
  parent?: { run: string; span: string };
}

export const traceIdOf = (run: string): string => hexOf(run, 32);
export const spanIdOf = (run: string, index = 0): string => hexOf(`${run}:${index}`, 16);
const nanos = (time: string) => String(BigInt(Date.parse(time)) * 1_000_000n);

/** One run as runlog writes it: an invoke_agent span and one tool span below it, on one line. */
export function runLine(run: string, options: RunOptions = {}): string {
  return JSON.stringify(runRequest(run, options));
}

export function runRequest(run: string, options: RunOptions = {}) {
  const start = options.start ?? "2026-01-05T09:00:00Z";
  const end = new Date(Date.parse(start) + (options.hours ?? 1) * 3_600_000).toISOString();
  const traceId = traceIdOf(options.parent?.run ?? run);
  const attributes: unknown[] = [
    text("gen_ai.operation.name", "invoke_agent"),
    text("gen_ai.request.model", options.model ?? "claude-sonnet-5-5"),
    text("osf.outcome", "succeeded"),
  ];
  if (options.agent) attributes.push(text("gen_ai.agent.name", options.agent));
  if (options.cost !== undefined) attributes.push({ key: "osf.cost.usd", value: { doubleValue: options.cost } });
  const tokens = (key: string, value: number | undefined) =>
    value === undefined ? [] : [{ key, value: { intValue: String(value) } }];
  if (options.usage)
    attributes.push(
      ...tokens("gen_ai.usage.input_tokens", options.usage.input),
      ...tokens("gen_ai.usage.output_tokens", options.usage.output),
      ...tokens("gen_ai.usage.cache_read.input_tokens", options.usage.cacheRead),
      ...tokens("gen_ai.usage.cache_write.input_tokens", options.usage.cacheWrite),
    );
  if (options.pullRequests)
    attributes.push({
      key: "osf.pull_request.urls",
      value: { arrayValue: { values: options.pullRequests.map((url) => ({ stringValue: url })) } },
    });
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            text("service.name", options.harness ?? "claude-code"),
            text("osf.run.id", run),
            text("osf.work_item.id", options.workItem ?? `work-${run}`),
            text("osf.source", options.source ?? "cli"),
            text("osf.requester.kind", "person"),
            text("osf.requester.id", options.requester ?? "github:mona"),
            text("osf.harness.name", options.harness ?? "claude-code"),
            text("osf.factory.version", "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c"),
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@opensoftware/runlog" },
            spans: [
              {
                traceId,
                spanId: spanIdOf(run),
                ...(options.parent ? { parentSpanId: options.parent.span } : {}),
                name: "invoke_agent",
                startTimeUnixNano: nanos(start),
                endTimeUnixNano: nanos(end),
                attributes,
              },
              {
                traceId,
                spanId: spanIdOf(run, 1),
                parentSpanId: spanIdOf(run),
                name: "execute_tool Bash",
                startTimeUnixNano: nanos(start),
                endTimeUnixNano: nanos(start),
                attributes: [text("gen_ai.operation.name", "execute_tool"), text("gen_ai.tool.name", "Bash")],
              },
            ],
          },
        ],
      },
    ],
  };
}

let sequence = 0;
const event = (type: string, time: string, data: unknown) => ({
  specversion: "1.0",
  id: `evt-${String(++sequence).padStart(6, "0")}`,
  source: "/osf/forge",
  type,
  time,
  datacontenttype: "application/json",
  data,
});

export const prUrl = (number: number) => `https://github.com/acme/web/pull/${number}`;

export function opened(number: number, options: { at?: string; title?: string; workItem?: string; run?: string } = {}) {
  return event("pr.opened@v1", options.at ?? "2026-01-05T09:00:00Z", {
    url: prUrl(number),
    repository: "https://github.com/acme/web",
    number,
    title: options.title ?? `Change ${number}`,
    headBranch: `factory/change-${number}`,
    baseBranch: "main",
    headCommit: "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c",
    author: { kind: "person", id: "github:mona" },
    ...(options.workItem ? { workItemId: options.workItem } : {}),
    ...(options.run ? { runId: options.run } : {}),
  });
}

export function reviewed(number: number, at: string, options: { bot?: boolean; state?: string } = {}) {
  return event("pr.reviewed@v1", at, {
    url: prUrl(number),
    reviewer: options.bot ? { kind: "trigger", id: "github:copilot" } : { kind: "person", id: "github:hubot" },
    automated: options.bot ?? false,
    state: options.state ?? "approved",
  });
}

export function closed(number: number, at: string, merged = true) {
  return event("pr.closed@v1", at, { url: prUrl(number), merged });
}

export function received(workItem: string, at: string) {
  return event("work.received@v1", at, {
    id: workItem,
    type: "task",
    title: `Work ${workItem}`,
    requester: { kind: "person", id: "github:mona" },
    origin: { source: "github", url: "https://github.com/acme/web/issues/1" },
    dedupeKey: `github:acme/web#${workItem}`,
  });
}

/** JSON Lines of the given objects and ready lines. */
export const lines = (...items: unknown[]): string =>
  `${items.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n")}\n`;

/** The report the scenario's command wrote. */
// biome-ignore lint/suspicious/noExplicitAny: the report is read as JSON
export async function readReport(sut: { files: { read(path: string): Promise<string> } }): Promise<any> {
  return JSON.parse(await sut.files.read("$OUTPUT/report.json"));
}

/** The data of "326 pull requests opened in the period and spend rows of 5351.38 USD in total". */
export const busyWeek = (): string =>
  lines(
    ...Array.from({ length: 326 }, (_, index) => opened(index + 1)),
    spendRow("req-1", 5000),
    spendRow("req-2", 351.38),
  );

/** A LiteLLM price table (model_prices_and_context_window.json) with the given entries. */
export const pricesFile = (entries: Record<string, Record<string, unknown>>): string =>
  `${JSON.stringify({ sample_spec: { input_cost_per_token: 0, litellm_provider: "openai" }, ...entries }, null, 2)}\n`;

/** The prices of "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token. */
export const sonnetPrices = (extra: Record<string, unknown> = {}): string =>
  pricesFile({
    "claude-sonnet-5-5": {
      input_cost_per_token: 0.000003,
      output_cost_per_token: 0.000015,
      litellm_provider: "anthropic",
      ...extra,
    },
  });

/** The text a reader of the page "ledger.html" sees: no tags, entities decoded, white space collapsed. */
export async function pageText(sut: { files: { read(path: string): Promise<string> } }): Promise<string> {
  const html = await sut.files.read("$INPUT/ledger.html");
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}
