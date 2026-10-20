import { scenario } from "@opensoftware/testkit";
import { junit, traced } from "./repo.ts";

scenario("SCN-TRACE-031", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a JUnit report in "build/test-results" in which the test of "SCN-SHOP-001" passed', async () => {
    await sut.files.put("$INPUT/build/test-results/checkout.xml", junit([{ id: "SCN-SHOP-001" }]));
  });

  await given('a spec-trace.json with the JUnit folder "build/test-results"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ junit: "build/test-results" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "PASS ok"', async () => {
    expect(run.stdout).toContain("PASS ok");
  });
});
