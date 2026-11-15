import { type Page, scenario } from "@opensoftware/testkit";
import {
  type Change,
  changeButtons,
  changeOfConsole,
  changeTexts,
  commitOnMain,
  FACTORY,
  openChanges,
  withHost,
} from "./changes.ts";

/** factory.yaml of the other person's commit: another host at the same place. */
const OTHER = withHost(FACTORY, "api.slack.com");

scenario("SCN-CONSOLE-210", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given('a change of the console that adds "api.linear.app" to the hosts of the agent "triage"', async () => {
    change = await changeOfConsole(sut, fakes);
  });

  let page: Page;
  await when(
    'another commit on "main" changes the hosts of "triage" and a factory engineer opens "/changes"',
    async () => {
      await commitOnMain(sut, change.forge, { "factory.yaml": OTHER });
      // Forgejo checks the open pull requests against their base in the background after a push.
      const state = async () => {
        page = await openChanges(sut);
        return changeTexts(page)[0] ?? "";
      };
      await expect.poll(state, { timeout: 30_000, interval: 200 }).toMatch(/ Conflict /);
    },
  );

  await then('the change shows "Conflict"', async () => {
    expect(changeTexts(page)).toEqual([
      expect.stringMatching(
        /^The agent triage may reach the host api\.linear\.app\. It conflicts with a newer commit of main\. .* Conflict/,
      ),
    ]);
  });

  await then('"main" holds the factory.yaml of the other commit', async () => {
    expect(await change.forge.file("factory", "factory.yaml", "main")).toBe(OTHER);
  });

  await then('it has the buttons "Try again" and "Discard"', async () => {
    expect(changeButtons(page)).toEqual(["Try again", "Discard"]);
  });
});
