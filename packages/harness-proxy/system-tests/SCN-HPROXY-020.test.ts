import { runAdapter } from "@opensoftware/harness-proxy";
import { scenario } from "@opensoftware/testkit";
import { captured, demoAdapter } from "./proxy.ts";

scenario("SCN-HPROXY-020", async ({ when, then }) => {
  const outputs = [captured(), captured(), captured()] as const;
  let codes: number[] = [];
  await when(
    'runAdapter runs "deploy", "constructor" and "toString" for an adapter with the usage "Usage: demo"',
    async () => {
      codes = [
        await runAdapter(demoAdapter, { args: ["deploy"], env: {}, io: outputs[0].io }),
        await runAdapter(demoAdapter, { args: ["constructor"], env: {}, io: outputs[1].io }),
        await runAdapter(demoAdapter, { args: ["toString"], env: {}, io: outputs[2].io }),
      ];
    },
  );

  await then('each gives 2 and writes "Usage: demo" to standard error, and nothing to standard output', async () => {
    expect(codes).toEqual([2, 2, 2]);
    expect(outputs.map((output) => [output.stderr, output.stdout])).toEqual([
      ["Usage: demo\n", ""],
      ["Usage: demo\n", ""],
      ["Usage: demo\n", ""],
    ]);
  });
});
