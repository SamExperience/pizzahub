import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "../src/utils/logger";

describe("logError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prints the error in development", () => {
    vi.stubEnv("DEV", true);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    logError("Error loading -> ", error);

    expect(spy).toHaveBeenCalledWith("Error loading -> ", error);
  });

  it("prints nothing in production", () => {
    vi.stubEnv("DEV", false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("Error loading -> ", new Error("boom"));

    expect(spy).not.toHaveBeenCalled();
  });
});
