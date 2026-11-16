import { scenario } from "@opensoftware/testkit";
import { foreman, RUN, serving } from "./console.ts";
import { EXPORT, EXPORT_ROW, IMPORT, IMPORT_ROW, workItemOf } from "./work.ts";

scenario("SCN-CONSOLE-275", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'an intake whose inbox holds "Import reports from CSV", received two days ago, and "Export reports as CSV", running in the run "run_5d41402abc4b2a76b971", and whose page at the cursor "Y3Vyc29y" is empty',
    async () => {
      intake = await fakes.http([
        { path: "/v1/inbox", body: { workItems: [workItemOf(IMPORT), workItemOf(EXPORT, "running", RUN)] } },
        { path: "/v1/inbox?cursor=Y3Vyc29y", body: { workItems: [] } },
      ]);
      await serving(sut, [(await foreman(fakes, [])).url], { CONSOLE_INTAKE_URL: intake.url });
    },
  );

  let answers: Awaited<ReturnType<typeof sut.http.get>>[] = [];
  await when('a program asks "/work/items" and "/work/items?cursor=Y3Vyc29y"', async () => {
    answers = await Promise.all([sut.http.get("/work/items"), sut.http.get("/work/items?cursor=Y3Vyc29y")]);
  });

  await then(
    'the first answer is 200 with the two rows as JSON, each with its title, type, status and its classes, source, requester, run and age, and "empty" false',
    async () => {
      expect([answers[0]?.status, answers[0]?.headers["content-type"]]).toEqual([
        200,
        "application/json; charset=utf-8",
      ]);
      expect(answers[0]?.body).toEqual({ rows: [IMPORT_ROW, EXPORT_ROW], empty: false });
      expect(answers[0]?.headers["cache-control"]).toBe("no-store");
    },
  );

  await then(
    'the second answer is 200 with no row and "empty" true, and intake was asked for "/v1/inbox" and "/v1/inbox?cursor=Y3Vyc29y"',
    async () => {
      expect([answers[1]?.status, answers[1]?.body]).toEqual([200, { rows: [], empty: true }]);
      expect(intake.requests().sort()).toEqual(["GET /v1/inbox", "GET /v1/inbox?cursor=Y3Vyc29y"]);
    },
  );
});
