import { scenario } from "@opensoftware/testkit";
import { junit, traced } from "./repo.ts";

scenario("SCN-TRACE-032", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a JUnit report in which the test of "SCN-SHOP-001" passed', async () => {
    await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ id: "SCN-SHOP-001" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check"', async () => {
    run = await sut.cli(["check"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is the lines "SPEC ok", "TRACE ok", "STEPS ok" and "PASS ok"', async () => {
    expect(run.stdout).toBe("SPEC ok\nTRACE ok\nSTEPS ok\nPASS ok\n");
  });
});
