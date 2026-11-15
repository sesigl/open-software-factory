import { scenario } from "@opensoftware/testkit";
import { committed, IMPLEMENT, PLAN, readmeWork, servingCommit } from "./foreman.ts";
import { committedSkill, factoryWithSkill, HASH, putPin, reviewEntry, SKILL } from "./skills.ts";

scenario("SCN-FORE-168", async ({ sut, fakes, given, when, then }) => {
  let first = "";
  await given(
    'the skill "review" is committed in "shared/review" of a Git repository that the server reaches at a "file://" URL, and its branch "main" has a newer commit of it',
    async () => {
      first = await committedSkill(sut);
      await committedSkill(sut, `${SKILL}Then read it a third time.\n`);
    },
  );

  let server: Awaited<ReturnType<typeof servingCommit>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" whose agent "plan" has the skill "git+<url>#main:shared/review" and a "factory.lock" that pins it at the first commit, with a scripted harness whose "plan" turn prints the skill\'s files',
    async () => {
      await putPin(sut, reviewEntry(sut), first, HASH);
      const commit = await committed(sut, fakes, factoryWithSkill(fakes, reviewEntry(sut)));
      server = await servingCommit(sut, fakes, commit, {
        turns: [
          { when: PLAN, commands: ["cat .claude/skills/review/SKILL.md .agents/skills/review/SKILL.md"] },
          { when: IMPLEMENT, reply: "done" },
        ],
      });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the agent of "plan" found the "SKILL.md" of the first commit in ".claude/skills/review" and ".agents/skills/review" of its folder',
    async () => {
      expect(server.harness.commands()).toEqual([expect.objectContaining({ exitCode: 0, output: SKILL + SKILL })]);
    },
  );
});
