import { memoryBytes } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-018", async ({ when, then }) => {
  let bytes: number[] = [];
  await when('the adapter calls memoryBytes with "256Mi" and "2Gi"', async () => {
    bytes = [memoryBytes("256Mi"), memoryBytes("2Gi")];
  });

  await then("it gives 268435456 and 2147483648", async () => {
    expect(bytes).toEqual([268435456, 2147483648]);
  });
});
