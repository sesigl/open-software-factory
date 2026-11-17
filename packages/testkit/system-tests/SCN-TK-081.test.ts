import { type Forge, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-081", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let main: string | undefined;
  let fix = "";
  await given(
    'the repository "demo" in fakes.forge, in which the test created the branch "fix" with "notes.md"',
    async () => {
      forge = await fakes.forge();
      await forge.createRepository("demo");
      main = (await forge.branches("demo"))[0]?.sha;
      fix = await forge.createBranch("demo", { branch: "fix", files: { "notes.md": "hi\n" } });
    },
  );

  await when(
    'a module creates the branch "release" from "main" and a webhook to "http://intake.example/forge" through the forge\'s API',
    async () => {
      const api = forgeClient(forge, "demo");
      await api("POST", "/branches", { new_branch_name: "release", old_ref_name: "main" });
      await api("POST", "/hooks", {
        type: "forgejo",
        config: { url: "http://intake.example/forge", content_type: "json" },
        events: ["pull_request"],
        active: true,
      });
    },
  );

  await then(
    'fakes.forge lists the branches "fix", "main" and "release" with their head commits, and that webhook',
    async () => {
      expect(fix).not.toBe(main);
      expect(await forge.file("demo", "notes.md", "fix")).toBe("hi\n");
      expect(await forge.branches("demo")).toEqual([
        { name: "fix", sha: fix },
        { name: "main", sha: main },
        { name: "release", sha: main },
      ]);
      expect(await forge.hooks("demo")).toEqual([
        expect.objectContaining({ url: "http://intake.example/forge", active: true }),
      ]);
    },
  );
});
