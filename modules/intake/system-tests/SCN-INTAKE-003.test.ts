import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

const ISSUE = "https://github.com/acme/web/issues/42";

scenario("SCN-INTAKE-003", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given("the server runs", async () => {
    server = await serving(sut);
  });

  let answer: Awaited<ReturnType<typeof server.submit>>;
  await when(
    'a program posts a submission without "dedupeKey" from the origin "https://github.com/acme/web/issues/42"',
    async () => {
      const { dedupeKey: _, ...work } = readmeWork(fakes);
      answer = await server.submit({ ...work, origin: { source: "github", url: ISSUE } });
    },
  );

  await then(
    'the answer has the status 201 and a work item with the dedupe key "https://github.com/acme/web/issues/42"',
    async () => {
      expect(answer.response.status, JSON.stringify(answer.error)).toBe(201);
      expect(answer.data?.workItem.dedupeKey).toBe(ISSUE);
    },
  );
});
