import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, spanIdOf } from "./records.ts";

scenario("SCN-LEDGER-025", async ({ sut, given, when, then }) => {
  await given(
    'a run of the agent "implementer" that started a run of the agent "reviewer" in its trace, and a run of the harness "codex" without an agent name',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          runLine("run-01", { agent: "implementer" }),
          runLine("run-02", { agent: "reviewer", parent: { run: "run-01", span: spanIdOf("run-01", 1) } }),
          runLine("run-03", { harness: "codex" }),
        ),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows 3 runs, 2 of them top-level', async () => {
    expect((await readReport(sut)).runs).toMatchObject({ total: 3, topLevel: 2 });
  });

  await then(
    'by agent "implementer" 1 run and 1 top-level, "reviewer" 1 run and 0 top-level, "codex" 1 run and 1 top-level',
    async () => {
      expect((await readReport(sut)).runs.byAgent).toEqual([
        { agent: "codex", total: 1, topLevel: 1 },
        { agent: "implementer", total: 1, topLevel: 1 },
        { agent: "reviewer", total: 1, topLevel: 0 },
      ]);
    },
  );
});
