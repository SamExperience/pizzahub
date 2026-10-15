import { afterEach, describe, expect, it, vi } from "vitest";
import { readPrintOnSave, writePrintOnSave } from "../src/utils/printPreference";

describe("print on save preference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is on by default", () => {
    expect(readPrintOnSave()).toBe(true);
  });

  it("remembers the last choice", () => {
    writePrintOnSave(false);
    expect(readPrintOnSave()).toBe(false);

    writePrintOnSave(true);
    expect(readPrintOnSave()).toBe(true);
  });

  it("falls back to on when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writePrintOnSave(false)).not.toThrow();
    expect(readPrintOnSave()).toBe(true);
  });
});
