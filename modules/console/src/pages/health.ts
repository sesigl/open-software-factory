// @ts-nocheck
// The data of the health page "/health" (src/web/pages/health.astro): what `console doctor` finds, one row per check
// with what to do when it fails (ADR 0086).
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
import type { Item } from "../domain/doctor.ts";
import type { FrameData } from "./frame.ts";
export interface HealthData {
  frame: FrameData;
  items: {
    name: string;
    state: string;
    todo: string;
  }[];
}
export const healthData = stryMutAct_9fa48("25") ? () => undefined : (stryCov_9fa48("25"), (() => {
  const healthData = (frame: FrameData, items: Item[]): HealthData => stryMutAct_9fa48("26") ? {} : (stryCov_9fa48("26"), {
    frame,
    items: items.map(stryMutAct_9fa48("27") ? () => undefined : (stryCov_9fa48("27"), ({
      name,
      ok,
      detail
    }) => stryMutAct_9fa48("28") ? {} : (stryCov_9fa48("28"), {
      name,
      state: ok ? stryMutAct_9fa48("29") ? "" : (stryCov_9fa48("29"), "ok") : stryMutAct_9fa48("30") ? "" : (stryCov_9fa48("30"), "failing"),
      todo: ok ? stryMutAct_9fa48("31") ? "" : (stryCov_9fa48("31"), "—") : stryMutAct_9fa48("32") ? detail && "" : (stryCov_9fa48("32"), detail ?? (stryMutAct_9fa48("33") ? "Stryker was here!" : (stryCov_9fa48("33"), "")))
    })))
  });
  return healthData;
})());