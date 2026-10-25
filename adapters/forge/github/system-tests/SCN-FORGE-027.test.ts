import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-027", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web" with the branch "fix-checkout" that changes "checkout.js"', async () => {
    box = await setup(sut, fakes);
    await box.forge.createBranch("web", { branch: "fix-checkout", files: { "checkout.js": "fixed\n" } });
  });

  let number = 0;
  await given('the client opened a pull request from "fix-checkout"', async () => {
    const opened = await box.json([
      "open-pr",
      "tester/web",
      "fix-checkout",
      "--title",
      "Fix checkout button on Safari",
    ]);
    number = opened.number as number;
  });

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(number)]);
  });

  await then('pr prints the author "tester" behind the adapter\'s name, no labels and "draft" false', async () => {
    expect(printed).toMatchObject({ author: "github:tester", labels: [], draft: false });
  });

  await then('pr prints the paths "checkout.js"', async () => {
    expect(printed.paths).toEqual(["checkout.js"]);
  });
});
