import { type CopyEnds, copyEnds } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-019", async ({ when, then }) => {
  let ends: CopyEnds | undefined;
  await when('the adapter calls copyEnds with "notes.md" and "0123456789ab:docs/notes.md"', async () => {
    ends = copyEnds("notes.md", "0123456789ab:docs/notes.md");
  });

  await then(
    'it gives the sandbox "0123456789ab", the path "/workspace/docs/notes.md", the client\'s path "notes.md" and a copy into the sandbox',
    async () => {
      expect(ends).toEqual({
        id: "0123456789ab",
        inSandbox: "/workspace/docs/notes.md",
        local: "notes.md",
        into: true,
      });
    },
  );
});
