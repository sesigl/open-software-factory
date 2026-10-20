import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-048", async ({ sut, given, when, then }) => {
  await given('a repository with a spec-trace.json with the ID pattern "^REQ-([A-Z]+)-\\d{4}$"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ id: "^REQ-([A-Z]+)-\\d{4}$" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace next-id SHOP"', async () => {
    run = await sut.cli(["next-id", "SHOP"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "REQ-SHOP-0001"', async () => {
    expect(run.stdout).toBe("REQ-SHOP-0001\n");
  });
});
