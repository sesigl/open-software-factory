// spec-trace next-id: the next free ID of a prefix over every feature file.
import type { Inputs } from "../domain/model.ts";
import { nextId } from "../domain/next-id.ts";

export function next(inputs: Inputs, prefix: string): string {
  return nextId(
    prefix,
    inputs.config.id,
    inputs.scenarios.flatMap((scenario) => scenario.ids),
  );
}
