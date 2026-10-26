import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-007", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" without "title" to "/v1/runs" with the API token', async () => {
    const { title: _title, ...untitled } = readmeWork(fakes);
    answer = await server.start(untitled);
  });

  await then('the answer has the status 400 and a problem that names "title"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.error).toMatchObject({ status: 400, detail: expect.stringContaining("title") });
    expect(server.harness.prompts()).toEqual([]);
  });
});
