// Shared setup of the scenarios of a change (ADR 0144): the factory's repository "tester/factory" on the testkit's
// Forgejo (fakes.forge), which the console fetches with Git; the console behind a sign-in proxy with an access file and
// the built adapter forge-forgejo; and a stand-in of factory-spec's "factory", since ISOLATION keeps the console's tests
// from starting another module. The stand-in prints the file it is given with the value added below "egress:", as
// "factory edit add-egress" does for the factories here, and records its arguments.
import type { Fakes, Forge, Page, Sut } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";
import { factoryOf, factoryYaml } from "./secrets.ts";
import { accessYaml } from "./signin.ts";

export const REPOSITORY = "tester/factory";

/** The people of the access file of the scenarios. */
export const PEOPLE = { "ada@acme.dev": "admin", "grace@acme.dev": "factory-engineer", "varun@acme.dev": "member" };

/** The sign-in proxy's header of the factory engineer. */
export const ENGINEER = { "x-forwarded-email": "grace@acme.dev" };

/** The factory of the repository: the agent "triage" may reach "api.github.com". */
export const FACTORY = factoryYaml({ triage: { egress: ["api.github.com"] } });

/** factory.yaml as the stand-in of "factory edit add-egress triage <host>" prints it for FACTORY. */
export const withHost = (yaml: string, host: string): string =>
  yaml.replace("      egress:\n", `      egress:\n        - ${host}\n`);

/** Calls Forgejo's API on the repository as the user "tester", as a person or the factory's workflow would. */
async function api(forge: Forge, method: string, path: string, body?: unknown): Promise<void> {
  const answer = await fetch(`${forge.url}/api/v1/repos/${REPOSITORY}${path}`, {
    method,
    headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`the forge answered ${method} ${path} with ${answer.status}`);
}

/** The factory's repository "tester/factory" with FACTORY; its main branch requires the check "factory" unless not. */
export async function factoryRepository(fakes: Fakes, required = true): Promise<Forge> {
  const forge = await fakes.forge();
  await forge.createRepository("factory", { "factory.yaml": FACTORY });
  if (!required) return forge;
  // The rule that the port's `protect` writes, in one call of Forgejo's API, and a person who may write still pushes
  // to main, as another person's commit in a scenario does; a pull request still needs the check.
  const rule = {
    rule_name: "main",
    enable_status_check: true,
    status_check_contexts: ["factory"],
    required_approvals: 0,
    enable_push: true,
  };
  await api(forge, "POST", "/branch_protections", rule);
  return forge;
}

/** Commits these files on "main" of the repository in one commit, as another person would. */
export async function commitOnMain(forge: Forge, files: Record<string, string>): Promise<void> {
  const operations = [];
  for (const [path, text] of Object.entries(files)) {
    const known = await fetch(`${forge.url}/api/v1/repos/${REPOSITORY}/contents/${path}?ref=main`, {
      headers: { authorization: `token ${forge.token}` },
    });
    const sha = known.ok ? ((await known.json()) as { sha: string }).sha : undefined;
    const content = Buffer.from(text).toString("base64");
    operations.push(sha ? { operation: "update", path, content, sha } : { operation: "create", path, content });
  }
  await api(forge, "POST", "/contents", { branch: "main", message: "a commit of another person", files: operations });
}

/** The head commit of the branch, or undefined when the repository has no such branch. */
export const headOf = async (forge: Forge, branch: string): Promise<string | undefined> =>
  (await forge.branches("factory")).find((each) => each.name === branch)?.sha;

/** A commit of the repository as Forgejo's API gives it: its message and its parents. */
export async function commitOf(forge: Forge, sha: string): Promise<{ message: string; parents: string[] }> {
  const answer = await fetch(`${forge.url}/api/v1/repos/${REPOSITORY}/git/commits/${sha}`, {
    headers: { authorization: `token ${forge.token}` },
  });
  const body = (await answer.json()) as { commit: { message: string }; parents: { sha: string }[] };
  return { message: body.commit.message, parents: body.parents.map((parent) => parent.sha) };
}

/** A shell word in single quotes. */
const word = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/**
 * The stand-in of the factory program: it appends its arguments to $OUTPUT/factory.log and prints the file after
 * "--file" with its last argument added below "egress:". Returns its command line for CONSOLE_FACTORY_COMMAND.
 */
export async function editProgram(sut: Sut): Promise<string> {
  const log = word(sut.files.path("$OUTPUT/factory.log"));
  const script = [
    "#!/bin/sh",
    `echo "$@" >> ${log}`,
    'file="$3"',
    "for value; do :; done",
    `sed "s|^      egress:\\$|&\\n        - $value|" "$file"`,
    "",
  ].join("\n");
  await sut.files.put("$INPUT/bin/factory", script, { executable: true });
  return sut.files.path("$INPUT/bin/factory");
}

/**
 * A forge adapter that cannot merge when green, like forge-github for a repository without auto-merge: it refuses
 * "merge --when-green" with the port's error and runs forge-forgejo for every other command. Returns its command line
 * for CONSOLE_FORGE_ADAPTER.
 */
export async function noMergeWhenGreen(sut: Sut): Promise<string> {
  const script = [
    "#!/bin/sh",
    "for arg; do",
    '  if [ "$arg" = "--when-green" ]; then',
    `    echo "forge-forgejo: the forge cannot merge $2#$3 when its checks pass: allow auto-merge in the repository's settings" >&2`,
    "    exit 1",
    "  fi",
    "done",
    `exec ${sut.adapter("forge/forgejo")} "$@"`,
    "",
  ].join("\n");
  await sut.files.put("$INPUT/bin/forge", script, { executable: true });
  return sut.files.path("$INPUT/bin/forge");
}

/** The lines the stand-in recorded, one per run of the factory program. */
export const factoryRuns = async (sut: Sut): Promise<string[]> => {
  const files = await sut.files.list("$OUTPUT");
  return files.includes("factory.log") ? (await sut.files.read("$OUTPUT/factory.log")).trim().split("\n") : [];
};

/** The console's variables of the factory's repository on the forge. */
export const changesEnv = (sut: Sut, forge: Forge): Record<string, string> => ({
  CONSOLE_FACTORY_REPOSITORY: `git+${forge.url}/${REPOSITORY}.git#main`,
  CONSOLE_FACTORY_TOKEN: forge.token,
  CONSOLE_FACTORY_USER: "forgejo:tester",
  CONSOLE_FACTORY_CACHE: sut.files.path("$OUTPUT/cache"),
  CONSOLE_FORGE_ADAPTER: sut.adapter("forge/forgejo"),
  CONSOLE_FORGE_URL: forge.url,
});

/**
 * The variables of a factory repository that no scenario reaches: for the scenarios in which the console refuses a
 * form before it asks the forge.
 */
export const unreachableEnv = (sut: Sut): Record<string, string> => ({
  CONSOLE_FACTORY_REPOSITORY: `git+http://127.0.0.1:9/${REPOSITORY}.git#main`,
  CONSOLE_FACTORY_USER: "forgejo:tester",
  CONSOLE_FACTORY_CACHE: sut.files.path("$OUTPUT/cache"),
  CONSOLE_FORGE_ADAPTER: sut.adapter("forge/forgejo"),
  CONSOLE_FORGE_URL: "http://127.0.0.1:9",
});

/** Starts a console behind a sign-in proxy with PEOPLE, the stand-in factory program and these variables. */
export async function servingChanges(sut: Sut, fakes: Fakes, env: Record<string, string>): Promise<void> {
  await sut.files.put("$INPUT/access.yaml", accessYaml(PEOPLE));
  const api = await foreman(fakes, []);
  await serving(sut, [api.url], {
    ...(await factoryOf(sut, { triage: { egress: ["api.github.com"] } })),
    CONSOLE_USER_HEADER: "X-Forwarded-Email",
    CONSOLE_FACTORY_COMMAND: await editProgram(sut),
    ...env,
  });
}

/** The fields of the form "Propose change" that add "api.linear.app" to the hosts of "triage". */
export const LINEAR = { edit: "add-egress", agent: "triage", value: "api.linear.app" };

/** Sends the form "Propose change" with these fields as the person of the headers, without following a redirect. */
export const propose = (sut: Sut, fields: Record<string, string> = LINEAR, headers = ENGINEER) =>
  sut.pages.send("/changes", fields, { headers, follow: false });

/** Presses a button of a change: sends its form, without following a redirect. */
export const press = (sut: Sut, number: number, button: "retry" | "discard" | "merge", headers = ENGINEER) =>
  sut.pages.send(`/changes/${number}/${button}`, {}, { headers, follow: false });

export interface Change {
  forge: Forge;
  /** The pull request of the change, with its head commit. */
  pr: { repository: string; number: number; url: string; sha: string };
  head: string;
}

/**
 * The factory's repository, a console for it with these variables, and the change of the factory engineer that adds
 * "api.linear.app" to "triage"; `env` may replace the forge adapter.
 */
export async function changeOfConsole(sut: Sut, fakes: Fakes, env: Record<string, string> = {}): Promise<Change> {
  const forge = await factoryRepository(fakes);
  await servingChanges(sut, fakes, { ...changesEnv(sut, forge), ...env });
  const sent = await propose(sut);
  if (sent.status !== 303) throw new Error(`the console did not open the change: ${sent.status} ${sent.text}`);
  const [pull] = await forge.pullRequests("factory");
  const sha = (await headOf(forge, pull?.head ?? "")) as string;
  return {
    forge,
    pr: { repository: "factory", number: pull?.number ?? 0, url: pull?.url ?? "", sha },
    head: pull?.head ?? "",
  };
}

/**
 * Posts the check "factory" on the head of the change as a commit status: what the port's `check` writes and the
 * factory's workflow posts.
 */
export const postCheck = (change: Change, state: "success" | "failure") =>
  api(change.forge, "POST", `/statuses/${change.pr.sha}`, { context: "factory", state });

/** The items of the list "Changes" of the page. */
export const changeItems = (page: Page) =>
  page.queryByRole("list", { name: "Changes" })?.queryAllByRole("listitem") ?? [];

/** The text of each change of the page. */
export const changeTexts = (page: Page): string[] => changeItems(page).map((item) => item.text);

/** The names of the buttons of the first change of the page. */
export const changeButtons = (page: Page): string[] =>
  (changeItems(page)[0]?.queryAllByRole("button") ?? []).map((button) => button.name);

/** "/changes" as the factory engineer opens it. */
export const openChanges = (sut: Sut, headers = ENGINEER): Promise<Page> => sut.pages.open("/changes", { headers });
