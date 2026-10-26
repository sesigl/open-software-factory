import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-006", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" without a token', async () => {
    answer = await server.start(readmeWork(fakes), {});
  });

  await then("the answer has the status 401", async () => {
    expect(answer.response.status).toBe(401);
    expect(answer.error).toMatchObject({
      title: "Unauthorized",
      detail: "send Authorization: Bearer <FOREMAN_API_TOKEN>",
    });
    expect(server.harness.prompts()).toEqual([]);
  });
});
