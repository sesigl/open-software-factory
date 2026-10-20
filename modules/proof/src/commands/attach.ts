// proof attach: one comment with the scenarios and the bundle link, and the commit status "proof".
import { type EvidenceManifest, validate } from "@opensoftware/contracts";
import { listBundle, MANIFEST, readBundleFile, readManifest } from "../adapters/files.ts";
import { forgeAt } from "../adapters/forge.ts";
import { type StoreConfig, upload } from "../adapters/store.ts";
import { comment, MARKER, pullRequestOf, summary } from "../domain/verdict.ts";

export interface AttachOptions {
  pr: string | undefined;
  store: string | undefined;
  bundleUrl: string | undefined;
  forgeUrl: string | undefined;
  token: string | undefined;
  storeConfig: StoreConfig;
}

export async function attach(folder: string, options: AttachOptions): Promise<string> {
  const document = readManifest(folder);
  const problems = validate("evidence-bundle", document);
  if (problems.length > 0) {
    throw new Error(problems.map((problem) => `evidence.json ${problem.path}: ${problem.message}`).join("\n"));
  }
  const manifest = document as EvidenceManifest;
  const url = options.pr ?? manifest.subject.pullRequest;
  if (!url) throw new Error("give the pull request with --pr: the bundle names none");
  if (!options.token) throw new Error("PROOF_FORGE_TOKEN is not set");
  const pr = pullRequestOf(url);

  let link = options.bundleUrl;
  if (options.store) {
    const files = listBundle(folder).map((path) => ({
      path: `${manifest.id}/${path}`,
      body: readBundleFile(folder, path),
      mediaType: path === MANIFEST ? "application/json" : mediaTypeOf(manifest, path),
    }));
    link = (await upload(options.store, options.storeConfig, files)).get(`${manifest.id}/${MANIFEST}`);
  }

  const base =
    pr.forge === "github"
      ? (options.forgeUrl ?? "https://api.github.com")
      : `${(options.forgeUrl ?? pr.origin).replace(/\/$/, "")}/api/v1`;
  const forge = forgeAt(base, options.token);
  const done = await forge.upsertComment(pr, MARKER, comment(manifest, link));
  const state = manifest.result === "passed" ? "success" : "failure";
  await forge.setStatus(pr, manifest.subject.commit, {
    state,
    description: summary(manifest),
    ...(link ? { target_url: link } : {}),
  });
  return `${done} the comment on ${url}; set "proof" to ${state} on ${manifest.subject.commit}`;
}

function mediaTypeOf(manifest: EvidenceManifest, path: string): string {
  return manifest.artifacts.find((artifact) => artifact.path === path)?.mediaType ?? "application/octet-stream";
}
