import { scenario } from "@opensoftware/testkit";
import { agentTraceOf, attributed } from "./agent-trace.ts";
import { claudeEditSession, LOGIN_TS, LOGOUT_TS } from "./sessions.ts";

scenario("SCN-RUN-037", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'a Git repository with one commit, the file "src/login.ts" and a Claude Code session that edited lines 3 to 4 of "src/login.ts" and wrote "src/logout.ts" with 3 lines',
    async () => {
      await sut.files.put("$INPUT/src/login.ts", LOGIN_TS);
      await sut.files.put("$INPUT/src/logout.ts", LOGOUT_TS);
      await sut.files.put("$INPUT/session.jsonl", claudeEditSession());
      commit = await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl --agent-trace trace.json"', async () => {
    run = await sut.cli(["export", "session.jsonl", "--agent-trace", "trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"trace.json" is an Agent Trace record with version "0.1.0" and the Git revision of the repository',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(record.version).toBe("0.1.0");
      expect(record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(record.vcs).toEqual({ type: "git", revision: commit });
    },
  );

  await then(
    'it attributes lines 3 to 4 of "src/login.ts" and lines 1 to 3 of "src/logout.ts" to "ai" with the model "anthropic/claude-sonnet-5-5"',
    async () => {
      const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
      expect(attributed(record)).toEqual([
        "src/login.ts:3-4 ai anthropic/claude-sonnet-5-5",
        "src/logout.ts:1-3 ai anthropic/claude-sonnet-5-5",
      ]);
    },
  );
});
