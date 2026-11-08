import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, serving, WAIT_MS, workReceived } from "./foreman.ts";

scenario("SCN-FORE-082", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await given('the file "factory.yaml" is gone', async () => {
    await sut.files.remove("$INPUT/factory.yaml");
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  await when('the file "factory.yaml" is back', async () => {
    // The first delivery fails while the file is gone; the message comes again after 5 seconds.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await sut.files.put("$INPUT/factory.yaml", readmeFiles(fakes)["factory.yaml"] as string);
  });

  await then('the server publishes "run.started@v1" for the work item', async () => {
    const [started] = await events.received("run.started@v1", { timeoutMs: WAIT_MS });
    expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
  });
});
