import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-167", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github with the branch "fix" with "notes.md"', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\n" } });
  });

  let parent = "";
  let made: GitHubAnswer;
  let moved: GitHubAnswer;
  let written: GitHubAnswer;
  await when(
    'a module reads the ref and the commit of "fix", makes a tree on its tree that changes "notes.md" and adds "docs/new.md", a commit of it on the branch\'s head, and moves "fix" there without force through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      parent = (await api("GET", "/git/ref/heads/fix")).json.object.sha;
      const base = await api("GET", `/git/commits/${parent}`);
      const tree = await api("POST", "/git/trees", {
        base_tree: base.json.tree.sha,
        tree: [
          { path: "notes.md", mode: "100644", type: "blob", content: "changed\n" },
          { path: "docs/new.md", mode: "100644", type: "blob", content: "new\n" },
        ],
      });
      made = await api("POST", "/git/commits", { message: "Change notes", tree: tree.json.sha, parents: [parent] });
      moved = await api("PATCH", "/git/refs/heads/fix", { sha: made.json.sha, force: false });
      written = await api("GET", `/git/commits/${made.json.sha}`);
    },
  );

  await then(
    'the move answers 200 with the new commit, whose parent is the old head, both files are on "fix", "README.md" is kept and "main" is unchanged',
    async () => {
      const ref = moved.json.object.sha === made.json.sha;
      expect(`${moved.status} ${ref} ${written.json.parents[0].sha === parent}`).toBe("200 true true");
      expect(await github.file("demo", "notes.md", "fix")).toBe("changed\n");
      expect(await github.file("demo", "docs/new.md", "fix")).toBe("new\n");
      expect(await github.file("demo", "README.md", "fix")).toBe("# demo\n");
      expect(await github.file("demo", "notes.md", "main")).toBeUndefined();
    },
  );
});
