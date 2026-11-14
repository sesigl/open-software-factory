import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FGITHUB-010", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given(
    '"main" of "tester/web" requires the check "factory", the repository does not allow auto-merge, and an open pull request whose check "factory" is pending',
    async () => {
      box = await setup(sut, fakes);
      await box.json(["protect", box.repo, "main", "--check", "factory"]);
      pr = await openFrom(box.forge, "console/add-skill");
      await box.json(["check", box.repo, pr.sha, "factory", "pending"]);
    },
  );

  let run: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["run"]>>;
  await when('the client runs "merge tester/web <number> --when-green"', async () => {
    run = await box.run(["merge", box.repo, String(pr.number), "--when-green"]);
  });

  await then(
    'merge exits with code 1 and prints "the forge cannot merge tester/web#1 when its checks pass: allow auto-merge in the repository\'s settings"',
    async () => {
      expect(run.exitCode, run.stdout + run.stderr).toBe(1);
      expect(run.stderr).toContain(
        "the forge cannot merge tester/web#1 when its checks pass: allow auto-merge in the repository's settings",
      );
    },
  );

  await then("the pull request is still open", async () => {
    expect((await box.json(["pr", box.repo, String(pr.number)])).state).toBe("open");
  });
});
