import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

// cgroup v2 has cpu.max and memory.max; cgroup v1 has the quota, the period and the limit in separate files.
const LIMITS = [
  "if [ -f /sys/fs/cgroup/cpu.max ]; then cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max;",
  "else echo $(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us /sys/fs/cgroup/cpu/cpu.cfs_period_us);",
  "cat /sys/fs/cgroup/memory/memory.limit_in_bytes; fi",
].join(" ");

scenario("SCN-SANDBOX-003", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let spec: Record<string, unknown> = {};
    await given('a sandbox spec with the test template, the CPU 0.5 and the memory "256Mi"', async () => {
      spec = { template: TEMPLATE, cpu: 0.5, memory: "256Mi" };
    });

    let lines: string[] = [];
    await when("the client creates a sandbox from the spec and reads its CPU quota and memory limit", async () => {
      const id = await box.create(spec);
      const run = await box.sh(id, LIMITS);
      lines = run.stdout.trim().split("\n");
    });

    await then("the CPU quota is 50000 of every 100000 microseconds", async () => {
      expect(lines[0]).toBe("50000 100000");
    });

    await then("the memory limit is 268435456 bytes", async () => {
      expect(lines[1]).toBe("268435456");
    });
  } finally {
    await box.destroyAll();
  }
});
