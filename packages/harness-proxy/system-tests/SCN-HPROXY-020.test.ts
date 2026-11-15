import { runAdapter } from "@opensoftware/harness-proxy";
import { scenario } from "@opensoftware/testkit";
import { captured, demoAdapter } from "./proxy.ts";

scenario("SCN-HPROXY-020", async ({ when, then }) => {
  const runs: { code: number; stdout: string; stderr: string }[] = [];
  await when(
    'runAdapter runs "deploy", "constructor" and "toString" for an adapter with the usage "Usage: demo"',
    async () => {
      for (const command of ["deploy", "constructor", "toString"]) {
        const output = captured();
        const code = await runAdapter(demoAdapter, { args: [command], env: {}, io: output.io });
        runs.push({ code, stdout: output.stdout, stderr: output.stderr });
      }
    },
  );

  await then('each gives 2 and writes "Usage: demo" to standard error, and nothing to standard output', async () => {
    expect(runs).toEqual([
      { code: 2, stdout: "", stderr: "Usage: demo\n" },
      { code: 2, stdout: "", stderr: "Usage: demo\n" },
      { code: 2, stdout: "", stderr: "Usage: demo\n" },
    ]);
  });
});
