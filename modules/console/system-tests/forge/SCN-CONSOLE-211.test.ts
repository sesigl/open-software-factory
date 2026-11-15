import { type Page, scenario } from "@opensoftware/testkit";
import { type Change, changeOfConsole, commitOnMain, headOf, postCheck, press } from "../changes.ts";

scenario("SCN-CONSOLE-211", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  let newer: string;
  await given('a change of the console whose check "factory" failed, and a newer commit on "main"', async () => {
    change = await changeOfConsole(sut, fakes);
    await postCheck(change, "failure");
    await commitOnMain(change.forge, { "README.md": "# The factory of Acme\n" });
    newer = (await headOf(change.forge, "main")) as string;
  });

  let sent: Page;
  await when('a factory engineer presses "Try again"', async () => {
    sent = await press(sut, change.pr.number, "retry");
  });

  await then('the console answered 303 to "/changes"', async () => {
    expect(sent.status).toBe(303);
    expect(sent.location).toBe("/changes");
  });

  await then("the old pull request is closed and its branch is gone", async () => {
    const old = (await change.forge.pullRequests("factory")).find((pull) => pull.number === change.pr.number);
    expect(old?.state).toBe("closed");
    expect(await headOf(change.forge, change.head)).toBeUndefined();
  });

  await then(
    'the forge has a new open pull request titled "factory edit add-egress triage api.linear.app" from a branch "console/add-egress-triage-<the newer commit>-<the same hash>"',
    async () => {
      const open = (await change.forge.pullRequests("factory")).filter((pull) => pull.state === "open");
      const hash = change.head.split("-").at(-1);
      expect(open.map(({ title, head }) => ({ title, head }))).toEqual([
        {
          title: "factory edit add-egress triage api.linear.app",
          head: `console/add-egress-triage-${newer.slice(0, 7)}-${hash}`,
        },
      ]);
    },
  );
});
