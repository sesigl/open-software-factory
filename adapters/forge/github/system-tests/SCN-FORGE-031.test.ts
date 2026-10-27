import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-031", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let opened: Awaited<ReturnType<typeof openFrom>>[] = [];
  await given(
    'open pull requests in "tester/web" from "observer/triage-inline-1a2b3c4d", "fix-checkout" and "observer/review-scope-5e6f7a8b" in this order',
    async () => {
      box = await setup(sut, fakes);
      opened = [];
      for (const branch of ["observer/triage-inline-1a2b3c4d", "fix-checkout", "observer/review-scope-5e6f7a8b"])
        opened.push(await openFrom(box.forge, branch));
    },
  );

  let printed: Record<string, unknown>[] = [];
  await when('the client runs "prs tester/web --head observer/"', async () => {
    printed = lines(await box.run(["prs", "tester/web", "--head", "observer/"]));
  });

  await then(
    'prs prints two lines with the branches "observer/review-scope-5e6f7a8b" and "observer/triage-inline-1a2b3c4d" in that order',
    async () => {
      expect(printed.map((line) => line.head)).toEqual([
        "observer/review-scope-5e6f7a8b",
        "observer/triage-inline-1a2b3c4d",
      ]);
    },
  );

  await then(
    'each line has the pull request\'s number, URL, title, base "main", the state "open", "draft" false and the author "tester" behind the adapter\'s name',
    async () => {
      const [review, triage] = [opened[2], opened[0]];
      expect(printed).toMatchObject([
        { number: review?.number, url: review?.url, title: "Change observer/review-scope-5e6f7a8b" },
        { number: triage?.number, url: triage?.url, title: "Change observer/triage-inline-1a2b3c4d" },
      ]);
      for (const line of printed)
        expect(line).toMatchObject({ base: "main", state: "open", draft: false, author: "github:tester" });
    },
  );

  await then("each line has the time the pull request was opened", async () => {
    for (const line of printed) expect(String(line.created)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
    expect(Date.parse(String(printed[0]?.created))).toBeGreaterThanOrEqual(Date.parse(String(printed[1]?.created)));
  });
});
