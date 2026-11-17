import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-012", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  await given("a pull request in fakes.forge", async () => {
    forge = await fakes.forge();
    await forge.createRepository("demo");
    pr = await forge.openPullRequest("demo", {
      branch: "fix",
      title: "Fix the typo",
      files: { "notes.md": "hello\n" },
    });
  });

  await when(
    'a module comments "evidence bundle attached" and sets the status "proof" to "success" on it through the forge\'s API',
    async () => {
      const api = forgeClient(forge, "demo");
      const read = await api<{ head: { sha: string } }>("GET", `/pulls/${pr.number}`);
      await api("POST", `/issues/${pr.number}/comments`, { body: "evidence bundle attached" });
      await api("POST", `/statuses/${read.head.sha}`, { state: "success", context: "proof", description: "ok" });
    },
  );

  await then("fakes.forge shows that comment and that status", async () => {
    expect(await forge.comments(pr)).toContain("evidence bundle attached");
    expect(await forge.statuses(pr)).toContainEqual(expect.objectContaining({ context: "proof", state: "success" }));
  });
});
