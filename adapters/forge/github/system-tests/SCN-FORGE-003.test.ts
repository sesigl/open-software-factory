import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let head = "";
  await given('the repository "tester/web" with the branch "fix-checkout" that changes "checkout.js"', async () => {
    box = await setup(sut, fakes);
    head = await box.forge.createBranch("web", { branch: "fix-checkout", files: { "checkout.js": "fixed\n" } });
  });

  let printed: Record<string, unknown>;
  await when(
    'the client runs "open-pr tester/web fix-checkout" with the title "Fix checkout button on Safari" and the body "Closes #12"',
    async () => {
      const args = ["open-pr", "tester/web", "fix-checkout", "--title", "Fix checkout button on Safari"];
      printed = await box.json([...args, "--body", "Closes #12"]);
    },
  );

  await then(
    'the test forge has an open pull request from "fix-checkout" into "main" with that title and body',
    async () => {
      expect(await box.forge.pullRequests("web")).toEqual([
        {
          number: 1,
          title: "Fix checkout button on Safari",
          body: "Closes #12",
          head: "fix-checkout",
          base: "main",
          state: "open",
          url: expect.stringMatching(/\/tester\/web\/pull\/1$/),
        },
      ]);
    },
  );

  await then('open-pr prints its number, its URL and the head commit of "fix-checkout"', async () => {
    const [opened] = await box.forge.pullRequests("web");
    expect(printed).toEqual({ number: 1, url: opened?.url, head: "fix-checkout", base: "main", sha: head });
  });
});
