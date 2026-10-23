import { type CopyEnds, copyEnds } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-020", async ({ when, then }) => {
  let ends: CopyEnds | undefined;
  await when('the adapter calls copyEnds with "0123456789ab:/tmp/result.txt" and "result.txt"', async () => {
    ends = copyEnds("0123456789ab:/tmp/result.txt", "result.txt");
  });

  await then(
    'it gives the sandbox "0123456789ab", the path "/tmp/result.txt", the client\'s path "result.txt" and a copy out of the sandbox',
    async () => {
      expect(ends).toEqual({ id: "0123456789ab", inSandbox: "/tmp/result.txt", local: "result.txt", into: false });
    },
  );
});
