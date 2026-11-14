import { scenario } from "@opensoftware/testkit";
import { open, serving } from "./console.ts";
import { lines, runRecord, score, table } from "./improvement.ts";

scenario("SCN-CONSOLE-092", async ({ sut, given, when, then }) => {
  await given(
    '"CONSOLE_IMPROVE_DIR" names a folder with a score of "redundant-tests" in "scores.jsonl", a line that is no JSON and a CloudEvent in it, a run record of "run_a" in "run_a.json", and a score of "slow-tests" in "scores.jsonl.bak"',
    async () => {
      const event = { specversion: "1.0", type: "work.received", id: "e1", source: "intake" };
      await sut.files.put(
        "$INPUT/improve/scores.jsonl",
        `${lines([score("redundant-tests", "run_a", 1)])}{"half a line\n${JSON.stringify(event)}\n`,
      );
      await sut.files.put(
        "$INPUT/improve/runs/run_a.json",
        JSON.stringify(runRecord("run_a", "implement", "succeeded", 1)),
      );
      await sut.files.put("$INPUT/improve/scores.jsonl.bak", lines([score("slow-tests", "run_a", 0)]));
      await serving(sut, ["http://127.0.0.1:1"], { CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve") });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/improvement"', async () => {
    page = await open(sut, "/improvement");
  });

  await then('the table "Scores" shows only "redundant-tests"', async () => {
    expect(page.status).toBe(200);
    expect(table(page.html, "Scores").map((row) => row[0])).toEqual(["redundant-tests"]);
  });

  await then('the table "Runs" shows "run_a"', async () => {
    expect(table(page.html, "Runs")).toEqual([["run_a", "implement", "succeeded", "1.00 USD"]]);
  });
});
