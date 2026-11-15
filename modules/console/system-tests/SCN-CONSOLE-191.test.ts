import { type Page, scenario } from "@opensoftware/testkit";
import { ADMIN, type AgentOf, type Store, VALUE } from "./secrets.ts";
import { needsOf, type SkillJson, servingSkills, skillOf, skillRows } from "./skills.ts";

scenario("SCN-CONSOLE-191", async ({ sut, fakes, given, when, then }) => {
  let agents: Record<string, AgentOf> = {};
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token" and "ref:openbao/sentry-token", whose agent "review" declares "ref:env/GH_TOKEN", and a store with only "linear-token"',
    async () => {
      agents = {
        triage: { secrets: ["ref:openbao/linear-token", "ref:openbao/sentry-token"], egress: ["api.linear.app"] },
        review: { secrets: ["ref:env/GH_TOKEN"] },
      };
    },
  );

  let store: Store;
  await given(
    'the skills "release-notes" of "triage", "changelog" of "review" and "sentry-triage" of "triage" and "review", which need "LINEAR_TOKEN" and the host "api.linear.app", "GH_TOKEN" and "SENTRY_TOKEN"',
    async () => {
      const skills: SkillJson[] = [
        skillOf(
          "changelog",
          { review: { secrets: { GH_TOKEN: "ref:env/GH_TOKEN" } } },
          { needs: { secrets: ["GH_TOKEN"], hosts: [] } },
        ),
        skillOf(
          "release-notes",
          { triage: { secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" } } },
          { needs: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] } },
        ),
        skillOf(
          "sentry-triage",
          {
            review: { lacks: { secrets: ["SENTRY_TOKEN"] } },
            triage: { secrets: { SENTRY_TOKEN: "ref:openbao/sentry-token" } },
          },
          { needs: { secrets: ["SENTRY_TOKEN"], hosts: [] } },
        ),
      ];
      store = await servingSkills(sut, fakes, agents, skills);
      await store.bao.write("linear-token", { value: VALUE });
    },
  );

  let page: Page;
  let sentry: Page;
  await when('the admin opens "/skills" and "/skills/sentry-triage"', async () => {
    page = await sut.pages.open("/skills", { headers: ADMIN });
    sentry = await sut.pages.open("/skills/sentry-triage", { headers: ADMIN });
  });

  await then(
    'the list shows "changelog", "release-notes" and "sentry-triage" in this order, each with its description, its folder in the factory\'s repository and its agents',
    async () => {
      expect(page.status).toBe(200);
      const rows = skillRows(page);
      expect(Object.keys(rows)).toEqual(["changelog", "release-notes", "sentry-triage"]);
      expect(rows["sentry-triage"]).toMatch(
        /^sentry-triage The skill sentry-triage\. Use it in the scenarios of the console\. skills\/sentry-triage in the factory's repository · Used by the agents review and triage /,
      );
      expect(rows.changelog).toBe(
        "changelog The skill changelog. Use it in the scenarios of the console. skills/changelog in the factory's repository · Used by the agent review Secret GH_TOKEN Set outside the UI",
      );
      expect(page.getByRole("link", { name: "release-notes" }).attribute("href")).toBe("/skills/release-notes");
    },
  );

  await then(
    '"release-notes" needs the secret "LINEAR_TOKEN", "Set", and the host "api.linear.app", "changelog" needs "GH_TOKEN", "Set outside the UI", and "sentry-triage" needs "SENTRY_TOKEN", "Not declared"',
    async () => {
      expect(needsOf(page, "release-notes")).toEqual(["Secret LINEAR_TOKEN Set", "Host api.linear.app"]);
      expect(needsOf(page, "changelog")).toEqual(["Secret GH_TOKEN Set outside the UI"]);
      expect(needsOf(page, "sentry-triage")).toEqual(["Secret SENTRY_TOKEN Not declared"]);
    },
  );

  await then(
    'the page of "sentry-triage" says "SENTRY_TOKEN" "From ref:openbao/sentry-token · Not declared by the agent review" is "Not declared"',
    async () => {
      const needs = sentry.getByRole("list", { name: "This skill needs" }).queryAllByRole("listitem");
      expect(needs.map((item) => item.text)).toEqual([
        "Secret SENTRY_TOKEN From ref:openbao/sentry-token · Not declared by the agent review Not declared",
      ]);
    },
  );

  await then('the page "Skills" is the navigation\'s current page', async () => {
    expect(page.title).toBe("Skills · Open Software Factory");
    const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
    expect([current.attribute("href"), current.text]).toEqual(["/skills", "Skills"]);
  });

  await then('the console ran the factory program with "skills --file <CONSOLE_FACTORY>"', async () => {
    expect(await sut.files.read("$OUTPUT/factory.log")).toBe(
      `skills --file ${sut.files.path("$INPUT/factory.yaml")}\n`,
    );
  });
});
