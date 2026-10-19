import "@typespec/json-schema";

using TypeSpec.JsonSchema;

@jsonSchema
namespace Osf.Contracts;

/** A lowercase name: letters, digits and hyphens, starting with a letter. Agents, stages, adapters, sources. */
@pattern("^[a-z][a-z0-9-]{0,62}$")
scalar Name extends string;

/** An identifier chosen by the producer. ULIDs are recommended; consumers treat it as opaque. */
@minLength(1)
@maxLength(128)
scalar Identifier extends string;

/** A Git commit hash, abbreviated (7+) or full. The factory version is the commit of the factory definition. */
@pattern("^[0-9a-f]{7,40}$")
scalar CommitHash extends string;

/** A scenario ID as checked by SPEC, for example SCN-PROOF-004. */
@pattern("^SCN-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]{3}$")
scalar ScenarioId extends string;

/** The version of a format inside its documents. Only 1 exists; a new major version of a format adds the next. */
@extension("const", Json<1>)
@minValue(1)
scalar FormatVersion extends int32;

/** An OpenTelemetry trace ID: 32 lowercase hex characters. */
@pattern("^[0-9a-f]{32}$")
scalar TraceId extends string;

/** Who caused something: a person, or an automated trigger such as a cron rule or an alert. */
enum ActorKind {
  person,
  trigger,
}

/** A person or trigger. RUNTIME-008: every run is attributed to one. */
model Actor {
  kind: ActorKind;

  /** Stable ID in the source system, prefixed with the source, for example "slack:U024BE7LH". */
  @minLength(1)
  id: string;

  /** Shown to people, for example "Varun". */
  displayName?: string;
}

model Link {
  url: url;
  title?: string;
}

/** How a run ended. */
enum RunOutcome {
  succeeded,
  failed,
  cancelled,
}
