import { scenario } from "@opensoftware/testkit";
import { ADA, failed } from "./foreman.ts";

scenario("SCN-FORE-098", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given('the server ran the README\'s "work.json" and the "implement" turn ended with "refusal"', async () => {
    run = await failed(sut, fakes);
  });

  let answers: Awaited<ReturnType<typeof run.retry>>[] = [];
  await when('"github:ada" and "github:ben" post a retry of the run at the same time', async () => {
    answers = await Promise.all([
      run.retry(run.runId, { by: ADA }),
      run.retry(run.runId, { by: { kind: "person", id: "github:ben" } }),
    ]);
  });

  await then(
    "one answer has the status 201 and the other the status 409 and a problem that names the new run",
    async () => {
      const created = answers.find((answer) => answer.response.status === 201);
      const refused = answers.find((answer) => answer.response.status === 409);
      expect(created?.data?.attempt).toBe(2);
      expect(refused?.error).toEqual({
        title: "The run does not run again",
        status: 409,
        detail: `${run.runId} already ran again as ${created?.data?.runId}`,
      });
    },
  );

  await then('"/v1/runs" lists two runs', async () => {
    expect((await run.list()).data?.runs).toHaveLength(2);
  });
});
