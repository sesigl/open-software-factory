import { type Page, scenario } from "@opensoftware/testkit";
import { openChanges, servingChanges, unreachableEnv } from "./changes.ts";

scenario("SCN-CONSOLE-228", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      await servingChanges(sut, fakes, unreachableEnv(sut));
    },
  );

  let page: Page;
  await when('"grace@acme.dev" opens "/changes"', async () => {
    page = await openChanges(sut);
  });

  await then('the page answers 200 with an alert that starts with "The changes could not be listed:"', async () => {
    expect(page.status).toBe(200);
    expect(page.queryAllByRole("alert").map((alert) => alert.text)).toEqual([
      expect.stringMatching(/^The changes could not be listed: \S/),
    ]);
  });

  await then(
    'the form "Propose a change" offers the changes "Add an egress host", "Remove an egress host", "Add a secret reference", "Remove a secret reference", "Add a skill" and "Remove a skill", and the agent "triage"',
    async () => {
      const form = page.getByRole("form", { name: "Propose a change" });
      const options = (label: string) =>
        form
          .getByRole("combobox", { name: label })
          .queryAllByRole("option")
          .map((option) => option.text);
      expect(options("Change")).toEqual([
        "Add an egress host",
        "Remove an egress host",
        "Add a secret reference",
        "Remove a secret reference",
        "Add a skill",
        "Remove a skill",
      ]);
      expect(options("Agent")).toEqual(["triage"]);
    },
  );
});
