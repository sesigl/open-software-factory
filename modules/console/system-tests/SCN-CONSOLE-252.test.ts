import { scenario } from "@opensoftware/testkit";
import { ADA, foreman, open, serving, submittingIntake } from "./console.ts";

scenario("SCN-CONSOLE-252", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake whose inbox is empty',
    async () => {
      const intake = await submittingIntake(fakes);
      await serving(sut, [(await foreman(fakes, [])).url], {
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
      });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('the person "ada@acme.dev" opens "/work"', async () => {
    page = await open(sut, "/work", ADA);
  });

  await then(
    'the page has the title "Work", the navigation "Main" with "Work" as the current page, and does not link "/pico.css"',
    async () => {
      expect([page.status, page.title]).toEqual([200, "Work · Open Software Factory"]);
      expect(page.getByRole("heading", { level: 1 }).text).toBe("Work");
      const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
      expect([current.text, current.attribute("href")]).toEqual(["Work", "/work"]);
      expect(page.stylesheets.filter((href) => href === "/pico.css")).toEqual([]);
      expect(page.stylesheets.some((href) => href.startsWith("/_astro/"))).toBe(true);
    },
  );

  await then('the page says "No work items yet."', async () => {
    expect(page.getByRole("main").text).toContain("No work items yet.");
  });

  await then(
    'the form "Submit work" has the field "Title", the field "Type" with "task", "bug", "idea" and "automation", the field "Description" and the button "Submit"',
    async () => {
      const form = page.getByRole("form", { name: "Submit work" });
      expect(form.getByRole("textbox", { name: "Title" }).attribute("name")).toBe("title");
      const type = form.getByRole("combobox", { name: "Type" });
      expect(type.attribute("name")).toBe("type");
      expect(type.queryAllByRole("option").map((option) => option.text)).toEqual(["task", "bug", "idea", "automation"]);
      expect(form.getByRole("textbox", { name: "Description" }).attribute("name")).toBe("description");
      expect(form.queryAllByRole("button").map((button) => button.name)).toEqual(["Submit"]);
      expect(page.forms).toEqual([{ name: "Submit work", method: "post", action: "/work" }]);
    },
  );
});
