import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, messagesOf, runLine, verdict } from "./runs.ts";

scenario("SCN-SCORE-006", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the runs file "runs.jsonl" with the run "run-01" whose user message is "Add a login page" and whose answer is "Done, I added two tests."',
    async () => {
      const line = runLine("run-01", { messages: { user: "Add a login page", answer: "Done, I added two tests." } });
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

  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then(`the judge call's user message contains "Add a login page" and "Done, I added two tests."`, async () => {
    expect(gateway.calls).toHaveLength(1);
    const { user } = messagesOf(gateway.calls[0] as { body: string });
    expect(user).toContain("Add a login page");
    expect(user).toContain("Done, I added two tests.");
  });
});
