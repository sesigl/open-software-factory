import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { type Catalog, named, putSkill, RELEASE_NOTES, SECRETS } from "./skills.ts";

scenario("SCN-FSPEC-115", async ({ sut, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app" and the file "teams.md" beside it',
    async () => {
      await putSkill(sut, "skills/release-notes", RELEASE_NOTES);
      await putSkill(sut, "skills/release-notes", "| Team | Label |\n", "teams.md");
      await putSkill(sut, "skills/changelog", named("changelog"));
    },
  );

  const sandbox = (host: string) => ["sandbox:", "  template: node-24", `  egress: [${host}]`];
  const triage = agent("triage", [
    "skills: [./skills/release-notes]",
    "secrets: [ref:openbao/linear-token, ref:env/GH_TOKEN]",
    ...sandbox("api.linear.app"),
  ]);
  await given(
    'a factory.yaml whose agent "triage" has the skill, the secret "ref:openbao/linear-token" and the egress host "api.linear.app"',
    async () => {
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
    },
  );

  await given(
    'whose agent "review" has the skills "./skills/release-notes" and "./skills/changelog" and only the egress host "github.com"',
    async () => {
      const review = agent("review", [
        "skills: [./skills/release-notes, ./skills/changelog]",
        ...sandbox("github.com"),
      ]);
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers: SECRETS, agents: [...triage, ...review] }));
      await sut.files.put("$INPUT/agents/review.md", prompt("review"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  let catalog: Catalog;
  await when('the console runs "factory skills"', async () => {
    run = await sut.cli(["skills"]);
    catalog = JSON.parse(run.stdout) as Catalog;
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('it prints the skills "changelog" and "release-notes" in this order', async () => {
    expect(catalog.skills.map((skill) => skill.name)).toEqual(["changelog", "release-notes"]);
  });

  const notes = () => catalog.skills[1] as Catalog["skills"][number];
  await then(
    '"release-notes" has its description, the folder "skills/release-notes", the needs "LINEAR_TOKEN" and "api.linear.app", the files "SKILL.md" and "teams.md", the Markdown "# Release notes" and no problem',
    async () => {
      const { agents, ...rest } = notes();
      expect(rest).toEqual({
        name: "release-notes",
        description: "Write the release notes of a change from its Linear issues. Use when a change ships.",
        source: { folder: "skills/release-notes" },
        needs: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] },
        files: ["SKILL.md", "teams.md"],
        body: "\n# Release notes\n",
        problems: [],
      });
    },
  );

  await then(
    'its agent "review" lacks the secret "LINEAR_TOKEN" and the host "api.linear.app", and its agent "triage" gives "LINEAR_TOKEN" with "ref:openbao/linear-token" and lacks nothing',
    async () => {
      expect(notes().agents).toEqual([
        { name: "review", secrets: {}, lacks: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] } },
        {
          name: "triage",
          secrets: { LINEAR_TOKEN: "ref:openbao/linear-token" },
          lacks: { secrets: [], hosts: [] },
        },
      ]);
    },
  );
});
