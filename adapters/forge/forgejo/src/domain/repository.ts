// A repository as the port names it: "<owner>/<name>".

/** The repository, or undefined when the text is not "<owner>/<name>". */
export function repositoryName(text: string | undefined): string | undefined {
  return text !== undefined && /^[^/\s]+\/[^/\s]+$/.test(text) ? text : undefined;
}

/** The states a check may have. */
export const CHECK_STATES = ["pending", "success", "failure", "error"];

/** The merge methods Forgejo takes as "Do". */
export const MERGE_METHODS = ["merge", "squash", "rebase"];
