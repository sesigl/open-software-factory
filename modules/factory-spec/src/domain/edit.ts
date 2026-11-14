// One edit of the text of factory.yaml for a program such as the console (T-58). The text keeps its comments, the order
// of its keys and its anchors, and an agent that shares a list with the edited agent through an anchor keeps it.
import type { FactoryDefinition } from "@opensoftware/contracts";
import {
  type Document,
  isAlias,
  isNode,
  isSeq,
  type Node,
  parseDocument,
  visit,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import { fail } from "./errors.ts";

/** The lists of an agent that an edit changes, by their path below the agent. */
export const LISTS = { skill: ["skills"], secret: ["secrets"], egress: ["sandbox", "egress"] } as const;

export type List = keyof typeof LISTS;

/** The style of the reference factory: no line is folded, and a flow list is "[a, b]". */
const STYLE = { lineWidth: 0, flowCollectionPadding: false };

/**
 * Adds the value to a list of the agent, or removes it. A value the list has already, or one it does not have, leaves
 * the text as it is.
 */
export function editList(text: string, name: string, list: List, value: string, add: boolean): string {
  const document = parseDocument(text);
  const agent = (document.toJS() as FactoryDefinition).agents[name] ?? fail(`factory.yaml declares no agent "${name}"`);
  const values = (list === "egress" ? agent.sandbox?.egress : agent[LISTS[list][0]]) ?? [];
  if (values.includes(value) === add) return text;
  // The agent gets its own copy of every shared node on the path, so no other agent changes.
  const node = own(document, document.get("agents") as YAMLMap, name) as YAMLMap;
  const items = LISTS[list].reduce<Node | undefined>(
    (parent, key) => parent && own(document, parent as YAMLMap, key),
    node,
  );
  if (!add) (items as YAMLSeq).delete(values.indexOf(value));
  else if (isSeq(items)) items.add(document.createNode(value));
  else node.setIn(LISTS[list], document.createNode([value]));
  return document.toString(STYLE);
}

/** Declares the secrets provider at the range; one that is declared at the same range leaves the text as it is. */
export function addSecretsProvider(text: string, name: string, range: string): string {
  const document = parseDocument(text);
  const declared = (document.toJS() as FactoryDefinition).providers?.secrets?.[name];
  if (declared === range) return text;
  if (declared) fail(`providers.secrets declares "${name}" at "${declared}", not "${range}"`);
  document.setIn(["providers", "secrets", name], range);
  return document.toString(STYLE);
}

/**
 * The value of the key, made the parent's own: an alias becomes a copy of what it names, and a node with an anchor
 * that aliases use moves to the first of them, so they keep sharing it, and leaves a copy here.
 */
function own(document: Document, parent: YAMLMap, key: string): Node | undefined {
  const child = parent.get(key, true) as Node | undefined;
  if (isAlias(child)) parent.set(key, copy(child.resolve(document) as Node));
  else if (child?.anchor) {
    let moved = false;
    visit(document, {
      Alias(_, alias) {
        if (moved || alias.resolve(document) !== child) return;
        moved = true;
        return child;
      },
    });
    if (moved) parent.set(key, copy(child));
  }
  return parent.get(key, true) as Node | undefined;
}

/** A deep copy of the node without its anchors. */
function copy(node: Node): Node {
  const clone = node.clone() as Node;
  visit(clone, (_, each) => {
    if (isNode(each)) each.anchor = undefined;
  });
  return clone;
}
