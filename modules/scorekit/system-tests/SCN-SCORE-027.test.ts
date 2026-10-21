import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-027", async ({ sut, fakes, given, when, then }) => {
  await given('"scores.jsonl" with 2 scores of "redundant-tests"', async () => {
    await sut.files.put("$INPUT/scores.jsonl", jsonl([scoreRecord("run-01", 1), scoreRecord("run-02", 0)]));
  });

  let url = "";
  await given("a Langfuse API that answers HTTP 401", async () => {
    const langfuse = await fakes.http([
      { method: "POST", path: "/api/public/scores", status: 401, body: { message: "Invalid credentials" } },
    ]);
    url = langfuse.url;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["push", "scores.jsonl"], {
        env: { LANGFUSE_HOST: url, LANGFUSE_PUBLIC_KEY: "pk-lf-test", LANGFUSE_SECRET_KEY: "sk-lf-test" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "Langfuse answered HTTP 401"', async () => {
    expect(run.stderr).toContain("Langfuse answered HTTP 401");
  });
});
