// sut.site: a folder of the unit served as a static site on loopback, such as the workbench of an island scenario
// (ADR 0152). Built on node:http: the testkit needs only a file with its content type, the headers the test names, and
// no file outside the folder, whatever the path holds (an encoded "..") or a symbolic link points at.
import { readFileSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, relative, resolve, sep } from "node:path";

export interface Site {
  /**
   * Serves the folder, relative to the unit's folder, on 127.0.0.1 until the scenario ends, and returns its base URL.
   * A path answers the file at that path, or the `index.html` of a folder, with its content type and `headers`, like
   * the Content-Security-Policy of the page that will hold an island. A path outside the folder, also through an
   * encoded ".." or a symbolic link, answers 404. `sut.browser.open` then opens paths of this site.
   */
  serve(folder: string, options?: { headers?: Record<string, string> }): Promise<string>;
  /** The base URL of the folder served last. */
  url(): string;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

/** `base()` is the URL of the folder served last, or undefined before the first. */
export function makeSite(
  moduleRoot: string,
  onStop: (stop: () => Promise<unknown>) => void,
): { site: Site; base: () => string | undefined } {
  let served: string | undefined;
  const site: Site = {
    async serve(folder, options = {}) {
      const unit = realpathSync(moduleRoot);
      const root = realpathSync(resolve(unit, folder));
      if (outside(unit, root) || !statSync(root).isDirectory()) {
        throw new Error(`sut.site serves only a folder of the unit: ${folder}`);
      }
      const server = createServer((request, response) => {
        try {
          const file = fileOf(root, String(request.url));
          const body = readFileSync(file);
          const type = TYPES[extname(file)] ?? "application/octet-stream";
          response.writeHead(200, { ...options.headers, "content-type": type }).end(body);
        } catch {
          // No such file, a path outside the folder, or a name that is no valid path.
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
        }
      });
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      onStop(
        () =>
          new Promise((done) => {
            server.close(done);
            server.closeAllConnections();
          }),
      );
      served = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      return served;
    },
    url() {
      if (!served) throw new Error("sut.site.url: no folder is served yet; call sut.site.serve(folder) first");
      return served;
    },
  };
  return { site, base: () => served };
}

/** Whether the real path is outside the folder. */
function outside(root: string, path: string): boolean {
  const rest = relative(root, path);
  return rest === ".." || rest.startsWith(`..${sep}`);
}

/** The real path of the file a request names inside the folder; it throws when there is none. */
function fileOf(root: string, url: string): string {
  const path = decodeURIComponent(new URL(url, "http://site").pathname);
  let real = realpathSync(join(root, path));
  if (statSync(real).isDirectory()) real = realpathSync(join(real, "index.html"));
  if (outside(root, real)) throw new Error(`outside the folder: ${path}`);
  return real;
}
