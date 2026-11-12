import { scenario } from "@opensoftware/testkit";
import { failed, newRunOf } from "./foreman.ts";

scenario("SCN-FORE-099", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  let newId = "";
  await given(
    'the server ran the README\'s "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run',
    async () => {
      run = await failed(sut, fakes);
      newId = newRunOf(await run.retry(run.runId));
    },
  );

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ben" posts a retry of the first run', async () => {
    answer = await run.retry(run.runId, { by: { kind: "person", id: "github:ben" } });
  });

  await then('the answer has the status 409 and a problem that names the run "<new id>"', async () => {
    expect(answer.response.status).toBe(409);
    expect(answer.error).toMatchObject({ status: 409, detail: `${run.runId} already ran again as ${newId}` });
  });
});
