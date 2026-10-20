import { type FakeHttp, type S3, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./forge.ts";
import { bundleOf, manifestOf, PR, SHA, screenshot } from "./reports.ts";

scenario("SCN-PROOF-028", async ({ sut, fakes, given, when, then }) => {
  let store: S3;
  await given('an S3-compatible store with the bucket "evidence"', async () => {
    store = await fakes.s3();
    const created = await fetch(`${store.endpoint}/evidence`, { method: "PUT" });
    expect(created.ok, await created.text()).toBe(true);
  });

  let github: FakeHttp;
  await given('a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"', async () => {
    github = await fakes.http(githubRoutes([]));
  });

  await given('a bundle for that pull request where "SCN-WEB-001" passed with a screenshot', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }], {
      commit: SHA,
      pullRequest: PR,
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --store s3://evidence/web" with the store\'s AWS variables and the GitHub API',
    async () => {
      run = await sut.cli(["attach", "evidence", "--store", "s3://evidence/web"], {
        env: {
          AWS_ENDPOINT_URL: store.endpoint,
          AWS_REGION: store.region,
          AWS_ACCESS_KEY_ID: store.accessKeyId,
          AWS_SECRET_ACCESS_KEY: store.secretAccessKey,
          PROOF_FORGE_URL: github.url,
          PROOF_FORGE_TOKEN: "test-token",
        },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the store holds "evidence.json" and "artifacts/SCN-WEB-001/checkout.png" below "web/<bundle id>/"',
    async () => {
      const { id } = await manifestOf(sut, "$INPUT/evidence");
      const manifest = await fetch(`${store.endpoint}/evidence/web/${id}/evidence.json`);
      expect(((await manifest.json()) as { id: string }).id).toBe(id);
      const picture = await fetch(`${store.endpoint}/evidence/web/${id}/artifacts/SCN-WEB-001/checkout.png`);
      expect(await picture.text()).toBe(await sut.files.read("$INPUT/evidence/artifacts/SCN-WEB-001/checkout.png"));
    },
  );

  await then('the comment on the pull request links the "evidence.json" in the store', async () => {
    const { id } = await manifestOf(sut, "$INPUT/evidence");
    const posted = github.received().find((request) => request.method === "POST" && request.path.endsWith("/comments"));
    expect((posted?.body as { body?: string } | undefined)?.body).toContain(
      `(${store.endpoint}/evidence/web/${id}/evidence.json)`,
    );
  });
});
