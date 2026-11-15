import { type Page, scenario } from "@opensoftware/testkit";
import {
  type Change,
  changeButtons,
  changeOfConsole,
  changeTexts,
  headOf,
  openChanges,
  postCheck,
  press,
} from "../changes.ts";

scenario("SCN-CONSOLE-212", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given('a change of the console whose check "factory" failed', async () => {
    change = await changeOfConsole(sut, fakes);
    await postCheck(sut, change, "failure");
  });

  let sent: Page;
  let page: Page;
  await when('a factory engineer presses "Discard" and opens "/changes"', async () => {
    sent = await press(sut, change.pr.number, "discard");
    page = await openChanges(sut);
  });

  await then('the console answered 303 to "/changes"', async () => {
    expect(sent.status).toBe(303);
    expect(sent.location).toBe("/changes");
  });

  await then("the pull request is closed and its branch is gone", async () => {
    expect((await change.forge.pullRequests("factory")).map((pull) => pull.state)).toEqual(["closed"]);
    expect(await headOf(change.forge, change.head)).toBeUndefined();
  });

  await then('the change shows "Discarded" and has no button', async () => {
    expect(changeTexts(page)).toEqual([
      `The agent triage may reach the host api.linear.app. Closed without a merge. Pull request #${change.pr.number} Discarded`,
    ]);
    expect(changeButtons(page)).toEqual([]);
  });
});
