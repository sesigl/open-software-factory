import { scenario } from "@opensoftware/testkit";
import { runRecord } from "./repo.ts";

scenario("SCN-REPO-038", async ({ sut, given, when, then }) => {
  await given('a run record "runs/run-1.jsonl" whose chat span has the attribute "gen_ai.input.messages"', async () => {
    const messages = JSON.stringify([{ role: "user", parts: [{ type: "text", content: "fix the login bug" }] }]);
    await sut.files.put("$INPUT/runs/run-1.jsonl", runRecord({ chat: { "gen_ai.input.messages": messages } }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check RUNS"', async () => {
    run = await sut.cli(["check", "RUNS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "RUNS runs/run-1.jsonl:1 has content gen_ai.input.messages"', async () => {
    expect(run.stdout).toContain("RUNS runs/run-1.jsonl:1 has content gen_ai.input.messages");
  });
});
