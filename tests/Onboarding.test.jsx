import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Onboarding from "../src/pages/Onboarding";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { FIELD_LIMITS } from "../src/utils/fieldLimits";

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    authUser: { uid: "u1", displayName: "Anna" },
    refreshProfile: vi.fn(),
  }),
}));
vi.mock("../src/services/onboarding.service", () => ({
  createOnboardingWorkspace: vi.fn(),
}));

const fillRequired = async () => {
  await userEvent.type(screen.getByLabelText("Company name"), "Pizza SA");
  await userEvent.type(screen.getByLabelText("Store name"), "Centro");
  await userEvent.type(screen.getByLabelText("Street"), "Rue du Lyon");
  await userEvent.type(screen.getByLabelText("Number"), "3");
  await userEvent.type(screen.getByLabelText("NPA"), "1201");
  await userEvent.type(screen.getByLabelText("City"), "Genève");
};

describe("Onboarding", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("limits the company, store, address and postal code inputs to FIELD_LIMITS", () => {
    render(<Onboarding />);

    const limits = [
      ["Company name", FIELD_LIMITS.NAME],
      ["Store name", FIELD_LIMITS.NAME],
      ["Street", FIELD_LIMITS.ADDRESS_LINE],
      ["Number", FIELD_LIMITS.STREET_NUMBER],
      ["NPA", FIELD_LIMITS.POSTAL_CODE],
      ["City", FIELD_LIMITS.ADDRESS_LINE],
      ["Country", FIELD_LIMITS.ADDRESS_LINE],
    ];

    limits.forEach(([name, max]) => {
      expect(screen.getByLabelText(name).getAttribute("maxlength")).toBe(String(max));
    });
  });

  it("shows the validation message thrown by the onboarding service", async () => {
    createOnboardingWorkspace.mockRejectedValue(new Error("Store name is required"));
    render(<Onboarding />);

    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Store name is required");
  });

  it("shows the generic message for unexpected (Firebase) errors", async () => {
    createOnboardingWorkspace.mockRejectedValue(
      Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }),
    );
    render(<Onboarding />);

    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Unable to create workspace. Please try again.",
    );
  });
});
