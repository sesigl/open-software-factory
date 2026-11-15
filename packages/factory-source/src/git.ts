// The fetch of one ref of a Git remote into a cache (ADR 0124, ADR 0142): a bare repository at <cache>/repository.git
// and the files of each commit at <cache>/<commit>/. A token goes to Git in its environment, never into a file or onto
// a command line.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

/** A ref of a Git remote that cannot be fetched; its message names the ref, the URL and Git's own message. */
export class FetchError extends Error {
  override name = "FetchError";
}

const run = promisify(execFile);

/** The environment of Git: no prompt for a password, and the token as Basic credentials for `url` only. */
function gitEnv(url: string, token: string | undefined): NodeJS.ProcessEnv {
  // Stryker disable next-line StringLiteral: Git reads an empty GIT_TERMINAL_PROMPT as false, like "0"
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (!token) return env;
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    ...env,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${url}.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
  };
}

/** Fetches `ref` of `url` into the bare repository below `cache`, writes its files once and gives its commit. */
export async function fetchCommit(url: string, ref: string, cache: string, token?: string): Promise<string> {
  const bare = join(cache, "repository.git");
  const env = gitEnv(url, token);
  const git = (...args: string[]) =>
    run("git", ["--git-dir", bare, ...args], { env }).then(({ stdout }) => stdout.trim());
  mkdirSync(cache, { recursive: true });
  // Again on a repository that exists, git init changes nothing.
  await run("git", ["init", "--quiet", "--bare", bare]);
  const commit = await git("fetch", "--quiet", "--no-tags", "--end-of-options", url, ref)
    .then(() => git("rev-parse", "--verify", "FETCH_HEAD^{commit}"))
    .catch((failure: { stderr: string }) => {
      throw new FetchError(`cannot fetch ${ref} of ${url}: ${failure.stderr.trim()}`);
    });
  const folder = join(cache, commit);
  if (!existsSync(folder)) {
    const partial = `${folder}.partial`;
    // A folder that a stopped fetch left half written is written again from nothing.
    rmSync(partial, { recursive: true, force: true });
    mkdirSync(partial);
    await git("--work-tree", partial, "checkout", "--quiet", commit, "--", ".");
    renameSync(partial, folder);
  }
  return commit;
}
