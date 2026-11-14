import { scenario } from "@opensoftware/testkit";
import { navLinks, open, serving, text } from "./console.ts";
import { lines, runRecord, score, table } from "./improvement.ts";

scenario("SCN-CONSOLE-090", async ({ sut, given, when, then }) => {
  await given(
    '"CONSOLE_IMPROVE_DIR" names a folder with the stage "implement" of "run_a" at 0.25 USD, the stage "review" of "run_b" at 0.5 USD and its stage "triage" without a cost, the scorer "redundant-tests" that passed "run_a" and failed "run_b" at 0.01 USD each, and the scorer "slow-tests" that failed "run_a" without a cost',
    async () => {
      await sut.files.put(
        "$INPUT/improve/runs/runs.jsonl",
        lines([
          runRecord("run_a", "implement", "succeeded", 0.25),
          runRecord("run_b", "review", "failed", 0.5),
          runRecord("run_b", "triage", "succeeded"),
        ]),
      );
      await sut.files.put(
        "$INPUT/improve/scores/scores.jsonl",
        lines([
          score("redundant-tests", "run_a", 1, 0.01),
          score("redundant-tests", "run_b", 0, 0.01),
          score("slow-tests", "run_a", 0),
        ]),
      );
      await serving(sut, ["http://127.0.0.1:1"], { CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve") });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/improvement"', async () => {
    page = await open(sut, "/improvement");
  });

  await then(
    'the table "Scores" shows "redundant-tests" with 2 scored, 1 passed, "50%" and "0.02 USD", and "slow-tests" with 1 scored, 0 passed, "0%" and "0.00 USD"',
    async () => {
      expect(page.status).toBe(200);
      expect(page.html).toContain("<title>Cost and scores · console</title>");
      expect(table(page.html, "Scores")).toEqual([
        ["redundant-tests", "2", "1", "50%", "0.02 USD"],
        ["slow-tests", "1", "0", "0%", "0.00 USD"],
      ]);
    },
  );

  await then(
    'the table "Runs" shows "run_a" with "implement", "succeeded" and "0.25 USD", "run_b" with "review", "failed" and "0.50 USD", and "run_b" with "triage", "succeeded" and "0.00 USD"',
    async () => {
      expect(table(page.html, "Runs")).toEqual([
        ["run_a", "implement", "succeeded", "0.25 USD"],
        ["run_b", "review", "failed", "0.50 USD"],
        ["run_b", "triage", "succeeded", "0.00 USD"],
      ]);
      expect(page.html).toContain('href="/runs/run_a"');
    },
  );

  await then('the page says "0.75 USD over 2 runs" and its navigation links "/improvement"', async () => {
    expect(text(page.html)).toContain("Cost and scores 0.75 USD over 2 runs.");
    expect(navLinks(page.html)).toContainEqual({ href: "/improvement", text: "Cost and scores" });
  });
});
