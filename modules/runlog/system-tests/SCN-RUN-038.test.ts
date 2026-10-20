import { scenario } from "@opensoftware/testkit";
import { agentTraceOf, attributed } from "./agent-trace.ts";
import { codexPatchSession, SESSION_TS } from "./sessions.ts";

scenario("SCN-RUN-038", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the file "src/session.ts" and a Codex session whose patch added its 2 lines',
    async () => {
      await sut.files.put("$INPUT/src/session.ts", SESSION_TS);
      await sut.files.put("$INPUT/rollout.jsonl", codexPatchSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export rollout.jsonl --agent-trace trace.json"', async () => {
    run = await sut.cli(["export", "rollout.jsonl", "--agent-trace", "trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"trace.json" attributes lines 1 to 2 of "src/session.ts" to "ai" with the model "openai/gpt-5-codex"',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(attributed(record)).toEqual(["src/session.ts:1-2 ai openai/gpt-5-codex"]);
    },
  );
});
