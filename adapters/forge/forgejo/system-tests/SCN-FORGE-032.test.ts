import { scenario } from "@opensoftware/testkit";
import { lines, openFrom, setup } from "./forge.ts";

scenario("SCN-FORGE-032", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let opened: Awaited<ReturnType<typeof openFrom>>[] = [];
  await given(
    'open pull requests in "tester/web" from "observer/triage-inline-1a2b3c4d", "observer/review-scope-5e6f7a8b" and "observer/ship-notes-9c0d1e2f"',
    async () => {
      box = await setup(sut, fakes);
      opened = [];
      for (const branch of [
        "observer/triage-inline-1a2b3c4d",
        "observer/review-scope-5e6f7a8b",
        "observer/ship-notes-9c0d1e2f",
      ])
        opened.push(await openFrom(box.forge, branch));
    },
  );

  await given(
    'the person "reviewer" approved the first, then commented on it, and asked for changes on the second',
    async () => {
      await box.forge.review(opened[0] as (typeof opened)[number], "APPROVED", "Good change");
      await box.forge.review(opened[0] as (typeof opened)[number], "COMMENT", "One more thought");
      await box.forge.review(opened[1] as (typeof opened)[number], "REQUEST_CHANGES", "Name the scenario");
    },
  );

  let printed: Record<string, unknown>[] = [];
  await when('the client runs "prs tester/web --head observer/"', async () => {
    printed = lines(await box.run(["prs", "tester/web", "--head", "observer/"]));
  });

  await then(
    'prs prints the review "approved" for the first, "changes_requested" for the second and "none" for the third',
    async () => {
      const review = (index: number) => printed.find((line) => line.number === opened[index]?.number)?.review;
      expect([review(0), review(1), review(2)]).toEqual(["approved", "changes_requested", "none"]);
    },
  );
});
