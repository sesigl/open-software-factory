import { type Page, scenario } from "@opensoftware/testkit";
import { links } from "./console.ts";
import { ADMIN } from "./secrets.ts";
import { type SkillJson, servingSkills, skillMd, skillOf } from "./skills.ts";

const BODY = [
  "",
  "# Triage a Linear issue",
  "",
  "Use this skill when a work item's origin is a Linear issue.",
  "",
  "## Steps",
  "",
  "1. Read the issue with `scripts/issue.sh`.",
  "2. Set the team from the table in `teams.md`.",
  "",
].join("\n");

scenario("SCN-CONSOLE-194", async ({ sut, fakes, given, when, then }) => {
  let fields: Partial<SkillJson> = {};
  await given(
    'the skill "release-notes" with the files "SKILL.md", "scripts/issue.sh" and "teams.md", whose SKILL.md has the heading "Steps", a numbered list and the code "scripts/issue.sh"',
    async () => {
      fields = {
        description: "Write the release notes of a change. Use when a change ships.",
        files: ["SKILL.md", "scripts/issue.sh", "teams.md"],
        body: BODY,
      };
    },
  );

  await given(
    'whose agents "triage" and "review" give "LINEAR_TOKEN" with "ref:openbao/linear-token", a store without it, and "review" lacks the host "api.linear.app"',
    async () => {
      const linear = { LINEAR_TOKEN: "ref:openbao/linear-token" };
      const skill = skillOf(
        "release-notes",
        { review: { secrets: linear, lacks: { hosts: ["api.linear.app"] } }, triage: { secrets: linear } },
        { ...fields, needs: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] } },
      );
      const declares = { secrets: ["ref:openbao/linear-token"] };
      await servingSkills(sut, fakes, { triage: declares, review: declares }, [skill]);
    },
  );

  let page: Page;
  await when('the admin opens "/skills/release-notes"', async () => {
    page = await sut.pages.open("/skills/release-notes", { headers: ADMIN });
  });

  await then(
    'the page has the heading "release-notes", the way back "Skills", the description and "skills/release-notes in the factory\'s repository"',
    async () => {
      expect([page.status, page.title]).toEqual([200, "release-notes · Open Software Factory"]);
      expect(page.getByRole("heading", { level: 1 }).text).toBe("release-notes");
      expect(page.getByRole("main").getByRole("link", { name: "Skills" }).attribute("href")).toBe("/skills");
      expect(page.getByText("Write the release notes of a change. Use when a change ships.").text).toBeTruthy();
      expect(page.getByText("skills/release-notes in the factory's repository").text).toBeTruthy();
    },
  );

  await then(
    'the panel "SKILL.md" shows the heading "Steps" below the page\'s headings, the numbered list and the code "scripts/issue.sh"',
    async () => {
      const panel = skillMd(page);
      expect(panel.getByRole("heading", { level: 3 }).text).toBe("Triage a Linear issue");
      expect(panel.getByRole("heading", { level: 4 }).text).toBe("Steps");
      expect(
        panel
          .getByRole("list")
          .queryAllByRole("listitem")
          .map((item) => item.text),
      ).toEqual(["Read the issue with scripts/issue.sh .", "Set the team from the table in teams.md ."]);
      expect(panel.queryAllByRole("code").map((code) => code.text)).toEqual(["scripts/issue.sh", "teams.md"]);
    },
  );

  await then('the list "Files" names "SKILL.md", "scripts/issue.sh" and "teams.md"', async () => {
    const files = page.getByRole("list", { name: "Files" }).queryAllByRole("listitem");
    expect(files.map((item) => item.text)).toEqual(["SKILL.md", "scripts/issue.sh", "teams.md"]);
  });

  await then(
    'the list "Agents" says "review" "Lacks api.linear.app" and "triage" "Has what the skill needs"',
    async () => {
      const agents = page.getByRole("list", { name: "Agents" }).queryAllByRole("listitem");
      expect(agents.map((item) => item.text)).toEqual([
        "review Lacks api.linear.app",
        "triage Has what the skill needs",
      ]);
    },
  );

  await then(
    'the list "This skill needs" says "LINEAR_TOKEN" "From ref:openbao/linear-token" is "Missing" with the link "Store a value LINEAR_TOKEN" to "/secrets?name=linear-token", and "api.linear.app" "Not in the egress of the agent review" is "Not allowed"',
    async () => {
      const needs = page.getByRole("list", { name: "This skill needs" });
      expect(needs.queryAllByRole("listitem").map((item) => item.text)).toEqual([
        "Secret LINEAR_TOKEN From ref:openbao/linear-token Missing Store a value LINEAR_TOKEN",
        "Host api.linear.app Not in the egress of the agent review Not allowed",
      ]);
      expect(links(needs)).toEqual([{ href: "/secrets?name=linear-token", text: "Store a value LINEAR_TOKEN" }]);
    },
  );
});
