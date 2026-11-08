import { scenario } from "@opensoftware/testkit";
import { foreman, sendWorkForm, serving, submittingIntake, text } from "./console.ts";

scenario("SCN-CONSOLE-046", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof submittingIntake>>;
  let url = "";
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions',
    async () => {
      intake = await submittingIntake(fakes);
      url = await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sendWorkForm>>;
  await when('a program sends the form "submit work" of "/work" without the header "X-Forwarded-Email"', async () => {
    answer = await sendWorkForm(url, { title: "Add a dark mode" });
  });

  await then(
    'the answer has the status 401 and says "sign in first: the console needs x-forwarded-email"',
    async () => {
      expect(answer.status).toBe(401);
      expect(text(answer.html)).toContain("sign in first: the console needs x-forwarded-email");
    },
  );

  await then("intake received no submission", async () => {
    expect(intake.received().filter(({ method }) => method === "POST")).toEqual([]);
  });
});
