import { scenario } from "@opensoftware/testkit";
import { lines, opened, readReport, reviewed } from "./records.ts";

scenario("SCN-LEDGER-020", async ({ sut, given, when, then }) => {
  await given("a pull request opened on 2026-01-05 with 3 reviews by people and 1 by a bot", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        opened(1, { at: "2026-01-05T09:00:00Z" }),
        reviewed(1, "2026-01-05T10:00:00Z", { state: "changes_requested" }),
        reviewed(1, "2026-01-05T11:00:00Z", { state: "commented" }),
        reviewed(1, "2026-01-05T12:00:00Z"),
        reviewed(1, "2026-01-05T09:30:00Z", { bot: true, state: "commented" }),
      ),
    );
  });

  await given("a pull request opened on 2026-01-06 with 1 comment by a person", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      (await sut.files.read("$INPUT/data.jsonl")) +
        lines(opened(2, { at: "2026-01-06T09:00:00Z" }), reviewed(2, "2026-01-06T10:00:00Z", { state: "commented" })),
    );
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows 2 human interactions per pull request', async () => {
    expect((await readReport(sut)).humanInteractions.perPullRequest).toBe(2);
  });

  await then('the human interactions per pull request 3 on "2026-01-05" and 1 on "2026-01-06"', async () => {
    expect((await readReport(sut)).humanInteractions.perDay).toEqual([
      { date: "2026-01-05", perPullRequest: 3 },
      { date: "2026-01-06", perPullRequest: 1 },
    ]);
  });
});
