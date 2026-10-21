import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, verdict } from "./runs.ts";

scenario("SCN-SCORE-001", async ({ sut, fakes, given, when, then }) => {
  await given("the runs file from the README", async () => {
    const readme = fakes.fromRepository("modules/scorekit")["README.md"] as string;
    const block = /^```jsonl runs\.jsonl\n([\s\S]*?)^```$/m.exec(readme)?.[1];
    if (!block) throw new Error("the README has no code block for runs.jsonl");
    await sut.files.put("$INPUT/runs.jsonl", block);
  });

  let url = "";
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "No test repeats another."',
    async () => {
      url = (await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "No test repeats another.") }])).url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the user runs the quick start command from the README", async () => {
    run = await sut.cli(sut.readme.quickStartArgs(), { env: { SCOREKIT_INFERENCE_URL: url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output folder contains the file the README promises", async () => {
    expect(await sut.files.list("$OUTPUT")).toContain(sut.readme.quickStartOutput());
  });

  await then(
    '"scores.jsonl" holds 2 scores of the scorer "redundant-tests" with the value 1 and the comment "No test repeats another."',
    async () => {
      const scores = await outputScores(sut);
      expect(scores).toHaveLength(2);
      for (const score of scores)
        expect(score).toMatchObject({ name: "redundant-tests", value: 1, comment: "No test repeats another." });
    },
  );
});
