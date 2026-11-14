import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-041", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let numbers: number[] = [];
  let merge = "";
  await given('three pull requests in "tester/web", the newest of them merged', async () => {
    box = await setup(sut, fakes);
    const opened = [];
    for (const branch of ["first-change", "second-change", "third-change"])
      opened.push(await openFrom(box.forge, branch));
    numbers = opened.map((pr) => pr.number);
    merge = await box.forge.mergePullRequest(opened[2] as (typeof opened)[number]);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "prs tester/web --state all --limit 2"', async () => {
    run = await box.run(["prs", box.repo, "--state", "all", "--limit", "2"]);
  });

  await then("prs prints two lines, the newest first, and the merged one has its merge commit", async () => {
    const listed = lines(run);
    expect(listed.map((line) => line.number)).toEqual([numbers[2], numbers[1]]);
    expect(listed[0]).toMatchObject({ state: "merged", mergeCommit: merge });
    expect(listed[1]).not.toHaveProperty("mergeCommit");
  });
});
