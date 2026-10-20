import { scenario } from "@opensoftware/testkit";
import { forgejoBundle } from "./forge.ts";
import { screenshot } from "./reports.ts";

scenario("SCN-PROOF-024", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof forgejoBundle>>;
  await given('a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed', async () => {
    setup = await forgejoBundle(sut, fakes, [
      { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] },
    ]);
  });

  await given("the developer attached the bundle to the pull request once", async () => {
    const first = await sut.cli(["attach", "evidence", "--pr", setup.pr.url], { env: setup.env });
    expect(first.exitCode, first.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --pr <pull request>" again with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge',
    async () => {
      run = await sut.cli(["attach", "evidence", "--pr", setup.pr.url], { env: setup.env });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the pull request has exactly one comment from proof", async () => {
    const comments = await setup.forge.comments(setup.pr);
    expect(comments.filter((comment) => comment.startsWith("<!-- proof -->"))).toHaveLength(1);
    expect(run.stdout).toContain("updated the comment");
  });
});
