// A factory's source (ADR 0135, ADR 0142): a path to its file, or git+<url>#<ref> with factory.yaml at the root of
// the ref's commit.
import { dirname, join } from "node:path";
import { fetchCommit } from "./git.ts";

export interface FactoryFolder {
  /** The folder of the factory: the folder of the path, or `<cache>/<commit>` of a remote. */
  folder: string;
  /** The factory's file: the path itself, or `factory.yaml` in the folder of a remote. */
  file: string;
  /** The commit of a remote's ref; undefined for a path, whose version is the caller's to find. */
  commit?: string;
}

export interface SourceOptions {
  /** The folder of a remote's bare repository and of one folder per commit; one folder per remote. */
  cache: string;
  /** A token for a private remote over HTTPS, sent as Basic credentials of `x-access-token`. */
  token?: string;
}

export interface FactorySource {
  /** The factory's folder; a remote is fetched again at each call, one fetch at a time. */
  fetch(): Promise<FactoryFolder>;
}

const GIT = /^git\+(.+?)(?:#(.+))?$/;

/**
 * The source that `setting` names: a path, or `git+<url>#<ref>` (default ref: the remote's HEAD). Paths stay as
 * given: a relative path or cache gives a folder relative to the working directory.
 */
export function factorySource(setting: string, options: SourceOptions): FactorySource {
  const remote = GIT.exec(setting);
  if (!remote) return { fetch: async () => ({ folder: dirname(setting), file: setting }) };
  const [, url, ref = "HEAD"] = remote as unknown as [string, string, string?];
  const { cache } = options;
  // One fetch at a time: callers fetch at once and share the bare repository.
  let queue: Promise<unknown> = Promise.resolve();
  const fetch = async (): Promise<FactoryFolder> => {
    const commit = await fetchCommit(url, ref, cache, options.token);
    const folder = join(cache, commit);
    return { folder, file: join(folder, "factory.yaml"), commit };
  };
  return {
    fetch: () => {
      const next = queue.then(fetch);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
