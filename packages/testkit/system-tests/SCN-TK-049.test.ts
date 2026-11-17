import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-049", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  let merge = "";
  await given("a pull request that the test merged in fakes.forge, and the merge commit it got back", async () => {
    forge = await fakes.forge();
    await forge.createRepository("demo", { "notes.md": "hello\n" });
    pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "fix.md": "fixed\n" } });
    merge = await forge.mergePullRequest(pr);
  });

  let read: { merged: boolean; merge_commit_sha: string };
  await when("a module reads the pull request through the forge's API", async () => {
    read = await forgeClient(forge, "demo")("GET", `/pulls/${pr.number}`);
  });

  await then("the pull request is merged with that merge commit", async () => {
    expect(merge).toMatch(/^[0-9a-f]{40}$/);
    expect({ merged: read.merged, merge: read.merge_commit_sha }).toEqual({ merged: true, merge });
  });
});
