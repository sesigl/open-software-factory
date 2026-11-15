// The page "/changes" and its forms (ADR 0144): a person with the role admin or factory-engineer proposes a change of
// the factory, which the console makes as a pull request on the factory's repository with the forge port's adapter,
// and acts on a failed, conflicting or ready change. The page asks the forge when it is opened; the console keeps no
// state and runs no loop.
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UsageError } from "@opensoftware/cli";
import type { ShellData } from "@opensoftware/ui";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  branchRules,
  type ChangeForge,
  closeChange,
  editFactory,
  factoryRepository,
  listChanges,
  mergeChange,
  openChange,
  readChange,
} from "../adapters/changes.ts";
import { readFactory } from "../adapters/factory-file.ts";
import type { Outcome } from "../adapters/program.ts";
import { render } from "../adapters/web.ts";
import {
  BUTTONS,
  bodyOf,
  branchOf,
  CHECK,
  type CheckedEdits,
  type Edit,
  editsOfForm,
  editsOfTitle,
  isChange,
  type Listed,
  messageOf,
  type Pull,
  repositoryOf,
  stateOf,
  titleOf,
} from "../domain/changes.ts";
import { changeRow, changesData, checking } from "../pages/changes.ts";
import { actorOf } from "./person.ts";

/** The factory's repository on a forge, from CONSOLE_FACTORY_REPOSITORY. */
export interface FactoryRepository {
  forge: ChangeForge;
  /** The main branch that changes merge into. */
  branch: string;
  /** The author of the console's pull requests: the user of CONSOLE_FACTORY_TOKEN, CONSOLE_FACTORY_USER. */
  user: string;
  /** Fetches the newest commit of the main branch. */
  fetch(): Promise<Outcome<{ file: string; commit: string }>>;
}

export interface ChangesSetup {
  /** The factory's repository, or undefined for a factory from a local folder. */
  repository: FactoryRepository | undefined;
  /** The command line of the factory program, CONSOLE_FACTORY_COMMAND. */
  command: string;
  factoryFile: string;
  /** Why this console has no person with a role, or undefined when it has. */
  closed: string | undefined;
  refresh: number;
  shell(request: FastifyRequest, title: string, refresh?: number): ShellData;
  signedIn(request: FastifyRequest, reply: FastifyReply, title: string): { person?: string; refused?: unknown };
  problem(reply: FastifyReply, status: number, title: string, detail: string): unknown;
}

type Env = Record<string, string | undefined>;

/** The forge adapter without CONSOLE_FORGE_ADAPTER. */
export const FORGE_ADAPTER = "npx -y @opensoftware/forge-github";

/**
 * The factory's repository of CONSOLE_FACTORY_REPOSITORY, "git+<url>#<branch>", with the forge adapter and the token
 * of the changes; undefined without the setting. A setting that is not such a line, or one without
 * CONSOLE_FACTORY_USER, stops the console at its start.
 */
export function factoryRepositoryOf(
  env: Env,
  adapter: { command: string; url?: string },
): FactoryRepository | undefined {
  const setting = env.CONSOLE_FACTORY_REPOSITORY;
  if (!setting) return undefined;
  const [url = "", branch = "main"] = setting.replace(/^git\+/, "").split("#");
  const name = setting.startsWith("git+") ? repositoryOf(url) : undefined;
  if (!name)
    throw new UsageError(
      `CONSOLE_FACTORY_REPOSITORY is git+<url>#<branch> of the factory's repository, like git+https://github.com/acme/factory.git#main, not ${setting}`,
    );
  const user = env.CONSOLE_FACTORY_USER;
  if (!user)
    throw new UsageError(
      "set CONSOLE_FACTORY_USER to the user of CONSOLE_FACTORY_TOKEN as the forge adapter names an author, like forgejo:factory-bot",
    );
  const token = env.CONSOLE_FACTORY_TOKEN;
  const cache =
    env.CONSOLE_FACTORY_CACHE ||
    join(tmpdir(), "osf-console-factory", createHash("sha256").update(url).digest("hex").slice(0, 12));
  return {
    forge: { command: adapter.command, url: adapter.url, token, repository: name },
    branch,
    user,
    fetch: factoryRepository(`git+${url}#${branch}`, cache, token),
  };
}

/** Why a console without roles offers no change. */
export const NO_ROLES =
  "no changes: they need a person with the role admin or factory-engineer, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER";

export const LOCAL =
  "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge.";

const ROLES = ["admin", "factory-engineer"];

/** An answer of a form: the redirect to "/changes", or a problem with its status and text. */
type Done = { status: 303 } | { status: number; title: string; detail: string };

const SEE = { status: 303 } as const;

const refused = (status: number, title: string, detail: string): Done => ({ status, title, detail });

/**
 * Why the person of the request cannot change the factory, with the status that refuses a form: 404 without a factory
 * repository or roles, 403 without the role; undefined when the person can.
 */
export function whyNoChange(
  repository: FactoryRepository | undefined,
  closed: string | undefined,
  request: FastifyRequest,
): { status: number; detail: string } | undefined {
  if (!repository) return { status: 404, detail: LOCAL };
  if (closed) return { status: 404, detail: closed };
  const actor = actorOf(request);
  if (actor && ROLES.includes(actor.role)) return undefined;
  const who = actor ? `${actor.email} has the role ${actor.role}` : "nobody signed in";
  return { status: 403, detail: `${who}: a change needs the role admin or factory-engineer` };
}

/**
 * The console's changes that `keep` keeps, the newest first, each open one as `pr` prints it, and what could not be
 * read. `pr` runs only for the changes that are still open, at the same time.
 */
export async function readChanges(
  repository: FactoryRepository,
  keep: (pull: Listed) => boolean,
): Promise<{ pulls: (Listed | Pull)[]; notes: string[] }> {
  const listed = await listChanges(repository.forge);
  const own = listed.ok ? listed.body.filter((pull) => isChange(pull, repository.user) && keep(pull)) : [];
  const read = await Promise.all(
    own.map((pull) => (pull.state === "open" ? readChange(repository.forge, pull.number) : undefined)),
  );
  const pulls = own.map((pull, index) => {
    const answer = read[index];
    return answer?.ok ? answer.body : pull;
  });
  const notes = [
    ...(listed.ok ? [] : [`The changes could not be listed: ${listed.note}`]),
    ...read.flatMap((answer) => (answer && !answer.ok ? [`A change could not be read: ${answer.note}`] : [])),
  ];
  return { pulls, notes };
}

export function useChanges(app: FastifyInstance, setup: ChangesSetup): void {
  const { repository } = setup;

  app.get("/changes", async (request, reply) => {
    if (!repository)
      return render(request, reply, 200, changesData(setup.shell(request, "Changes"), LOCAL, [], [], undefined));
    const { pulls, notes } = await readChanges(repository, () => true);
    const act = !whyNoChange(repository, setup.closed, request);
    const rows = pulls.map((pull) => changeRow(pull, repository.branch, act));
    const agents = act ? Object.keys(readFactory(setup.factoryFile).agents ?? {}) : undefined;
    const shell = setup.shell(request, "Changes", checking(pulls) ? setup.refresh : undefined);
    return render(request, reply, 200, changesData(shell, undefined, rows, notes, agents), "changes");
  });

  /** The person who may change the factory, or the answer that refuses the form. */
  const guard = (
    request: FastifyRequest,
    reply: FastifyReply,
  ):
    | { refused: unknown; person?: undefined; repository?: undefined }
    | { refused?: undefined; person: string; repository: FactoryRepository } => {
    const why = whyNoChange(repository, setup.closed, request);
    if (why?.status === 404) return { refused: setup.problem(reply, 404, "No changes", why.detail) };
    const signed = setup.signedIn(request, reply, "Changes");
    if (signed.refused) return { refused: signed.refused };
    if (why) return { refused: setup.problem(reply, 403, "Forbidden", why.detail) };
    return { person: actorOf(request)?.email as string, repository: repository as FactoryRepository };
  };

  /** Makes the change on the newest commit of the main branch, in the name of the person. */
  const propose = async (found: FactoryRepository, edits: Edit[], person: string, failed: string): Promise<Done> => {
    const [fetched, rules] = await Promise.all([found.fetch(), branchRules(found.forge, found.branch)]);
    if (!fetched.ok) return refused(502, failed, `${failed}: ${fetched.note}`);
    if (!rules.ok) return refused(502, failed, `${failed}: ${rules.note}`);
    // The check comes first: without it nothing would check the change before the forge merges it.
    if (!rules.body.checks.includes(CHECK))
      return refused(
        409,
        failed,
        `${failed}: the branch ${found.branch} of ${found.forge.repository} does not require the check ${CHECK}, so nothing would check the change before it merges. Require the check ${CHECK} on ${found.branch} first.`,
      );
    const { file, commit } = fetched.body;
    const edited = await editFactory(setup.command, file, edits);
    if (!edited.ok) return refused(400, failed, `${failed}: ${edited.note}`);
    if (!edited.body.changed)
      return refused(400, failed, `${failed}: the edit changes nothing in factory.yaml at ${commit.slice(0, 7)}`);
    const branch = branchOf(edits, commit);
    const opened = await openChange(found.forge, {
      branch,
      from: commit,
      base: found.branch,
      text: edited.body.text,
      message: messageOf(edits, person),
      title: titleOf(edits),
      body: bodyOf(edits, person, found.branch),
    });
    if (!opened.ok) return refused(502, failed, `${failed}: ${opened.note}`);
    // A forge that cannot merge when green leaves the change "Checking", and "Merge" makes it live (ADR 0144).
    await mergeChange(found.forge, opened.body, true);
    return SEE;
  };

  const answer = (reply: FastifyReply, done: Done) =>
    "title" in done
      ? setup.problem(reply, done.status, done.title, done.detail)
      : reply.code(303).header("location", "/changes").send();

  app.post("/changes", async (request, reply) => {
    const { person, repository: found, refused: no } = guard(request, reply);
    if (no) return no;
    const checked: CheckedEdits = editsOfForm((request.body ?? {}) as Record<string, unknown>);
    if (!checked.ok) return answer(reply, refused(400, "Not proposed", `Not proposed: ${checked.reason}`));
    return answer(reply, await propose(found as FactoryRepository, checked.edits, person as string, "Not proposed"));
  });

  /** A button of a change: only for a change of the console in a state that offers it. */
  const button =
    (
      name: keyof typeof BUTTONS,
      failed: string,
      run: (found: FactoryRepository, pull: Pull, person: string) => Promise<Done>,
    ) =>
    async (request: FastifyRequest<{ Params: { number: string } }>, reply: FastifyReply) => {
      const { person, repository: found, refused: no } = guard(request, reply);
      if (no) return no;
      const number = Number(request.params.number);
      const forge = (found as FactoryRepository).forge;
      const read = Number.isInteger(number) && number > 0 ? await readChange(forge, number) : undefined;
      if (read && !read.ok) return answer(reply, refused(502, failed, `${failed}: ${read.note}`));
      const pull = read?.body;
      if (!pull || !isChange(pull, (found as FactoryRepository).user))
        return answer(
          reply,
          refused(404, "Not found", `no change #${request.params.number} of the console in ${forge.repository}`),
        );
      const state = stateOf(pull);
      if (!BUTTONS[name].includes(state))
        return answer(reply, refused(409, failed, `${failed}: ${whyNot(name, pull.number, state)}`));
      return answer(reply, await run(found as FactoryRepository, pull, person as string));
    };

  app.post(
    "/changes/:number/retry",
    button("retry", "Not tried again", async (found, pull, person) => {
      // The title is the edit's line; anyone who may write to the repository can change it, so it is a form.
      const checked = editsOfTitle(pull.title);
      if (!checked.ok) return refused(400, "Not tried again", `Not tried again: ${checked.reason}`);
      const closed = await closeChange(found.forge, pull.number);
      if (!closed.ok) return refused(502, "Not tried again", `Not tried again: ${closed.note}`);
      return propose(found, checked.edits, person, "Not tried again");
    }),
  );
  app.post(
    "/changes/:number/discard",
    button("discard", "Not discarded", async (found, pull) => {
      const closed = await closeChange(found.forge, pull.number);
      return closed.ok ? SEE : refused(502, "Not discarded", `Not discarded: ${closed.note}`);
    }),
  );
  app.post(
    "/changes/:number/merge",
    button("merge", "Not merged", async (found, pull) => {
      const merged = await mergeChange(found.forge, pull.number, false);
      return merged.ok ? SEE : refused(502, "Not merged", `Not merged: ${merged.note}`);
    }),
  );
}

/** Why a button does not act on a change in this state: "Merge" needs the check, the others a failed change. */
const NEEDS: Record<keyof typeof BUTTONS, string> = {
  merge: `only a change whose check ${CHECK} passed merges`,
  retry: "only a failed change or one in conflict is tried again",
  discard: "only a failed change or one in conflict is discarded",
};

const whyNot = (name: keyof typeof BUTTONS, number: number, state: string): string =>
  `#${number} is ${state}; ${NEEDS[name]}`;
