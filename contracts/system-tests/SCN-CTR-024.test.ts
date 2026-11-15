import { scenario } from "@opensoftware/testkit";

const none = { secrets: [], hosts: [] };

scenario("SCN-CTR-024", async ({ sut, given, when, then }) => {
  await given(
    'a skill catalog "skills.json" whose skill "review" has the source folder "skills/review" of the repository "https://forge.example/acme/skills.git" at a commit',
    async () => {
      const source = {
        folder: "skills/review",
        repository: "https://forge.example/acme/skills.git",
        commit: "3f786850e387550fdab836ed7e6dc881de23001b",
      };
      const review = {
        ...{ name: "review", description: "Review a plan. Use before a change starts.", source, needs: none },
        ...{ agents: [{ name: "plan", secrets: {}, lacks: none }], files: ["SKILL.md"], body: "# Review\n" },
        problems: [],
      };
      await sut.files.put("$INPUT/skills.json", JSON.stringify({ skills: [review] }));
    },
  );

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
