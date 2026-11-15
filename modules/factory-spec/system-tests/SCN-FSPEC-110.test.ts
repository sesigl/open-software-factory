import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { named, putSkill } from "./skills.ts";

const SKILLS = { triage: "./skills/release-notes", spec: "skills/release-notes/", review: "./shared/release-notes" };

scenario("SCN-FSPEC-110", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agents "triage" and "spec" have the skill "./skills/release-notes", written as "skills/release-notes/" for "spec"',
    async () => {
      await putSkill(sut, "skills/release-notes", named("release-notes"));
    },
  );

  await given('whose agent "review" has the skill "./shared/release-notes" on line 23', async () => {
    await putSkill(sut, "shared/release-notes", named("release-notes"));
    const agents = Object.entries(SKILLS).flatMap(([name, skill]) => agent(name, [`skills: [${skill}]`]));
    await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents }));
    for (const name of Object.keys(SKILLS)) await sut.files.put(`$INPUT/agents/${name}.md`, prompt(name));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.yaml:23:14 the skill \\"./shared/release-notes\\" has the name \\"release-notes\\" of the skill \\"./skills/release-notes\\": a factory uses one skill of a name" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'factory.yaml:23:14 the skill "./shared/release-notes" has the name "release-notes" of the skill "./skills/release-notes": a factory uses one skill of a name\n' +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
