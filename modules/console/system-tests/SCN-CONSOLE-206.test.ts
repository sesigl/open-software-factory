import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import {
  changesEnv,
  changeTexts,
  commitOf,
  FACTORY,
  factoryRepository,
  headOf,
  openChanges,
  propose,
  servingChanges,
  withHost,
} from "./changes.ts";

scenario("SCN-CONSOLE-206", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let main: string;
  await given(
    'a factory repository "tester/factory" whose main branch requires the check "factory" and whose agent "triage" may reach "api.github.com", and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"',
    async () => {
      forge = await factoryRepository(sut, fakes);
      main = (await headOf(forge, "main")) as string;
      await servingChanges(sut, fakes, changesEnv(sut, forge));
    },
  );

  let sent: Page;
  await when(
    '"grace@acme.dev" sends the form "Propose change" with "add-egress", the agent "triage" and the value "api.linear.app"',
    async () => {
      sent = await propose(sut);
    },
  );

  await then('the console answered 303 to "/changes"', async () => {
    expect(sent.status).toBe(303);
    expect(sent.location).toBe("/changes");
  });

  let head: string;
  await then(
    'the forge has one open pull request titled "factory edit add-egress triage api.linear.app" from a branch "console/add-egress-triage-<the newest commit>-<hash of the edit>", whose body says that "grace@acme.dev" asked for it',
    async () => {
      const pulls = await forge.pullRequests("factory");
      expect(pulls.map(({ title, state, base }) => ({ title, state, base }))).toEqual([
        { title: "factory edit add-egress triage api.linear.app", state: "open", base: "main" },
      ]);
      head = pulls[0]?.head ?? "";
      expect(head).toMatch(new RegExp(`^console/add-egress-triage-${main.slice(0, 7)}-[0-9a-f]{8}$`));
      expect(pulls[0]?.body).toContain("grace@acme.dev asked for this change of the factory in the console.");
      expect(pulls[0]?.body).toContain("The agent `triage` may reach the host `api.linear.app`.");
    },
  );

  await then(
    'its one commit starts at the newest commit of "main", holds the factory.yaml that "factory edit" printed for that commit, and ends with the trailer "Requested-by: grace@acme.dev"',
    async () => {
      const commit = await commitOf(forge, (await headOf(forge, head)) as string);
      expect(commit.parents).toEqual([main]);
      expect(await forge.file("factory", "factory.yaml", head)).toBe(withHost(FACTORY, "api.linear.app"));
      expect(commit.message.trimEnd()).toMatch(/\n\nRequested-by: grace@acme\.dev$/);
    },
  );

  await then(
    '"/changes" shows the change as "Checking", "The agent triage may reach the host api.linear.app.", and reloads itself',
    async () => {
      const page = await openChanges(sut);
      expect(page.status).toBe(200);
      expect(changeTexts(page)).toEqual([
        expect.stringMatching(/^The agent triage may reach the host api\.linear\.app\. .* Checking$/),
      ]);
      expect(page.refresh).toBe(10);
    },
  );
});
