import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-049", async ({ sut, given, when, then }) => {
  await given('a repository with a spec-trace.json with the ID pattern "^REQ-([A-Z]+)-[0-9]+$"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ id: "^REQ-([A-Z]+)-[0-9]+$" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace next-id SHOP"', async () => {
    run = await sut.cli(["next-id", "SHOP"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then(
    'the error output contains "spec-trace: cannot build a first ID for SHOP from ^REQ-([A-Z]+)-[0-9]+$"',
    async () => {
      expect(run.stderr).toContain("spec-trace: cannot build a first ID for SHOP from ^REQ-([A-Z]+)-[0-9]+$");
    },
  );
});
