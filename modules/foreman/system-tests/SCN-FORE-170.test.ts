import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";
import { committedSkill, factoryWithSkill, HASH, putPin, reviewEntry } from "./skills.ts";

const WRONG = "h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

scenario("SCN-FORE-170", async ({ sut, fakes, given, when, then }) => {
  let commit = "";
  await given(
    'the skill "review" is committed in "shared/review" of a Git repository that the server reaches at a "file://" URL',
    async () => {
      commit = await committedSkill(sut);
    },
  );

  await given(
    'the README\'s "factory.yaml" whose agent "plan" has the skill "git+<url>#main:shared/review" is committed with a "factory.lock" that pins its commit and the hash "h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
    async () => {
      await putPin(sut, reviewEntry(sut), commit, WRONG);
      await committed(sut, fakes, factoryWithSkill(fakes, reviewEntry(sut)));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: the folder shared/review of file://<path> at <commit> has the hash h1:c7yV/uKhC1mA4AQfa0iqY95BjwgtdubuRKOgs06JHx0=, not the hash h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= of its pin"',
    async () => {
      expect(run.stderr).toContain(
        `factory.yaml: the folder shared/review of file://${sut.files.path("$INPUT")} at ${commit} has the hash ${HASH}, not the hash ${WRONG} of its pin`,
      );
    },
  );
});
