import { type Page, scenario } from "@opensoftware/testkit";
import { servingOpen } from "./skills.ts";

const ERROR = "factory.yaml:7:3 /agents/triage/model: missing required field";

scenario("SCN-CONSOLE-201", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console whose factory program exits with code 1 and the error "factory.yaml:7:3 /agents/triage/model: missing required field"',
    async () => {
      await servingOpen(sut, fakes, { triage: {} }, { error: ERROR });
    },
  );

  let list: Page;
  let skill: Page;
  await when('a person opens "/skills" and "/skills/release-notes"', async () => {
    list = await sut.pages.open("/skills");
    skill = await sut.pages.open("/skills/release-notes");
  });

  await then(
    '"/skills" answers 200 and says "The skills could not be read: factory.yaml:7:3 /agents/triage/model: missing required field" and "No skills yet"',
    async () => {
      expect(list.status).toBe(200);
      expect(list.getByRole("alert").text).toBe(`The skills could not be read: ${ERROR}`);
      expect(list.getByText(/^No skills yet/).text).toBe(
        "No skills yet. An agent names one in the factory definition, like skills: [./skills/release-notes].",
      );
    },
  );

  await then('"/skills/release-notes" answers 502 and says the same', async () => {
    expect(skill.status).toBe(502);
    expect(skill.text).toContain(`The skills could not be read: ${ERROR}`);
  });
});
