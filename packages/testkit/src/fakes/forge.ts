// A real Forgejo in a container (ADR 0016), with an admin user, an API token and the few calls a test needs.
import { randomUUID } from "node:crypto";
import { GenericContainer, Wait } from "testcontainers";
import { address, IMAGES, type Track } from "./services.ts";

export interface PullRequest {
  repository: string;
  number: number;
  url: string;
  /** The head commit of the pull request. */
  sha: string;
}

export interface Forge {
  /** Base URL of the forge, for example `${url}/api/v1/version`. */
  url: string;
  /** API token of the user `owner`; send it as `Authorization: token <token>`. */
  token: string;
  owner: string;
  /** Creates a repository of `owner` with one commit on `main` that holds these files. */
  createRepository(name: string, files?: Record<string, string>): Promise<void>;
  /** Commits the files on a new branch and opens a pull request from it into `main`. */
  openPullRequest(
    repository: string,
    change: { branch: string; title: string; files: Record<string, string> },
  ): Promise<PullRequest>;
  /** Merges the pull request into `main` with a merge commit and returns that commit. */
  mergePullRequest(pr: PullRequest): Promise<string>;
  /** The bodies of the pull request's comments, oldest first. */
  comments(pr: PullRequest): Promise<string[]>;
  /** The commit statuses of the pull request's head commit. */
  statuses(pr: PullRequest): Promise<{ context: string; state: string; description: string }[]>;
}

const OWNER = "tester";

export async function startForge(track: Track): Promise<Forge> {
  // A fresh password per forge: it lives only as long as the container.
  const password = randomUUID();
  const container = track(
    await new GenericContainer(IMAGES.forge)
      .withEnvironment({
        FORGEJO__security__INSTALL_LOCK: "true",
        FORGEJO__database__DB_TYPE: "sqlite3",
        FORGEJO__repository__DEFAULT_BRANCH: "main",
        FORGEJO__service__DISABLE_REGISTRATION: "true",
      })
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp("/api/healthz", 3000))
      .start(),
  );
  const created = await container.exec(
    [
      "forgejo",
      "admin",
      "user",
      "create",
      "--admin",
      "--username",
      OWNER,
      "--password",
      password,
      "--email",
      "tester@example.invalid",
      "--must-change-password=false",
    ],
    { user: "git" },
  );
  if (created.exitCode !== 0) throw new Error(`fakes.forge could not create its user: ${created.output}`);

  const url = `http://${address(container, 3000)}`;
  const basic = `Basic ${Buffer.from(`${OWNER}:${password}`).toString("base64")}`;
  const issued = await call<{ sha1: string }>(url, basic, "POST", `/users/${OWNER}/tokens`, {
    name: "testkit",
    scopes: ["write:repository", "write:issue", "write:user"],
  });
  const auth = `token ${issued.sha1}`;
  const api = <T>(method: string, path: string, body?: unknown): Promise<T> => call<T>(url, auth, method, path, body);

  return {
    url,
    token: issued.sha1,
    owner: OWNER,
    async createRepository(name, files = {}) {
      await api("POST", "/user/repos", { name, auto_init: true, default_branch: "main", private: false });
      if (Object.keys(files).length > 0) await commit(api, name, "main", undefined, "initial files", files);
    },
    async openPullRequest(repository, change) {
      await commit(api, repository, change.branch, "main", change.title, change.files);
      const pr = await api<{ number: number; html_url: string; head: { sha: string } }>(
        "POST",
        `/repos/${OWNER}/${repository}/pulls`,
        { base: "main", head: change.branch, title: change.title },
      );
      return { repository, number: pr.number, url: pr.html_url, sha: pr.head.sha };
    },
    async mergePullRequest(pr) {
      const path = `/repos/${OWNER}/${pr.repository}/pulls/${pr.number}`;
      // Forgejo checks whether a new pull request can merge in the background and answers 405 until it knows.
      for (let attempt = 1; ; attempt++) {
        const answer = await fetch(`${url}/api/v1${path}/merge`, {
          method: "POST",
          headers: { authorization: auth, "content-type": "application/json" },
          body: JSON.stringify({ Do: "merge" }),
        });
        if (answer.ok) break;
        if (answer.status !== 405 || attempt === 50)
          throw new Error(`fakes.forge: POST ${path}/merge returned ${answer.status}: ${await answer.text()}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return (await api<{ merge_commit_sha: string }>("GET", path)).merge_commit_sha;
    },
    async comments(pr) {
      const list = await api<{ body: string }[]>(
        "GET",
        `/repos/${OWNER}/${pr.repository}/issues/${pr.number}/comments`,
      );
      return list.map((comment) => comment.body);
    },
    async statuses(pr) {
      const list = await api<{ context: string; status: string; description: string }[]>(
        "GET",
        `/repos/${OWNER}/${pr.repository}/commits/${pr.sha}/statuses`,
      );
      return list.map(({ context, status, description }) => ({ context, state: status, description }));
    },
  };
}

type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

/** One commit with these files on `branch`; `from` creates the branch from another one. */
async function commit(
  api: Api,
  repository: string,
  branch: string,
  from: string | undefined,
  message: string,
  files: Record<string, string>,
): Promise<void> {
  await api("POST", `/repos/${OWNER}/${repository}/contents`, {
    branch: from ?? branch,
    ...(from ? { new_branch: branch } : {}),
    message,
    files: Object.entries(files).map(([path, content]) => ({
      operation: "create",
      path,
      content: Buffer.from(content).toString("base64"),
    })),
  });
}

async function call<T>(url: string, auth: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${url}/api/v1${path}`, {
    method,
    headers: { authorization: auth, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`fakes.forge: ${method} ${path} returned ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}
