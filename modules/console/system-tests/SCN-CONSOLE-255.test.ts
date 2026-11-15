import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, links, RUN, runOf, sendForm, sendWorkForm, serving, submittingIntake } from "./console.ts";

scenario("SCN-CONSOLE-255", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof submittingIntake>>;
  let api: Awaited<ReturnType<typeof foreman>>;
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email", an intake and a foreman with the running run "Export reports as CSV"',
    async () => {
      intake = await submittingIntake(fakes);
      api = await foreman(fakes, [runOf("Export reports as CSV")]);
      await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email", CONSOLE_INTAKE_URL: intake.url });
    },
  );

  let answers: Awaited<ReturnType<typeof sendForm>>[] = [];
  await when(
    'a program sends the form "submit work" of "/work" without the header "X-Forwarded-Email", and the person "ada@acme.dev" sends the form "Cancel" of the run\'s page with the origin "https://evil.example"',
    async () => {
      answers = [
        await sendWorkForm(sut, { title: "Add a dark mode" }),
        await sendForm(sut, `/runs/${RUN}/signals`, { type: "cancel" }, { ...ADA, origin: "https://evil.example" }),
      ];
    },
  );

  /** The answer's status, title, the current link of the navigation "Main" and the links of its content. */
  const shown = (answer: (typeof answers)[number]) => {
    const current = answer.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
    return {
      status: answer.status,
      title: answer.getByRole("heading", { level: 1 }).text,
      current: [current.text, current.attribute("href")],
      back: links(answer.getByRole("main")),
    };
  };

  await then(
    'the first answer has the status 401, the title "Sign in", the navigation "Main" with "Work" as the current page and the way back "Work"',
    async () => {
      expect(shown(answers[0] as (typeof answers)[number])).toEqual({
        status: 401,
        title: "Sign in",
        current: ["Work", "/work"],
        back: [{ href: "/work", text: "Work" }],
      });
      expect(intake.received().filter(({ method }) => method === "POST")).toEqual([]);
    },
  );

  await then(
    'the second answer has the status 403, the title "Forbidden", the navigation "Main" with "Runs" as the current page and the way back "Runs"',
    async () => {
      expect(shown(answers[1] as (typeof answers)[number])).toEqual({
        status: 403,
        title: "Forbidden",
        current: ["Runs", "/"],
        back: [{ href: "/", text: "Runs" }],
      });
      expect(api.received().filter(({ method }) => method === "POST")).toEqual([]);
    },
  );
});
