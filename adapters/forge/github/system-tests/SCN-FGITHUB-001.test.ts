import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" that "github-actions[bot]" commented "Evidence attached" on',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      const posted = await box.run(["comment", "tester/web", String(pr.number), "Evidence attached"], {
        FORGE_TOKEN: box.forge.actionsToken,
      });
      expect(posted.exitCode, posted.stderr).toBe(0);
    },
  );

  await given('the person "reviewer" commented "Looks good" on it', async () => {
    await box.forge.say(pr, "Looks good");
  });

  let lines: Record<string, unknown>[];
  await when(
    'the client runs "comments" for it with a GitHub Actions token, which may not read "GET /user"',
    async () => {
      const run = await box.run(["comments", "tester/web", String(pr.number)], { FORGE_TOKEN: box.forge.actionsToken });
      expect(run.exitCode, run.stderr).toBe(0);
      lines = run.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  );

  await then(
    'comments prints "Evidence attached" by "github-actions[bot]" with "mine" true and "Looks good" with "mine" false',
    async () => {
      expect(lines.map(({ text, person, mine }) => ({ text, person, mine }))).toEqual([
        { text: "Evidence attached", person: "github:github-actions[bot]", mine: true },
        { text: "Looks good", person: "github:reviewer", mine: false },
      ]);
    },
  );
});
