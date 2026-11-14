import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-037", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let first = "";
  await given('the commit of "main" of "tester/web", and a later commit on "main"', async () => {
    box = await setup(sut, fakes);
    first = (await box.forge.branches("web")).find((each) => each.name === "main")?.sha ?? "";
    await box.forge.mergePullRequest(await openFrom(box.forge, "later-change"));
  });

  let made: Record<string, unknown>;
  await when('the client runs "branch tester/web console/at-commit --from <the first commit>"', async () => {
    made = await box.json(["branch", box.repo, "console/at-commit", "--from", first]);
  });

  await then("branch prints the new branch with the first commit's SHA", async () => {
    expect(made).toEqual({ branch: "console/at-commit", sha: first });
    expect((await box.forge.branches("web")).find((each) => each.name === "main")?.sha).not.toBe(first);
  });
});
