import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-040", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given('an open pull request in "tester/web" from "console/add-skill"', async () => {
    box = await setup(sut, fakes);
    pr = await openFrom(box.forge, "console/add-skill");
  });

  let closed: Record<string, unknown>;
  await when('the client runs "close tester/web <number> --delete-branch"', async () => {
    closed = await box.json(["close", box.repo, String(pr.number), "--delete-branch"]);
  });

  await then('close prints the number and the state "closed"', async () => {
    expect(closed).toEqual({ number: pr.number, state: "closed" });
  });

  await then('the repository has no branch "console/add-skill"', async () => {
    expect((await box.forge.branches("web")).map((each) => each.name)).not.toContain("console/add-skill");
    expect((await box.forge.pullRequests("web")).find((each) => each.number === pr.number)?.state).toBe("closed");
  });
});
