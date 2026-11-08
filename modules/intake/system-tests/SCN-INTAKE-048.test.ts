import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-INTAKE-048", async ({ sut, given, when, then }) => {
  await given("the server runs", async () => {
    await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/inbox?status=merged" with the API token', async () => {
    answer = await sut.http.request("GET", "/v1/inbox?status=merged", { headers: AUTH });
  });

  await then('the answer has the status 400 and a problem that names "status"', async () => {
    expect(answer.status).toBe(400);
    expect((answer.body as { detail: string }).detail).toMatch(/^status: /);
  });
});
