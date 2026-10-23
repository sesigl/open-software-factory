import { runAdapter } from "@opensoftware/harness-proxy";
import { scenario } from "@opensoftware/testkit";
import { captured, demoAdapter } from "./proxy.ts";

scenario("SCN-HPROXY-016", async ({ when, then }) => {
  const output = captured();
  let code = 0;
  await when('runAdapter runs "transcript" for the adapter "demo"', async () => {
    code = await runAdapter(demoAdapter, { args: ["transcript"], env: {}, io: output.io });
  });

  await then('it gives 2 and writes "harness-demo: name the session ID" to standard error', async () => {
    expect(code).toBe(2);
    expect(output.stderr).toBe("harness-demo: name the session ID\n");
    expect(output.stdout).toBe("");
  });
});
