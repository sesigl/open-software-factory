import { scenario } from "@opensoftware/testkit";
import { bundleOf } from "./reports.ts";

scenario("SCN-PROOF-031", async ({ sut, given, when, then }) => {
  await given('a bundle without a pull request where "SCN-WEB-001" passed', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout" }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof attach evidence" with PROOF_FORGE_TOKEN', async () => {
    run = await sut.cli(["attach", "evidence"], { env: { PROOF_FORGE_TOKEN: "test-token" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output contains "give the pull request with --pr"', async () => {
    expect(run.stderr).toContain("give the pull request with --pr");
  });
});
