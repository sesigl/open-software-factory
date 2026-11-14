import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-043", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given('an open pull request in "tester/web" from "console/add-skill"', async () => {
    box = await setup(sut, fakes);
    pr = await openFrom(box.forge, "console/add-skill");
  });

  let closed: Record<string, unknown>;
  await when('the client runs "close tester/web <number>"', async () => {
    closed = await box.json(["close", box.repo, String(pr.number)]);
  });

  await then('close prints the number and the state "closed"', async () => {
    expect(closed).toEqual({ number: pr.number, state: "closed" });
    expect((await box.forge.pullRequests("web")).find((each) => each.number === pr.number)?.state).toBe("closed");
  });

  await then('the repository still has the branch "console/add-skill" at the pull request\'s head commit', async () => {
    const kept = (await box.forge.branches("web")).find((each) => each.name === "console/add-skill");
    expect(kept?.sha).toBe(pr.sha);
  });
});
