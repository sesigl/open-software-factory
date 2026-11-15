import { scenario } from "@opensoftware/testkit";

const none = { secrets: [], hosts: [] };

scenario("SCN-CTR-015", async ({ sut, given, when, then }) => {
  const releaseNotes = {
    name: "release-notes",
    description: "Write the release notes of a change from its Linear issues. Use when a change ships.",
    source: { folder: "skills/release-notes" },
    needs: { secrets: ["LINEAR_TOKEN"], hosts: [] },
    files: ["SKILL.md"],
    body: "\n# Release notes\n",
    problems: [],
  };
  let agents: object[] = [];
  await given(
    'a skill catalog "skills.json" whose skill "release-notes" needs "LINEAR_TOKEN", which the agent "triage" gives with "ref:openbao/linear-token" and the agent "review" lacks',
    async () => {
      agents = [
        { name: "review", secrets: {}, lacks: { secrets: ["LINEAR_TOKEN"], hosts: [] } },
        { name: "triage", secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" }, lacks: none },
      ];
    },
  );

  await given('whose skill "missing" has no description and no body', async () => {
    const missing = {
      ...{ name: "missing", description: null, source: { folder: "skills/missing" }, needs: none },
      ...{ agents: [{ name: "triage", secrets: {}, lacks: none }], files: ["README.md"], body: null },
      problems: ['the skill "./skills/missing" has no SKILL.md'],
    };
    await sut.files.put("$INPUT/skills.json", JSON.stringify({ skills: [missing, { ...releaseNotes, agents }] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate skill-catalog skills.json"', async () => {
    run = await sut.cli(["validate", "skill-catalog", "skills.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "skills.json: valid skill-catalog"', async () => {
    expect(run.stdout).toContain("skills.json: valid skill-catalog");
  });
});
