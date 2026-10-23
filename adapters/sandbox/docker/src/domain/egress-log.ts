// @ts-nocheck
// The egress log: one line per request that left the sandbox, from iron-proxy's audit lines. It keeps the facts a
// person needs and leaves out header values and MCP arguments.
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
export interface EgressEntry {
  host: string;
  method: string;
  path: string;
  outcome: "allowed" | "refused";
  /** What refused the request: "allowlist", "mcp" or another iron-proxy transform. */
  refusedBy?: string;
  mcpServer?: string;
  tool?: string;
  /** The variables whose placeholders the proxy swapped for the real secret. */
  secrets?: string[];
}
interface Audit {
  msg?: string;
  audit?: {
    host?: string;
    method?: string;
    path?: string;
    action?: string;
  };
  rejected_by?: string;
  request_transforms?: {
    name: string;
    annotations?: {
      swapped?: {
        secret: string;
      }[];
    };
  }[];
  mcp?: {
    server?: string;
    messages?: {
      direction?: string;
      tool?: string;
      decision?: string;
    }[];
  };
}
export function egressEntries(log: string): EgressEntry[] {
  if (stryMutAct_9fa48("355")) {
    {}
  } else {
    stryCov_9fa48("355");
    return log.split(stryMutAct_9fa48("356") ? "" : (stryCov_9fa48("356"), "\n")).flatMap(line => {
      if (stryMutAct_9fa48("357")) {
        {}
      } else {
        stryCov_9fa48("357");
        const record = parse(line);
        return (stryMutAct_9fa48("360") ? record?.msg === "request" || record.audit : stryMutAct_9fa48("359") ? false : stryMutAct_9fa48("358") ? true : (stryCov_9fa48("358", "359", "360"), (stryMutAct_9fa48("362") ? record?.msg !== "request" : stryMutAct_9fa48("361") ? true : (stryCov_9fa48("361", "362"), (stryMutAct_9fa48("363") ? record.msg : (stryCov_9fa48("363"), record?.msg)) === (stryMutAct_9fa48("364") ? "" : (stryCov_9fa48("364"), "request")))) && record.audit)) ? stryMutAct_9fa48("365") ? [] : (stryCov_9fa48("365"), [entry(record)]) : stryMutAct_9fa48("366") ? ["Stryker was here"] : (stryCov_9fa48("366"), []);
      }
    });
  }
}
function entry(record: Audit): EgressEntry {
  if (stryMutAct_9fa48("367")) {
    {}
  } else {
    stryCov_9fa48("367");
    const {
      host = stryMutAct_9fa48("368") ? "Stryker was here!" : (stryCov_9fa48("368"), ""),
      method = stryMutAct_9fa48("369") ? "Stryker was here!" : (stryCov_9fa48("369"), ""),
      path = stryMutAct_9fa48("370") ? "Stryker was here!" : (stryCov_9fa48("370"), ""),
      action
    } = stryMutAct_9fa48("371") ? record.audit && {} : (stryCov_9fa48("371"), record.audit ?? {});
    const call = stryMutAct_9fa48("373") ? record.mcp.messages?.find(message => message.direction === "request" && message.tool) : stryMutAct_9fa48("372") ? record.mcp?.messages.find(message => message.direction === "request" && message.tool) : (stryCov_9fa48("372", "373"), record.mcp?.messages?.find(stryMutAct_9fa48("374") ? () => undefined : (stryCov_9fa48("374"), message => stryMutAct_9fa48("377") ? message.direction === "request" || message.tool : stryMutAct_9fa48("376") ? false : stryMutAct_9fa48("375") ? true : (stryCov_9fa48("375", "376", "377"), (stryMutAct_9fa48("379") ? message.direction !== "request" : stryMutAct_9fa48("378") ? true : (stryCov_9fa48("378", "379"), message.direction === (stryMutAct_9fa48("380") ? "" : (stryCov_9fa48("380"), "request")))) && message.tool))));
    const refusedBy = stryMutAct_9fa48("381") ? record.rejected_by && (call?.decision === "deny" ? "mcp" : undefined) : (stryCov_9fa48("381"), record.rejected_by ?? ((stryMutAct_9fa48("384") ? call?.decision !== "deny" : stryMutAct_9fa48("383") ? false : stryMutAct_9fa48("382") ? true : (stryCov_9fa48("382", "383", "384"), (stryMutAct_9fa48("385") ? call.decision : (stryCov_9fa48("385"), call?.decision)) === (stryMutAct_9fa48("386") ? "" : (stryCov_9fa48("386"), "deny")))) ? stryMutAct_9fa48("387") ? "" : (stryCov_9fa48("387"), "mcp") : undefined));
    const secrets = (stryMutAct_9fa48("388") ? record.request_transforms && [] : (stryCov_9fa48("388"), record.request_transforms ?? (stryMutAct_9fa48("389") ? ["Stryker was here"] : (stryCov_9fa48("389"), [])))).flatMap(stryMutAct_9fa48("390") ? () => undefined : (stryCov_9fa48("390"), transform => stryMutAct_9fa48("391") ? transform.annotations?.swapped && [] : (stryCov_9fa48("391"), (stryMutAct_9fa48("392") ? transform.annotations.swapped : (stryCov_9fa48("392"), transform.annotations?.swapped)) ?? (stryMutAct_9fa48("393") ? ["Stryker was here"] : (stryCov_9fa48("393"), []))))).map(stryMutAct_9fa48("394") ? () => undefined : (stryCov_9fa48("394"), swap => swap.secret.split("/").pop() as string));
    return stryMutAct_9fa48("395") ? {} : (stryCov_9fa48("395"), {
      host: host.replace(stryMutAct_9fa48("398") ? /:\D+$/ : stryMutAct_9fa48("397") ? /:\d$/ : stryMutAct_9fa48("396") ? /:\d+/ : (stryCov_9fa48("396", "397", "398"), /:\d+$/), stryMutAct_9fa48("399") ? "Stryker was here!" : (stryCov_9fa48("399"), "")),
      method,
      path,
      outcome: (stryMutAct_9fa48("402") ? action !== "allow" : stryMutAct_9fa48("401") ? false : stryMutAct_9fa48("400") ? true : (stryCov_9fa48("400", "401", "402"), action === (stryMutAct_9fa48("403") ? "" : (stryCov_9fa48("403"), "allow")))) ? stryMutAct_9fa48("404") ? "" : (stryCov_9fa48("404"), "allowed") : stryMutAct_9fa48("405") ? "" : (stryCov_9fa48("405"), "refused"),
      ...(refusedBy ? stryMutAct_9fa48("406") ? {} : (stryCov_9fa48("406"), {
        refusedBy
      }) : {}),
      ...((stryMutAct_9fa48("407") ? record.mcp.server : (stryCov_9fa48("407"), record.mcp?.server)) ? stryMutAct_9fa48("408") ? {} : (stryCov_9fa48("408"), {
        mcpServer: record.mcp.server
      }) : {}),
      ...((stryMutAct_9fa48("409") ? call.tool : (stryCov_9fa48("409"), call?.tool)) ? stryMutAct_9fa48("410") ? {} : (stryCov_9fa48("410"), {
        tool: call.tool
      }) : {}),
      ...(secrets.length ? stryMutAct_9fa48("411") ? {} : (stryCov_9fa48("411"), {
        secrets
      }) : {})
    });
  }
}
function parse(line: string): Audit | undefined {
  if (stryMutAct_9fa48("412")) {
    {}
  } else {
    stryCov_9fa48("412");
    try {
      if (stryMutAct_9fa48("413")) {
        {}
      } else {
        stryCov_9fa48("413");
        return JSON.parse(line) as Audit;
      }
    } catch {
      if (stryMutAct_9fa48("414")) {
        {}
      } else {
        stryCov_9fa48("414");
        return undefined;
      }
    }
  }
}