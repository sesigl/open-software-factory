import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, links, RUN, runOf, sendForm, serving } from "./console.ts";

const DETAIL = `${RUN} is complete`;

scenario("SCN-CONSOLE-248", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman that answers the signal "cancel" of "run_5d41402abc4b2a76b971" with 409 and "run_5d41402abc4b2a76b971 is complete"',
    async () => {
      const refusal = { type: "about:blank", title: "Conflict", status: 409, detail: DETAIL };
      const api = await foreman(
        fakes,
        [runOf("Export reports as CSV")],
        [{ method: "POST", path: `/v1/runs/${RUN}/signals`, status: 409, body: refusal }],
      );
      await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let answer: Awaited<ReturnType<typeof sendForm>>;
  await when('the person "ada@acme.dev" sends the form "Cancel" of the run\'s page', async () => {
    answer = await sendForm(sut, `/runs/${RUN}/signals`, { type: "cancel" }, ADA);
  });

  await then(
    'the page answers 409 with the title "Not sent" and says "run_5d41402abc4b2a76b971 is complete"',
    async () => {
      expect([answer.status, answer.title]).toEqual([409, "Not sent · Open Software Factory"]);
      expect(answer.getByRole("heading", { level: 1 }).text).toBe("Not sent");
      expect(answer.getByRole("alert").text).toBe(DETAIL);
    },
  );

  await then('the page has the navigation "Main" with "Runs" as the current page and the way back "Runs"', async () => {
    const current = answer.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
    expect([current.text, current.attribute("href")]).toEqual(["Runs", "/"]);
    expect(links(answer.getByRole("main"))).toEqual([{ href: "/", text: "Runs" }]);
  });
});
