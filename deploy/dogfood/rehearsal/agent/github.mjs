// The scripted agent's calls of GitHub's API in the rehearsal (ADR 0173), as `gh` would make them, with the agent's
// GH_TOKEN. It runs in the run's folder, where it keeps the run's pull request in pull.json.
//   node rehearsal/github.mjs open <owner/name> <branch>   opens the draft pull request and labels it "rehearsal"
//   node rehearsal/github.mjs ready                         marks it ready for review
//   node rehearsal/github.mjs link                          prints "Pull request: <link>"
import { readFileSync, writeFileSync } from "node:fs";

const [command, repository, branch] = process.argv.slice(2);

async function call(method, url, body) {
  const answer = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`GitHub answered ${method} ${url} with ${answer.status}: ${await answer.text()}`);
  return answer.json();
}

if (command === "open") {
  const api = `https://api.github.com/repos/${repository}`;
  const pull = await call("POST", `${api}/pulls`, {
    title: "Rehearsal: greet(name)",
    head: branch,
    base: "main",
    draft: true,
    body: "The scenario of greet(name), from the scripted agent of the factory's rehearsal (ADR 0173). Close it with its branch when you are done.",
  });
  await call("POST", `${api}/issues/${pull.number}/labels`, { labels: ["rehearsal"] });
  writeFileSync("pull.json", JSON.stringify({ url: pull.html_url, id: pull.node_id }));
}
if (command === "ready") {
  const { id } = JSON.parse(readFileSync("pull.json", "utf8"));
  const query =
    "mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { isDraft } } }";
  const answer = await call("POST", "https://api.github.com/graphql", { query, variables: { id } });
  if (answer.errors) throw new Error(`GitHub did not mark the pull request ready: ${JSON.stringify(answer.errors)}`);
}
console.log(`Pull request: ${JSON.parse(readFileSync("pull.json", "utf8")).url}`);
