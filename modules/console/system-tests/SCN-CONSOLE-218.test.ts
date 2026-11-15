import { type Page, scenario } from "@opensoftware/testkit";
import { type Change, changeOfConsole, headOf, postCheck, press, REPOSITORY } from "./changes.ts";

const TITLE = "factory edit add-egress triage api.linear.app;curl";

scenario("SCN-CONSOLE-218", async ({ sut, fakes, given, when, then }) => {
  let change: Change;
  await given(
    'a change of the console whose check "factory" failed, and whose title a person changed to "factory edit add-egress triage api.linear.app;curl"',
    async () => {
      change = await changeOfConsole(sut, fakes);
      await postCheck(sut, change, "failure");
      const renamed = await fetch(`${change.forge.url}/api/v1/repos/${REPOSITORY}/pulls/${change.pr.number}`, {
        method: "PATCH",
        headers: { authorization: `token ${change.forge.token}`, "content-type": "application/json" },
        body: JSON.stringify({ title: TITLE }),
      });
      if (!renamed.ok) throw new Error(`the forge did not rename the pull request: ${renamed.status}`);
    },
  );

  let sent: Page;
  await when('a factory engineer presses "Try again"', async () => {
    sent = await press(sut, change.pr.number, "retry");
  });

  await then(
    'the form answers 400 and says "Not tried again: api.linear.app;curl is not a host name, like api.linear.app"',
    async () => {
      expect(sent.status).toBe(400);
      expect(sent.text).toContain("Not tried again: api.linear.app;curl is not a host name, like api.linear.app");
    },
  );

  await then("the pull request is still open, with its branch", async () => {
    expect((await change.forge.pullRequests("factory")).map(({ title, state }) => ({ title, state }))).toEqual([
      { title: TITLE, state: "open" },
    ]);
    expect(await headOf(change.forge, change.head)).toBe(change.pr.sha);
  });
});
