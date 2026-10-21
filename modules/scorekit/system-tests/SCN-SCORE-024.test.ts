import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-024", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 2 scores of "redundant-tests" on 2026-01-01, one of them passed, and 2 passed scores on 2026-01-02',
    async () => {
      await sut.files.put(
        "$INPUT/scores.jsonl",
        jsonl([
          scoreRecord("run-01", 1, { timestamp: "2026-01-01T09:00:00Z" }),
          scoreRecord("run-02", 0, { timestamp: "2026-01-01T10:00:00Z" }),
          scoreRecord("run-03", 1, { timestamp: "2026-01-02T09:00:00Z" }),
          scoreRecord("run-04", 1, { timestamp: "2026-01-02T10:00:00Z" }),
        ]),
      );
    },
  );

  await when('the user runs "scorekit report scores.jsonl"', async () => {
    await sut.cli(["report", "scores.jsonl"]);
  });

  await then(
    '"report.json" shows for "redundant-tests" the pass rate 0.5 on "2026-01-01" and 1 on "2026-01-02"',
    async () => {
      const [scorer] = JSON.parse(await sut.files.read("$OUTPUT/report.json")).scorers;
      expect(scorer).toMatchObject({ name: "redundant-tests" });
      expect(scorer.days).toMatchObject([
        { date: "2026-01-01", passRate: 0.5 },
        { date: "2026-01-02", passRate: 1 },
      ]);
    },
  );
});
