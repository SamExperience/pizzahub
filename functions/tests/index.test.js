import { describe, expect, it } from "vitest";

describe("functions entry point", () => {
  it("loads without errors and exports the functions", async () => {
    const module = await import("../index.js");

    expect(Object.keys(module).sort()).toEqual(["createCheckoutSession", "stripeWebhook"]);
  });

  it("deploys the functions in europe-west6", async () => {
    const { createCheckoutSession, stripeWebhook } = await import("../index.js");

    expect(createCheckoutSession.__endpoint.region).toEqual(["europe-west6"]);
    expect(stripeWebhook.__endpoint.region).toEqual(["europe-west6"]);
  });
});
