import { scenario } from "@opensoftware/testkit";
import { runsOf } from "./otlp.ts";
import { claudeEditSession, LOGIN_TS, LOGOUT_TS } from "./sessions.ts";

scenario("SCN-RUN-040", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit, the file "src/login.ts" and a Claude Code session that edited lines 3 to 4 of "src/login.ts" and wrote "src/logout.ts" with 3 lines',
    async () => {
      await sut.files.put("$INPUT/src/login.ts", LOGIN_TS);
      await sut.files.put("$INPUT/src/logout.ts", LOGOUT_TS);
      await sut.files.put("$INPUT/session.jsonl", claudeEditSession());
      await sut.git.commit("init");
    },
  );

  await when('the developer runs "runlog export session.jsonl --agent-trace trace.json"', async () => {
    await sut.cli(["export", "session.jsonl", "--agent-trace", "trace.json"]);
  });

  await then(
    'the root span in "runs.jsonl" has "osf.agent_trace.uri" set to the file URL of "trace.json"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes["osf.agent_trace.uri"]).toMatch(/^file:\/\/\/.+\/trace\.json$/);
    },
  );
});
