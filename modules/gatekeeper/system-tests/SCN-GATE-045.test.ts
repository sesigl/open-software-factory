import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-GATE-045", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with the README policy and groups for the channel "slack:C0GATES"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<ReturnType<typeof server.api>["GET"]>>;
  await when('a program gets "/v1/gates/g0123456789abcdef"', async () => {
    answer = await server
      .api()
      .GET("/v1/gates/{gateId}", { params: { path: { gateId: "g0123456789abcdef" } }, headers: AUTH });
  });

  await then('the answer has the status 404 and a problem whose detail names "g0123456789abcdef"', async () => {
    expect(answer.response.status).toBe(404);
    expect(answer.error).toMatchObject({ status: 404, detail: expect.stringContaining("g0123456789abcdef") });
  });
});
