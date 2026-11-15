import { type Page, scenario } from "@opensoftware/testkit";
import { type Change, changeOfConsole, noMergeWhenGreen, postCheck, press } from "../changes.ts";

scenario("SCN-CONSOLE-214", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given(
    'a forge adapter that cannot merge a pull request of "tester/factory" when its checks pass, and a change of the console whose check "factory" failed',
    async () => {
      change = await changeOfConsole(sut, fakes, { CONSOLE_FORGE_ADAPTER: await noMergeWhenGreen(sut) });
      await postCheck(change, "failure");
    },
  );

  let sent: Page;
  await when('a factory engineer sends the form "Merge" of the change', async () => {
    sent = await press(sut, change.pr.number, "merge");
  });

  await then('the form answers 409 and says "Not merged: the check factory of #1 is not green"', async () => {
    expect(sent.status).toBe(409);
    expect(sent.text).toContain(`Not merged: the check factory of #${change.pr.number} is not green`);
  });

  await then("the pull request is still open", async () => {
    expect((await change.forge.pullRequests("factory")).map((pull) => pull.state)).toEqual(["open"]);
  });
});
