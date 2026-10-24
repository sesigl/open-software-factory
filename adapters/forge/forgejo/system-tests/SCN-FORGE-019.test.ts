import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-019", async ({ sut, fakes, when, then }) => {
  const box = await setup(sut, fakes);
  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "branch tester/shop fix-checkout"', async () => {
    run = await box.run(["branch", "tester/shop", "fix-checkout"]);
  });

  await then('branch exits with code 1 and the error "no repository tester/shop"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("forge-forgejo: no repository tester/shop\n");
  });
});
