import { loadScenarios, type ParsedFeatures } from "./features.ts";
import { baseCommit } from "./git.ts";
import type { Finding, Repo } from "./repo.ts";
import { loadTests, type TestFile } from "./tests.ts";

/** What every check gets: the repository, lazily parsed features and tests, and the base commit. */
export class Context {
  readonly repo: Repo;
  /** `osf docs-affected` prints every affected doc, not only the failing ones. */
  readonly list: boolean;
  readonly notes: string[] = [];
  #features: ParsedFeatures | undefined;

  constructor(repo: Repo, options: { list?: boolean } = {}) {
    this.repo = repo;
    this.list = options.list ?? false;
  }

  features(): ParsedFeatures {
    this.#features ??= loadScenarios(this.repo);
    return this.#features;
  }

  tests(): TestFile[] {
    return loadTests(this.repo);
  }

  /** The base commit, or undefined (with a note) when OSF_BASE is not set. */
  base(check: string): string | undefined {
    const base = baseCommit(this.repo.root);
    if (!base) this.notes.push(`${check}: OSF_BASE is not set, so there is nothing to compare with`);
    return base;
  }
}

export type Check = (context: Context) => Finding[] | Promise<Finding[]>;
