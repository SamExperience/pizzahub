import { describe, expect, it } from "vitest";

describe("functions entry point", () => {
  it("loads without errors and exports the callable functions", async () => {
    const module = await import("../index.js");

    expect(Object.keys(module)).toEqual(["createCheckoutSession"]);
  });

  it("deploys the functions in europe-west6", async () => {
    const { createCheckoutSession } = await import("../index.js");

    expect(createCheckoutSession.__endpoint.region).toEqual(["europe-west6"]);
  });
});
