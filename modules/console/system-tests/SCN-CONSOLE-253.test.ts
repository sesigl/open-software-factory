import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, links, sendWorkForm, serving } from "./console.ts";

scenario("SCN-CONSOLE-253", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that answers a submission with 400',
    async () => {
      const refusal = { type: "about:blank", title: "Bad Request", status: 400, detail: "type: must be a type" };
      intake = await fakes.http([
        { path: "/v1/inbox", body: { workItems: [] } },
        { method: "POST", path: "/v1/work-items", status: 400, body: refusal },
      ]);
      await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sendWorkForm>>;
  await when(
    'the person "ada@acme.dev" sends the form "submit work" of "/work" with the title "Add a dark mode"',
    async () => {
      answer = await sendWorkForm(sut, { title: "Add a dark mode" }, ADA);
    },
  );

  await then(
    'the answer has the status 502 with the title "Not submitted" and says that intake did not answer with 400',
    async () => {
      expect([answer.status, answer.title]).toEqual([502, "Not submitted · Open Software Factory"]);
      expect(answer.getByRole("heading", { level: 1 }).text).toBe("Not submitted");
      expect(answer.getByRole("alert").text).toBe(`the intake at ${intake.url} did not answer: 400`);
    },
  );

  await then('the page has the navigation "Main" with "Work" as the current page and the way back "Work"', async () => {
    const current = answer.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
    expect([current.text, current.attribute("href")]).toEqual(["Work", "/work"]);
    expect(links(answer.getByRole("main"))).toEqual([{ href: "/work", text: "Work" }]);
  });
});
