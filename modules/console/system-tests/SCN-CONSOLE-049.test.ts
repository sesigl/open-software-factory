import { scenario } from "@opensoftware/testkit";
import { foreman, sendWorkForm, serving, submittingIntake, text } from "./console.ts";

scenario("SCN-CONSOLE-049", async ({ sut, fakes, given, when, then }) => {
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
  await when(
    'the person "ada@acme.dev" sends the form "submit work" of "/work" with the origin "https://evil.example"',
    async () => {
      answer = await sendWorkForm(
        url,
        { title: "Add a dark mode" },
        { "x-forwarded-email": "ada@acme.dev", origin: "https://evil.example" },
      );
    },
  );

  await then('the answer has the status 403 and says "the form came from another site"', async () => {
    expect(answer.status).toBe(403);
    expect(text(answer.html)).toContain("the form came from another site");
  });

  await then("intake received no submission", async () => {
    expect(intake.received().filter(({ method }) => method === "POST")).toEqual([]);
  });
});
