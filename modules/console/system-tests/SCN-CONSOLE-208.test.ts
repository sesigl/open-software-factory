import { type Page, scenario } from "@opensoftware/testkit";
import { type Change, changeButtons, changeOfConsole, changeTexts, headOf, openChanges, postCheck } from "./changes.ts";

scenario("SCN-CONSOLE-208", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given('a change of the console that waits for its check "factory"', async () => {
    change = await changeOfConsole(sut, fakes);
  });

  let page: Page;
  let merged: string;
  await when(
    'the check "factory" of its pull request passes, the forge merges it, and a person opens "/changes"',
    async () => {
      await postCheck(sut, change, "success");
      // Forgejo merges a pull request that waits for its checks in the background, once the status arrived.
      const state = async () => (await change.forge.pullRequests("factory"))[0]?.state;
      await expect.poll(state, { timeout: 30_000, interval: 200 }).toBe("closed");
      merged = (await headOf(change.forge, "main")) as string;
      page = await openChanges(sut);
    },
  );

  await then('the change shows "Live" and "Live for the next run: factory version <the merge commit>"', async () => {
    expect(changeTexts(page)).toEqual([
      `The agent triage may reach the host api.linear.app. Live for the next run: factory version ${merged.slice(0, 7)} Pull request #${change.pr.number} Live`,
    ]);
    expect(page.refresh).toBeUndefined();
  });

  await then("it has no button", async () => {
    expect(changeButtons(page)).toEqual([]);
  });
});
