import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, messagesOf, runLine, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-014", async ({ sut, fakes, given, when, then }) => {
  await given('the scorer file "scorers/short.md" with the transcript limit 2000 characters', async () => {
    await sut.files.put("$INPUT/scorers/short.md", scorerFile({ max_chars: 2000 }));
  });

  await given(
    'the runs file "runs.jsonl" with the run "run-01" whose tool call "Bash" ran a command of 5000 characters',
    async () => {
      const line = runLine("run-01", { tools: [{ name: "Bash", arguments: "x".repeat(5000) }] });
      await sut.files.put("$INPUT/runs.jsonl", `${line}\n`);
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }]);
    },
  );

  await when('the user runs "scorekit score --scorer scorers/short.md runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "scorers/short.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the judge call's user message has at most 2000 characters", async () => {
    expect(gateway.calls).toHaveLength(1);
    const { user } = messagesOf(gateway.calls[0] as { body: string });
    expect(user.length).toBeGreaterThan(1900);
    expect(user.length).toBeLessThanOrEqual(2000);
  });

  await then(`the judge call's user message starts with "Run: run-01" and contains "characters cut"`, async () => {
    const { user } = messagesOf(gateway.calls[0] as { body: string });
    expect(user.startsWith("Run: run-01")).toBe(true);
    expect(user).toContain("characters cut");
  });
});
