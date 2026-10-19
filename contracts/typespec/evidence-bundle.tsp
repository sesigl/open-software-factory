import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/** A path inside the bundle: relative, forward slashes, no "..". */
@pattern("^(?!/)(?!.*(^|/)\\.\\.(/|$))[^\\\\]+$")
scalar BundlePath extends string;

@pattern("^[0-9a-f]{64}$")
scalar Sha256 extends string;

/**
 * `evidence.json` at the root of an evidence bundle: what was verified, against which scenario IDs, with which
 * artifacts and result (P10).
 */
model EvidenceManifest {
  /** Version of this format. */
  manifestVersion: 1;

  id: Identifier;
  createdAt: utcDateTime;

  /** The change that was verified. */
  subject: EvidenceSubject;

  runId?: Identifier;
  workItemId?: Identifier;

  /** The tool that wrote the bundle, for example proof 1.2.0. */
  producer: Producer;

  /** Passed only when every scenario passed. */
  result: VerificationResult;

  scenarios: ScenarioEvidence[];
  artifacts: Artifact[];
}

model EvidenceSubject {
  repository: url;
  commit: CommitHash;
  pullRequest?: url;
}

model Producer {
  @minLength(1)
  name: string;

  @minLength(1)
  version: string;
}

enum VerificationResult {
  passed,
  failed,
}

enum ScenarioResult {
  passed,
  failed,
  skipped,
}

model ScenarioEvidence {
  id: ScenarioId;
  result: ScenarioResult;

  /** Paths of the artifacts in this bundle that prove the scenario. */
  artifacts: BundlePath[];

  summary?: string;
}

enum ArtifactKind {
  screenshot,
  video,
  `playwright-trace`,
  junit,
  log,
  report,
  other,
}

model Artifact {
  path: BundlePath;
  kind: ArtifactKind;

  /** IANA media type, for example "image/png". */
  @minLength(1)
  mediaType: string;

  sha256: Sha256;

  @minValue(0)
  bytes?: safeint;
}
