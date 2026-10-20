import { scenario } from "@opensoftware/testkit";
import { forgejoBundle } from "./forge.ts";
import { screenshot } from "./reports.ts";

scenario("SCN-PROOF-025", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof forgejoBundle>>;
  await given(
    'a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed and "SCN-WEB-002" failed',
    async () => {
      setup = await forgejoBundle(sut, fakes, [
        { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] },
        { title: "SCN-WEB-002 refund", status: "unexpected", attachments: [screenshot("refund.png")] },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --pr <pull request>" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge',
    async () => {
      run = await sut.cli(["attach", "evidence", "--pr", setup.pr.url], { env: setup.env });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the head commit has the status "proof" with the state "failure" and the description "1 of 2 scenarios passed"',
    async () => {
      expect(await setup.forge.statuses(setup.pr)).toContainEqual({
        context: "proof",
        state: "failure",
        description: "1 of 2 scenarios passed",
      });
    },
  );
});
