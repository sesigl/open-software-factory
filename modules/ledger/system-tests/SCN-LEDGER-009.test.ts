import { scenario } from "@opensoftware/testkit";
import { lines, opened } from "./records.ts";

scenario("SCN-LEDGER-009", async ({ sut, given, when, then }) => {
  await given('the file "events.jsonl" with 1 "gate.decided@v1" event and 1 "pr.opened@v1" event', async () => {
    const gate = {
      specversion: "1.0",
      id: "evt-gate-1",
      source: "/osf/gatekeeper",
      type: "gate.decided@v1",
      time: "2026-01-05T09:00:00Z",
      data: { gateId: "gate-1", workItemId: "work-1", decision: "approved", decidedAt: "2026-01-05T09:00:00Z" },
    };
    await sut.files.put("$INPUT/events.jsonl", lines(gate, opened(1)));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest events.jsonl"', async () => {
    run = await sut.cli(["ingest", "events.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the output says "ingested 0 runs, 0 spend rows and 1 event into ledger.duckdb; skipped 1 event of another type"',
    async () => {
      expect(run.stdout).toContain(
        "ingested 0 runs, 0 spend rows and 1 event into ledger.duckdb; skipped 1 event of another type",
      );
    },
  );
});
