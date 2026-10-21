import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-025", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01',
    async () => {
      const scores = (["run-01", "run-02", "run-03", "run-04"] as const).map((run, index) =>
        scoreRecord(run, index < 3 ? 1 : 0, { cost: 0.01 }),
      );
      await sut.files.put("$INPUT/scores.jsonl", jsonl(scores));
    },
  );

  await when('the user runs "scorekit report scores.jsonl --markdown report.md"', async () => {
    await sut.cli(["report", "scores.jsonl", "--markdown", "report.md"]);
  });

  await then('"report.md" has the row "| redundant-tests | 4 | 3 | 1 | 75.0% | 0.0400 |"', async () => {
    expect((await sut.files.read("$INPUT/report.md")).split("\n")).toContain(
      "| redundant-tests | 4 | 3 | 1 | 75.0% | 0.0400 |",
    );
  });
});
