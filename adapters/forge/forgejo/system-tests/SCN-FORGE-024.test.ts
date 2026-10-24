import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-024", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let registered: Record<string, unknown>;
  await given('the client ran "webhook tester/web http://intake.example/forge --event push"', async () => {
    box = await setup(sut, fakes);
    registered = await box.json(["webhook", "tester/web", "http://intake.example/forge", "--event", "push"]);
  });

  let run: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["run"]>>;
  await when('the client runs "hooks tester/web"', async () => {
    run = await box.run(["hooks", "tester/web"]);
  });

  await then("hooks prints one line with the same ID, URL, events and active flag that webhook printed", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const lines = run.stdout
      .trim()
      .split("\n")
      .map((text) => JSON.parse(text) as unknown);
    expect(lines).toEqual([registered]);
    expect(registered).toMatchObject({ url: "http://intake.example/forge", events: ["push"], active: true });
  });
});
