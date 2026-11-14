import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-INTAKE-061", async ({ sut, given, when, then }) => {
  await given("the server runs", async () => {
    await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/inbox?limit=501" with the API token', async () => {
    answer = await sut.http.request("GET", "/v1/inbox?limit=501", { headers: AUTH });
  });

  await then('the answer has the status 400 and a problem that names "limit"', async () => {
    expect(answer.status).toBe(400);
    expect((answer.body as { detail: string }).detail).toMatch(/^limit: "501" is not a whole number from 1 to 500$/);
  });
});
