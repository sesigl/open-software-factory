import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, readReport } from "./records.ts";

scenario("SCN-LEDGER-026", async ({ sut, given, when, then }) => {
  await given(`4 merged pull requests, one of them titled 'Revert "Add the checkout page"'`, async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        opened(1, { title: "Add the checkout page" }),
        opened(2),
        opened(3),
        opened(4, { title: 'Revert "Add the checkout page"' }),
        opened(5, { title: 'Revert "Change 2"' }),
        ...[1, 2, 3, 4].map((number) => closed(number, "2026-01-06T10:00:00Z")),
        closed(5, "2026-01-06T10:00:00Z", false),
      ),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report data.jsonl"', async () => {
    run = await sut.cli(["report", "data.jsonl"]);
  });

  await then('"report.json" shows the revert rate 0.25 with 1 revert of 4 merged pull requests', async () => {
    expect((await readReport(sut)).revertRate).toEqual({ rate: 0.25, reverts: 1, merged: 4 });
  });

  await then('the output says "revert rate 25.0%"', async () => {
    expect(run.stdout).toContain("revert rate 25.0%");
  });
});
