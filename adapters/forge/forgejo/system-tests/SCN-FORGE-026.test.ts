import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-026", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web" without webhooks', async () => {
    box = await setup(sut, fakes);
    expect(await box.forge.hooks("web")).toEqual([]);
  });

  let run: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["run"]>>;
  await when('the client runs "unhook tester/web 424242"', async () => {
    run = await box.run(["unhook", "tester/web", "424242"]);
  });

  await then('unhook exits with code 0 and prints the ID 424242 and "removed" false', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ id: 424242, removed: false });
  });
});
