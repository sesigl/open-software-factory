import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-146", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.page>>;
  await when('a program reads "/v1/runs?cursor=bm90LWEtcGFnZQ" with the API token', async () => {
    answer = await server.page({ cursor: "bm90LWEtcGFnZQ" });
  });

  await then('the answer has the status 400 and a problem that names "cursor"', async () => {
    expect(answer.response.status).toBe(400);
    expect((answer.error as { detail: string }).detail).toMatch(/^cursor: /);
  });
});
