// A real Forgejo in a container (ADR 0016), with an admin user, an API token and the few calls a test needs. Its
// webhooks reach a fake for containers at host.docker.internal (ADR 0057).
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

export interface OpenedPullRequest {
  number: number;
  title: string;
  body: string;
  /** The branch the pull request merges from. */
  head: string;
  /** The branch it merges into. */
  base: string;
  state: "open" | "closed";
  url: string;
}

export interface Forge {
  /**
   * Base URL of the forge: Forgejo's, for example `${url}/api/v1/version`, or for `fakes.github` the API's base, for
   * example `${url}/repos/tester/web`.
   */
  url: string;
  /** API token of the user `owner`; send it as `Authorization: token <token>` (GitHub also takes `Bearer <token>`). */
  token: string;
  owner: string;
  /** Every pull request of the repository, open and closed, newest first. */
  pullRequests(repository: string): Promise<OpenedPullRequest[]>;
  /** The text of a file on a branch or at a commit, or undefined when it has no such file. */
  file(repository: string, path: string, ref: string): Promise<string | undefined>;
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
  /** Commits the files on a new branch from `main` (or `from`) and returns the branch's head commit. */
  createBranch(
    repository: string,
    change: { branch: string; files: Record<string, string>; from?: string },
  ): Promise<string>;
  /** The repository's branches with their head commits, sorted by name. */
  branches(repository: string): Promise<{ name: string; sha: string }[]>;
  /** The repository's webhooks with their URL, their events sorted, and whether they are active. */
  hooks(repository: string): Promise<{ url: string; events: string[]; active: boolean }[]>;
  /**
   * Reviews the pull request as the person `reviewer`, a second user who may write to the repository:
   * `APPROVED`, `REQUEST_CHANGES` or `COMMENT`.
   */
  review(pr: PullRequest, state: "APPROVED" | "REQUEST_CHANGES" | "COMMENT", body?: string): Promise<void>;
  /** Comments on the pull request's conversation as the person `reviewer`, like a person who writes there. */
  say(pr: PullRequest, text: string): Promise<{ id: number; user: string; body: string }>;
}

const OWNER = "tester";
const REVIEWER = "reviewer";

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
        // Webhooks may reach the test's fakes on the Docker host, which Forgejo blocks by default as a private address.
        FORGEJO__webhook__ALLOWED_HOST_LIST: "*",
      })
      .withExtraHosts([{ host: "host.docker.internal", ipAddress: "host-gateway" }])
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp("/api/healthz", 3000))
      .start(),
  );
  const url = `http://${address(container, 3000)}`;
  /** Creates a user with the forge's password and gives its API token. */
  const user = async (name: string, admin: boolean): Promise<string> => {
    const created = await container.exec(
      [
        "forgejo",
        "admin",
        "user",
        "create",
        ...(admin ? ["--admin"] : []),
        "--username",
        name,
        "--password",
        password,
        "--email",
        `${name}@example.invalid`,
        "--must-change-password=false",
      ],
      { user: "git" },
    );
    if (created.exitCode !== 0) throw new Error(`fakes.forge could not create the user ${name}: ${created.output}`);
    const basic = `Basic ${Buffer.from(`${name}:${password}`).toString("base64")}`;
    const issued = await call<{ sha1: string }>(url, basic, "POST", `/users/${name}/tokens`, {
      name: "testkit",
      scopes: ["write:repository", "write:issue", "write:user"],
    });
    return issued.sha1;
  };
  const token = await user(OWNER, true);
  const auth = `token ${token}`;
  const api = <T>(method: string, path: string, body?: unknown): Promise<T> => call<T>(url, auth, method, path, body);
  let reviewerAuth: string | undefined;
  /** The person "reviewer", who may write to the pull request's repository: the authorization of their token. */
  const reviewer = async (pr: PullRequest): Promise<string> => {
    reviewerAuth ??= `token ${await user(REVIEWER, false)}`;
    await api("PUT", `/repos/${OWNER}/${pr.repository}/collaborators/${REVIEWER}`, { permission: "write" });
    return reviewerAuth;
  };

  return {
    url,
    token,
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
    async createBranch(repository, change) {
      await commit(api, repository, change.branch, change.from ?? "main", `change ${change.branch}`, change.files);
      return (await api<{ commit: { id: string } }>("GET", `/repos/${OWNER}/${repository}/branches/${change.branch}`))
        .commit.id;
    },
    async branches(repository) {
      const list = await api<{ name: string; commit: { id: string } }[]>(
        "GET",
        `/repos/${OWNER}/${repository}/branches`,
      );
      return list
        .map((branch) => ({ name: branch.name, sha: branch.commit.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async hooks(repository) {
      const list = await api<{ config: { url: string }; events: string[]; active: boolean }[]>(
        "GET",
        `/repos/${OWNER}/${repository}/hooks`,
      );
      return list.map((hook) => ({ url: hook.config.url, events: [...hook.events].sort(), active: hook.active }));
    },
    async review(pr, state, body = "") {
      await call(url, await reviewer(pr), "POST", `/repos/${OWNER}/${pr.repository}/pulls/${pr.number}/reviews`, {
        event: state,
        body,
      });
    },
    async say(pr, text) {
      const path = `/repos/${OWNER}/${pr.repository}/issues/${pr.number}/comments`;
      const posted = await call<{ id: number }>(url, await reviewer(pr), "POST", path, { body: text });
      return { id: posted.id, user: REVIEWER, body: text };
    },
    async pullRequests(repository) {
      const list = await api<PullJson[]>("GET", `/repos/${OWNER}/${repository}/pulls?state=all`);
      return list.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        head: pr.head.ref,
        base: pr.base.ref,
        state: pr.state,
        url: pr.html_url,
      }));
    },
    async file(repository, path, ref) {
      const answer = await fetch(
        `${url}/api/v1/repos/${OWNER}/${repository}/raw/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
        { headers: { authorization: auth } },
      );
      if (answer.status === 404) return undefined;
      if (!answer.ok) throw new Error(`fakes.forge: reading ${path} at ${ref} returned ${answer.status}`);
      return answer.text();
    },
  };
}

/** The fields of Forgejo's pull request JSON that `pullRequests` gives. */
interface PullJson {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  html_url: string;
  head: { ref: string };
  base: { ref: string };
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
