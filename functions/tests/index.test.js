import { describe, expect, it } from "vitest";

describe("functions entry point", () => {
  it("loads without errors and exports no functions yet", async () => {
    const module = await import("../index.js");

    expect(Object.keys(module)).toEqual([]);
  });
});
