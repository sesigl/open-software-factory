import { scenario } from "@opensoftware/testkit";
import { openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-044", async ({ sut, fakes, given, when, then }) => {
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

  await given('the client ran "merge tester/web <number> --when-green"', async () => {
    expect(await box.json(["merge", box.repo, String(pr.number), "--when-green"])).toEqual({ queued: true });
  });

  let run: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["run"]>>;
  await when('the client runs "merge tester/web <number> --when-green" again', async () => {
    run = await box.run(["merge", box.repo, String(pr.number), "--when-green"]);
  });

  await then('merge prints "queued" true and exits with code 0, and the pull request is still open', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ queued: true });
    expect((await box.json(["pr", box.repo, String(pr.number)])).state).toBe("open");
  });
});
