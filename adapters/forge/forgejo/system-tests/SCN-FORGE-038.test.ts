import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-038", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given(
    '"main" of "tester/web" requires the check "factory", the repository allows a merge when the checks pass, and an open pull request whose check "factory" is pending',
    async () => {
      box = await setup(sut, fakes);
      await box.json(["protect", box.repo, "main", "--check", "factory"]);
      pr = await openFrom(box.forge, "console/add-skill");
      await box.json(["check", box.repo, pr.sha, "factory", "pending"]);
    },
  );

  let queued: Record<string, unknown>;
  let before: Record<string, unknown>;
  await when(
    'the client runs "merge tester/web <number> --when-green", then posts "factory" as "success" on its head',
    async () => {
      queued = await box.json(["merge", box.repo, String(pr.number), "--when-green"]);
      before = await box.json(["pr", box.repo, String(pr.number)]);
      await box.json(["check", box.repo, pr.sha, "factory", "success"]);
    },
  );

  await then('merge prints "queued" true, and the pull request was still open before the check passed', async () => {
    expect(queued).toEqual({ queued: true });
    expect(before.state).toBe("open");
  });

  await then("the forge then merges the pull request", async () => {
    // Forgejo merges a scheduled pull request in the background once the status arrived.
    const state = async () => (await box.json(["pr", box.repo, String(pr.number)])).state;
    await expect.poll(state, { timeout: 30_000, interval: 250 }).toBe("merged");
    expect(await box.forge.file("web", "console-add-skill.md", "main")).toBe("console/add-skill\n");
  });
});
