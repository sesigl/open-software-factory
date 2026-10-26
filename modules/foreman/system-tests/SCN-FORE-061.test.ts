import { scenario } from "@opensoftware/testkit";
import { waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-061", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given(
    'a run of the README\'s factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"',
    async () => {
      run = await waitingAtGate(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('a person posts the signal "take-over"', async () => {
    answer = await run.signal(run.runId, { type: "take-over" });
  });

  await then("the answer has the status 409 and a problem that says no stage of the run is running", async () => {
    expect(answer.response.status).toBe(409);
    expect(answer.error).toMatchObject({ status: 409, detail: `no stage of ${run.runId} is running` });
    expect((await run.view(run.runId)).state).toBe("blocked");
  });
});
