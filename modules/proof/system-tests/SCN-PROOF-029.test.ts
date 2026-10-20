import { scenario } from "@opensoftware/testkit";
import { bundleOf, PR, SHA } from "./reports.ts";

scenario("SCN-PROOF-029", async ({ sut, given, when, then }) => {
  await given(
    'a bundle for the pull request "https://github.com/acme/web/pull/7" where "SCN-WEB-001" passed',
    async () => {
      await bundleOf(sut, [{ title: "SCN-WEB-001 checkout" }], { commit: SHA, pullRequest: PR });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof attach evidence" without PROOF_FORGE_TOKEN', async () => {
    run = await sut.cli(["attach", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "PROOF_FORGE_TOKEN is not set"', async () => {
    expect(run.stderr).toContain("PROOF_FORGE_TOKEN is not set");
  });
});
