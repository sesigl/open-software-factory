import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

const TEXT = "The run ended with the outcome failed";

scenario("SCN-FORGE-034", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let issue: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["forge"]["openIssue"]>>;
  await given('an issue in "tester/web"', async () => {
    box = await setup(sut, fakes);
    issue = await box.forge.openIssue("web", { title: "Export reports as CSV" });
  });

  let printed: Record<string, unknown>;
  await when('the client runs "comment" on it with the text "The run ended with the outcome failed"', async () => {
    printed = await box.json(["comment", "tester/web", String(issue.number), TEXT]);
  });

  await then('the test forge shows the comment "The run ended with the outcome failed" on the issue', async () => {
    expect(await box.forge.comments(issue)).toEqual([TEXT]);
  });

  await then("comment prints the comment's ID and the issue's URL with the comment's anchor", async () => {
    expect(printed).toEqual({
      id: expect.any(Number),
      url: expect.stringMatching(new RegExp(`/tester/web/issues/${issue.number}#issuecomment-${printed.id}$`)),
    });
  });
});
