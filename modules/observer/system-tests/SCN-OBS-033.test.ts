import { scenario } from "@opensoftware/testkit";
import { jsonl, score } from "./scores.ts";

scenario("SCN-OBS-033", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" whose second line is "research-skill-used failed"', async () => {
    await sut.files.put(
      "$INPUT/scores.jsonl",
      `${jsonl([score("research-skill-used", "run-1", true)])}research-skill-used failed\n`,
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer analyze scores.jsonl"', async () => {
    run = await sut.cli(["analyze", "scores.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output contains "scores.jsonl:2: not JSON"', async () => {
    expect(run.stderr).toContain("scores.jsonl:2: not JSON");
  });
});
