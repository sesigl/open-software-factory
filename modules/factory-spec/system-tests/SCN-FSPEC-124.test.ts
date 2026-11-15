import { scenario } from "@opensoftware/testkit";
import { FAR, putEntries } from "./remote.ts";
import { lines } from "./skills.ts";

const BARE = "git+https://forge.example/acme/skills.git#main";
const OUTSIDE = "git+https://forge.example/acme/skills.git#main:../review";
const ROOTED = "git+https://forge.example/acme/skills.git#main:/review";

scenario("SCN-FSPEC-124", async ({ sut, given, when, then }) => {
  let line = "";
  await given(
    'a factory.yaml whose agent "triage" has the skills "git+https://forge.example/acme/skills.git#main", "git+https://forge.example/acme/skills.git#main:../review", "git+https://forge.example/acme/skills.git#main:/review" and "git+https://forge.example/acme/skills.git#v1:skills/review" on line 14',
    async () => {
      line = (await putEntries(sut, [BARE, OUTSIDE, ROOTED, FAR])).split("\n")[13] as string;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  // The column of an entry is that of its opening quote.
  const at = (entry: string) => `factory.yaml:14:${line.indexOf(`"${entry}"`) + 1}`;
  await then(
    'the output names the first entry as "is no git+<url>#<ref>:<path>: name a ref and the skill\'s folder", the second and the third as "names a folder outside its repository"',
    async () => {
      expect(lines(run).slice(0, 3)).toEqual([
        `${at(BARE)} the skill "${BARE}" is no git+<url>#<ref>:<path>: name a ref and the skill's folder`,
        `${at(OUTSIDE)} the skill "${OUTSIDE}" names a folder outside its repository`,
        `${at(ROOTED)} the skill "${ROOTED}" names a folder outside its repository`,
      ]);
    },
  );

  await then(
    'it warns "factory.lock has no pin of the skill \\"review\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/review\\": run \\"factory plan\\"" at the fourth',
    async () => {
      expect(lines(run).slice(3)).toEqual([
        `${at(FAR)} warning /agents/triage/skills/3: factory.lock has no pin of the skill "review" for "${FAR}": run "factory plan"`,
        "factory.yaml: 3 problems, 1 warning",
      ]);
    },
  );
});
