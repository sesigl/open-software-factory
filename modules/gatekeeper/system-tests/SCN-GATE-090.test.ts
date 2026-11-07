import { scenario } from "@opensoftware/testkit";
import { readmeRequest, serving } from "./server.ts";

scenario("SCN-GATE-090", async ({ sut, fakes, given, when, then }) => {
  await given('the server runs with the README policy and groups for the channel "slack:C0GATES"', async () => {
    await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program posts the README request to "/v1/gates" without an Authorization header', async () => {
    answer = await sut.http.request("POST", "/v1/gates", { body: readmeRequest(fakes) });
  });

  await then(
    'the answer has the status 401 and a problem whose detail says "send Authorization: Bearer <GATEKEEPER_API_TOKEN>"',
    async () => {
      expect(answer.status).toBe(401);
      expect(answer.body).toEqual({
        title: "Unauthorized",
        status: 401,
        detail: "send Authorization: Bearer <GATEKEEPER_API_TOKEN>",
      });
    },
  );
});
