import { scenario } from "@opensoftware/testkit";
import { ADA, failed } from "./foreman.ts";

scenario("SCN-FORE-111", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given('the server ran the README\'s "work.json" and the "implement" turn ended with "refusal"', async () => {
    run = await failed(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run from the stage "implemnt"', async () => {
    answer = await run.retry(run.runId, { by: ADA, from: "implemnt" });
  });

  await then(
    'the answer has the status 400 and a problem that names "from" and says the run has no stage "implemnt"',
    async () => {
      expect(answer.response.status).toBe(400);
      expect(answer.error).toEqual({
        title: "Bad request",
        status: 400,
        detail: `from: ${run.runId} has no stage "implemnt"`,
      });
    },
  );
});
