import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-018", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the repository "tester/web"', async () => {
    box = await setup(sut, fakes);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr tester/web 1" with the token "not-a-token"', async () => {
    run = await box.run(["pr", "tester/web", "1"], { FORGE_TOKEN: "not-a-token" });
  });

  await then('pr exits with code 1 and the error "the forge refused the token"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("forge-github: the forge refused the token\n");
  });
});
