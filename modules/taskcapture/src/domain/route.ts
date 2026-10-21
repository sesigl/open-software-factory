// The model a tag routes to, and the LiteLLM proxy config that sends the alias with that tag to it (ADR 0039).
import { type Document, isMap, isSeq, type YAMLMap } from "yaml";
import { type Cell, cellName } from "./cells.ts";
import { percent, usd } from "./present.ts";

export interface Choice {
  model?: string;
  minCorrectness?: number;
}

type Priced = Cell & { correctness: number; costUsdPerTrial: number };

/** The cell to route to: the named model, the cheapest cell that reaches the minimum, or the most efficient. */
export function choose(
  report: { cells: Cell[]; mostEfficient: { configuration: string; model: string } | null },
  choice: Choice,
): Priced {
  const priced = report.cells.filter(
    (cell): cell is Priced => cell.correctness !== null && cell.costUsdPerTrial !== null,
  );
  const byCorrectness = [...priced].sort(
    (a, b) => b.correctness - a.correctness || a.costUsdPerTrial - b.costUsdPerTrial,
  );
  if (choice.model !== undefined) {
    const found = byCorrectness.find((cell) => cell.model === choice.model);
    if (!found) throw new Error(`the report has no scored cell of the model ${choice.model}`);
    return found;
  }
  if (choice.minCorrectness !== undefined) {
    const min = choice.minCorrectness;
    const reaching = priced
      .filter((cell) => cell.correctness >= min)
      .sort((a, b) => a.costUsdPerTrial - b.costUsdPerTrial || b.correctness - a.correctness);
    const top = byCorrectness[0];
    if (!reaching[0])
      throw new Error(
        `no model reaches correctness ${percent(min)}; the best is ${top ? `${cellName(top)} with ${percent(top.correctness)}` : "none"}`,
      );
    return reaching[0];
  }
  const efficient = report.mostEfficient;
  const found = efficient && priced.find((cell) => cellName(cell) === cellName(efficient));
  if (!found) throw new Error("the report has no cell with both a correctness and a cost");
  return found;
}

export const routeLine = (tag: string, cell: Priced): string =>
  `${tag} → ${cell.model} (correctness ${percent(cell.correctness)}, ${usd(cell.costUsdPerTrial)} USD per trial)`;

/**
 * Adds the deployment of `alias` for `tag` to a LiteLLM config: a deployment of the same alias with that tag is
 * replaced, every other one is kept, and tag filtering is turned on.
 */
export function addRoute(config: Document, route: { alias: string; tag: string; model: string }): Document {
  const list = config.get("model_list");
  const kept = isSeq(list)
    ? list.items.filter((item) => {
        if (!isMap(item)) return true;
        const tags = (item as YAMLMap).getIn(["litellm_params", "tags"]);
        const tagged = isSeq(tags) && tags.items.some((tag) => String((tag as { value?: unknown }).value ?? tag) === route.tag);
        return !(item.get("model_name") === route.alias && tagged);
      })
    : [];
  config.set(
    "model_list",
    config.createNode([
      ...kept,
      config.createNode({
        model_name: route.alias,
        litellm_params: { model: route.model, tags: [route.tag] },
      }),
    ]),
  );
  config.setIn(["router_settings", "enable_tag_filtering"], true);
  return config;
}
