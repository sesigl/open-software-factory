import { type Forge, scenario } from "@opensoftware/testkit";
import {
  type Browser,
  factoryRepository,
  factoryYaml,
  githubSignIn,
  implementOf,
  mainOf,
  merged,
  type PullOfForge,
  passCheck,
  postRun,
  runView,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

// Below Linux's ephemeral range; no other scenario of the suite uses it.
const PORT = "18082";
/** The second work item, posted after the change is live. */
const AGAIN = { ...WORK, id: "wi_7f3e3b2c1a9d5e4f6071", dedupeKey: "idea:export-csv-after-change" };
const TITLE = "factory edit add-egress implement api.linear.app";

scenario("SCN-E2E-008", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let factory = "";
  let repository: Record<string, string> = {};
  await given(
    'a factory repository on Forgejo whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal", and whose main branch requires the check "factory" and no approval',
    async () => {
      forge = await fakes.forge();
      factory = factoryYaml(["implement"], {
        agent: ["sandbox:", "  template: osf-e2e:workspace", "  egress: [host.docker.internal]"],
      });
      repository = await factoryRepository(fakes, forge, factory);
    },
  );

  const github = await githubSignIn(fakes, PORT);
  let profile: Smoke;
  await given(
    'the Compose profile with "FACTORY_REPOSITORY" set to that repository\'s "main", "FACTORY_TOKEN" and "FACTORY_USER" to a token of the forge and its user, and "FACTORY_FORGE_ADAPTER" to "forge-forgejo", and the scripted harness that answers when asked to implement',
    async () => {
      const turns = [{ when: "Implement the work item", reply: "Done." }];
      profile = await smoke(
        sut,
        fakes,
        factory,
        turns,
        undefined,
        { ...repository, ...github.env },
        { sandboxes: true },
      );
    },
  );

  let open: Browser;
  await given(
    'the console with the sign-in of GitHub, where "grace@acme.dev" of the repository\'s "access.yaml" signed in as "factory-engineer"',
    async () => {
      await started(profile, ["foreman", "console"]);
      open = await github.signIn(profile, "/changes");
    },
  );

  let foreman = "";
  let first = "";
  await given(
    'a first run, whose stage "implement" succeeded with the newest commit of "main" as its factory version',
    async () => {
      foreman = await profile.url("foreman");
      first = await postRun(foreman, WORK);
      await profile.until(async () => (await implementOf(foreman, first))?.state, "succeeded");
      expect((await runView(foreman, first)).factoryVersion).toBe(await mainOf(forge));
    },
  );

  let sent: Awaited<ReturnType<Browser>>;
  await when(
    'the factory engineer sends the form "Propose change" of the page "/changes" with "add-egress", the agent "implement" and the value "api.linear.app"',
    async () => {
      sent = await open("/changes", { edit: "add-egress", agent: "implement", value: "api.linear.app" });
    },
  );

  await then(
    'the console answered 303 to "/changes", and the forge has one open pull request "factory edit add-egress implement api.linear.app" whose body names "grace@acme.dev"',
    async () => {
      expect({ status: sent.status, location: sent.location }, sent.html).toEqual({
        status: 303,
        location: "/changes",
      });
      const pulls = await forge.pullRequests("factory");
      expect(pulls.map(({ title, state }) => ({ title, state }))).toEqual([{ title: TITLE, state: "open" }]);
      expect(pulls[0]?.body).toContain("grace@acme.dev");
    },
  );

  let pull: PullOfForge;
  let changes: Awaited<ReturnType<Browser>>;
  await when(
    'the check "factory" of the pull request\'s head passes, posted as the factory\'s workflow posts it, and the factory engineer opens "/changes"',
    async () => {
      await passCheck(forge);
      pull = await merged(forge);
      changes = await open("/changes");
    },
  );

  await then(
    'the forge merged the pull request into "main" without another person, and the "factory.yaml" of "main" lets "implement" reach "api.linear.app"',
    async () => {
      // The console's own user asked the forge to merge when green; nobody approved or merged by hand.
      expect({ merged: pull.merged, by: pull.merged_by?.login }).toEqual({ merged: true, by: forge.owner });
      expect(await mainOf(forge)).toBe(pull.merge_commit_sha);
      expect(await forge.file("factory", "factory.yaml", "main")).toMatch(
        /egress: \[\s*host\.docker\.internal,\s*api\.linear\.app\s*\]/,
      );
    },
  );

  await then(
    'the page "/changes" shows the change as "Live" with "Live for the next run: factory version <the merge commit>"',
    async () => {
      expect(changes.status).toBe(200);
      expect(changes.html).toContain(`Live for the next run: factory version ${pull.merge_commit_sha.slice(0, 7)}`);
      expect(changes.html).toMatch(/>Live<\/span>/);
    },
  );

  let second = "";
  await when('a program posts a second work item to foreman\'s "/v1/runs", with no restart', async () => {
    second = await postRun(foreman, AGAIN);
  });

  await then(
    'the stage "implement" of the second run succeeded with the merge commit as its factory version',
    async () => {
      await profile.until(async () => (await implementOf(foreman, second))?.state, "succeeded");
      const [before, after] = await Promise.all([runView(foreman, first), runView(foreman, second)]);
      expect(after.factoryVersion).toBe(pull.merge_commit_sha);
      // The first run keeps the factory version it started with (ADR 0110).
      expect(before.factoryVersion).not.toBe(after.factoryVersion);
    },
  );
});
