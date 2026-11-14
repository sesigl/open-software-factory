import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FGITHUB-011", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let newest: Awaited<ReturnType<typeof openFrom>> | undefined;
  await given('101 open pull requests in "tester/web", more than one page of GitHub\'s list', async () => {
    box = await setup(sut, fakes);
    for (let index = 1; index <= 101; index++) newest = await openFrom(box.forge, `console/change-${index}`);
  });

  let printed: Record<string, unknown>[];
  await when('the client runs "prs tester/web --limit 1"', async () => {
    printed = lines(await box.run(["prs", box.repo, "--limit", "1"]));
  });

  await then("prs prints the newest pull request only", async () => {
    expect(printed.map((line) => line.number)).toEqual([newest?.number]);
  });

  await then("the client asked GitHub for one page of the list of pull requests", async () => {
    const pages = box.forge.calls().filter((call) => call.startsWith("GET /repos/tester/web/pulls?"));
    expect(pages).toHaveLength(1);
  });
});
