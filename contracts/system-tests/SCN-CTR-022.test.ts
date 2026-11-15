import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-022", async ({ sut, given, when, then }) => {
  await given('a factory lock "factory.lock" that pins the skill "review" at the commit "4b825dc"', async () => {
    const review = {
      source: "git+https://forge.example/acme/skills.git#v1.2:skills/review",
      commit: "4b825dc",
      hash: "h1:uPQnZjYBqRPfDTJKbPXlBPw5mRhYBO1ZbmwgcsT0W2c=",
    };
    await sut.files.put("$INPUT/factory.lock", JSON.stringify({ version: 1, mcp: {}, skills: { review } }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate factory-lock factory.lock"', async () => {
    run = await sut.cli(["validate", "factory-lock", "factory.lock"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "factory.lock /skills/review/commit: must match pattern"', async () => {
    expect(run.stdout).toContain("factory.lock /skills/review/commit: must match pattern");
  });
});
