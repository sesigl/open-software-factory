import { scenario } from "@opensoftware/testkit";
import { FAR, putEntries } from "./remote.ts";
import { lines, named, putSkill } from "./skills.ts";

scenario("SCN-FSPEC-123", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/review" and "git+https://forge.example/acme/skills.git#v1:skills/review" on line 14',
    async () => {
      await putSkill(sut, "skills/review", named("review"));
      await putEntries(sut, ["./skills/review", FAR]);
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
    'the output starts with "factory.yaml:14:31 the skill \\"git+https://forge.example/acme/skills.git#v1:skills/review\\" has the name \\"review\\" of the skill \\"./skills/review\\": a factory uses one skill of a name"',
    async () => {
      expect(lines(run)[0]).toBe(
        `factory.yaml:14:31 the skill "${FAR}" has the name "review" of the skill "./skills/review": a factory uses one skill of a name`,
      );
    },
  );

  await then('it ends with "factory.yaml: 1 problems, 1 warning"', async () => {
    expect(lines(run).at(-1)).toBe("factory.yaml: 1 problems, 1 warning");
  });
});
