import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-016", async ({ sut, given, when, then }) => {
  await given('a skill catalog "skills.json" whose skill "release-notes" has every field but "body"', async () => {
    const skill = {
      name: "release-notes",
      description: "Write the release notes of a change from its Linear issues. Use when a change ships.",
      source: { folder: "skills/release-notes" },
      needs: { secrets: [], hosts: [] },
      agents: [],
      files: ["SKILL.md"],
      problems: [],
    };
    await sut.files.put("$INPUT/skills.json", JSON.stringify({ skills: [skill] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate skill-catalog skills.json"', async () => {
    run = await sut.cli(["validate", "skill-catalog", "skills.json"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "skills.json /skills/0/body: missing required field"', async () => {
    expect(run.stdout).toContain("skills.json /skills/0/body: missing required field");
  });
});
