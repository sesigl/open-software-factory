import { scenario } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";

scenario("SCN-CONSOLE-276", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  let foremanUrl = "";
  await given('an intake whose inbox answers 503, and a second console without "CONSOLE_INTAKE_URL"', async () => {
    intake = await fakes.http([{ path: "/v1/inbox", status: 503, body: { title: "Service Unavailable" } }]);
    foremanUrl = (await foreman(fakes, [])).url;
  });

  let answers: Awaited<ReturnType<typeof sut.http.get>>[] = [];
  await when('a program asks "/work/items" of each console', async () => {
    await serving(sut, [foremanUrl], { CONSOLE_INTAKE_URL: intake.url });
    const first = await sut.http.get("/work/items");
    await sut.http.stop();
    await serving(sut, [foremanUrl]);
    answers = [first, await sut.http.get("/work/items")];
  });

  await then(
    'the first answer is 502 with the title "Not refreshed" and says that intake did not answer with 503',
    async () => {
      expect([answers[0]?.status, answers[0]?.body]).toEqual([
        502,
        { title: "Not refreshed", detail: `the intake at ${intake.url} did not answer: 503` },
      ]);
    },
  );

  await then('the second answer is 404 with the title "No work items" and names "CONSOLE_INTAKE_URL"', async () => {
    expect([answers[1]?.status, answers[1]?.body]).toEqual([
      404,
      { title: "No work items", detail: "no work items: set CONSOLE_INTAKE_URL to the base URL of intake's API" },
    ]);
  });
});
