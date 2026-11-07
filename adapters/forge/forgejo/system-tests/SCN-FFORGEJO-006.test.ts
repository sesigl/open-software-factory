import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FFORGEJO-006", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "check tester/web 9b1c2d3 verify success extra" with one word too many', async () => {
    run = await box.run(["check", "tester/web", "9b1c2d3", "verify", "success", "extra"]);
  });

  await then("check exits with code 2, prints nothing and writes the usage to the error output", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/^Usage: forge-forgejo <command>\n/);
    expect(run.stderr).toContain("  check <repo> <sha> <name> <pending|success|failure|error> ");
  });
});
