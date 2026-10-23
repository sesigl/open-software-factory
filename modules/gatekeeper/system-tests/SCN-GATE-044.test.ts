import { scenario } from "@opensoftware/testkit";
import { readmeRequest, serving } from "./server.ts";

scenario("SCN-GATE-044", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with the README policy and groups for the channel "slack:C0GATES"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program posts the README request to "/v1/gates" without the API token', async () => {
    answer = await sut.http.request("POST", "/v1/gates", {
      body: readmeRequest(fakes),
      headers: { authorization: "Bearer testkit-api-tokeX" },
    });
  });

  await then("the answer has the status 401", async () => {
    expect(answer.status).toBe(401);
    expect(answer.body).toMatchObject({ status: 401, title: "Unauthorized" });
  });

  await then('the Slack channel "C0GATES" has no message', async () => {
    expect(server.slack.messages("C0GATES")).toEqual([]);
  });
});
