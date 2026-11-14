import { scenario } from "@opensoftware/testkit";
import { foreman, sendWorkForm, serving, submittingIntake } from "./console.ts";

scenario("SCN-CONSOLE-045", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof submittingIntake>>;
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions',
    async () => {
      intake = await submittingIntake(fakes);
      await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
        CONSOLE_INTAKE_TOKEN: "intake-token",
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sendWorkForm>>;
  await when(
    'the person "ada@acme.dev" sends the form "submit work" of "/work" with the title "Add a dark mode" and the type "idea"',
    async () => {
      answer = await sendWorkForm(
        sut,
        { title: "Add a dark mode", type: "idea" },
        { "x-forwarded-email": "ada@acme.dev" },
      );
    },
  );

  await then('the answer redirects to "/work"', async () => {
    expect([answer.status, answer.location]).toEqual([303, "/work"]);
  });

  await then(
    'intake received the submission "Add a dark mode" of the type "idea" from the person "ada@acme.dev" with the origin "console"',
    async () => {
      const posted = intake.received().filter(({ method }) => method === "POST");
      expect(posted).toHaveLength(1);
      const sent = intake.headers().filter(({ method }) => method === "POST");
      expect(sent[0]?.headers.authorization).toBe("Bearer intake-token");
      expect(posted[0]?.body).toMatchObject({
        title: "Add a dark mode",
        type: "idea",
        requester: { kind: "person", id: "ada@acme.dev" },
        origin: { source: "console" },
      });
    },
  );
});
