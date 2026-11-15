import { type Page, scenario } from "@opensoftware/testkit";
import { navLinks } from "./console.ts";
import type { AgentOf } from "./secrets.ts";
import { needsOf, servingOpen, skillOf } from "./skills.ts";

scenario("SCN-CONSOLE-192", async ({ sut, fakes, given, when, then }) => {
  // The console gets only a foreman, its factory and the factory program: no sign-in, no proxy and no store.
  let agents: Record<string, AgentOf> = {};
  await given('a console without "CONSOLE_SIGN_IN", "CONSOLE_USER_HEADER" and "OSF_OPENBAO_ADDR"', async () => {
    agents = { triage: { secrets: ["ref:openbao/linear-token"] }, review: { secrets: ["ref:env/GH_TOKEN"] } };
  });

  await given(
    'the skill "release-notes" whose agent gives "LINEAR_TOKEN" with "ref:openbao/linear-token", and the skill "changelog" whose agent gives "GH_TOKEN" with "ref:env/GH_TOKEN"',
    async () => {
      await servingOpen(sut, fakes, agents, [
        skillOf(
          "changelog",
          { review: { secrets: { GH_TOKEN: "ref:env/GH_TOKEN" } } },
          { needs: { secrets: ["GH_TOKEN"], hosts: [] } },
        ),
        skillOf(
          "release-notes",
          { triage: { secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } } },
          { needs: { secrets: ["LINEAR_TOKEN"], hosts: [] } },
        ),
      ]);
    },
  );

  let list: Page;
  let skill: Page;
  await when('a person opens "/skills" and "/skills/release-notes"', async () => {
    list = await sut.pages.open("/skills");
    skill = await sut.pages.open("/skills/release-notes");
  });

  await then('both answer 200, and the navigation of each links "/skills"', async () => {
    expect([list.status, skill.status]).toEqual([200, 200]);
    expect(navLinks(list).map((link) => link.href)).toEqual(["/", "/skills", "/factory", "/health"]);
    expect(navLinks(skill).map((link) => link.href)).toEqual(["/", "/skills", "/factory", "/health"]);
  });

  await then(
    '"release-notes" needs the secret "LINEAR_TOKEN" without a state, and "changelog" needs "GH_TOKEN", "Set outside the UI"',
    async () => {
      expect(needsOf(list, "release-notes")).toEqual(["Secret LINEAR_TOKEN"]);
      expect(needsOf(list, "changelog")).toEqual(["Secret GH_TOKEN Set outside the UI"]);
      const needs = skill.getByRole("list", { name: "This skill needs" }).queryAllByRole("listitem");
      expect(needs.map((item) => item.text)).toEqual(["Secret LINEAR_TOKEN From ref:openbao/linear-token"]);
    },
  );
});
