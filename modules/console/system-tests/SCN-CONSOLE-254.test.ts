import { scenario } from "@opensoftware/testkit";
import { foreman, open, rows, serving } from "./console.ts";

scenario("SCN-CONSOLE-254", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  let foremanUrl = "";
  await given("an intake whose inbox answers 503", async () => {
    intake = await fakes.http([{ path: "/v1/inbox", status: 503, body: { title: "Service Unavailable" } }]);
    foremanUrl = (await foreman(fakes, [])).url;
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/work"', async () => {
    await serving(sut, [foremanUrl], { CONSOLE_INTAKE_URL: intake.url });
    page = await open(sut, "/work");
  });

  await then("the page answers 200 and says that intake did not answer with 503", async () => {
    expect(page.status).toBe(200);
    expect(page.getByRole("alert").text).toBe(`the intake at ${intake.url} did not answer: 503`);
  });

  await then('the page lists no work item and does not say "No work items yet."', async () => {
    expect(rows(page)).toEqual([]);
    expect(page.getByRole("main").text).not.toContain("No work items yet.");
  });
});
