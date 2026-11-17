import { scenario } from "@opensoftware/testkit";
import { lines, mergedFrom, readReport } from "./records.ts";

scenario("SCN-LEDGER-068", async ({ sut, given, when, then }) => {
  const events: unknown[] = [];
  await given('a merged pull request "Add the cart" from the head branch "osf/run-07"', async () => {
    events.push(...mergedFrom(1, "osf/run-07", { title: "Add the cart" }));
  });

  await given(`a merged pull request 'Revert "Add the cart"' from the head branch "revert-1-osf/run-07"`, async () => {
    events.push(
      ...mergedFrom(2, "revert-1-osf/run-07", { title: 'Revert "Add the cart"', at: "2026-01-07T10:00:00Z" }),
    );
    await sut.files.put("$INPUT/data.jsonl", lines(...events));
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    const run = await sut.cli(["report", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"report.json" shows the revert rate 1 for the factory with 1 revert of 1 merged pull request',
    async () => {
      expect((await readReport(sut)).origin.factory).toMatchObject({ revertRate: 1, reverts: 1, merged: 1 });
    },
  );

  await then('"report.json" shows the revert rate 0 for people with 0 reverts of 1 merged pull request', async () => {
    expect((await readReport(sut)).origin.people).toMatchObject({ revertRate: 0, reverts: 0, merged: 1 });
  });
});
