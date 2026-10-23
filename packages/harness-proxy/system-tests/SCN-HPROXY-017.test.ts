import { runAdapter } from "@opensoftware/harness-proxy";
import { scenario } from "@opensoftware/testkit";
import { captured, demoAdapter } from "./proxy.ts";

scenario("SCN-HPROXY-017", async ({ when, then }) => {
  const output = captured();
  let code = 2;
  await when('runAdapter runs "--help" for an adapter with the usage "Usage: demo"', async () => {
    code = await runAdapter(demoAdapter, { args: ["--help"], env: {}, io: output.io });
  });

  await then('it gives 0 and prints "Usage: demo"', async () => {
    expect(code).toBe(0);
    expect(output.stdout).toBe("Usage: demo\n");
  });
});
