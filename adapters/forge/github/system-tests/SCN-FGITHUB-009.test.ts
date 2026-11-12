import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-009", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web" and a token that may not read check runs', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr" for it with that token', async () => {
    run = await box.run(["pr", "tester/web", String(pr.number)], { FORGE_TOKEN: box.forge.noChecksToken });
  });

  await then(
    'pr exits with code 1 and an error that names the repository and the permission "Checks: read"',
    async () => {
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toBe("");
      expect(run.stderr).toBe(
        'forge-github: the token may not read the check runs of tester/web: give it the permission "Checks: read"\n',
      );
    },
  );
});
