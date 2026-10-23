// @ts-nocheck
// destroy <ID>: the sandbox's container with its files, its egress proxy and its network. Snapshots stay.
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
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { egressName, sandboxName } from "../domain/names.ts";
import { sandboxContainer } from "./sandbox.ts";
export async function destroy(id: string | undefined): Promise<Outcome> {
  if (stryMutAct_9fa48("286")) {
    {}
  } else {
    stryCov_9fa48("286");
    await sandboxContainer(id);
    await destroySandbox(id as string);
    return stryMutAct_9fa48("287") ? {} : (stryCov_9fa48("287"), {
      lines: stryMutAct_9fa48("288") ? [] : (stryCov_9fa48("288"), [stryMutAct_9fa48("289") ? `` : (stryCov_9fa48("289"), `destroyed ${id}`)])
    });
  }
}

/** Removes whatever parts of the sandbox exist. */
export async function destroySandbox(id: string): Promise<void> {
  if (stryMutAct_9fa48("290")) {
    {}
  } else {
    stryCov_9fa48("290");
    await docker(stryMutAct_9fa48("291") ? [] : (stryCov_9fa48("291"), [stryMutAct_9fa48("292") ? "" : (stryCov_9fa48("292"), "rm"), stryMutAct_9fa48("293") ? "" : (stryCov_9fa48("293"), "--force"), stryMutAct_9fa48("294") ? "" : (stryCov_9fa48("294"), "--volumes"), sandboxName(id), egressName(id)]));
    await docker(stryMutAct_9fa48("295") ? [] : (stryCov_9fa48("295"), [stryMutAct_9fa48("296") ? "" : (stryCov_9fa48("296"), "network"), stryMutAct_9fa48("297") ? "" : (stryCov_9fa48("297"), "rm"), sandboxName(id)]));
  }
}