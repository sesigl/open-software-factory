import { type Page, scenario } from "@opensoftware/testkit";
import { ENGINEER, unreachableEnv } from "./changes.ts";
import { agentTexts, openSkill, servingSwitches } from "./switches.ts";

const MEMBER = { "x-forwarded-email": "varun@acme.dev" };
const WHY = "varun@acme.dev has the role member: a change needs the role admin or factory-engineer";

scenario("SCN-CONSOLE-236", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, "grace@acme.dev" as "factory-engineer" and "varun@acme.dev" as "member"',
    async () => {
      env = unreachableEnv(sut);
    },
  );

  await given(
    'a factory whose agent "triage" uses the skill "release-notes" and whose agent "review" does not',
    async () => {
      await servingSwitches(sut, fakes, env);
    },
  );

  let engineer: Page;
  let spec: Page;
  let member: Page;
  let asked: Page;
  await when(
    '"grace@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=spec", and "varun@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=review"',
    async () => {
      [engineer, spec, member, asked] = await Promise.all([
        openSkill(sut),
        sut.pages.open("/skills/release-notes/switch?agent=spec", {
          headers: { "x-forwarded-email": "grace@acme.dev" },
        }),
        openSkill(sut, MEMBER),
        sut.pages.open("/skills/release-notes/switch?agent=review", { headers: MEMBER }),
      ]);
    },
  );

  await then(
    'the factory engineer\'s page has an alert that starts with "The changes could not be listed:" and offers "Switch on for review" and "Switch off for triage"',
    async () => {
      expect(engineer.status).toBe(200);
      expect(engineer.getByRole("alert").text).toMatch(/^The changes could not be listed: /);
      expect(engineer.queryAllByRole("button").map((button) => button.name)).toEqual(
        expect.arrayContaining(["Switch on for review", "Switch off for triage"]),
      );
    },
  );

  await then('the page for "spec" answers 404 and says "spec is not an agent of the factory"', async () => {
    expect(spec.status).toBe(404);
    expect(spec.text).toContain("spec is not an agent of the factory");
  });

  await then(
    'the member\'s list "Agents" says "review Does not have the skill" and "triage Has what the skill needs", without a button, and the page says "varun@acme.dev has the role member: a change needs the role admin or factory-engineer"',
    async () => {
      expect(agentTexts(member)).toEqual(["review Does not have the skill", "triage Has what the skill needs"]);
      expect(member.getByRole("list", { name: "Agents" }).queryAllByRole("button")).toEqual([]);
      expect(member.getByText(WHY).text).toBe(WHY);
    },
  );

  await then("the member's page that asks first answers 403 and says the same", async () => {
    expect(asked.status).toBe(403);
    expect(asked.text).toContain(WHY);
  });
});
