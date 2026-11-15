import { type Page, scenario } from "@opensoftware/testkit";
import {
  type Change,
  changeButtons,
  changeItems,
  changeOfConsole,
  changeTexts,
  openChanges,
  postCheck,
} from "../changes.ts";
import { links } from "../console.ts";

scenario("SCN-CONSOLE-209", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given('a change of the console that waits for its check "factory"', async () => {
    change = await changeOfConsole(sut, fakes);
  });

  let page: Page;
  await when('the check "factory" of its pull request fails and a factory engineer opens "/changes"', async () => {
    await postCheck(change, "failure");
    page = await openChanges(sut);
  });

  await then('the change shows "Failed" and "The check factory failed."', async () => {
    expect(changeTexts(page)).toEqual([
      expect.stringMatching(
        /^The agent triage may reach the host api\.linear\.app\. The check factory failed\. .* Failed/,
      ),
    ]);
  });

  await then("it links its pull request", async () => {
    expect(links(changeItems(page)[0])).toEqual([{ href: change.pr.url, text: `Pull request #${change.pr.number}` }]);
  });

  await then('it has the buttons "Try again" and "Discard"', async () => {
    expect(changeButtons(page)).toEqual(["Try again", "Discard"]);
  });
});
