import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

const CONTENT = [
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.tool.call.arguments",
  "gen_ai.tool.call.result",
];

scenario("SCN-RUN-014", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then('"runs.jsonl" does not contain the prompt "Fix the failing login test"', async () => {
    const text = await sut.files.read("$OUTPUT/runs.jsonl");
    expect(text).toContain("invoke_agent");
    expect(text).not.toContain("Fix the failing login test");
  });

  await then(
    'no span has the attribute "gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.tool.call.arguments" or "gen_ai.tool.call.result"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.length).toBeGreaterThan(1);
      for (const span of exported?.spans ?? [])
        for (const name of CONTENT) expect(span.attributes).not.toHaveProperty([name]);
    },
  );
});
