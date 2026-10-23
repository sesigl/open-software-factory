import { scenario } from "@opensoftware/testkit";
import { AUTH, serving } from "./server.ts";

scenario("SCN-GATE-043", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with the README policy and groups for the channel "slack:C0GATES"', async () => {
    server = await serving(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program posts a request without "summary" to "/v1/gates"', async () => {
    answer = await sut.http.request("POST", "/v1/gates", {
      body: { workItem: "WI-1", stage: "merge" },
      headers: AUTH,
    });
  });

  await then('the answer has the status 400 and a problem whose detail names the field "summary"', async () => {
    expect(answer.status).toBe(400);
    expect(answer.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(answer.body).toMatchObject({ status: 400, detail: expect.stringContaining('the field "summary"') });
  });

  await then('the Slack channel "C0GATES" has no message', async () => {
    expect(server.slack.messages("C0GATES")).toEqual([]);
  });
});
