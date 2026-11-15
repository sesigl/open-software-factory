// What the scenarios of factory-source share: a committed factory.yaml, and a forge that asks for credentials.
import type { FakeHttp, Fakes, Sut } from "@opensoftware/testkit";

export const FACTORY = "name: hello\n";
export const TOKEN = "factory-token-0001";
/** The first request of `git fetch` over HTTP, for the repository at `/acme/factory.git`. */
export const INFO_REFS = "/acme/factory.git/info/refs?service=git-upload-pack";

/** Commits factory.yaml with `text` in $INPUT, a repository on "main", and gives the commit. */
export async function committed(sut: Sut, text = FACTORY): Promise<string> {
  await sut.files.put("$INPUT/factory.yaml", text);
  return sut.git.commit("the hello factory");
}

/** $INPUT at a file:// URL. */
export function fileUrl(sut: Sut): string {
  return `file://${sut.files.path("$INPUT")}`;
}

/** A forge whose repository `/acme/factory.git` answers 401, as for a private repository without its credentials. */
export function privateForge(fakes: Fakes): Promise<FakeHttp> {
  return fakes.http([{ path: INFO_REFS, status: 401, body: "", contentType: "text/plain" }]);
}

/** The text of every file below `$OUTPUT/<dir>`, by its path. */
export async function texts(sut: Sut, dir: string): Promise<string[]> {
  const files = await sut.files.list(`$OUTPUT/${dir}`);
  return Promise.all(files.map((file) => sut.files.read(`$OUTPUT/${dir}/${file}`)));
}
