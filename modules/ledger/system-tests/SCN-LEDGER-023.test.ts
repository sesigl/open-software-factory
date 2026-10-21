import { scenario } from "@opensoftware/testkit";
import { lines, opened, readReport, reviewed } from "./records.ts";

scenario("SCN-LEDGER-023", async ({ sut, given, when, then }) => {
  await given("a pull request opened at 09:00, reviewed by a bot at 09:30 and by a person at 13:00", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        opened(1, { at: "2026-01-05T09:00:00Z" }),
        reviewed(1, "2026-01-05T09:30:00Z", { bot: true }),
        reviewed(1, "2026-01-05T13:00:00Z"),
      ),
    );
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows the median hours from pull request to first human review 4', async () => {
    expect((await readReport(sut)).cycleTime.pullRequestToFirstHumanReview).toBe(4);
  });
});
