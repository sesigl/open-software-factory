import { scenario } from "@opensoftware/testkit";
import { labelsFile, runsFile } from "./runs.ts";

const RANGE = "--min-agreement must be a number from 0 to 1";

/** The rows of the scenario's table: the arguments after "calibrate --scorer redundant-tests" and their error. */
const ROWS: [string[], string][] = [
  [["runs.jsonl"], "--labels is required: a file of score records with the source ANNOTATION"],
  [["--labels", "labels.jsonl", "--min-agreement", "1.5", "runs.jsonl"], RANGE],
  [["--labels", "labels.jsonl", "--min-agreement=-0.5", "runs.jsonl"], RANGE],
  [["--labels", "labels.jsonl", "--min-agreement", "most", "runs.jsonl"], RANGE],
];

scenario("SCN-SCORE-064", async ({ sut, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  await given('the labels file "labels.jsonl" that labels "run-01" "pass"', async () => {
    await sut.files.put("$INPUT/labels.jsonl", labelsFile({ "run-01": "pass" }));
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when('the user runs "scorekit calibrate --scorer redundant-tests" with each of these arguments', async () => {
    runs = await Promise.all(ROWS.map(([args]) => sut.cli(["calibrate", "--scorer", "redundant-tests", ...args])));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual(ROWS.map(() => 2));
  });

  await then('the error output of each command is "scorekit: " and the error of its row', async () => {
    expect(runs.map((run) => run.stderr)).toEqual(ROWS.map(([, error]) => `scorekit: ${error}\n`));
  });
});
