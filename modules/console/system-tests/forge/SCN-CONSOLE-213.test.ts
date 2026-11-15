import { type Page, scenario } from "@opensoftware/testkit";
import {
  type Change,
  changeButtons,
  changeOfConsole,
  changeTexts,
  FACTORY,
  noMergeWhenGreen,
  openChanges,
  postCheck,
  press,
  withHost,
} from "../changes.ts";

scenario("SCN-CONSOLE-213", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given(
    'a forge adapter that cannot merge a pull request of "tester/factory" when its checks pass, and a change of the console',
    async () => {
      change = await changeOfConsole(sut, fakes, { CONSOLE_FORGE_ADAPTER: await noMergeWhenGreen(sut) });
    },
  );

  let first: Page;
  let ready: Page;
  let sent: Page;
  await when(
    'a factory engineer opens "/changes", the check "factory" passes, and the person opens "/changes" again and presses "Merge"',
    async () => {
      first = await openChanges(sut);
      await postCheck(change, "success");
      ready = await openChanges(sut);
      sent = await press(sut, change.pr.number, "merge");
    },
  );

  await then(
    'the change showed "Checking" without a button first, and then "Ready" with the button "Merge"',
    async () => {
      expect(changeTexts(first)).toEqual([expect.stringMatching(/ Checking$/)]);
      expect(changeButtons(first)).toEqual([]);
      expect(changeTexts(ready)).toEqual([
        expect.stringMatching(/The check factory passed\. Merge it to make it live for the next run\. .* Ready Merge$/),
      ]);
      expect(changeButtons(ready)).toEqual(["Merge"]);
    },
  );

  await then('the console answered 303 to "/changes", and "main" holds the factory.yaml of the change', async () => {
    expect(sent.status).toBe(303);
    expect(sent.location).toBe("/changes");
    expect(await change.forge.file("factory", "factory.yaml", "main")).toBe(withHost(FACTORY, "api.linear.app"));
  });
});
