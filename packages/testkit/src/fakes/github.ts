// An in-process fake of the part of GitHub's REST API that a forge client calls (ADR 0058), with the same Forge
// interface as fakes.forge. It keeps repositories with their commits and files, branches, pull requests, commit
// statuses, comments, reviews, branch protection and webhooks. Webhooks deliver signed events to URLs on the local
// host. IDs, SHAs and times come from counters and the fixed clock. A call it does not know fails the scenario.
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { FIXED_DATE } from "../support/process.ts";
import type { Forge, OpenedPullRequest, PullRequest } from "./forge.ts";
import { Commits, type Files } from "./github-repository.ts";

/** A comment on a pull request's conversation, with its author. */
export interface GitHubComment {
  id: number;
  user: string;
  body: string;
}

/** fakes.github: the Forge interface, and the pull request's conversation as a chat surface (ADR 0059). */
export interface FakeGitHub extends Forge {
  /**
   * Comments on the pull request as a person, `reviewer` by default, and delivers the `issue_comment` event to the
   * webhooks, like a person who writes in the conversation.
   */
  say(pr: PullRequest, text: string, as?: string): Promise<GitHubComment>;
  /** The comments of the pull request's conversation with their authors, oldest first. */
  conversation(pr: PullRequest): Promise<GitHubComment[]>;
  /** A token like a GitHub Actions token: its user is "github-actions[bot]", and GET /user answers 403 (ADR 0061). */
  actionsToken: string;
}

export interface RunningGitHub {
  github: FakeGitHub;
  close(): Promise<string[]>;
}

const OWNER = "tester";
const REVIEWER = "reviewer";
const ACTIONS = "github-actions[bot]";
const ACTIONS_TOKEN = "ghs_testkit_actions";
const TOKENS: Record<string, string> = {
  ghp_testkit_tester: OWNER,
  ghp_testkit_reviewer: REVIEWER,
  [ACTIONS_TOKEN]: ACTIONS,
};
const OWNER_TOKEN = "ghp_testkit_tester";
const CHECK_STATES = ["pending", "success", "failure", "error"];
/** The REST API versions the fake takes in X-GitHub-Api-Version; a request without the header gets the first. */
const API_VERSIONS = ["2022-11-28"];
/** What GitHub answers for a pull request that cannot merge because it conflicts with its base. */
const NOT_MERGEABLE = "Pull Request is not mergeable";

interface Pull {
  number: number;
  title: string;
  body: string;
  head: string;
  base: string;
  user: string;
  state: "open" | "closed";
  merged: boolean;
  mergeCommit: string | null;
  /** False until a client read the pull request once: GitHub answers `mergeable: null` while it computes it. */
  computed: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

interface Status {
  id: number;
  sha: string;
  context: string;
  state: string;
  description: string | null;
  targetUrl: string | null;
  createdAt: string;
}

interface Rule {
  contexts: string[];
  approvals: number;
  enforceAdmins: boolean;
}

interface Hook {
  id: number;
  url: string;
  contentType: string;
  secret: string;
  events: string[];
  active: boolean;
}

interface Repository {
  name: string;
  /** The last number of a pull request: GitHub numbers them per repository from 1. */
  numbered: number;
  branches: Map<string, string>;
  pulls: Pull[];
  statuses: Status[];
  comments: { id: number; number: number; body: string; user: string; createdAt: string }[];
  reviews: { id: number; number: number; user: string; state: string; body: string }[];
  rules: Map<string, Rule>;
  hooks: Hook[];
}

/** An answer other than a success: GitHub's status and message. */
class Answer extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function startGitHub(): Promise<RunningGitHub> {
  const commits = new Commits();
  const repositories = new Map<string, Repository>();
  const problems: string[] = [];
  const deliveries: Promise<void>[] = [];
  let ids = 0;
  let seconds = 0;
  const nextId = () => ++ids;
  // Each event is one second after the one before, from the fixed clock.
  const now = () => new Date(Date.parse(FIXED_DATE) + ++seconds * 1000).toISOString().replace(".000Z", "Z");
  let url = "";

  const repository = (name: string): Repository => {
    const found = repositories.get(name);
    if (!found) throw new Answer(404, "Not Found");
    return found;
  };
  const tip = (repo: Repository, branch: string): string => {
    const sha = repo.branches.get(branch);
    if (!sha) throw new Answer(404, "Branch not found");
    return sha;
  };
  const pull = (repo: Repository, number: number): Pull => {
    const found = repo.pulls.find((candidate) => candidate.number === number);
    if (!found) throw new Answer(404, "Not Found");
    return found;
  };
  /** Whether the pull request's head merges into its base without a conflict. */
  const mergeable = (repo: Repository, pr: Pull): boolean =>
    commits.merged(tip(repo, pr.base), tip(repo, pr.head)) !== undefined;

  // The JSON of GitHub's answers and webhook payloads.
  const userJson = (login: string) => ({
    login,
    id: login === OWNER ? 1 : 2,
    type: "User",
    html_url: `${url}/${login}`,
  });
  const repoJson = (repo: Repository) => ({
    id: 1,
    name: repo.name,
    full_name: `${OWNER}/${repo.name}`,
    owner: userJson(OWNER),
    html_url: `${url}/${OWNER}/${repo.name}`,
    default_branch: "main",
  });
  const pullUrl = (repo: Repository, pr: Pull) => `${url}/${OWNER}/${repo.name}/pull/${pr.number}`;
  const pullJson = (repo: Repository, pr: Pull, read = false) => {
    const open = pr.state === "open";
    const computed = pr.computed;
    if (read) pr.computed = true;
    const canMerge = open ? mergeable(repo, pr) : false;
    const headSha = repo.branches.get(pr.head) ?? "";
    return {
      url: `${url}/repos/${OWNER}/${repo.name}/pulls/${pr.number}`,
      html_url: pullUrl(repo, pr),
      number: pr.number,
      state: pr.state,
      title: pr.title,
      body: pr.body,
      user: userJson(pr.user),
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      closed_at: pr.closedAt,
      merged_at: pr.merged ? pr.closedAt : null,
      merged: pr.merged,
      // GitHub answers null while it computes, and for a closed pull request.
      mergeable: !open || !computed ? null : canMerge,
      mergeable_state: open && !computed ? "unknown" : canMerge ? "clean" : "dirty",
      // While a pull request is open, GitHub names the commit of a test merge here.
      merge_commit_sha: pr.merged ? pr.mergeCommit : canMerge ? testMerge(headSha) : null,
      head: { label: `${OWNER}:${pr.head}`, ref: pr.head, sha: headSha },
      base: { label: `${OWNER}:${pr.base}`, ref: pr.base, sha: repo.branches.get(pr.base) ?? "" },
      labels: [],
      draft: false,
    };
  };
  /** The files whose text differs between the tips of the pull request's base and head, sorted by path. */
  const changedFiles = (repo: Repository, pr: Pull) => {
    const base = commits.get(tip(repo, pr.base))?.files ?? {};
    const head = commits.get(tip(repo, pr.head))?.files ?? {};
    return [...new Set([...Object.keys(base), ...Object.keys(head)])]
      .filter((path) => base[path] !== head[path])
      .sort()
      .map((filename) => ({ filename, status: head[filename] === undefined ? "removed" : "modified" }));
  };

  /** Sends the event to each active hook of the repository that takes it, signed with the hook's secret. */
  const deliver = (repo: Repository, event: string, payload: Record<string, unknown>, only?: Hook) => {
    for (const hook of only ? [only] : repo.hooks) {
      if (!hook.active || !(event === "ping" || hook.events.includes(event) || hook.events.includes("*"))) continue;
      const json = JSON.stringify({
        ...payload,
        repository: repoJson(repo),
        sender: payload.sender ?? userJson(OWNER),
      });
      // A webhook with the content type "form" gets the JSON as the form field "payload", as on GitHub.
      const form = hook.contentType !== "json";
      const body = form ? new URLSearchParams({ payload: json }).toString() : json;
      const delivery = String(nextId()).padStart(12, "0");
      const headers: Record<string, string> = {
        "content-type": form ? "application/x-www-form-urlencoded" : "application/json",
        "user-agent": "GitHub-Hookshot/testkit",
        "x-github-event": event,
        "x-github-delivery": `00000000-0000-4000-8000-${delivery}`,
        "x-github-hook-id": String(hook.id),
      };
      if (hook.secret) {
        headers["x-hub-signature-256"] = `sha256=${createHmac("sha256", hook.secret).update(body).digest("hex")}`;
      }
      // Like GitHub, the fake cannot reach every URL; it delivers only on this host, and the test reads the receiver.
      if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(hook.url)) continue;
      deliveries.push(
        fetch(hook.url, { method: "POST", headers, body }).then(
          (answer) => void answer.body?.cancel(),
          (error: Error) => void problems.push(`fake GitHub: the delivery to ${hook.url} failed: ${error.message}`),
        ),
      );
    }
  };

  const openPull = (
    repo: Repository,
    user: string,
    fields: { head: string; base: string; title: string; body: string },
  ) => {
    tip(repo, fields.base);
    if (!repo.branches.has(fields.head))
      throw new Answer(422, `Validation Failed: head ${fields.head} is not a branch of ${OWNER}/${repo.name}`);
    if (repo.pulls.some((pr) => pr.state === "open" && pr.head === fields.head && pr.base === fields.base))
      throw new Answer(422, `A pull request already exists for ${OWNER}:${fields.head}.`);
    const time = now();
    const pr: Pull = {
      number: ++repo.numbered,
      ...fields,
      user,
      state: "open",
      merged: false,
      mergeCommit: null,
      computed: false,
      createdAt: time,
      updatedAt: time,
      closedAt: null,
    };
    repo.pulls.push(pr);
    deliver(repo, "pull_request", {
      action: "opened",
      number: pr.number,
      pull_request: pullJson(repo, pr),
      sender: userJson(user),
    });
    return pr;
  };

  /** The merge rules of the base branch, when they hold for this person: admins pass unless they are enforced. */
  const refusal = (repo: Repository, pr: Pull, user: string): string | undefined => {
    const rule = repo.rules.get(pr.base);
    if (!rule || (user === OWNER && !rule.enforceAdmins)) return undefined;
    const head = tip(repo, pr.head);
    for (const context of rule.contexts) {
      const latest = repo.statuses.findLast((status) => status.sha === head && status.context === context);
      if (latest?.state === "success") continue;
      const failed = latest?.state === "failure" || latest?.state === "error";
      return `Required status check "${context}" is ${failed ? "failing" : "expected"}.`;
    }
    const approvers = new Set<string>();
    const latest = new Map<string, string>();
    for (const review of repo.reviews.filter((candidate) => candidate.number === pr.number))
      if (review.state !== "COMMENTED") latest.set(review.user, review.state);
    for (const [reviewer, state] of latest) if (state === "APPROVED" && reviewer !== pr.user) approvers.add(reviewer);
    if (approvers.size >= rule.approvals) return undefined;
    const plural = rule.approvals === 1 ? "review is" : "reviews are";
    return `At least ${rule.approvals} approving ${plural} required by reviewers with write access.`;
  };

  const mergePull = (repo: Repository, pr: Pull, user: string, method: string): string => {
    if (pr.state !== "open") throw new Answer(405, NOT_MERGEABLE);
    const base = tip(repo, pr.base);
    const head = tip(repo, pr.head);
    const files = commits.merged(base, head);
    if (!files) throw new Answer(405, NOT_MERGEABLE);
    const refused = refusal(repo, pr, user);
    if (refused) throw new Answer(405, refused);
    const sha =
      method === "merge"
        ? commits.add([base, head], `Merge pull request #${pr.number} from ${OWNER}/${pr.head}`, files)
        : commits.add([base], `${pr.title} (#${pr.number})`, files);
    repo.branches.set(pr.base, sha);
    const time = now();
    Object.assign(pr, { state: "closed", merged: true, mergeCommit: sha, updatedAt: time, closedAt: time });
    deliver(repo, "pull_request", {
      action: "closed",
      number: pr.number,
      pull_request: pullJson(repo, pr),
      sender: userJson(user),
    });
    return sha;
  };

  const review = (repo: Repository, pr: Pull, user: string, event: string, body: string) => {
    const state = { APPROVE: "APPROVED", REQUEST_CHANGES: "CHANGES_REQUESTED", COMMENT: "COMMENTED" }[event];
    if (!state) throw new Answer(422, `Unprocessable Entity: event ${event}`);
    if (user === pr.user && state !== "COMMENTED")
      throw new Answer(422, "Unprocessable Entity: Can not approve your own pull request");
    const stored = { id: nextId(), number: pr.number, user, state, body };
    repo.reviews.push(stored);
    pr.updatedAt = now();
    deliver(repo, "pull_request_review", {
      action: "submitted",
      review: {
        id: stored.id,
        user: userJson(user),
        body,
        state: state.toLowerCase(),
        submitted_at: pr.updatedAt,
        html_url: `${pullUrl(repo, pr)}#pullrequestreview-${stored.id}`,
      },
      pull_request: pullJson(repo, pr),
      sender: userJson(user),
    });
  };

  const commentJson = (repo: Repository, pr: Pull, stored: Repository["comments"][number]) => ({
    id: stored.id,
    body: stored.body,
    user: userJson(stored.user),
    html_url: `${pullUrl(repo, pr)}#issuecomment-${stored.id}`,
    created_at: stored.createdAt,
    updated_at: stored.createdAt,
  });
  const comment = (repo: Repository, pr: Pull, user: string, body: string) => {
    const stored = { id: nextId(), number: pr.number, body, user, createdAt: now() };
    repo.comments.push(stored);
    const json = commentJson(repo, pr, stored);
    deliver(repo, "issue_comment", {
      action: "created",
      issue: {
        number: pr.number,
        title: pr.title,
        user: userJson(pr.user),
        pull_request: { html_url: pullUrl(repo, pr) },
      },
      comment: json,
      sender: userJson(user),
    });
    return json;
  };

  /** Commits the files on top of `from` onto `branch`, creating the branch when it is new. */
  const commitOn = (repo: Repository, branch: string, from: string, message: string, files: Files) => {
    const parent = tip(repo, from);
    const sha = commits.add([parent], message, { ...commits.get(parent)?.files, ...files });
    repo.branches.set(branch, sha);
    return sha;
  };

  const hookJson = (hook: Hook) => ({
    id: hook.id,
    type: "Repository",
    name: "web",
    active: hook.active,
    events: hook.events,
    config: {
      url: hook.url,
      content_type: hook.contentType,
      insecure_ssl: "0",
      ...(hook.secret ? { secret: "********" } : {}),
    },
  });
  const saveHook = (hook: Hook, body: Record<string, unknown>) => {
    const config = (body.config ?? {}) as Record<string, unknown>;
    if (config.url !== undefined) hook.url = String(config.url);
    if (config.content_type !== undefined) hook.contentType = String(config.content_type);
    if (config.secret !== undefined) hook.secret = String(config.secret);
    if (Array.isArray(body.events)) hook.events = body.events.map(String);
    if (body.active !== undefined) hook.active = Boolean(body.active);
    if (!hook.url) throw new Answer(422, "Validation Failed: url cannot be blank");
  };

  /** The routes below /repos/tester/<name>, matched against the path without its query. */
  const routes: [
    string,
    RegExp,
    (repo: Repository, match: string[], body: Record<string, unknown>, user: string) => [number, unknown],
  ][] = [
    ["GET", /^$/, (repo) => [200, repoJson(repo)]],
    [
      "GET",
      /^\/commits\/([^/]+)$/,
      (repo, [ref = ""]) => {
        const sha = repo.branches.get(ref) ?? commits.find(ref)?.sha;
        const found = sha ? commits.get(sha) : undefined;
        if (!found) throw new Answer(422, `No commit found for SHA: ${ref}`);
        return [
          200,
          {
            sha: found.sha,
            commit: { message: found.message },
            parents: found.parents.map((parent) => ({ sha: parent })),
          },
        ];
      },
    ],
    [
      "GET",
      /^\/commits\/([^/]+)\/status$/,
      (repo, [ref = ""]) => {
        const sha = repo.branches.get(ref) ?? commits.find(ref)?.sha;
        if (!sha) throw new Answer(422, `No commit found for SHA: ${ref}`);
        const latest = new Map<string, Status>();
        for (const status of repo.statuses.filter((candidate) => candidate.sha === sha))
          latest.set(status.context, status);
        const statuses = [...latest.values()].reverse();
        const states = statuses.map((status) => status.state);
        const state = states.some((s) => s === "failure" || s === "error")
          ? "failure"
          : states.length === 0 || states.includes("pending")
            ? "pending"
            : "success";
        return [
          200,
          {
            state,
            sha,
            total_count: statuses.length,
            statuses: statuses.map((status) => ({
              id: status.id,
              context: status.context,
              state: status.state,
              description: status.description,
              target_url: status.targetUrl,
              created_at: status.createdAt,
            })),
          },
        ];
      },
    ],
    [
      "POST",
      /^\/statuses\/([0-9a-f]{40})$/,
      (repo, [sha = ""], body) => {
        if (!commits.get(sha)) throw new Answer(422, `No commit found for SHA: ${sha}`);
        if (!CHECK_STATES.includes(String(body.state)))
          throw new Answer(422, `Validation Failed: state is not included in the list`);
        const status: Status = {
          id: nextId(),
          sha,
          context: String(body.context ?? "default"),
          state: String(body.state),
          // GitHub keeps null for a description or URL the status does not give.
          description: body.description == null ? null : String(body.description),
          targetUrl: body.target_url == null ? null : String(body.target_url),
          createdAt: now(),
        };
        repo.statuses.push(status);
        return [
          201,
          {
            id: status.id,
            context: status.context,
            state: status.state,
            description: status.description,
            target_url: status.targetUrl,
          },
        ];
      },
    ],
    [
      "POST",
      /^\/git\/refs$/,
      (repo, _match, body) => {
        const ref = String(body.ref ?? "");
        const sha = String(body.sha ?? "");
        if (!ref.startsWith("refs/heads/") || ref === "refs/heads/")
          throw new Answer(422, "Reference name must start with 'refs/heads/' and name a branch");
        if (!commits.get(sha)) throw new Answer(422, "Object does not exist");
        const branch = ref.slice("refs/heads/".length);
        if (repo.branches.has(branch)) throw new Answer(422, "Reference already exists");
        repo.branches.set(branch, sha);
        return [201, { ref, object: { type: "commit", sha } }];
      },
    ],
    [
      "POST",
      /^\/pulls$/,
      (repo, _match, body, user) => {
        if (!body.title) throw new Answer(422, "Validation Failed: title is missing");
        const pr = openPull(repo, user, {
          head: String(body.head ?? "").replace(`${OWNER}:`, ""),
          base: String(body.base ?? ""),
          title: String(body.title),
          body: String(body.body ?? ""),
        });
        return [201, pullJson(repo, pr)];
      },
    ],
    ["GET", /^\/pulls\/(\d+)$/, (repo, [number = ""]) => [200, pullJson(repo, pull(repo, Number(number)), true)]],
    ["GET", /^\/pulls\/(\d+)\/files$/, (repo, [number = ""]) => [200, changedFiles(repo, pull(repo, Number(number)))]],
    [
      "PUT",
      /^\/pulls\/(\d+)\/merge$/,
      (repo, [number = ""], body, user) => {
        const method = String(body.merge_method ?? "merge");
        if (!["merge", "squash", "rebase"].includes(method))
          throw new Answer(422, "Validation Failed: merge_method is not included in the list");
        const sha = mergePull(repo, pull(repo, Number(number)), user, method);
        return [200, { sha, merged: true, message: "Pull Request successfully merged" }];
      },
    ],
    [
      "POST",
      /^\/pulls\/(\d+)\/reviews$/,
      (repo, [number = ""], body, user) => {
        review(repo, pull(repo, Number(number)), user, String(body.event ?? ""), String(body.body ?? ""));
        return [200, {}];
      },
    ],
    [
      "GET",
      /^\/issues\/(\d+)\/comments$/,
      (repo, [number = ""]) => {
        const pr = pull(repo, Number(number));
        return [
          200,
          repo.comments.filter((entry) => entry.number === pr.number).map((entry) => commentJson(repo, pr, entry)),
        ];
      },
    ],
    [
      "POST",
      /^\/issues\/(\d+)\/comments$/,
      (repo, [number = ""], body, user) => {
        if (!body.body) throw new Answer(422, "Validation Failed: body is missing");
        return [201, comment(repo, pull(repo, Number(number)), user, String(body.body))];
      },
    ],
    [
      "PUT",
      /^\/branches\/(.+)\/protection$/,
      (repo, [branch = ""], body) => {
        const name = decodeURIComponent(branch);
        tip(repo, name);
        for (const key of ["required_status_checks", "enforce_admins", "required_pull_request_reviews", "restrictions"])
          if (!(key in body)) throw new Answer(422, `Invalid request.\n\n"${key}" wasn't supplied.`);
        const checks = body.required_status_checks as { contexts?: string[] } | null;
        const reviews = body.required_pull_request_reviews as { required_approving_review_count?: number } | null;
        const approvals = reviews?.required_approving_review_count ?? 0;
        if (!Number.isInteger(approvals) || approvals < 0 || approvals > 6)
          throw new Answer(422, "Invalid request.\n\nrequired_approving_review_count must be between 0 and 6.");
        const rule = { contexts: checks?.contexts ?? [], approvals, enforceAdmins: body.enforce_admins === true };
        repo.rules.set(name, rule);
        return [
          200,
          {
            required_status_checks: checks ? { strict: false, contexts: rule.contexts } : undefined,
            required_pull_request_reviews: reviews ? { required_approving_review_count: approvals } : undefined,
            enforce_admins: { enabled: rule.enforceAdmins },
          },
        ];
      },
    ],
    ["GET", /^\/hooks$/, (repo) => [200, repo.hooks.map(hookJson)]],
    [
      "POST",
      /^\/hooks$/,
      (repo, _match, body) => {
        if (body.name !== undefined && body.name !== "web")
          throw new Answer(422, "Validation Failed: name must be web");
        const hook: Hook = { id: nextId(), url: "", contentType: "form", secret: "", events: ["push"], active: true };
        saveHook(hook, body);
        if (repo.hooks.some((existing) => existing.url === hook.url))
          throw new Answer(422, "Validation Failed: Hook already exists on this repository");
        repo.hooks.push(hook);
        deliver(repo, "ping", { zen: "Keep it logically awesome.", hook_id: hook.id, hook: hookJson(hook) }, hook);
        return [201, hookJson(hook)];
      },
    ],
    [
      "PATCH",
      /^\/hooks\/(\d+)$/,
      (repo, [id = ""], body) => {
        const hook = repo.hooks.find((candidate) => candidate.id === Number(id));
        if (!hook) throw new Answer(404, "Not Found");
        saveHook(hook, body);
        return [200, hookJson(hook)];
      },
    ],
    [
      "DELETE",
      /^\/hooks\/(\d+)$/,
      (repo, [id = ""]) => {
        const index = repo.hooks.findIndex((candidate) => candidate.id === Number(id));
        if (index < 0) throw new Answer(404, "Not Found");
        repo.hooks.splice(index, 1);
        return [204, undefined];
      },
    ],
  ];

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, value: unknown) => {
      response.statusCode = status;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify(value));
    };
    const method = request.method ?? "GET";
    const path = (request.url ?? "").split("?")[0] ?? "";
    let text = "";
    for await (const chunk of request) text += chunk;
    const token = /^(?:Bearer|token) (.+)$/i.exec(request.headers.authorization ?? "")?.[1] ?? "";
    const user = TOKENS[token];
    if (!user) return send(401, { message: "Bad credentials", status: "401" });
    const version = request.headers["x-github-api-version"];
    if (version !== undefined && !API_VERSIONS.includes(String(version)))
      return send(400, { message: `API version ${version} is not supported.`, status: "400" });
    if (method === "GET" && path === "/user") {
      // GitHub does not let an Actions token read its user.
      if (user === ACTIONS) return send(403, { message: "Resource not accessible by integration", status: "403" });
      return send(200, userJson(user));
    }
    const repoMatch = new RegExp(`^/repos/${OWNER}/([^/]+)(.*)$`).exec(path);
    const route = repoMatch && routes.find(([verb, pattern]) => verb === method && pattern.test(repoMatch[2] ?? ""));
    if (!repoMatch || !route) {
      problems.push(`fake GitHub: ${method} ${path} is not supported`);
      return send(404, { message: "Not Found" });
    }
    try {
      const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
      const match = (route[1].exec(repoMatch[2] ?? "") ?? []).slice(1);
      const [status, value] = route[2](repository(repoMatch[1] ?? ""), match, body, user);
      send(status, value);
    } catch (error) {
      if (!(error instanceof Answer)) throw error;
      send(error.status, { message: error.message, status: String(error.status) });
    }
  };
  const server = createServer((request, response) => {
    handle(request, response).catch((error: Error) => {
      problems.push(`fake GitHub: ${request.method} ${request.url} failed: ${error.message}`);
      if (!response.headersSent) response.statusCode = 500;
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const ref = (pr: PullRequest) => {
    const repo = repository(pr.repository);
    return { repo, pr: pull(repo, pr.number) };
  };
  const opened = (repo: Repository, pr: Pull): PullRequest => ({
    repository: repo.name,
    number: pr.number,
    url: pullUrl(repo, pr),
    sha: tip(repo, pr.head),
  });

  const github: FakeGitHub = {
    url,
    token: OWNER_TOKEN,
    actionsToken: ACTIONS_TOKEN,
    owner: OWNER,
    async createRepository(name, files = {}) {
      const initial = Object.keys(files).length > 0 ? files : { "README.md": `# ${name}\n` };
      const sha = commits.add([], "Initial commit", initial);
      repositories.set(name, {
        name,
        numbered: 0,
        branches: new Map([["main", sha]]),
        pulls: [],
        statuses: [],
        comments: [],
        reviews: [],
        rules: new Map(),
        hooks: [],
      });
    },
    async openPullRequest(name, change) {
      const repo = repository(name);
      commitOn(repo, change.branch, "main", change.title, change.files);
      return opened(repo, openPull(repo, OWNER, { head: change.branch, base: "main", title: change.title, body: "" }));
    },
    async mergePullRequest(pr) {
      const found = ref(pr);
      return mergePull(found.repo, found.pr, OWNER, "merge");
    },
    async comments(pr) {
      return ref(pr)
        .repo.comments.filter((entry) => entry.number === pr.number)
        .map((entry) => entry.body);
    },
    async say(pr, text, as = REVIEWER) {
      const found = ref(pr);
      const posted = comment(found.repo, found.pr, as, text);
      return { id: posted.id, user: as, body: text };
    },
    async conversation(pr) {
      return ref(pr)
        .repo.comments.filter((entry) => entry.number === pr.number)
        .map(({ id, user, body }) => ({ id, user, body }));
    },
    async statuses(pr) {
      const { repo, pr: found } = ref(pr);
      const head = tip(repo, found.head);
      return repo.statuses
        .filter((status) => status.sha === head)
        .reverse()
        .map(({ context, state, description }) => ({ context, state, description: description ?? "" }));
    },
    async createBranch(name, change) {
      const repo = repository(name);
      return commitOn(repo, change.branch, change.from ?? "main", `change ${change.branch}`, change.files);
    },
    async branches(name) {
      return [...repository(name).branches]
        .map(([branch, sha]) => ({ name: branch, sha }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async hooks(name) {
      return repository(name).hooks.map((hook) => ({
        url: hook.url,
        events: [...hook.events].sort(),
        active: hook.active,
      }));
    },
    async review(pr, state, body = "") {
      const found = ref(pr);
      review(found.repo, found.pr, REVIEWER, state === "APPROVED" ? "APPROVE" : state, body);
    },
    async pullRequests(name): Promise<OpenedPullRequest[]> {
      const repo = repository(name);
      return [...repo.pulls].reverse().map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        head: pr.head,
        base: pr.base,
        state: pr.state,
        url: pullUrl(repo, pr),
      }));
    },
    async file(name, path, at) {
      const repo = repository(name);
      const sha = repo.branches.get(at) ?? commits.find(at)?.sha;
      return sha ? commits.get(sha)?.files[path] : undefined;
    },
  };

  return {
    github,
    async close() {
      await Promise.all(deliveries);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return problems;
    },
  };
}

/** The SHA GitHub names as `merge_commit_sha` of an open pull request: a test merge of its head. */
function testMerge(head: string): string {
  return createHmac("sha1", "test-merge").update(head).digest("hex");
}
