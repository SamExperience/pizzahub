import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  doc: vi.fn((db, name, id) => ({ collectionName: name, id })),
  onSnapshot: vi.fn(),
}));

const firebaseFunctions = vi.hoisted(() => ({
  httpsCallable: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("firebase/functions", () => firebaseFunctions);
vi.mock("../src/services/firebase", () => ({
  db: { name: "db" },
  functions: { name: "functions" },
}));

import {
  isSubscriptionActive,
  startCheckout,
  subscribeToSubscription,
} from "../src/services/billing.service";

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSubscriptionActive", () => {
  it("is true only for the active status", () => {
    expect(isSubscriptionActive({ status: "active" })).toBe(true);
  });

  it.each(["past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"])(
    "is false for %s",
    (status) => {
      expect(isSubscriptionActive({ status })).toBe(false);
    },
  );

  it("is false when the Company never subscribed", () => {
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);
  });
});

describe("startCheckout", () => {
  it("calls createCheckoutSession without data and redirects to the Checkout url", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_1" },
    });
    firebaseFunctions.httpsCallable.mockReturnValue(callable);

    await startCheckout();

    expect(firebaseFunctions.httpsCallable).toHaveBeenCalledWith(
      { name: "functions" },
      "createCheckoutSession",
    );
    expect(callable).toHaveBeenCalledWith();
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1");
  });

  it("throws without redirecting when the response has no url", async () => {
    firebaseFunctions.httpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({ data: {} }),
    );

    await expect(startCheckout()).rejects.toThrow("Could not start the checkout.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("propagates the function error without redirecting", async () => {
    const error = Object.assign(new Error("The subscription is already active."), {
      code: "functions/failed-precondition",
    });
    firebaseFunctions.httpsCallable.mockReturnValue(vi.fn().mockRejectedValue(error));

    await expect(startCheckout()).rejects.toBe(error);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("subscribeToSubscription", () => {
  it("requires a Company ID and an onChange callback", () => {
    expect(() => subscribeToSubscription("", vi.fn())).toThrow("Company ID is required");
    expect(() => subscribeToSubscription("company1")).toThrow(
      "onChange callback is required",
    );
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it("listens to the Company's subscription document and delivers every change", () => {
    const onChange = vi.fn();
    const unsubscribe = vi.fn();
    let emit;
    firestore.onSnapshot.mockImplementation((ref, next) => {
      emit = next;
      return unsubscribe;
    });

    const result = subscribeToSubscription("company1", onChange);

    expect(firestore.onSnapshot.mock.calls[0][0]).toEqual({
      collectionName: "subscriptions",
      id: "company1",
    });
    emit({ id: "company1", exists: () => true, data: () => ({ status: "incomplete" }) });
    emit({ id: "company1", exists: () => true, data: () => ({ status: "active" }) });
    expect(onChange).toHaveBeenNthCalledWith(1, { id: "company1", status: "incomplete" });
    expect(onChange).toHaveBeenNthCalledWith(2, { id: "company1", status: "active" });
    expect(result).toBe(unsubscribe);
  });

  it("delivers null when the Company never subscribed", () => {
    const onChange = vi.fn();
    firestore.onSnapshot.mockImplementation((ref, next) => {
      next({ id: "company1", exists: () => false, data: () => undefined });
      return vi.fn();
    });

    subscribeToSubscription("company1", onChange);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("forwards listener errors to onError", () => {
    const onError = vi.fn();
    firestore.onSnapshot.mockImplementation((ref, next, error) => {
      error(new Error("permission-denied"));
      return vi.fn();
    });

    subscribeToSubscription("company1", vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(new Error("permission-denied"));
  });
});
