import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

/** The rows of the scenario's table: the arguments after "score" and the error they get. */
const ROWS: [string[], string][] = [
  [["--scorer", "redundant-tests", "--sample", "1.5", "runs.jsonl"], "--sample must be a number from 0 to 1"],
  [["--scorer", "redundant-tests", "--sample=-0.5", "runs.jsonl"], "--sample must be a number from 0 to 1"],
  [["--sample", "1", "runs.jsonl"], "--scorer is required: a pack name or a scorer file"],
  [["--scorer", "scorers/none.md", "runs.jsonl"], "scorers/none.md: no such scorer file"],
  [["--scorer", "redundant-tests", "--sample", "1"], "name at least one runs file or folder"],
];

scenario("SCN-SCORE-051", async ({ sut, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when('the user runs "scorekit score" with each of these arguments', async () => {
    runs = await Promise.all(ROWS.map(([args]) => sut.cli(["score", ...args])));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual(ROWS.map(() => 2));
  });

  await then('the error output of each command is "scorekit: " and the error of its row', async () => {
    expect(runs.map((run) => run.stderr)).toEqual(ROWS.map(([, error]) => `scorekit: ${error}\n`));
  });
});
