import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

/** A kubeconfig without the context it names: kubectl fails before it calls any cluster. */
const MISSING_CONTEXT = "apiVersion: v1\nkind: Config\ncurrent-context: osf-missing\n";

scenario("SCN-SKUBE-009", async ({ sut, given, when, then }) => {
  await given('a kubeconfig whose current context "osf-missing" does not exist', async () => {
    await sut.files.put("$INPUT/kubeconfig", MISSING_CONTEXT);
  });

  let run: CliResult;
  await when('the client runs "list" with that kubeconfig', async () => {
    run = await sandboxes(sut, { KUBECONFIG: sut.files.path("$INPUT/kubeconfig") }).cli(["list"]);
  });

  await then(
    'the command exits with code 1 and writes "sandbox-kubernetes: kubectl get failed: " and kubectl\'s error, which names "osf-missing"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(1);
      expect(run.stderr).toMatch(/sandbox-kubernetes: kubectl get failed: [^\n]*osf-missing/);
    },
  );
});
