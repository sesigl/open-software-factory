import { loadScenarios, type ParsedFeatures } from "./features.ts";
import { baseCommit } from "./git.ts";
import type { Finding, Repo } from "./repo.ts";

/**
 * What every check gets: the repository, lazily parsed features, and the base commit. A check that reads the system
 * tests calls `loadTests` itself, so the checks that do not never load ts-morph.
 */
export class Context {
  readonly repo: Repo;
  /** `osf docs-affected` prints every affected doc, not only the failing ones. */
  readonly list: boolean;
  /** `osf check MUTATION --total` scores every mutant, not only those in the lines changed since OSF_BASE. */
  readonly total: boolean;
  readonly notes: string[] = [];
  #features: ParsedFeatures | undefined;

  constructor(repo: Repo, options: { list?: boolean; total?: boolean } = {}) {
    this.repo = repo;
    this.list = options.list ?? false;
    this.total = options.total ?? false;
  }

  features(): ParsedFeatures {
    this.#features ??= loadScenarios(this.repo);
    return this.#features;
  }

  /** Checks whose comparison with the base did not run because OSF_BASE is not set. */
  readonly skipped = new Set<string>();

  /** The base commit, or undefined when OSF_BASE is not set; the check then counts as skipped. */
  base(check: string): string | undefined {
    const base = baseCommit(this.repo.root);
    if (!base) this.skipped.add(check);
    return base;
  }
}

export type Check = (context: Context) => Finding[] | Promise<Finding[]>;
