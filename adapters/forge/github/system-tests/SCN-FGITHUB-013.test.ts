import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FGITHUB-013", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let oldest: Awaited<ReturnType<typeof openFrom>>;
  await given(
    '101 open pull requests in "tester/web", of which only the oldest is from a branch that starts with "observer/"',
    async () => {
      box = await setup(sut, fakes);
      oldest = await openFrom(box.forge, "observer/triage-1a2b3c4d");
      for (let index = 2; index <= 101; index++) await openFrom(box.forge, `console/change-${index}`);
    },
  );

  let printed: Record<string, unknown>[];
  await when('the client runs "prs tester/web --head observer/ --limit 1"', async () => {
    printed = lines(await box.run(["prs", box.repo, "--head", "observer/", "--limit", "1"]));
  });

  await then("prs prints that oldest pull request", async () => {
    expect(printed.map((line) => [line.number, line.head])).toEqual([[oldest.number, "observer/triage-1a2b3c4d"]]);
  });

  await then("the client asked GitHub for two pages of the list of pull requests", async () => {
    const pages = box.forge.calls().filter((call) => call.startsWith("GET /repos/tester/web/pulls?"));
    expect(pages).toHaveLength(2);
  });
});
