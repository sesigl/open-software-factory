import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-042", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given(
    '"main" of "tester/web" requires the check "factory", and an open pull request whose check "factory" is "success"',
    async () => {
      box = await setup(sut, fakes);
      await box.json(["protect", box.repo, "main", "--check", "factory"]);
      pr = await openFrom(box.forge, "console/add-skill");
      await box.json(["check", box.repo, pr.sha, "factory", "success"]);
    },
  );

  let merged: Record<string, unknown>;
  await when('the client runs "merge tester/web <number> --when-green"', async () => {
    merged = await box.json(["merge", box.repo, String(pr.number), "--when-green"]);
  });

  await then("merge prints the merge commit, and the pull request is merged", async () => {
    const after = await box.json(["pr", box.repo, String(pr.number)]);
    expect(after.state).toBe("merged");
    expect(merged).toEqual({ sha: after.mergeCommit });
    expect(await box.forge.file("web", "console-add-skill.md", "main")).toBe("console/add-skill\n");
  });
});
