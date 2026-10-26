import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-INTAKE-007", async ({ sut, given, when, then }) => {
  await given("the server runs", async () => {
    await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program gets "/v1/work-items/wi_00000000000000000000"', async () => {
    answer = await sut.http.request("GET", "/v1/work-items/wi_00000000000000000000", { headers: AUTH });
  });

  await then('the answer has the status 404 and a problem whose detail names "wi_00000000000000000000"', async () => {
    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ status: 404, detail: "the server has no work item wi_00000000000000000000" });
  });
});
