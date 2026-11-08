import { scenario } from "@opensoftware/testkit";
import { TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-048", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console without "CONSOLE_FOREMAN_URL"', async () => {
    env = {};
  });

  let intake = "";
  await given('an intake whose "/v1/health" answers 404', async () => {
    intake = (
      await fakes.http([
        { path: "/v1/health", status: 404, body: { title: "Not Found" } },
        { path: TOKEN_ROUTES.intake, status: 404, body: { title: "Not Found" } },
      ])
    ).url;
    env = { ...env, CONSOLE_INTAKE_URL: intake };
  });

  const file = sut.files.path("$INPUT/missing.yaml");
  await given('"CONSOLE_FACTORY" names a file that does not exist', async () => {
    env = { ...env, CONSOLE_FACTORY: file };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then(`it prints "FAIL  foreman: set CONSOLE_FOREMAN_URL to the base URL of the foreman's API"`, async () => {
    expect(run.stdout).toContain("FAIL  foreman: set CONSOLE_FOREMAN_URL to the base URL of the foreman's API\n");
  });

  await then(
    'it prints "FAIL  intake: <URL>/v1/health answered 404: update intake to a release with /v1/health"',
    async () => {
      expect(run.stdout).toContain(
        `FAIL  intake: ${intake}/v1/health answered 404: update intake to a release with /v1/health\n`,
      );
    },
  );

  await then(
    `it prints "FAIL  factory: ENOENT: no such file or directory, open '<file>': check CONSOLE_FACTORY"`,
    async () => {
      expect(run.stdout).toContain(
        `FAIL  factory: ENOENT: no such file or directory, open '${file}': check CONSOLE_FACTORY\n`,
      );
    },
  );
});
