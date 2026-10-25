import type { WorkSubmission } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-005", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given("the server runs", async () => {
    server = await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof server.submit>>;
  await when('a program posts a submission without "title" to "/v1/work-items"', async () => {
    const { title: _, ...work } = readmeWork(fakes);
    answer = await server.submit(work as WorkSubmission);
  });

  await then('the answer has the status 400 and a problem whose detail names the field "title"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.error).toMatchObject({
      title: "The request is not a work submission",
      status: 400,
      detail: "/title: missing required field",
    });
  });
});
