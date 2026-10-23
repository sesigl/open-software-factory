import { copyEnds } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";
import { catching } from "./egress.ts";

scenario("SCN-SEGRESS-021", async ({ when, then }) => {
  let error: unknown;
  await when('the adapter calls copyEnds with "0123456789ab:a.txt" and "ba9876543210:b.txt"', async () => {
    error = catching(() => copyEnds("0123456789ab:a.txt", "ba9876543210:b.txt"));
  });

  await then("it fails with a usage error that says to name the sandbox on one side only", async () => {
    expect((error as Error).constructor.name).toBe("UsageError");
    expect((error as Error).message).toBe("name the sandbox on one side only, as <ID>:<path>");
  });
});
