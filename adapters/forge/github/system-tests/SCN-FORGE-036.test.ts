import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-036", async ({ sut, fakes, when, then }) => {
  let run: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["run"]>>;
  await when("the client runs \"commit tester/web console/missing --message 'x' factory.yaml=<file>\"", async () => {
    const box = await setup(sut, fakes);
    await sut.files.put("$INPUT/factory.yaml", "version: 1\n");
    run = await box.run([
      "commit",
      box.repo,
      "console/missing",
      "--message",
      "x",
      `factory.yaml=${sut.files.path("$INPUT/factory.yaml")}`,
    ]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('it prints "no branch tester/web:console/missing"', async () => {
    expect(run.stderr).toContain("no branch tester/web:console/missing");
  });
});
