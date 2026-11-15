import { copyEnds } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-020", async ({ when, then }) => {
  let ends: ReturnType<typeof copyEnds> | undefined;
  await when('the adapter calls copyEnds with "0123456789ab:a.txt" and "ba9876543210:b.txt"', async () => {
    ends = copyEnds("0123456789ab:a.txt", "ba9876543210:b.txt");
  });

  await then('it gives the problem "name the sandbox on one side only, as <ID>:<path>"', async () => {
    expect(ends).toEqual({ problem: "name the sandbox on one side only, as <ID>:<path>" });
  });
});
