import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

const front = (name: string, metadata: string[]): string =>
  skillMd([`name: ${name}`, `description: The skill ${name}. Use it in a scenario.`, ...metadata]);

scenario("SCN-FSPEC-107", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/notes", "./skills/hosts" and "./skills/names"',
    async () => {
      await putSkilled(sut, ["./skills/notes", "./skills/hosts", "./skills/names"]);
    },
  );

  await given('the metadata of "notes" is the text "LINEAR_TOKEN"', async () => {
    await putSkill(sut, "skills/notes", front("notes", ["metadata: LINEAR_TOKEN"]));
  });

  await given('the metadata "opensoftware/hosts" of "hosts" is a list on line 5', async () => {
    await putSkill(sut, "skills/hosts", front("hosts", ["metadata:", "  opensoftware/hosts:", "    - api.linear.app"]));
  });

  await given(
    'the metadata of "names" has "opensoftware/secrets: linear-token" on line 5 and "opensoftware/hosts: https://api.linear.app" on line 6',
    async () => {
      const metadata = [
        "metadata:",
        "  opensoftware/secrets: linear-token",
        "  opensoftware/hosts: https://api.linear.app",
      ];
      await putSkill(sut, "skills/names", front("names", metadata));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/notes/SKILL.md:4:1 metadata is no mapping of keys to text", "skills/hosts/SKILL.md:5:3 metadata \\"opensoftware/hosts\\" is no text: write the names on one line, separated by spaces", "skills/names/SKILL.md:5:3 metadata \\"opensoftware/secrets\\" names \\"linear-token\\", which is no variable of upper-case letters, digits and \\"_\\"", "skills/names/SKILL.md:6:3 metadata \\"opensoftware/hosts\\" names \\"https://api.linear.app\\", which is no host name" and then "factory.yaml: 4 problems"',
    async () => {
      expect(run.stdout).toBe(
        [
          "skills/notes/SKILL.md:4:1 metadata is no mapping of keys to text",
          'skills/hosts/SKILL.md:5:3 metadata "opensoftware/hosts" is no text: write the names on one line, separated by spaces',
          'skills/names/SKILL.md:5:3 metadata "opensoftware/secrets" names "linear-token", which is no variable of upper-case letters, digits and "_"',
          'skills/names/SKILL.md:6:3 metadata "opensoftware/hosts" names "https://api.linear.app", which is no host name',
          "factory.yaml: 4 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
