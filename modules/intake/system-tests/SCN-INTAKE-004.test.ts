import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-004", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given("the server runs", async () => {
    server = await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof server.submit>>;
  await when(
    'a program posts a submission without "dedupeKey" from the origin "api" without a link or ID',
    async () => {
      const { dedupeKey: _, ...work } = readmeWork(fakes);
      answer = await server.submit(work);
    },
  );

  await then('the answer has the status 400 and a problem whose detail names the field "dedupeKey"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(answer.error).toMatchObject({ status: 400, detail: "/dedupeKey: missing required field" });
  });
});
