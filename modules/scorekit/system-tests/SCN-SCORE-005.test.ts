import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, messagesOf, outputScores, runLine, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-005", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the scorer file "scorers/slow-tests.md" with the pass criterion "No test waits longer than one second." and the prompt "Look for sleep calls in tests."',
    async () => {
      await sut.files.put(
        "$INPUT/scorers/slow-tests.md",
        scorerFile({ pass: "No test waits longer than one second." }, "Look for sleep calls in tests."),
      );
    },
  );

  await given(
    'the runs file "runs.jsonl" with the run "run-01" whose tool call "Bash" ran "sleep 5 && npm test"',
    async () => {
      const line = runLine("run-01", { tools: [{ name: "Bash", arguments: '{"command":"sleep 5 && npm test"}' }] });
      await sut.files.put("$INPUT/runs.jsonl", `${line}\n`);
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "fail" and the reason "A test sleeps."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("fail", "A test sleeps.") }]);
    },
  );

  await when('the user runs "scorekit score --scorer scorers/slow-tests.md runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "scorers/slow-tests.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then(
    `the judge call's system message contains "Look for sleep calls in tests." and "No test waits longer than one second."`,
    async () => {
      expect(gateway.calls).toHaveLength(1);
      const { system } = messagesOf(gateway.calls[0] as { body: string });
      expect(system).toContain("Look for sleep calls in tests.");
      expect(system).toContain("No test waits longer than one second.");
    },
  );

  await then(`the judge call's user message contains "run-01", "Bash" and "sleep 5 && npm test"`, async () => {
    const { user } = messagesOf(gateway.calls[0] as { body: string });
    for (const text of ["run-01", "Bash", "sleep 5 && npm test"]) expect(user).toContain(text);
  });

  await then('"scores.jsonl" holds a score for "run-01" with the name "slow-tests"', async () => {
    expect(await outputScores(sut)).toMatchObject([{ name: "slow-tests", metadata: { "osf.run.id": "run-01" } }]);
  });
});
