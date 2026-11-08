import { scenario } from "@opensoftware/testkit";
import { foreman, open, sendWorkForm, serving, submittingIntake } from "./console.ts";

scenario("SCN-CONSOLE-047", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given('a console with an intake but without "CONSOLE_USER_HEADER"', async () => {
    const intake = await submittingIntake(fakes);
    url = await serving(sut, [(await foreman(fakes, [])).url], { CONSOLE_INTAKE_URL: intake.url });
  });

  let page: Awaited<ReturnType<typeof open>>;
  let answer: Awaited<ReturnType<typeof sendWorkForm>>;
  await when('a person opens "/work" and a program sends the form "submit work" of "/work"', async () => {
    page = await open(sut, "/work");
    answer = await sendWorkForm(url, { title: "Add a dark mode" }, { "x-forwarded-email": "ada@acme.dev" });
  });

  await then("the page has no form", async () => {
    expect(page.status).toBe(200);
    expect(page.html).not.toContain("<form");
  });

  await then("the form gets the status 405", async () => {
    expect(answer.status).toBe(405);
  });
});
