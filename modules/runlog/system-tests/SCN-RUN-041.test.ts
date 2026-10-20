import { scenario } from "@opensoftware/testkit";
import { agentTraceOf } from "./agent-trace.ts";
import { claudeEditSession, LOGOUT_TS } from "./sessions.ts";

scenario("SCN-RUN-041", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the file "src/login.ts" without the lines a Claude Code session wrote into it',
    async () => {
      await sut.files.put("$INPUT/src/login.ts", "export function login(user) {\n  return Boolean(user);\n}\n");
      await sut.files.put("$INPUT/src/logout.ts", LOGOUT_TS);
      await sut.files.put("$INPUT/session.jsonl", claudeEditSession());
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl --agent-trace trace.json"', async () => {
    run = await sut.cli(["export", "session.jsonl", "--agent-trace", "trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"trace.json" has no file "src/login.ts"', async () => {
    const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
    expect(record.files.map((file) => file.path)).toEqual(["src/logout.ts"]);
  });
});
