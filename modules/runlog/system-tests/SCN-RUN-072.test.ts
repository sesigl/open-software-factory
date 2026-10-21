import { scenario } from "@opensoftware/testkit";
import { agentTraceOf } from "./agent-trace.ts";
import { runsOf } from "./otlp.ts";
import { claudeEditSession, LOGIN_TS, LOGOUT_TS } from "./sessions.ts";

scenario("SCN-RUN-072", async ({ sut, given, when, then }) => {
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

  await then('"trace.json" names the tool "claude-code" with the version "2.1.0"', async () => {
    const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
    expect(record.tool).toEqual({ name: "claude-code", version: "2.1.0" });
  });

  await then('its ID is the trace ID of the run in "runs.jsonl" in the 8-4-4-4-12 form of a UUID', async () => {
    const record = agentTraceOf(await sut.files.read("$INPUT/trace.json"));
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const hex = exported?.root.traceId ?? "";
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
    const [, a, b, c, d, e] = hex.match(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/) ?? [];
    expect(record.id).toBe(`${a}-${b}-${c}-${d}-${e}`);
  });
});
