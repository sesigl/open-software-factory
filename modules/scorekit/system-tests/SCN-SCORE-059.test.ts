import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-059", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" with 2 scores of "redundant-tests"', async () => {
    await sut.files.put("$INPUT/scores.jsonl", jsonl([scoreRecord("run-01", 1), scoreRecord("run-02", 0)]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and without a secret key',
    async () => {
      run = await sut.cli(["push", "scores.jsonl"], {
        env: { LANGFUSE_HOST: "http://127.0.0.1:9", LANGFUSE_PUBLIC_KEY: "pk-lf-test" },
      });
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output is "scorekit: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"', async () => {
    expect(run.stderr).toBe("scorekit: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY\n");
  });
});
