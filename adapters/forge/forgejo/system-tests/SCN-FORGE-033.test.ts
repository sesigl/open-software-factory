import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-033", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openFrom>>;
  await given(
    'a pull request in "tester/web" from "observer/triage-inline-1a2b3c4d" that a person merged',
    async () => {
      box = await setup(sut, fakes);
      pr = await openFrom(box.forge, "observer/triage-inline-1a2b3c4d");
      await box.forge.mergePullRequest(pr);
    },
  );

  let open: Awaited<ReturnType<typeof box.run>>;
  let all: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "prs tester/web" and "prs tester/web --state all"', async () => {
    open = await box.run(["prs", "tester/web"]);
    all = await box.run(["prs", "tester/web", "--state", "all"]);
  });

  await then("the first prints nothing", async () => {
    expect(open.exitCode, open.stderr).toBe(0);
    expect(open.stdout.trim()).toBe("");
  });

  await then('the second prints the pull request with the state "merged"', async () => {
    expect(lines(all)).toMatchObject([{ number: pr.number, url: pr.url, state: "merged" }]);
  });
});
