// The data of the health page "/health" (src/web/pages/health.astro): what `console doctor` finds, one row per check
// with what to do when it fails (ADR 0086).
import type { Item } from "../domain/doctor.ts";
import type { FrameData } from "./frame.ts";

export interface HealthData {
  frame: FrameData;
  items: { name: string; state: string; todo: string }[];
}

export const healthData = (frame: FrameData, items: Item[]): HealthData => ({
  frame,
  items: items.map(({ name, ok, detail }) => ({ name, state: ok ? "ok" : "failing", todo: ok ? "—" : (detail ?? "") })),
});
