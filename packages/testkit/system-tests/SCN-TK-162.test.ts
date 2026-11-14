import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { oidcModule } from "./oidc.ts";

scenario("SCN-TK-162", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI signs in at the provider in "DEMO_ISSUER" with the authorization code flow and PKCE, and prints the state and the claims of the ID token whose signature the provider\'s keys verify',
    async () => {
      module = oidcModule([], { state: "state-1", error: "access_denied" });
    },
  );

  await given(
    'its system test signs in nobody at fakes.oidc and expects the error "access_denied" with the state',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
