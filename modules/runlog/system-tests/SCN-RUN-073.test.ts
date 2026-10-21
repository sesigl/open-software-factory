import { scenario } from "@opensoftware/testkit";
import { agentTraceOf, attributed } from "./agent-trace.ts";
import { AUTH_TS, codexPatchSession, UPDATE_AUTH_PATCH } from "./sessions.ts";

scenario("SCN-RUN-073", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the file "src/auth.ts" and a Codex session whose patch added line 1, kept lines 2 to 4 and added lines 5 to 7 of it',
    async () => {
      await sut.files.put("$INPUT/src/auth.ts", AUTH_TS);
      await sut.files.put("$INPUT/rollout.jsonl", codexPatchSession(UPDATE_AUTH_PATCH));
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
    '"trace.json" attributes line 1 and lines 5 to 7 of "src/auth.ts" to "ai" with the model "openai/gpt-5-codex"',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(attributed(record)).toEqual([
        "src/auth.ts:1-1 ai openai/gpt-5-codex",
        "src/auth.ts:5-7 ai openai/gpt-5-codex",
      ]);
    },
  );
});
