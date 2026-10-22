// A merged pull request for "taskcapture capture": its commits in the Git repository in $INPUT, which capture reads
// with "--git .", and the answer of GitHub's REST API for it, as a fakes.http route.
import type { CliResult, FakeHttp, HttpRoute } from "@opensoftware/testkit";

export const URL = "https://github.com/acme/web/pull/7";
export const SUM_TEST = [
  'import { test } from "node:test";',
  'import assert from "node:assert";',
  'import { sum } from "../src/sum.js";',
  'test("sum adds", () => assert.equal(sum(2, 3), 5));',
  "",
].join("\n");

/** A Node repository whose sum subtracts. */
export const NODE_REPOSITORY: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "web", type: "module", scripts: { test: "node --test" } })}\n`,
  "src/sum.js": "export const sum = (a, b) => a - b;\n",
};
/** The pull request that fixes it and adds its test. */
export const SUM_FIX: Record<string, string> = {
  "src/sum.js": "export const sum = (a, b) => a + b;\n",
  "test/sum.test.js": SUM_TEST,
};

export interface Pull {
  /** The files of the repository before the pull request. */
  base?: Record<string, string>;
  /** The files the pull request adds or changes. */
  change?: Record<string, string>;
  /** The files the pull request deletes. */
  deletes?: string[];
  title?: string;
  body?: string;
  merged?: boolean;
}

interface Sut {
  files: { put(path: string, content: string): Promise<void>; remove(path: string): Promise<void> };
  git: { commit(message: string): Promise<string> };
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
}

/** Commits the repository and then the pull request in $INPUT; returns the API route and both commits. */
export async function commitPull(sut: Sut, pull: Pull): Promise<{ route: HttpRoute; parent: string; merge: string }> {
  for (const [path, content] of Object.entries(pull.base ?? NODE_REPOSITORY))
    await sut.files.put(`$INPUT/${path}`, content);
  const parent = await sut.git.commit("the repository before the pull request");
  for (const [path, content] of Object.entries(pull.change ?? SUM_FIX)) await sut.files.put(`$INPUT/${path}`, content);
  for (const path of pull.deletes ?? []) await sut.files.remove(`$INPUT/${path}`);
  const merge = await sut.git.commit(pull.title ?? "Fix the sum");
  const merged = pull.merged ?? true;
  return {
    parent,
    merge,
    route: {
      path: "/repos/acme/web/pulls/7",
      body: {
        number: 7,
        html_url: URL,
        title: pull.title ?? "Fix the sum",
        body: pull.body ?? null,
        state: merged ? "closed" : "open",
        merged,
        merge_commit_sha: merged ? merge : null,
        base: { ref: "main", sha: parent },
      },
    },
  };
}

/** Runs "taskcapture capture --git . <options> <URL>" with TASKCAPTURE_FORGE_URL set to the GitHub API. */
export const capture = (sut: Sut, github: FakeHttp, options: string[] = [], env: Record<string, string> = {}) =>
  sut.cli(["capture", "--git", ".", ...options, URL], { env: { TASKCAPTURE_FORGE_URL: github.url, ...env } });

/** A run record the way runlog writes it: one OTLP/JSON trace export request with the run's invoke_agent span. */
export function runRecord(run: { id: string; pulls: string[]; harness?: string; model?: string; costUsd?: number }) {
  const str = (key: string, value: string) => ({ key, value: { stringValue: value } });
  const attributes = [
    str("gen_ai.operation.name", "invoke_agent"),
    ...(run.model ? [str("gen_ai.request.model", run.model)] : []),
    str("osf.outcome", "success"),
    ...(run.costUsd === undefined ? [] : [{ key: "osf.cost.usd", value: { doubleValue: run.costUsd } }]),
    {
      key: "osf.pull_request.urls",
      value: { arrayValue: { values: run.pulls.map((url) => ({ stringValue: url })) } },
    },
  ];
  return `${JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            str("service.name", run.harness ?? "claude-code"),
            str("osf.run.id", run.id),
            str("osf.harness.name", run.harness ?? "claude-code"),
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@opensoftware/runlog" },
            spans: [
              {
                traceId: "8022d8386bae87fe7cbf27194d9c035e",
                spanId: "cb2484d6144089e2",
                name: "invoke_agent",
                kind: 1,
                startTimeUnixNano: "1767225600000000000",
                endTimeUnixNano: "1767229200000000000",
                attributes,
              },
            ],
          },
        ],
      },
    ],
  })}\n`;
}

/** The lines of one [section] of a task.toml. */
export const section = (toml: string, name: string): string[] => {
  const start = toml.indexOf(`[${name}]`);
  const end = toml.indexOf("\n[", start + 1);
  return toml.slice(start, end < 0 ? undefined : end).split("\n");
};
