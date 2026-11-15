import { scenario } from "@opensoftware/testkit";
import { FAR, putEntries } from "./remote.ts";
import { lines } from "./skills.ts";

const BARE = "git+https://forge.example/acme/skills.git#main";
const OUTSIDE = "git+https://forge.example/acme/skills.git#main:../review";

scenario("SCN-FSPEC-124", async ({ sut, given, when, then }) => {
  let line = "";
  await given(
    'a factory.yaml whose agent "triage" has the skills "git+https://forge.example/acme/skills.git#main", "git+https://forge.example/acme/skills.git#main:../review" and "git+https://forge.example/acme/skills.git#v1:skills/review" on line 14',
    async () => {
      line = (await putEntries(sut, [BARE, OUTSIDE, FAR])).split("\n")[13] as string;
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
    'the output names the first entry as "is no git+<url>#<ref>:<path>: name a ref and the skill\'s folder", the second as "names a folder outside its repository"',
    async () => {
      expect(lines(run).slice(0, 2)).toEqual([
        `${at(BARE)} the skill "${BARE}" is no git+<url>#<ref>:<path>: name a ref and the skill's folder`,
        `${at(OUTSIDE)} the skill "${OUTSIDE}" names a folder outside its repository`,
      ]);
    },
  );

  await then(
    'it warns "factory.lock has no pin of the skill \\"review\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/review\\": run \\"factory plan\\"" at the third',
    async () => {
      expect(lines(run).slice(2)).toEqual([
        `${at(FAR)} warning /agents/triage/skills/2: factory.lock has no pin of the skill "review" for "${FAR}": run "factory plan"`,
        "factory.yaml: 2 problems, 1 warning",
      ]);
    },
  );
});
