import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/**
 * access.yaml next to factory.yaml (ADR 0134): who may sign in to the factory UI, each person with one role. The
 * console reads it at each request, so a merge that removes a person ends their access.
 */
@extension("additionalProperties", Json<false>)
model Access {
  /** The version of the access file's format. */
  version: 1;

  /** The people who may sign in. An email appears once. */
  @minItems(1)
  people: AccessPerson[];
}

/** One person: the email the provider verifies, compared in lower case, and their role. */
@extension("additionalProperties", Json<false>)
model AccessPerson {
  @format("email")
  email: string;

  /** The name the UI shows, when the provider gives none. */
  @minLength(1)
  name?: string;

  /**
   * `member` sees every page but Secrets and acts on work, runs and gates; `factory-engineer` also changes the factory
   * from the UI; `admin` also stores and deletes secrets.
   */
  role: AccessRole;
}

/** The roles of the factory UI (ADR 0134), from the least to the most it may do. */
enum AccessRole {
  member,
  `factory-engineer`,
  admin,
}
