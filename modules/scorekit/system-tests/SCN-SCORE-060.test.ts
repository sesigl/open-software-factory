import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

const SCORES = [
  scoreRecord("run-03", 0, {
    name: "scope-creep",
    timestamp: "2026-01-02T10:00:00Z",
    cost: 0.02,
    comment: "Adds a | pipe\nand a new line.",
  }),
  scoreRecord("run-02", 1, { timestamp: "2026-01-02T09:00:00Z", cost: 0.01, comment: "Fine." }),
  scoreRecord("run-01", 0, { timestamp: "2026-01-01T09:00:00Z", cost: 0.01, comment: "Not fine." }),
  scoreRecord("run-01", 1, { source: "ANNOTATION", timestamp: "2026-01-03T09:00:00Z" }),
];

const MARKDOWN = `# Scores

| Scorer | Runs | Pass | Fail | Pass rate | Cost (USD) |
| --- | ---: | ---: | ---: | ---: | ---: |
| redundant-tests | 2 | 1 | 1 | 50.0% | 0.0200 |
| scope-creep | 1 | 0 | 1 | 0.0% | 0.0200 |

## redundant-tests

| Day | Runs | Pass rate |
| --- | ---: | ---: |
| 2026-01-01 | 1 | 0.0% |
| 2026-01-02 | 1 | 100.0% |

| Run | Result | Reason | Time | Cost (USD) |
| --- | --- | --- | --- | ---: |
| run-01 | fail | Not fine. | 2026-01-01T09:00:00Z | 0.0100 |
| run-02 | pass | Fine. | 2026-01-02T09:00:00Z | 0.0100 |

## scope-creep

| Day | Runs | Pass rate |
| --- | ---: | ---: |
| 2026-01-02 | 1 | 0.0% |

| Run | Result | Reason | Time | Cost (USD) |
| --- | --- | --- | --- | ---: |
| run-03 | fail | Adds a \\| pipe and a new line. | 2026-01-02T10:00:00Z | 0.0200 |
`;

scenario("SCN-SCORE-060", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with 3 scores of "scope-creep" and "redundant-tests" not in time order, a label with the source "ANNOTATION" and a reason with "|" and a line break',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", jsonl(SCORES));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit report scores.jsonl --markdown report.md"', async () => {
    run = await sut.cli(["report", "scores.jsonl", "--markdown", "report.md"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output has one line per scorer, sorted by name, with its runs, pass rate and cost", async () => {
    expect(run.stdout).toBe(
      "redundant-tests: 2 runs, pass rate 50.0%, cost 0.02 USD\nscope-creep: 1 runs, pass rate 0.0%, cost 0.02 USD\n",
    );
  });

  await then(
    '"report.md" has the table of the scorers, then for each scorer the table of its days and the table of its runs',
    async () => {
      expect(await sut.files.read("$INPUT/report.md")).toBe(MARKDOWN);
    },
  );
});
