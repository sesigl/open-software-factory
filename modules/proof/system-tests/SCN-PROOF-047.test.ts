import { scenario } from "@opensoftware/testkit";
import { forgejoBundle } from "./forge.ts";
import { screenshot } from "./reports.ts";

scenario("SCN-PROOF-047", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof forgejoBundle>>;
  await given('a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed', async () => {
    setup = await forgejoBundle(sut, fakes, [
      { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --pr <pull request> --bundle-url https://ci.example.com/evidence" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge',
    async () => {
      run = await sut.cli(
        ["attach", "evidence", "--pr", setup.pr.url, "--bundle-url", "https://ci.example.com/evidence"],
        { env: setup.env },
      );
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  let comment: string;
  await then(
    'the pull request has a comment that links "https://ci.example.com/evidence" and says "Scenarios: 1 passed, 0 failed, 0 skipped"',
    async () => {
      [comment = ""] = await setup.forge.comments(setup.pr);
      expect(comment).toContain("(https://ci.example.com/evidence)");
      expect(comment).toContain("Scenarios: 1 passed, 0 failed, 0 skipped");
    },
  );

  await then('the comment does not name "SCN-WEB-001"', async () => {
    expect(comment).not.toContain("SCN-WEB-001");
  });

  await then(
    'the head commit has the status "proof" with the state "success" and the description "1 of 1 scenarios passed"',
    async () => {
      expect(await setup.forge.statuses(setup.pr)).toContainEqual({
        context: "proof",
        state: "success",
        description: "1 of 1 scenarios passed",
      });
    },
  );
});
