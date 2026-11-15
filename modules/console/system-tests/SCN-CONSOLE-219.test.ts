import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, changeTexts, factoryRepository, headOf, openChanges, press, servingChanges } from "./changes.ts";

const BRANCH = "console/add-egress-triage-1a2b3c4-5e6f7a8b";

scenario("SCN-CONSOLE-219", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let sha: string;
  await given(
    'a factory repository "tester/factory" with an open pull request from "console/add-egress-triage-1a2b3c4-5e6f7a8b" by "forgejo:tester", and a console whose "CONSOLE_FACTORY_USER" is "forgejo:factory-bot"',
    async () => {
      forge = await factoryRepository(sut, fakes);
      ({ sha } = await forge.openPullRequest("factory", {
        branch: BRANCH,
        title: "factory edit add-egress triage api.linear.app",
        files: { "notes.md": "a change of another person\n" },
      }));
      await servingChanges(sut, fakes, { ...changesEnv(sut, forge), CONSOLE_FACTORY_USER: "forgejo:factory-bot" });
    },
  );

  let page: Page;
  let sent: Page;
  await when('a factory engineer opens "/changes" and sends the form "Discard" of pull request 1', async () => {
    page = await openChanges(sut);
    sent = await press(sut, 1, "discard");
  });

  await then("the page lists no change", async () => {
    expect(page.status).toBe(200);
    expect(changeTexts(page)).toEqual([]);
    expect(page.getByText("No changes yet.").text).toBe("No changes yet.");
  });

  await then('the form answers 404 and says "no change #1 of the console in tester/factory"', async () => {
    expect(sent.status).toBe(404);
    expect(sent.text).toContain("no change #1 of the console in tester/factory");
  });

  await then("the pull request is still open, with its branch", async () => {
    expect((await forge.pullRequests("factory")).map((pull) => pull.state)).toEqual(["open"]);
    expect(await headOf(forge, BRANCH)).toBe(sha);
  });
});
