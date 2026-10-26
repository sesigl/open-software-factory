import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-066", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.list>>;
  await when('a program reads "/v1/runs?state=done" with the API token', async () => {
    answer = await server.list("done");
  });

  await then('the answer has the status 400 and a problem that names "state"', async () => {
    expect(answer.response.status).toBe(400);
    expect((answer.error as { detail: string }).detail).toBe(
      'state: no run is "done"; ask for running, blocked, complete, failed or cancelled',
    );
  });
});
