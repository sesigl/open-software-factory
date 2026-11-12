import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-094", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.retry>>;
  await when('a program posts a retry to "/v1/runs/run_00000000000000000000/retry" without "by"', async () => {
    answer = await server.retry("run_00000000000000000000", { from: "plan" });
  });

  await then('the answer has the status 400 and a problem that names "by"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.error).toEqual({
      title: "Bad request",
      status: 400,
      detail:
        'the body is not a retry: /by: a retry needs the actor who asks, as { "kind": "person", "id": "<source>:<ID>" }',
    });
  });
});
