import { scenario } from "@opensoftware/testkit";
import { baseCommit } from "./repo.ts";

const MISSING = "0000000000000000000000000000000000000001";

scenario("SCN-TRACE-055", async ({ sut, given, when, then }) => {
  await given('a base commit with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await baseCommit(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base 0000000000000000000000000000000000000001"', async () => {
    run = await sut.cli(["report", "--base", MISSING]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output contains "spec-trace: the base 0000000000000000000000000000000000000001 is not a commit of this repository"',
    async () => {
      expect(run.stderr).toContain(`spec-trace: the base ${MISSING} is not a commit of this repository`);
    },
  );
});
