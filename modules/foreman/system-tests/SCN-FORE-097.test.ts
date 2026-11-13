import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-097", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.retry>>;
  await when('"github:ada" posts a retry to "/v1/runs/run_00000000000000000000/retry"', async () => {
    answer = await server.retry("run_00000000000000000000");
  });

  await then('the answer has the status 404 and a problem that names "run_00000000000000000000"', async () => {
    expect(answer.response.status).toBe(404);
    expect(answer.error).toEqual({
      title: "No such run",
      status: 404,
      detail: "the server has no run run_00000000000000000000",
    });
  });
});
