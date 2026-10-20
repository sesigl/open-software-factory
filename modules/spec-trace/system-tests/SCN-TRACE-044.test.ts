import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-044", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a bundle in "evidence" whose evidence.json has no scenarios', async () => {
    await sut.files.put("$INPUT/evidence/evidence.json", JSON.stringify({ manifestVersion: 1, artifacts: [] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --evidence evidence"', async () => {
    run = await sut.cli(["report", "--evidence", "evidence"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output contains "spec-trace: evidence/evidence.json does not match the evidence-bundle contract"',
    async () => {
      expect(run.stderr).toContain("spec-trace: evidence/evidence.json does not match the evidence-bundle contract");
    },
  );
});
