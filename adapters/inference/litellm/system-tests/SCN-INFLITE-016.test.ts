import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-016", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "list" with "DOCKER_HOST" set to "unix:///nonexistent/docker.sock"', async () => {
    run = await sut.cli(["list"], { env: { DOCKER_HOST: "unix:///nonexistent/docker.sock" } });
  });

  await then("list exits with code 1 and prints one line on standard error", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toMatch(/^[^\n]+\n$/);
  });

  await then(
    'the line starts with "inference-litellm: docker ps: ", names "/nonexistent/docker.sock" and does not have the text "Command failed"',
    async () => {
      expect(run.stderr).toMatch(/^inference-litellm: docker ps: \S/);
      expect(run.stderr).toContain("/nonexistent/docker.sock");
      expect(run.stderr).not.toContain("Command failed");
    },
  );
});
