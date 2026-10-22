import { scenario } from "@opensoftware/testkit";
import { jsonl, problemsOf, runRecord, score } from "./scores.ts";

scenario("SCN-OBS-005", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" with failed scores of the scorer "research-skill-used" for the runs "run-1", "run-2" and "run-3"',
    async () => {
      const records = ["run-1", "run-2", "run-3"].map((run) => score("research-skill-used", run, true));
      await sut.files.put("$INPUT/scores.jsonl", jsonl(records));
    },
  );

  await given(
    'a run record in "runs/" for the run "run-1" with the transcript "https://langfuse.example/trace/1" and the pull request "https://github.com/acme/web/pull/7"',
    async () => {
      const record = runRecord("run-1", {
        transcript: "https://langfuse.example/trace/1",
        pullRequest: "https://github.com/acme/web/pull/7",
      });
      await sut.files.put("$INPUT/runs/2026-01-01.jsonl", jsonl([record]));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer analyze --runs runs scores.jsonl"', async () => {
    run = await sut.cli(["analyze", "--runs", "runs", "scores.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the problem "research-skill-used" lists the run "run-1" with the links "https://langfuse.example/trace/1" and "https://github.com/acme/web/pull/7"',
    async () => {
      const [problem] = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
      expect(problem?.runs[0]).toMatchObject({
        run: "run-1",
        links: ["https://langfuse.example/trace/1", "https://github.com/acme/web/pull/7"],
      });
    },
  );

  await then('it lists the runs "run-2" and "run-3" without links', async () => {
    const [problem] = problemsOf(await sut.files.read("$OUTPUT/problems.json"));
    expect(problem?.runs.slice(1)).toMatchObject([
      { run: "run-2", links: [] },
      { run: "run-3", links: [] },
    ]);
  });
});
