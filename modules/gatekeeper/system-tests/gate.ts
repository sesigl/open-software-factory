// Shared setup of the gatekeeper scenarios: the README's files, fake Slack, and a scripted forge API.
import type { FakeHttp, Fakes, Sut } from "@opensoftware/testkit";

/** The fenced blocks of the README's Quick start that name a file, like ```json groups.json. */
export function readmeFiles(fakes: Fakes): Record<string, string> {
  const readme = fakes.fromRepository("modules/gatekeeper")["README.md"] as string;
  const files: Record<string, string> = {};
  for (const block of readme.matchAll(/^```\w+ (\S+)\n([\s\S]*?)^```$/gm))
    files[block[1] as string] = block[2] as string;
  return files;
}

export async function putReadme(sut: Sut, fakes: Fakes, change: Record<string, string> = {}): Promise<void> {
  for (const [file, text] of Object.entries({ ...readmeFiles(fakes), ...change }))
    await sut.files.put(`$INPUT/${file}`, text);
}

export const GATE = [
  "--policy",
  "policy.rego",
  "--groups",
  "groups.json",
  "--channel",
  "slack:C0GATES",
  "request.json",
];

export const request = (paths: string[]): string =>
  JSON.stringify({
    workItem: "https://github.com/acme/web/pull/6",
    stage: "merge",
    summary: "Merge it",
    change: { paths },
  });

export async function slackEnv(fakes: Fakes) {
  const slack = await fakes.slack();
  return { slack, env: { GATEKEEPER_SLACK_URL: slack.url, GATEKEEPER_SLACK_TOKEN: slack.token } };
}

/** The README's request, asked in C0GATES; returns the fake Slack, the environment and the request message. */
export async function requested(sut: Sut, fakes: Fakes, env: Record<string, string> = {}) {
  const { slack, env: slackVars } = await slackEnv(fakes);
  await putReadme(sut, fakes);
  const run = await sut.cli(["request", ...GATE], { env: { ...slackVars, ...env } });
  if (run.exitCode !== 0) throw new Error(`gatekeeper request failed: ${run.stderr}`);
  const message = slack.messages("C0GATES")[0];
  if (!message) throw new Error("gatekeeper request posted nothing");
  return { slack, env: { ...slackVars, ...env }, message };
}

/** Replies after the request in its thread, oldest first, without the request. */
export const replies = (slack: Awaited<ReturnType<Fakes["slack"]>>, request: { ts: string }) =>
  slack
    .messages("C0GATES")
    .filter((message) => message.threadTs === request.ts && message.ts !== request.ts)
    .map((message) => message.text);

// The forge: the pull request acme/web#12 on a scripted GitHub API.

export const PR = "https://github.com/acme/web/pull/12";
export const SHA = "4f2a9c7d1e3b5a6f8c0d2e4f6a8b0c1d3e5f7a9b";
export const PULL_GATE = ["--policy", "merge.rego", "--groups", "groups.json", "--pull-request", PR];

export const MERGE_POLICY = `package gatekeeper

approvers contains "maintainers" if startswith(input.change.head, "observer/")
`;

export async function putMergeFiles(sut: Sut, prefix = ""): Promise<void> {
  await sut.files.put(`$INPUT/${prefix}merge.rego`, MERGE_POLICY);
  await sut.files.put(`$INPUT/${prefix}groups.json`, JSON.stringify({ maintainers: ["github:sesigl"] }));
}

export interface Comment {
  id: number;
  body: string;
  login: string;
  at: string;
}

/**
 * A scripted GitHub API with the pull request, its comments, and room for comments and commit statuses. With
 * `before`, the first read of the comments gets those, and later reads get `comments`.
 */
export function forge(fakes: Fakes, branch: string, comments: Comment[] = [], before?: Comment[]): Promise<FakeHttp> {
  const base = "/repos/acme/web";
  const commentJson = ({ id, body, login, at }: Comment) => ({ id, body, created_at: at, user: { login } });
  return fakes.http([
    {
      path: `${base}/pulls/12`,
      body: {
        html_url: PR,
        title: "Fix the research skill",
        user: { login: "observer-bot" },
        head: { ref: branch, sha: SHA },
        base: { ref: "main" },
        labels: [],
      },
    },
    { path: `${base}/pulls/12/files?per_page=100`, body: [{ filename: "AGENTS.md" }] },
    { path: "/user", body: { login: "gatekeeper-bot" } },
    ...(before ? [{ path: `${base}/issues/12/comments?per_page=100`, body: before.map(commentJson), times: 1 }] : []),
    { path: `${base}/issues/12/comments?per_page=100`, body: comments.map(commentJson) },
    {
      method: "POST",
      path: `${base}/issues/12/comments`,
      body: commentJson({ id: 900, body: "posted", login: "gatekeeper-bot", at: "2026-01-01T00:00:00Z" }),
    },
    { method: "POST", path: `${base}/statuses/${SHA}`, body: {} },
  ]);
}

/** The body of the request comment that gatekeeper posts for the pull request from this branch. */
export async function requestComment(sut: Sut, fakes: Fakes, branch: string): Promise<string> {
  const first = await forge(fakes, branch);
  await putMergeFiles(sut, "first-");
  const run = await sut.cli(
    [
      "request",
      "--policy",
      "first-merge.rego",
      "--groups",
      "first-groups.json",
      "--pull-request",
      PR,
      "--out",
      "first.json",
    ],
    { env: { GATEKEEPER_FORGE_URL: first.url } },
  );
  const posted = first.received().find((call) => call.method === "POST" && call.path.endsWith("/comments"));
  if (run.exitCode !== 0 || !posted) throw new Error(`gatekeeper request posted no comment: ${run.stderr}`);
  return (posted.body as { body: string }).body;
}

/** The commit statuses that gatekeeper set, oldest first. */
export const statuses = (http: FakeHttp) =>
  http
    .received()
    .filter((call) => call.method === "POST" && call.path.includes("/statuses/"))
    .map((call) => call.body as { state: string; context: string; description: string });
