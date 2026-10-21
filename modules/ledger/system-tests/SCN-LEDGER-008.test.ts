import { scenario } from "@opensoftware/testkit";
import { closed, lines } from "./records.ts";

scenario("SCN-LEDGER-008", async ({ sut, given, when, then }) => {
  await given('the file "events.jsonl" whose line 1 is a "pr.closed@v1" event without "merged"', async () => {
    const event = closed(1, "2026-01-05T12:00:00Z") as { data: Record<string, unknown> };
    delete event.data.merged;
    await sut.files.put("$INPUT/events.jsonl", lines(event));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest events.jsonl"', async () => {
    run = await sut.cli(["ingest", "events.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output names "events.jsonl:1", "pr.closed@v1" and "/data"', async () => {
    expect(run.stderr).toContain("events.jsonl:1");
    expect(run.stderr).toContain("pr.closed@v1");
    expect(run.stderr).toContain("/data");
  });
});
