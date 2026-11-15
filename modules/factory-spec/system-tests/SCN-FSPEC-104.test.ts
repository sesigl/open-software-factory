import { scenario } from "@opensoftware/testkit";
import { named, putSkill, putSkilled } from "./skills.ts";

const NAMES = ["Release-Notes", "-notes", "release--notes", "release_notes"];

scenario("SCN-FSPEC-104", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/Release-Notes", "./skills/-notes", "./skills/release--notes" and "./skills/release_notes"',
    async () => {
      await putSkilled(
        sut,
        NAMES.map((name) => `./skills/${name}`),
      );
    },
  );

  await given("each SKILL.md has the name of its folder on line 2", async () => {
    for (const name of NAMES) await putSkill(sut, `skills/${name}`, named(name));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output names, for each of the four, "SKILL.md:2:1 name \\"<name>\\" is not lowercase letters and digits with single hyphens between them" and then "factory.yaml: 4 problems"',
    async () => {
      expect(run.stdout).toBe(
        [
          ...NAMES.map(
            (name) =>
              `skills/${name}/SKILL.md:2:1 name "${name}" is not lowercase letters and digits with single hyphens between them`,
          ),
          "factory.yaml: 4 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
