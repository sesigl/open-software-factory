// The formats of the contracts: the name used on the CLI, the folder of the schema and the TypeSpec model.

export interface Format {
  /** CLI name and file name: `<path>/<name>.schema.json`. */
  name: string;
  /** Folder under contracts/. */
  path: string;
  /** The TypeSpec model, also the name of the generated type and class. */
  model: string;
}

const format = (path: string, model: string): Format => ({ name: path.split("/").pop() as string, path, model });

export const FORMATS: readonly Format[] = [
  format("factory-definition", "FactoryDefinition"),
  format("work-item", "WorkItem"),
  format("run-record", "RunRecord"),
  format("evidence-bundle", "EvidenceManifest"),
  format("score", "Score"),
  format("gate-record", "GateRecord"),
  format("sandbox-spec", "SandboxSpec"),
  format("events/work-received", "WorkReceived"),
  format("events/run-completed", "RunCompleted"),
  format("events/gate-requested", "GateRequested"),
  format("events/gate-decided", "GateDecided"),
  format("events/score-recorded", "ScoreRecorded"),
  format("events/pr-opened", "PrOpened"),
  format("events/pr-reviewed", "PrReviewed"),
  format("events/pr-closed", "PrClosed"),
];

export function formatNamed(name: string): Format | undefined {
  return FORMATS.find((candidate) => candidate.name === name);
}
