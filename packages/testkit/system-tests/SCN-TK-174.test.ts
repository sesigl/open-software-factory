import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-174", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github with the branch "fix"', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\n" } });
  });

  let blob: GitHubAnswer;
  await when(
    'a module posts the bytes "ff fe 00 80 41 0a c3 28" as a base64 blob, makes a tree on the tree of "fix" with "logo.bin" as that blob, commits it on "fix" and moves "fix" there through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      const content = Buffer.from("fffe0080410ac328", "hex").toString("base64");
      blob = await api("POST", "/git/blobs", { content, encoding: "base64" });
      const parent = (await api("GET", "/git/ref/heads/fix")).json.object.sha;
      const base = await api("GET", `/git/commits/${parent}`);
      const tree = await api("POST", "/git/trees", {
        base_tree: base.json.tree.sha,
        tree: [{ path: "logo.bin", mode: "100644", type: "blob", sha: blob.json.sha }],
      });
      const made = await api("POST", "/git/commits", {
        message: "Add the logo",
        tree: tree.json.sha,
        parents: [parent],
      });
      await api("PATCH", "/git/refs/heads/fix", { sha: made.json.sha });
    },
  );

  await then(
    'the blob answers 201 with "702e1e879fdef58f4ee3b5229825b123b436cf5d", Git\'s SHA of these bytes, and "logo.bin" on "fix" has these bytes',
    async () => {
      expect(`${blob.status} ${blob.json.sha}`).toBe("201 702e1e879fdef58f4ee3b5229825b123b436cf5d");
      const bytes = await github.fileBytes("demo", "logo.bin", "fix");
      expect(bytes?.toString("hex")).toBe("fffe0080410ac328");
      expect(await github.file("demo", "notes.md", "fix")).toBe("hello\n");
    },
  );
});
