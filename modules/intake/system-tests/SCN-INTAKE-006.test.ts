import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-006", async ({ sut, fakes, given, when, then }) => {
  await given("the server runs", async () => {
    await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program posts the README\'s "work.json" to "/v1/work-items" without the API token', async () => {
    answer = await sut.http.request("POST", "/v1/work-items", {
      body: readmeWork(fakes),
      headers: { authorization: "Bearer not-the-token" },
    });
  });

  await then("the answer has the status 401", async () => {
    expect(answer.status).toBe(401);
    expect(answer.body).toMatchObject({ status: 401, detail: "send Authorization: Bearer <INTAKE_API_TOKEN>" });
  });
});
