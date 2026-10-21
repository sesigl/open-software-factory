import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { readEvents } from "./github.ts";

scenario("SCN-LEDGER-048", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  await given('a Forgejo repository "tester/web" with the open pull request "Add a sum function"', async () => {
    forge = await fakes.forge();
    await forge.createRepository("web");
    pr = await forge.openPullRequest("web", {
      branch: "add-sum",
      title: "Add a sum function",
      files: { "sum.ts": "export const sum = (a: number, b: number) => a + b;\n" },
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger import <forge URL>/tester/web"', async () => {
    run = await sut.cli(["import", `${forge.url}/${forge.owner}/web`], { env: { LEDGER_FORGE_TOKEN: forge.token } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"pr-events.jsonl" has a "pr.opened@v1" event with the pull request\'s URL, its title "Add a sum function" and its head commit',
    async () => {
      const events = await readEvents(sut);
      expect(events.map((event) => event.type)).toEqual(["pr.opened@v1"]);
      expect(events[0].data).toMatchObject({
        url: pr.url,
        number: pr.number,
        title: "Add a sum function",
        headBranch: "add-sum",
        baseBranch: "main",
        headCommit: pr.sha,
        author: { kind: "person", id: "forgejo:tester" },
      });
    },
  );
});
