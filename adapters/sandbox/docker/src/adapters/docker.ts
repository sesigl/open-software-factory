// @ts-nocheck
// The Docker CLI, the adapter's only way to the Docker host (ADR 0054). It follows DOCKER_HOST and the user's
// Docker context like any docker command.
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
import { spawn } from "node:child_process";
export interface DockerResult {
  code: number;
  stdout: Buffer;
  stderr: string;
}

/** Runs `docker <args>` and collects its output; `input` goes to its standard input. */
export function docker(args: string[], input?: Buffer): Promise<DockerResult> {
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("1")) {
        {}
      } else {
        stryCov_9fa48("1");
        const child = spawn(stryMutAct_9fa48("2") ? "" : (stryCov_9fa48("2"), "docker"), args, stryMutAct_9fa48("3") ? {} : (stryCov_9fa48("3"), {
          stdio: stryMutAct_9fa48("4") ? [] : (stryCov_9fa48("4"), [stryMutAct_9fa48("5") ? "" : (stryCov_9fa48("5"), "pipe"), stryMutAct_9fa48("6") ? "" : (stryCov_9fa48("6"), "pipe"), stryMutAct_9fa48("7") ? "" : (stryCov_9fa48("7"), "pipe")])
        }));
        const stdout: Buffer[] = stryMutAct_9fa48("8") ? ["Stryker was here"] : (stryCov_9fa48("8"), []);
        const stderr: Buffer[] = stryMutAct_9fa48("9") ? ["Stryker was here"] : (stryCov_9fa48("9"), []);
        if (stryMutAct_9fa48("10")) {
          ;
        } else {
          stryCov_9fa48("10");
          child.stdout.on(stryMutAct_9fa48("11") ? "" : (stryCov_9fa48("11"), "data"), stryMutAct_9fa48("12") ? () => undefined : (stryCov_9fa48("12"), (chunk: Buffer) => stdout.push(chunk)));
        }
        if (stryMutAct_9fa48("13")) {
          ;
        } else {
          stryCov_9fa48("13");
          child.stderr.on(stryMutAct_9fa48("14") ? "" : (stryCov_9fa48("14"), "data"), stryMutAct_9fa48("15") ? () => undefined : (stryCov_9fa48("15"), (chunk: Buffer) => stderr.push(chunk)));
        }
        child.on(stryMutAct_9fa48("17") ? "" : (stryCov_9fa48("17"), "error"), reject);
        child.on(stryMutAct_9fa48("19") ? "" : (stryCov_9fa48("19"), "close"), stryMutAct_9fa48("20") ? () => undefined : (stryCov_9fa48("20"), code => resolve(stryMutAct_9fa48("21") ? {} : (stryCov_9fa48("21"), {
          code: stryMutAct_9fa48("22") ? code && 1 : (stryCov_9fa48("22"), code ?? 1),
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr).toString(stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), "utf8"))
        }))));
        if (stryMutAct_9fa48("24")) {
          ;
        } else {
          stryCov_9fa48("24");
          child.stdin.end(input);
        }
      }
    });
  }
}

/** Runs `docker <args>` and gives its standard output as text; a failure throws with Docker's error. */
export async function dockerText(args: string[], input?: Buffer): Promise<string> {
  if (stryMutAct_9fa48("25")) {
    {}
  } else {
    stryCov_9fa48("25");
    const result = await docker(args, input);
    if (stryMutAct_9fa48("28") ? result.code === 0 : stryMutAct_9fa48("27") ? false : stryMutAct_9fa48("26") ? true : (stryCov_9fa48("26", "27", "28"), result.code !== 0)) throw new Error(stryMutAct_9fa48("30") ? `` : (stryCov_9fa48("30"), `docker ${args[0]} failed: ${stryMutAct_9fa48("31") ? result.stderr : (stryCov_9fa48("31"), result.stderr.trim())}`));
    return stryMutAct_9fa48("32") ? result.stdout.toString("utf8") : (stryCov_9fa48("32"), result.stdout.toString(stryMutAct_9fa48("33") ? "" : (stryCov_9fa48("33"), "utf8")).trim());
  }
}

/** Runs `docker <args>` on the program's own standard input and output, and gives its exit code. */
export function dockerAttached(args: string[]): Promise<number> {
  if (stryMutAct_9fa48("34")) {
    {}
  } else {
    stryCov_9fa48("34");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("35")) {
        {}
      } else {
        stryCov_9fa48("35");
        const child = spawn(stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), "docker"), args, stryMutAct_9fa48("37") ? {} : (stryCov_9fa48("37"), {
          stdio: stryMutAct_9fa48("38") ? "" : (stryCov_9fa48("38"), "inherit")
        }));
        child.on(stryMutAct_9fa48("40") ? "" : (stryCov_9fa48("40"), "error"), reject);
        child.on(stryMutAct_9fa48("42") ? "" : (stryCov_9fa48("42"), "close"), stryMutAct_9fa48("43") ? () => undefined : (stryCov_9fa48("43"), code => resolve(stryMutAct_9fa48("44") ? code && 1 : (stryCov_9fa48("44"), code ?? 1))));
      }
    });
  }
}