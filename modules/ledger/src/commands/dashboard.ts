// ledger dashboard: write the Grafana dashboard over the PostgreSQL views (ADR 0035).
import { writeText } from "@opensoftware/cli";
import { packageFile } from "../adapters/files.ts";

export function dashboard(out: string): string {
  writeText(out, packageFile("grafana/ledger-dashboard.json"));
  return `wrote ${out}`;
}
