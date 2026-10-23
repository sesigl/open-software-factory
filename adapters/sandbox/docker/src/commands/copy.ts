// @ts-nocheck
// copy <from> <to>: a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
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
import { posix } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { WORKSPACE } from "../domain/names.ts";
import { sandboxContainer } from "./sandbox.ts";
const IN_SANDBOX = stryMutAct_9fa48("92") ? /^([0-9a-f]{12}):(.)$/ : stryMutAct_9fa48("91") ? /^([^0-9a-f]{12}):(.+)$/ : stryMutAct_9fa48("90") ? /^([0-9a-f]):(.+)$/ : stryMutAct_9fa48("89") ? /^([0-9a-f]{12}):(.+)/ : stryMutAct_9fa48("88") ? /([0-9a-f]{12}):(.+)$/ : (stryCov_9fa48("88", "89", "90", "91", "92"), /^([0-9a-f]{12}):(.+)$/);
export async function copy(from: string | undefined, to: string | undefined): Promise<Outcome> {
  if (stryMutAct_9fa48("93")) {
    {}
  } else {
    stryCov_9fa48("93");
    check(stryMutAct_9fa48("97") ? from || to : stryMutAct_9fa48("96") ? false : stryMutAct_9fa48("95") ? true : (stryCov_9fa48("95", "96", "97"), from && to), stryMutAct_9fa48("98") ? "" : (stryCov_9fa48("98"), "name what to copy and where to, like copy notes.md <ID>:notes.md"));
    const source = IN_SANDBOX.exec(from as string);
    const target = IN_SANDBOX.exec(to as string);
    check(stryMutAct_9fa48("102") ? Boolean(source) === Boolean(target) : stryMutAct_9fa48("101") ? false : stryMutAct_9fa48("100") ? true : (stryCov_9fa48("100", "101", "102"), Boolean(source) !== Boolean(target)), stryMutAct_9fa48("103") ? "" : (stryCov_9fa48("103"), "name the sandbox on one side only, as <ID>:<path>"));
    if (stryMutAct_9fa48("105") ? false : stryMutAct_9fa48("104") ? true : (stryCov_9fa48("104", "105"), source)) {
      if (stryMutAct_9fa48("106")) {
        {}
      } else {
        stryCov_9fa48("106");
        const container = await sandboxContainer(source[1]);
        await dockerText(stryMutAct_9fa48("107") ? [] : (stryCov_9fa48("107"), [stryMutAct_9fa48("108") ? "" : (stryCov_9fa48("108"), "cp"), stryMutAct_9fa48("109") ? `` : (stryCov_9fa48("109"), `${container}:${inWorkspace(source[2] as string)}`), to as string]));
      }
    } else {
      if (stryMutAct_9fa48("110")) {
        {}
      } else {
        stryCov_9fa48("110");
        const container = await sandboxContainer(stryMutAct_9fa48("111") ? target[1] : (stryCov_9fa48("111"), target?.[1]));
        const path = inWorkspace(target?.[2] as string);
        await dockerText(stryMutAct_9fa48("112") ? [] : (stryCov_9fa48("112"), [stryMutAct_9fa48("113") ? "" : (stryCov_9fa48("113"), "cp"), from as string, stryMutAct_9fa48("114") ? `` : (stryCov_9fa48("114"), `${container}:${path}`)]));
        // docker cp gives the files to root; the sandbox's user owns its working folder and what is copied into it.
        const owner = stryMutAct_9fa48("115") ? [] : (stryCov_9fa48("115"), [stryMutAct_9fa48("116") ? "" : (stryCov_9fa48("116"), "sh"), stryMutAct_9fa48("117") ? "" : (stryCov_9fa48("117"), "-c"), stryMutAct_9fa48("118") ? `` : (stryCov_9fa48("118"), `chown -R "$(stat -c %u:%g ${WORKSPACE})" "$1"`), stryMutAct_9fa48("119") ? "" : (stryCov_9fa48("119"), "sh"), path]);
        await dockerText(stryMutAct_9fa48("120") ? [] : (stryCov_9fa48("120"), [stryMutAct_9fa48("121") ? "" : (stryCov_9fa48("121"), "exec"), stryMutAct_9fa48("122") ? "" : (stryCov_9fa48("122"), "--user"), stryMutAct_9fa48("123") ? "" : (stryCov_9fa48("123"), "0"), container, ...owner]));
      }
    }
    return stryMutAct_9fa48("124") ? {} : (stryCov_9fa48("124"), {
      lines: stryMutAct_9fa48("125") ? [] : (stryCov_9fa48("125"), [stryMutAct_9fa48("126") ? `` : (stryCov_9fa48("126"), `copied ${from} to ${to}`)])
    });
  }
}
const inWorkspace = stryMutAct_9fa48("127") ? () => undefined : (stryCov_9fa48("127"), (() => {
  const inWorkspace = (path: string): string => posix.resolve(WORKSPACE, path);
  return inWorkspace;
})());