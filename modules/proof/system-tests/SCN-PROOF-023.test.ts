import { scenario } from "@opensoftware/testkit";
import { forgejoBundle } from "./forge.ts";
import { screenshot } from "./reports.ts";

scenario("SCN-PROOF-023", async ({ sut, fakes, given, when, then }) => {
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

  await then(
    'the pull request has a comment that links "https://ci.example.com/evidence" and lists "SCN-WEB-001" as "passed"',
    async () => {
      const [comment] = await setup.forge.comments(setup.pr);
      expect(comment).toContain("(https://ci.example.com/evidence)");
      expect(comment).toContain("| SCN-WEB-001 | passed |");
    },
  );

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
