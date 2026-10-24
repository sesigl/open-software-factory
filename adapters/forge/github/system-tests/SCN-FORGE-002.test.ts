import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-002", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web" with the branch "fix-checkout"', async () => {
    box = await setup(sut, fakes);
    await box.forge.createBranch("web", { branch: "fix-checkout", files: { "checkout.js": "fixed\n" } });
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "branch tester/web fix-checkout"', async () => {
    run = await box.run(["branch", "tester/web", "fix-checkout"]);
  });

  await then('branch exits with code 1 and the error "branch fix-checkout exists"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("forge-github: branch fix-checkout exists\n");
    expect(run.stdout).toBe("");
  });
});
