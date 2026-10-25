import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-029", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web" without pull requests', async () => {
    box = await setup(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "comments tester/web 42"', async () => {
    run = await box.run(["comments", "tester/web", "42"]);
  });

  await then('comments exits with code 1 and the error "no pull request tester/web#42"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("forge-github: no pull request tester/web#42\n");
    expect(run.stdout).toBe("");
  });
});
