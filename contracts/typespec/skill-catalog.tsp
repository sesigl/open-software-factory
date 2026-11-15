import "@typespec/json-schema";
import "./common.tsp";
import "./factory-definition.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/**
 * What `factory skills` of factory-spec prints (ADR 0141, ADR 0143): every skill the factory's agents use, read with
 * the rules of `factory lint` (ADR 0140), sorted by name. The console reads it for its pages `/skills` and
 * `/skills/<name>`, so it never parses a SKILL.md itself.
 */
model SkillCatalog {
  skills: CatalogSkill[];
}

/** One skill, also one that lint refuses: then `problems` names why. */
model CatalogSkill {
  /** The last segment of the skill's folder. */
  @minLength(1)
  name: string;

  /** The description of its front matter; null without one. */
  description: string | null;

  /** Where the skill comes from. */
  source: CatalogSkillSource;

  /** What it needs, from the `metadata` of its front matter. */
  needs: SkillNeeds;

  /** Each agent that uses it, sorted by name. */
  agents: CatalogSkillAgent[];

  /** The files of its folder, by their path below it, sorted. */
  files: string[];

  /**
   * The text of SKILL.md below the line that ends its front matter, all of it without front matter; null without a
   * SKILL.md that is UTF-8 text.
   */
  body: string | null;

  /**
   * The problems of its own files as `factory lint` prints them, relative to the folder of factory.yaml, and a folder
   * without a SKILL.md.
   */
  problems: string[];
}

/** A folder of the factory's repository, relative to the folder of factory.yaml, like "skills/release-notes". */
model CatalogSkillSource {
  @minLength(1)
  folder: string;
}

/** The secrets a skill needs, by the variable that holds each in a sandbox, and the hosts it reaches (ADR 0140). */
model SkillNeeds {
  secrets: SkillSecretName[];
  hosts: SkillHost[];
}

/** An agent that uses a skill. */
model CatalogSkillAgent {
  @minLength(1)
  name: string;

  /** The agent's reference whose variable is each secret the skill needs, by the variable. */
  secrets: Record<SecretReference>;

  /** Each needed secret the agent does not declare, and each needed host its sandbox does not allow. */
  lacks: SkillNeeds;
}

/** The variable of a secret in a sandbox (ADR 0068), like "LINEAR_TOKEN". */
@pattern("^[A-Z0-9_]+$")
scalar SkillSecretName extends string;

/** A host as an entry of `sandbox.egress`, like "api.linear.app". */
@pattern("^[a-z0-9-]+(\\.[a-z0-9-]+)*$")
scalar SkillHost extends string;
