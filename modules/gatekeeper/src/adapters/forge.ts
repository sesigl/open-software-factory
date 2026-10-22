// A pull request on GitHub or Forgejo: the request is a comment, decisions are later comments, and the result is
// the commit status "gatekeeper" of the head commit. Both forges answer these calls alike.
import type { Channel, Message } from "../domain/gate.ts";
import type { PullJson, PullRequest } from "../domain/pull-request.ts";
import { fromIso } from "../domain/time.ts";

interface CommentJson {
  id: number;
  body: string;
  created_at: string;
  user: { login: string };
}

export type Forge = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export function forgeApi(pr: PullRequest, token: string | undefined): Forge {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  if (token) headers.authorization = `token ${token}`;
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await fetch(`${pr.api}${path}`, init);
    if (response.ok) return (await response.json()) as T;
    throw new Error(`${method} ${path}: the forge answered ${response.status}`);
  };
}

const base = (pr: PullRequest): string => `/repos/${pr.owner}/${pr.repo}`;

export async function readPull(pr: PullRequest, forge: Forge): Promise<{ pull: PullJson; paths: string[] }> {
  const pull = await forge<PullJson>("GET", `${base(pr)}/pulls/${pr.number}`);
  const files = await forge<{ filename: string }[]>("GET", `${base(pr)}/pulls/${pr.number}/files?per_page=100`);
  return { pull, paths: files.map((file) => file.filename) };
}

export async function setStatus(
  pr: PullRequest,
  forge: Forge,
  sha: string,
  state: "pending" | "success" | "failure",
  description: string,
): Promise<void> {
  await forge("POST", `${base(pr)}/statuses/${sha}`, {
    state,
    context: "gatekeeper",
    description: description.slice(0, 140),
    target_url: pr.url,
  });
}

export function pullRequestChannel(pr: PullRequest, forge: Forge): Channel {
  let login: Promise<string> | undefined;
  // A GitHub Actions token may not read /user; its comments are by github-actions[bot].
  const me = (): Promise<string> => {
    login ??= forge<{ login: string }>("GET", "/user").then(
      (user) => user.login,
      () => "github-actions[bot]",
    );
    return login;
  };
  const message = (raw: CommentJson, mine: string): Message => ({
    id: String(raw.id),
    author: `${pr.forge}:${raw.user.login}`,
    time: fromIso(raw.created_at),
    text: raw.body,
    mine: raw.user.login === mine,
  });
  const comments = async (): Promise<Message[]> => {
    const mine = await me();
    const list = await forge<CommentJson[]>("GET", `${base(pr)}/issues/${pr.number}/comments?per_page=100`);
    return list.map((raw) => message(raw, mine));
  };

  return {
    name: pr.url,
    mention: (identity) => (identity.startsWith(`${pr.forge}:`) ? `@${identity.slice(pr.forge.length + 1)}` : identity),
    howToDecide: 'Comment "/approve" or "/reject <reason>".',
    async find(marker) {
      return (await comments()).find((comment) => comment.mine && comment.text.includes(`<!-- ${marker} -->`));
    },
    async thread(request) {
      const all = await comments();
      return all.slice(all.findIndex((comment) => comment.id === request.id) + 1);
    },
    async post(text, marker) {
      const raw = await forge<CommentJson>("POST", `${base(pr)}/issues/${pr.number}/comments`, {
        body: `${text}\n\n<!-- ${marker} -->`,
      });
      return message(raw, await me());
    },
  };
}
