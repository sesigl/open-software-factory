// The data of the health page "/health" (src/web/pages/health.astro): what `console doctor` finds, one row per check
// with what to do when it fails (ADR 0086), in the shell of the new look. The template only reads it.
import type { ShellData } from "@opensoftware/ui";
import type { Item } from "../domain/doctor.ts";

export interface HealthData {
  shell: ShellData;
  /** Each check: "ok", "warning" or "failing", with the classes of that state. */
  items: { name: string; state: string; stateClass: string; todo: string }[];
}

const stateOf = ({ ok, warn }: Item): string => (ok ? (warn ? "warning" : "ok") : "failing");

export const healthData = (shell: ShellData, items: Item[]): HealthData => ({
  shell,
  items: items.map((item) => {
    const state = stateOf(item);
    return {
      name: item.name,
      state,
      stateClass: `osf-state osf-state-${state}`,
      todo: item.ok && !item.warn ? "—" : (item.detail ?? ""),
    };
  }),
});
