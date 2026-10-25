import { scenario } from "@opensoftware/testkit";
import { fromSlack, received } from "./server.ts";

scenario("SCN-INTAKE-002", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof received>>;
  await given('the server received the README\'s "work.json"', async () => {
    server = await received(sut, fakes);
  });

  let answer: Awaited<ReturnType<typeof server.submit>>;
  await when('a program posts a submission with the dedupe key "idea:export-csv" from the origin "slack"', async () => {
    answer = await server.submit(fromSlack(fakes));
  });

  await then("the answer has the status 200 and the same work item ID", async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data?.workItem.id).toBe(server.id);
  });

  await then('"/v1/work-items/<id>" lists the requests from "api" and "slack"', async () => {
    const view = await server.workItem(server.id);
    expect(view?.requests.map((request) => request.origin.source)).toEqual(["api", "slack"]);
    expect(view?.requests[1]?.origin.url).toBe("https://testkit.slack.com/archives/C0WORK/p1767225600000001");
  });
});
