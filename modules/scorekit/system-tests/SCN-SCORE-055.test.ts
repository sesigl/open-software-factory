import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

const NAME = '"name" must be lowercase letters, digits and hyphens';
const SAMPLE = '"sample" must be a number from 0 to 1';
const MAX_CHARS = '"max_chars" must be a whole number of at least 200';
const PRICE = '"price" must have the numbers "input" and "output"';
const NO_FRONT = 'no front matter between "---" lines';
const NOT_MAPPING = "the front matter is not a mapping";

/** A scorer file with these front matter lines, the pass criterion and a prompt. */
const front = (line: string) => `---\n${line}\npass: Fine.\n---\nJudge.`;

/** The rows of the scenario's table, in order: the text of the scorer file and the error it gets. */
const ROWS: [string, string][] = [
  [front("name: 1st"), NAME],
  [front("name: twins!"), NAME],
  [front("description: 5"), '"description" must be a text'],
  [front('description: "  "'), '"description" must be a text'],
  [front('model: ""'), '"model" must be a text'],
  [front('sample: "0.5"'), SAMPLE],
  [front("sample: -0.1"), SAMPLE],
  [front("sample: 1.1"), SAMPLE],
  [front('max_chars: "300"'), MAX_CHARS],
  [front("max_chars: 250.5"), MAX_CHARS],
  [front("max_chars: 199"), MAX_CHARS],
  [front("price: 3"), PRICE],
  [front("price: null"), PRICE],
  [front('price: {input: "3", output: 15}'), PRICE],
  [front("price: {input: -1, output: 15}"), PRICE],
  [front('price: {input: 3, output: "15"}'), PRICE],
  [front("price: {input: 3, output: -1}"), PRICE],
  [front("price: {input: 3, output: 15, cached: 1}"), PRICE],
  ["Judge.", NO_FRONT],
  ["x\n---\npass: Fine.\n---\nJudge.", NO_FRONT],
  ["---\n- pass\n---\nJudge.", NOT_MAPPING],
  ["---\njust text\n---\nJudge.", NOT_MAPPING],
  ["---\npass: Fine.\n---\n   \n", "the judge prompt after the front matter is empty"],
];

const fileOf = (index: number) => `scorers/wrong-${index + 1}.md`;

scenario("SCN-SCORE-055", async ({ sut, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  await given('the scorer file "scorers/wrong-<row>.md" for each row of this table, with the row\'s text', async () => {
    for (const [index, [text]] of ROWS.entries()) await sut.files.put(`$INPUT/${fileOf(index)}`, text);
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when('the user runs "scorekit score --scorer scorers/wrong-<row>.md runs.jsonl" for each row', async () => {
    runs = await Promise.all(ROWS.map((_, index) => sut.cli(["score", "--scorer", fileOf(index), "runs.jsonl"])));
  });

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual(ROWS.map(() => 2));
  });

  await then(
    'the error output of each command is "scorekit: scorers/wrong-<row>.md: " and the error of its row',
    async () => {
      expect(runs.map((run) => run.stderr)).toEqual(
        ROWS.map(([, error], index) => `scorekit: ${fileOf(index)}: ${error}\n`),
      );
    },
  );
});
