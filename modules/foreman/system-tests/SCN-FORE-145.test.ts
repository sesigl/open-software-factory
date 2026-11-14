import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-145", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('"foreman serve" runs the README\'s "factory.yaml"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.page>>;
  await when('a program reads "/v1/runs?limit=0" with the API token', async () => {
    answer = await server.page({ limit: 0 });
  });

  await then('the answer has the status 400 and a problem that names "limit"', async () => {
    expect(answer.response.status).toBe(400);
    expect((answer.error as { detail: string }).detail).toBe('limit: "0" is not a whole number from 1 to 500');
  });
});
