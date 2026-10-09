import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((db, name) => ({ collectionName: name })),
  where: vi.fn((field, op, value) => ({ type: "where", field, op, value })),
  orderBy: vi.fn((field) => ({ type: "orderBy", field })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  onSnapshot: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("../src/services/firebase", () => ({ db: { name: "db" } }));

import {
  ORDER_STATUS,
  ORDER_STATUSES,
  ORDER_TYPE,
  getTodayRange,
  subscribeToTodayOrders,
} from "../src/services/order.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("order constants", () => {
  it("defines the English statuses in Tableau column order", () => {
    expect(ORDER_STATUSES).toEqual(["Pending", "In progress", "Completed"]);
    expect(ORDER_STATUS.PENDING).toBe("Pending");
    expect(ORDER_STATUS.IN_PROGRESS).toBe("In progress");
    expect(ORDER_STATUS.COMPLETED).toBe("Completed");
  });

  it("defines the order types", () => {
    expect(ORDER_TYPE).toEqual({ TAKEAWAY: "takeaway", DELIVERY: "delivery" });
  });
});

describe("getTodayRange", () => {
  it("returns local midnight today and tomorrow", () => {
    const { start, end } = getTodayRange(new Date(2026, 9, 9, 15, 30, 45));

    expect(start).toEqual(new Date(2026, 9, 9, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2026, 9, 10, 0, 0, 0, 0));
  });

  it("treats the last millisecond of the day as today", () => {
    const { start, end } = getTodayRange(new Date(2026, 9, 9, 23, 59, 59, 999));

    expect(start).toEqual(new Date(2026, 9, 9));
    expect(end).toEqual(new Date(2026, 9, 10));
  });

  it("rolls over month and year boundaries", () => {
    const { start, end } = getTodayRange(new Date(2026, 11, 31, 12));

    expect(start).toEqual(new Date(2026, 11, 31));
    expect(end).toEqual(new Date(2027, 0, 1));
  });
});

describe("subscribeToTodayOrders", () => {
  it("queries the Store's orders of today sorted by creation time", () => {
    firestore.onSnapshot.mockReturnValue(vi.fn());

    subscribeToTodayOrders("store-1", vi.fn());

    const [ref, storeFilter, fromFilter, toFilter, order] =
      firestore.query.mock.calls[0];

    expect(ref).toEqual({ collectionName: "orders" });
    expect(storeFilter).toMatchObject({
      field: "storeId",
      op: "==",
      value: "store-1",
    });
    expect(fromFilter).toMatchObject({ field: "createdAt", op: ">=" });
    expect(toFilter).toMatchObject({ field: "createdAt", op: "<" });
    expect(toFilter.value.getTime() - fromFilter.value.getTime()).toBeGreaterThan(
      0,
    );
    expect(fromFilter.value.getHours()).toBe(0);
    expect(toFilter.value.getHours()).toBe(0);
    expect(order).toEqual({ type: "orderBy", field: "createdAt" });
  });

  it("opens a single listener", () => {
    firestore.onSnapshot.mockReturnValue(vi.fn());

    subscribeToTodayOrders("store-1", vi.fn());

    expect(firestore.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("maps documents to plain orders with their id", () => {
    const onChange = vi.fn();
    firestore.onSnapshot.mockImplementation((q, next) => {
      next({
        docs: [
          { id: "o1", data: () => ({ status: "Pending", total: 10 }) },
          { id: "o2", data: () => ({ status: "Completed", total: 20 }) },
        ],
      });
      return vi.fn();
    });

    subscribeToTodayOrders("store-1", onChange);

    expect(onChange).toHaveBeenCalledWith([
      { id: "o1", status: "Pending", total: 10 },
      { id: "o2", status: "Completed", total: 20 },
    ]);
  });

  it("calls onChange again with the new data on a second snapshot", () => {
    const onChange = vi.fn();
    let emit;
    firestore.onSnapshot.mockImplementation((q, next) => {
      emit = next;
      return vi.fn();
    });

    subscribeToTodayOrders("store-1", onChange);

    emit({ docs: [{ id: "o1", data: () => ({ status: "Pending" }) }] });
    emit({
      docs: [
        { id: "o1", data: () => ({ status: "In progress" }) },
        { id: "o2", data: () => ({ status: "Pending" }) },
      ],
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, [
      { id: "o1", status: "Pending" },
    ]);
    expect(onChange).toHaveBeenNthCalledWith(2, [
      { id: "o1", status: "In progress" },
      { id: "o2", status: "Pending" },
    ]);
  });

  it("delivers an empty list when there are no orders", () => {
    const onChange = vi.fn();
    firestore.onSnapshot.mockImplementation((q, next) => {
      next({ docs: [] });
      return vi.fn();
    });

    subscribeToTodayOrders("store-1", onChange);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("forwards listener errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("permission-denied");
    firestore.onSnapshot.mockImplementation((q, next, fail) => {
      fail(error);
      return vi.fn();
    });

    subscribeToTodayOrders("store-1", vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("returns the unsubscribe function", () => {
    const unsubscribe = vi.fn();
    firestore.onSnapshot.mockReturnValue(unsubscribe);

    const result = subscribeToTodayOrders("store-1", vi.fn());
    result();

    expect(result).toBe(unsubscribe);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing Store ID", () => {
    expect(() => subscribeToTodayOrders("", vi.fn())).toThrow(
      "Store ID is required",
    );
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a missing onChange callback", () => {
    expect(() => subscribeToTodayOrders("store-1")).toThrow(
      "onChange callback is required",
    );
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});
