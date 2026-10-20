import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-014", async ({ sut, given, when, then }) => {
  await given('a repository with the deprecated scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut, "deprecated");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 is deprecated but still has a system test"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE features/checkout.feature:4 SCN-SHOP-001 is deprecated but still has a system test",
      );
    },
  );
});
