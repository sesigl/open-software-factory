import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { committedReview, entryAt, lockOf, putEntries } from "./remote.ts";

scenario("SCN-FSPEC-120", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      commit = await committedReview(sut);
    },
  );

  await given('a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review"', async () => {
    await putEntries(sut, [entryAt(sut, "main")]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  let check: Awaited<ReturnType<typeof sut.cli>>;
  let lint: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan", then "factory plan --check" and "factory lint"', async () => {
    run = await sut.cli(["plan"]);
    check = await sut.cli(["plan", "--check"]);
    lint = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output starts with "+ factory.lock.skills.review: " and the pin', async () => {
    const pin = (await lockOf(sut)).skills?.review;
    expect(run.stdout.split("\n")[0]).toBe(`+ factory.lock.skills.review: ${JSON.stringify(pin)}`);
  });

  await then(
    'factory.lock pins the skill "review" for its entry at the commit of "main", with the hash "h1:" of its files, a valid factory-lock of the contracts',
    async () => {
      const lock = await lockOf(sut);
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      expect(lock.skills).toEqual({
        review: { source: entryAt(sut, "main"), commit, hash: expect.stringMatching(/^h1:[A-Za-z0-9+/]{43}=$/) },
      });
      expect(validate("factory-lock", lock)).toEqual([]);
    },
  );

  await then(
    '"factory plan --check" prints "factory.lock is current." and "factory lint" prints "factory.yaml: no problems"',
    async () => {
      expect([check.exitCode, check.stdout]).toEqual([0, "factory.lock is current.\n"]);
      expect([lint.exitCode, lint.stdout]).toEqual([0, "factory.yaml: no problems\n"]);
    },
  );
});
