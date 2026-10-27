import { scenario } from "@opensoftware/testkit";
import { factoryYaml, fromContainer, REQUESTS, type Smoke, smoke, started } from "./profile.ts";

const README = "# web\n\nThe factory fixes this README.\n";
const BRANCH = "fix-readme-typo";
const TITLE = "Fix the typo in the README";

/** The JUnit report of the verify agent: one passed scenario of the web app. */
const REPORT = [
  '<testsuites><testsuite name="web"><testcase name="SCN-WEB-001" classname="web">',
  '<properties><property name="scenario" value="SCN-WEB-001"/></properties></testcase></testsuite></testsuites>',
].join("");

scenario("SCN-E2E-001", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  const server = fromContainer(forge.url);
  const remote = server.replace("//", `//${forge.owner}:${forge.token}@`);
  const auth = `-H 'authorization: token ${forge.token}' -H 'content-type: application/json'`;
  const pulls = `${server}/api/v1/repos/${forge.owner}/web/pulls`;
  /** The link of the open pull request, as Forgejo gives it. */
  const link = `"$(curl -sS ${auth} '${pulls}?state=open' | node -p 'JSON.parse(require("fs").readFileSync(0))[0].html_url')"`;

  let factory = "";
  await given('a factory with the stages "triage", "implement" and "verify"', async () => {
    // Forgejo gives the new repository a README.md.
    await forge.createRepository("web");
    factory = factoryYaml(["triage", "implement", "verify"]);
  });

  let profile: Smoke;
  await given('the scripted harness changes "README.md" when asked to implement', async () => {
    profile = await smoke(sut, fakes, factory, [
      { when: "Triage the work item", reply: "A task of low priority." },
      {
        when: "Implement the work item",
        edits: { "README.md": README },
        // As a coding agent does it with its tools: clone, change, push a branch and open a pull request.
        commands: [
          `git clone -q ${remote}/${forge.owner}/web.git web`,
          "cp README.md web/README.md",
          `cd web && git checkout -q -b ${BRANCH} && git -c user.name=agent -c user.email=agent@example.invalid commit -qam '${TITLE}' && git push -q origin ${BRANCH}`,
          `curl -sS ${auth} --data '{"head":"${BRANCH}","base":"main","title":"${TITLE}"}' ${pulls} >/dev/null`,
          `echo ${link}`,
        ],
      },
      {
        when: "Verify the pull request",
        // The verification's evidence, bundled and attached by proof, which sets the commit status "proof".
        commands: [
          `git clone -q -b ${BRANCH} ${remote}/${forge.owner}/web.git checked`,
          `cd checked && echo '${REPORT}' > report.xml && proof bundle --junit report.xml --out evidence --repository ${server}/${forge.owner}/web --pull-request ${link}`,
          `cd checked && PROOF_FORGE_URL=${server} PROOF_FORGE_TOKEN=${forge.token} proof attach evidence`,
        ],
      },
    ]);
    await started(profile, ["foreman", "intake"]);
  });

  let ts = "";
  await when('a person posts "Fix the typo in the README" in the fake Slack channel', async () => {
    ts = (await profile.slack.say({ channel: REQUESTS, text: `<@${profile.slack.bot}> ${TITLE}` })).ts;
  });

  const bot = () => profile.slack.messages(REQUESTS).filter((message) => message.user === profile.slack.bot);
  await then('a pull request exists in Forgejo that changes "README.md"', async () => {
    // The thread gets the link once the run completed, after every stage of the factory.
    await profile.until(() => bot().length, 2);
    const [pr] = await forge.pullRequests("web");
    expect(pr).toMatchObject({ title: TITLE, head: BRANCH, base: "main", state: "open" });
    expect(await forge.file("web", "README.md", BRANCH)).toBe(README);
  });

  await then('the pull request has a check named "proof" with the result "success"', async () => {
    const [pr] = await forge.pullRequests("web");
    const head = (await forge.branches("web")).find((branch) => branch.name === BRANCH)?.sha as string;
    const statuses = await forge.statuses({ repository: "web", number: 1, url: pr?.url as string, sha: head });
    expect(statuses).toContainEqual(expect.objectContaining({ context: "proof", state: "success" }));
  });

  await then("the fake Slack thread links the pull request", async () => {
    const [pr] = await forge.pullRequests("web");
    expect(bot().map(({ threadTs, text }) => ({ threadTs, text }))).toEqual([
      { threadTs: ts, text: expect.stringMatching(/^Received as work item wi_[0-9a-f]{20}\.$/) },
      { threadTs: ts, text: `Pull request: ${pr?.url}` },
    ]);
  });
});
