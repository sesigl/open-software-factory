import { scenario } from "@opensoftware/testkit";
import { servingGateway } from "./foreman.ts";

scenario("SCN-FORE-055", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm"',
    async () => {
      server = await servingGateway(sut, fakes);
      expect(server.inference?.list()).toEqual(["000000000001"]);
    },
  );

  await when("the server gets the signal SIGTERM", async () => {
    await sut.http.stop();
  });

  await then("the inference adapter's list is empty", async () => {
    expect(server.inference?.list()).toEqual([]);
  });
});
