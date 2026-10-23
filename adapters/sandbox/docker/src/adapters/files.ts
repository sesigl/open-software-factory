// @ts-nocheck
// Files on the Docker client's side: what the user names, and a temporary folder for what `docker cp` copies.
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Writes the files below a new temporary folder, calls `use` with it and removes it afterwards. */
export async function withFolder<T>(files: Record<string, string>, use: (folder: string) => Promise<T>): Promise<T> {
  if (stryMutAct_9fa48("45")) {
    {}
  } else {
    stryCov_9fa48("45");
    const folder = mkdtempSync(join(tmpdir(), stryMutAct_9fa48("46") ? "" : (stryCov_9fa48("46"), "sandbox-docker-")));
    try {
      if (stryMutAct_9fa48("47")) {
        {}
      } else {
        stryCov_9fa48("47");
        for (const [path, text] of Object.entries(files)) {
          if (stryMutAct_9fa48("48")) {
            {}
          } else {
            stryCov_9fa48("48");
            mkdirSync(dirname(join(folder, path)), stryMutAct_9fa48("50") ? {} : (stryCov_9fa48("50"), {
              recursive: stryMutAct_9fa48("51") ? false : (stryCov_9fa48("51"), true)
            }));
            if (stryMutAct_9fa48("52")) {
              ;
            } else {
              stryCov_9fa48("52");
              writeFileSync(join(folder, path), text);
            }
          }
        }
        return await use(folder);
      }
    } finally {
      if (stryMutAct_9fa48("53")) {
        {}
      } else {
        stryCov_9fa48("53");
        rmSync(folder, stryMutAct_9fa48("55") ? {} : (stryCov_9fa48("55"), {
          recursive: stryMutAct_9fa48("56") ? false : (stryCov_9fa48("56"), true),
          force: stryMutAct_9fa48("57") ? false : (stryCov_9fa48("57"), true)
        }));
      }
    }
  }
}
export const fileExists = stryMutAct_9fa48("58") ? () => undefined : (stryCov_9fa48("58"), (() => {
  const fileExists = (path: string): boolean => existsSync(path);
  return fileExists;
})());
export const readText = stryMutAct_9fa48("59") ? () => undefined : (stryCov_9fa48("59"), (() => {
  const readText = (file: string): string => readFileSync(file, stryMutAct_9fa48("60") ? "" : (stryCov_9fa48("60"), "utf8"));
  return readText;
})());