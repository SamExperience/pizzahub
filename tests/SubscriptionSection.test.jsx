import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import SubscriptionSection from "../src/components/SubscriptionSection";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  startCheckout: vi.fn(),
  unsubscribe: vi.fn(),
  auth: { userProfile: { companyId: "company-1" } },
}));

vi.mock("../src/services/billing.service", async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeToSubscription: mocks.subscribe,
  startCheckout: mocks.startCheckout,
}));

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

// Listener callbacks captured so each test can push snapshots.
let listener;

const renderSection = (path = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SubscriptionSection />
    </MemoryRouter>,
  );

const emit = (subscription) => act(() => listener.onChange(subscription));

const periodEnd = new Date(2026, 10, 14);
const periodEndText = periodEnd.toLocaleDateString([], {
  day: "numeric",
  month: "long",
  year: "numeric",
});

describe("SubscriptionSection", () => {
  beforeEach(() => {
    mocks.auth.userProfile = { companyId: "company-1" };
    mocks.subscribe.mockReset();
    mocks.subscribe.mockImplementation((companyId, onChange, onError) => {
      listener = { companyId, onChange, onError };
      return mocks.unsubscribe;
    });
    mocks.startCheckout.mockReset();
    mocks.unsubscribe.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("listens to the Company subscription and shows loading until the first snapshot", () => {
    renderSection();

    expect(listener.companyId).toBe("company-1");
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderSection();

    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("shows No subscription and the Subscribe button when there is no document", () => {
    renderSection();
    emit(null);

    expect(screen.getByText("No subscription")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy();
    expect(screen.queryByText(/Renews on/)).toBeNull();
    expect(screen.getByText(/Test mode/)).toBeTruthy();
  });

  it("shows an active subscription with its renewal date and no Subscribe button", () => {
    renderSection();
    emit({
      status: "active",
      currentPeriodEnd: { toDate: () => periodEnd },
      cancelAtPeriodEnd: false,
    });

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText(`Renews on ${periodEndText}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
  });

  it("shows the end date when the cancellation is scheduled", () => {
    renderSection();
    emit({ status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: true });

    expect(screen.getByText(`Ends on ${periodEndText}`)).toBeTruthy();
    expect(screen.queryByText(/Renews on/)).toBeNull();
  });

  it("labels an inactive Stripe status and offers Subscribe", () => {
    renderSection();
    emit({ status: "past_due", currentPeriodEnd: null, cancelAtPeriodEnd: false });

    expect(screen.getByText("Past due")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy();
  });

  it("shows the error when the subscription cannot be read", () => {
    renderSection();
    act(() => listener.onError(new Error("denied")));

    expect(screen.getByRole("alert").textContent).toBe("Unable to load the subscription.");
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
  });

  it("starts the checkout and disables the button while redirecting", async () => {
    const user = userEvent.setup();
    mocks.startCheckout.mockReturnValue(new Promise(() => {}));
    renderSection();
    emit(null);

    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(mocks.startCheckout).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Redirecting to checkout ..." }).disabled,
    ).toBe(true);
  });

  it("shows an error and enables the button again when the checkout fails", async () => {
    const user = userEvent.setup();
    mocks.startCheckout.mockRejectedValue(new Error("failed"));
    renderSection();
    emit(null);

    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(screen.getByRole("alert").textContent).toContain("Unable to start the checkout");
    expect(screen.getByRole("button", { name: "Subscribe" }).disabled).toBe(false);
  });

  it("shows the processing message after a successful checkout until the status is active", () => {
    renderSection("/dashboard?checkout=success");
    emit(null);

    expect(screen.getByText(/Payment is being processed/)).toBeTruthy();

    emit({ status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false });

    expect(screen.queryByText(/Payment is being processed/)).toBeNull();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("keeps the processing message while the subscription is incomplete", () => {
    renderSection("/dashboard?checkout=success");
    emit({ status: "incomplete", currentPeriodEnd: null, cancelAtPeriodEnd: false });

    expect(screen.getByText(/Payment is being processed/)).toBeTruthy();
  });

  it("hides the processing message once the subscription has a final status", () => {
    renderSection("/dashboard?checkout=success");
    emit({ status: "canceled", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false });

    expect(screen.queryByText(/Payment is being processed/)).toBeNull();
    expect(screen.getByText("Canceled")).toBeTruthy();
  });

  it("shows the cancelled message after a cancelled checkout", () => {
    renderSection("/dashboard?checkout=cancel");
    emit(null);

    expect(screen.getByText(/Checkout cancelled/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy();
  });
});
