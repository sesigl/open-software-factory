import { scenario } from "@opensoftware/testkit";
import { AUTH, askedServer, readmeRequest } from "./server.ts";

scenario("SCN-GATE-042", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  await given('the server asked for approval of the README request in the Slack channel "C0GATES"', async () => {
    server = await askedServer(sut, fakes);
  });

  let answer: Awaited<ReturnType<ReturnType<typeof server.api>["POST"]>>;
  await when('a program posts the README request to "/v1/gates" again', async () => {
    answer = await server.api().POST("/v1/gates", { body: readmeRequest(fakes), headers: AUTH });
  });

  await then("the answer has the status 200 and the same gate ID", async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data?.id).toBe(server.id);
  });

  await then('the Slack channel "C0GATES" has one approval request', async () => {
    expect(server.slack.messages("C0GATES")).toHaveLength(1);
  });
});
