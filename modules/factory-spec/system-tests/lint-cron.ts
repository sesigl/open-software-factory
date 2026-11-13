// The factory of SCN-FSPEC-063 and SCN-FSPEC-064: an agent "triage" and, on line 13, a cron automation.
import type { Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

export async function putCronFactory(sut: Sut): Promise<void> {
  const rest = ["automations:", '  - cron: "0 10 * * *"', "    run: self-triage-report"];
  await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage"), rest }));
  await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
}
