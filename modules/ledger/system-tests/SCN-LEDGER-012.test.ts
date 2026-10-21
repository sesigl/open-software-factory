import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-012", async ({ sut, given, when, then }) => {
  await given(
    'a run with the source "slack", the requester "github:mona", the agent "implementer" and the model "claude-sonnet-5-5" and spend rows of 3.00 USD',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          runLine("run-01", { source: "slack", requester: "github:mona", agent: "implementer" }),
          spendRow("req-1", 2, { run: "run-01", model: "claude-sonnet-5-5" }),
          spendRow("req-2", 1, { run: "run-01", model: "claude-sonnet-5-5" }),
        ),
      );
    },
  );

  await given(
    'a run with the source "github", the requester "github:hubot", the agent "reviewer" and the model "claude-haiku-5-5" and spend rows of 1.00 USD',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        (await sut.files.read("$INPUT/data.jsonl")) +
          lines(
            runLine("run-02", { source: "github", requester: "github:hubot", agent: "reviewer" }),
            spendRow("req-3", 1, { run: "run-02", model: "claude-haiku-5-5" }),
          ),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    const run = await sut.cli(["report", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  const slices = (first: string, second: string) => [
    { name: first, usd: 3, share: 0.75 },
    { name: second, usd: 1, share: 0.25 },
  ];

  await then(
    '"report.json" shows the spend by "source" as "slack" 3.00 USD with the share 0.75 and "github" 1.00 USD with the share 0.25',
    async () => {
      expect((await readReport(sut)).spend.bySource).toEqual(slices("slack", "github"));
    },
  );

  await then(
    '"report.json" shows the spend by "user" as "github:mona" 3.00 USD with the share 0.75 and "github:hubot" 1.00 USD with the share 0.25',
    async () => {
      expect((await readReport(sut)).spend.byUser).toEqual(slices("github:mona", "github:hubot"));
    },
  );

  await then(
    '"report.json" shows the spend by "agent" as "implementer" 3.00 USD with the share 0.75 and "reviewer" 1.00 USD with the share 0.25',
    async () => {
      expect((await readReport(sut)).spend.byAgent).toEqual(slices("implementer", "reviewer"));
    },
  );

  await then(
    '"report.json" shows the spend by "model" as "claude-sonnet-5-5" 3.00 USD with the share 0.75 and "claude-haiku-5-5" 1.00 USD with the share 0.25',
    async () => {
      expect((await readReport(sut)).spend.byModel).toEqual(slices("claude-sonnet-5-5", "claude-haiku-5-5"));
    },
  );
});
