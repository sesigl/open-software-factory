import { scenario } from "@opensoftware/testkit";
import { lines, mergedFrom, readReport } from "./records.ts";

scenario("SCN-LEDGER-070", async ({ sut, given, when, then }) => {
  await given(
    'merged pull requests from the head branches "bot/run-1", "ci/bump-2", "osf/run-3" and "fix-login"',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          ...mergedFrom(1, "bot/run-1"),
          ...mergedFrom(2, "ci/bump-2"),
          ...mergedFrom(3, "osf/run-3"),
          ...mergedFrom(4, "fix-login"),
        ),
      );
    },
  );

  await when(`the user runs "ledger report --factory-branches 'bot/, ci/,' data.jsonl"`, async () => {
    const run = await sut.cli(["report", "--factory-branches", "bot/, ci/,", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"report.json" shows the factory branches "bot/" and "ci/", 2 merged pull requests of the factory and 2 of people',
    async () => {
      const { origin } = await readReport(sut);
      expect(origin.factoryBranches).toEqual(["bot/", "ci/"]);
      expect(origin.factory.merged).toBe(2);
      expect(origin.people.merged).toBe(2);
    },
  );
});
