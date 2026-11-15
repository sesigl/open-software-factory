import { scenario } from "@opensoftware/testkit";

const SOURCE = "git+https://forge.example/acme/skills.git#v1.2:skills/review";

scenario("SCN-CTR-021", async ({ sut, given, when, then }) => {
  await given(
    'a factory lock "factory.lock" that pins the skill "review" of "git+https://forge.example/acme/skills.git#v1.2:skills/review" at a commit with its hash',
    async () => {
      const review = {
        source: SOURCE,
        commit: "3f786850e387550fdab836ed7e6dc881de23001b",
        hash: "h1:uPQnZjYBqRPfDTJKbPXlBPw5mRhYBO1ZbmwgcsT0W2c=",
      };
      await sut.files.put("$INPUT/factory.lock", JSON.stringify({ version: 1, mcp: {}, skills: { review } }));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate factory-lock factory.lock"', async () => {
    run = await sut.cli(["validate", "factory-lock", "factory.lock"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "factory.lock: valid factory-lock"', async () => {
    expect(run.stdout).toContain("factory.lock: valid factory-lock");
  });
});
