import { type HarnessTurn, scenario } from "@opensoftware/testkit";
import { IMPLEMENT, otherWork, PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-190", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_MAX_STAGES" set to "1" and a scripted harness whose "plan" turns fail while another "plan" turn runs',
    async () => {
      // A "plan" turn holds the folder "turn" for a moment; a second "plan" turn at the same time cannot make it.
      const turn = sut.files.path("$OUTPUT/turn");
      const plan: HarnessTurn = { when: PLAN, commands: [`mkdir '${turn}'`, "sleep 0.5", `rmdir '${turn}'`] };
      server = await serving(sut, fakes, {
        turns: [plan, { ...plan }, { when: IMPLEMENT }, { when: IMPLEMENT }],
        env: { FOREMAN_MAX_STAGES: "1" },
      });
    },
  );

  const runIds: string[] = [];
  await when(
    'a program posts the README\'s "work.json" and a second work item to "/v1/runs" with the API token',
    async () => {
      for (const work of [readmeWork(fakes), otherWork(fakes)]) {
        const { data, response } = await server.start(work);
        expect(response.status).toBe(201);
        runIds.push(data?.runId as string);
      }
    },
  );

  await then('"/v1/runs/<id>" of each run shows the state "complete"', async () => {
    for (const runId of runIds) expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then('the harness received the prompt "Write a plan" twice', async () => {
    expect(server.prompts(PLAN)).toHaveLength(2);
  });
});
