import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((db, name) => ({ collectionName: name })),
  where: vi.fn((field, op, value) => ({ type: "where", field, op, value })),
  orderBy: vi.fn((field) => ({ type: "orderBy", field })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  onSnapshot: vi.fn(),
  // doc(collectionRef) generates a new id; doc(db, name, id) points to a document.
  doc: vi.fn((parent, name, id) =>
    name === undefined
      ? { collectionName: parent.collectionName, id: `new-${parent.collectionName}` }
      : { collectionName: name, id },
  ),
  serverTimestamp: vi.fn(() => "server-time"),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("../src/services/firebase", () => ({ db: { name: "db" } }));

import {
  ORDER_STATUS,
  ORDER_STATUSES,
  ORDER_TYPE,
  buildItemSnapshot,
  calculateOrderTotal,
  cancelOrder,
  createOrder,
  getTodayRange,
  subscribeToTodayOrders,
  updateItemQuantity,
  updateOrder,
  updateOrderStatus,
  validateOrder,
} from "../src/services/order.service";

beforeEach(() => {
  vi.clearAllMocks();
});

const pizza = {
  id: "p1",
  name: "Margherita",
  price: null,
  sizes: [
    { name: "Small", price: 9.5 },
    { name: "Large", price: 13.2 },
  ],
  availableCookingLevels: ["Rare", "Well done"],
  defaultCookingLevel: "Well done",
  isAvailable: true,
};

const drink = {
  id: "p2",
  name: "Cola",
  price: 3.3,
  sizes: null,
  availableCookingLevels: null,
  defaultCookingLevel: null,
  isAvailable: true,
};

describe("buildItemSnapshot", () => {
  it("copies the product data with size price and cooking level", () => {
    expect(
      buildItemSnapshot(pizza, {
        size: "Large",
        cookingLevel: "Rare",
        customizations: ["  no basil ", "", "extra cheese"],
        quantity: 2,
      }),
    ).toEqual({
      productId: "p1",
      productName: "Margherita",
      size: "Large",
      unitPrice: 13.2,
      quantity: 2,
      cookingLevel: "Rare",
      customizations: ["no basil", "extra cheese"],
      subtotal: 26.4,
    });
  });

  it("uses the product price and no size or cooking level when not defined", () => {
    expect(buildItemSnapshot(drink, { quantity: 3 })).toEqual({
      productId: "p2",
      productName: "Cola",
      size: null,
      unitPrice: 3.3,
      quantity: 3,
      cookingLevel: null,
      customizations: [],
      subtotal: 9.9,
    });
  });

  it("falls back to the default cooking level", () => {
    const item = buildItemSnapshot(pizza, { size: "Small", quantity: 1 });

    expect(item.cookingLevel).toBe("Well done");
  });

  it("rejects unavailable products", () => {
    expect(() =>
      buildItemSnapshot({ ...drink, isAvailable: false }, { quantity: 1 }),
    ).toThrow("Product is not available");
  });

  it("requires a valid size when the product has sizes", () => {
    expect(() => buildItemSnapshot(pizza, { quantity: 1 })).toThrow(
      "Item size is required",
    );
    expect(() =>
      buildItemSnapshot(pizza, { size: "Huge", quantity: 1 }),
    ).toThrow("Item size is required");
  });

  it("rejects a size or cooking level the product does not offer", () => {
    expect(() =>
      buildItemSnapshot(drink, { size: "Large", quantity: 1 }),
    ).toThrow("Product has no sizes");
    expect(() =>
      buildItemSnapshot(drink, { cookingLevel: "Rare", quantity: 1 }),
    ).toThrow("Product has no cooking levels");
    expect(() =>
      buildItemSnapshot(pizza, { size: "Small", cookingLevel: "Burnt", quantity: 1 }),
    ).toThrow("Item cooking level is invalid");
  });

  it("requires a positive integer quantity", () => {
    for (const quantity of [0, -1, 1.5, undefined])
      expect(() => buildItemSnapshot(drink, { quantity })).toThrow(
        "Item quantity must be a positive integer",
      );
  });
});

describe("updateItemQuantity", () => {
  it("returns a copy with the new quantity and the recalculated subtotal", () => {
    const item = buildItemSnapshot(pizza, { size: "Small", quantity: 1 });
    const updated = updateItemQuantity(item, 3);

    expect(updated).toEqual({ ...item, quantity: 3, subtotal: 28.5 });
    expect(item.quantity).toBe(1);
    expect(item.subtotal).toBe(9.5);
  });

  it("rounds the subtotal to cents", () => {
    expect(updateItemQuantity({ unitPrice: 0.1, quantity: 1, subtotal: 0.1 }, 3).subtotal).toBe(0.3);
  });

  it.each([0, -1, 1.5, "2", undefined])("rejects quantity %s", (quantity) => {
    const item = buildItemSnapshot(pizza, { size: "Small", quantity: 1 });

    expect(() => updateItemQuantity(item, quantity)).toThrow(
      "Item quantity must be a positive integer",
    );
  });
});

describe("calculateOrderTotal", () => {
  it("sums the subtotals without floating point drift", () => {
    expect(
      calculateOrderTotal([{ subtotal: 0.1 }, { subtotal: 0.2 }, { subtotal: 9.9 }]),
    ).toBe(10.2);
  });

  it("returns 0 for no items", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});

const validOrder = () => ({
  items: [buildItemSnapshot(drink, { quantity: 2 })],
  orderType: ORDER_TYPE.TAKEAWAY,
  scheduledTime: new Date(2026, 9, 12, 19, 30),
});

describe("validateOrder", () => {
  it("returns the order data with the total", () => {
    expect(validateOrder(validOrder())).toEqual({ ...validOrder(), total: 6.6 });
  });

  it("rejects an invalid order type", () => {
    expect(() => validateOrder({ ...validOrder(), orderType: "dine-in" })).toThrow(
      "Order type is invalid",
    );
  });

  it("requires at least one item", () => {
    expect(() => validateOrder({ ...validOrder(), items: [] })).toThrow(
      "Order must have at least one item",
    );
    expect(() => validateOrder({ ...validOrder(), items: undefined })).toThrow(
      "Order must have at least one item",
    );
  });

  it("requires a valid scheduled time", () => {
    for (const scheduledTime of [undefined, "19:30", new Date("invalid")])
      expect(() => validateOrder({ ...validOrder(), scheduledTime })).toThrow(
        "Scheduled time is required",
      );
  });
});

describe("createOrder", () => {
  const createBatch = () => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });

  const params = (overrides = {}) => ({
    companyId: "company1",
    storeId: "store1",
    customerData: { firstName: "Mario" },
    ...validOrder(),
    ...overrides,
  });

  it("writes a new Customer and a Pending Order in one batch", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await expect(createOrder(params())).resolves.toBe("new-orders");

    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenNthCalledWith(
      1,
      { collectionName: "customers", id: "new-customers" },
      expect.objectContaining({ companyId: "company1", firstName: "Mario" }),
    );
    expect(batch.set).toHaveBeenNthCalledWith(
      2,
      { collectionName: "orders", id: "new-orders" },
      {
        storeId: "store1",
        customerId: "new-customers",
        items: validOrder().items,
        orderType: "takeaway",
        scheduledTime: validOrder().scheduledTime,
        total: 6.6,
        status: "Pending",
        createdAt: "server-time",
        updatedAt: "server-time",
      },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("references an unchanged existing Customer without updating it", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await createOrder(
      params({
        existingCustomer: { id: "c1", firstName: "Mario" },
      }),
    );

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][1]).toMatchObject({ customerId: "c1" });
  });

  it("updates an edited existing Customer in the same batch", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await createOrder(
      params({
        customerData: { firstName: "Mario", phone: "123" },
        existingCustomer: { id: "c1", firstName: "Mario" },
      }),
    );

    expect(batch.update).toHaveBeenCalledWith(
      { collectionName: "customers", id: "c1" },
      expect.objectContaining({ phone: "123", updatedAt: "server-time" }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("does not write anything when the order or the Customer is invalid", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await expect(createOrder(params({ items: [] }))).rejects.toThrow(
      "Order must have at least one item",
    );
    await expect(
      createOrder(params({ orderType: ORDER_TYPE.DELIVERY })),
    ).rejects.toThrow("Customer phone is required for delivery");

    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("requires the Company and the Store", async () => {
    await expect(createOrder(params({ companyId: "" }))).rejects.toThrow(
      "Company ID is required",
    );
    await expect(createOrder(params({ storeId: "" }))).rejects.toThrow(
      "Store ID is required",
    );
  });
});

describe("updateOrder", () => {
  const createBatch = () => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });

  const params = (overrides = {}) => ({
    companyId: "company1",
    orderId: "o1",
    customerData: { firstName: "Mario" },
    existingCustomer: { id: "c1", firstName: "Mario" },
    ...validOrder(),
    ...overrides,
  });

  it("updates only the Order content fields with the recalculated total", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await expect(updateOrder(params())).resolves.toBeUndefined();

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith(
      { collectionName: "orders", id: "o1" },
      {
        customerId: "c1",
        items: validOrder().items,
        orderType: "takeaway",
        scheduledTime: validOrder().scheduledTime,
        total: 6.6,
        updatedAt: "server-time",
      },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("creates a new Customer in the same batch and references it", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await updateOrder(params({ existingCustomer: null, customerData: { firstName: "Anna" } }));

    expect(batch.set).toHaveBeenCalledWith(
      { collectionName: "customers", id: "new-customers" },
      expect.objectContaining({ companyId: "company1", firstName: "Anna" }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      { collectionName: "orders", id: "o1" },
      expect.objectContaining({ customerId: "new-customers" }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("updates an edited existing Customer in the same batch", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await updateOrder(params({ customerData: { firstName: "Mario", phone: "123" } }));

    expect(batch.update).toHaveBeenCalledWith(
      { collectionName: "customers", id: "c1" },
      expect.objectContaining({ phone: "123", updatedAt: "server-time" }),
    );
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("never writes status, storeId or createdAt", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await updateOrder(params({ status: "Completed", storeId: "s2", createdAt: "x" }));

    const data = batch.update.mock.calls[0][1];
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("storeId");
    expect(data).not.toHaveProperty("createdAt");
  });

  it("does not write anything when the order or the Customer is invalid", async () => {
    const batch = createBatch();
    firestore.writeBatch.mockReturnValue(batch);

    await expect(updateOrder(params({ items: [] }))).rejects.toThrow(
      "Order must have at least one item",
    );
    await expect(
      updateOrder(params({ orderType: ORDER_TYPE.DELIVERY })),
    ).rejects.toThrow("Customer phone is required for delivery");

    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("requires the Company and the Order", async () => {
    await expect(updateOrder(params({ companyId: "" }))).rejects.toThrow(
      "Company ID is required",
    );
    await expect(updateOrder(params({ orderId: "" }))).rejects.toThrow(
      "Order ID is required",
    );
  });
});

describe("updateOrderStatus", () => {
  it.each(["Pending", "In progress", "Completed"])(
    "writes the %s status and updatedAt",
    async (status) => {
      firestore.updateDoc.mockResolvedValue(undefined);

      await updateOrderStatus("o1", status);

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        { collectionName: "orders", id: "o1" },
        { status, updatedAt: "server-time" },
      );
    },
  );

  it("rejects Cancelled and unknown statuses", async () => {
    await expect(updateOrderStatus("o1", "Cancelled")).rejects.toThrow(
      "Order status is invalid",
    );
    await expect(updateOrderStatus("o1", "Done")).rejects.toThrow(
      "Order status is invalid",
    );
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("requires the Order ID", async () => {
    await expect(updateOrderStatus("", "Pending")).rejects.toThrow(
      "Order ID is required",
    );
  });
});

describe("cancelOrder", () => {
  it("sets the status to Cancelled instead of deleting", async () => {
    firestore.updateDoc.mockResolvedValue(undefined);

    await cancelOrder("o1");

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      { collectionName: "orders", id: "o1" },
      { status: "Cancelled", updatedAt: "server-time" },
    );
  });

  it("requires the Order ID", async () => {
    await expect(cancelOrder("")).rejects.toThrow("Order ID is required");
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("propagates write errors", async () => {
    firestore.updateDoc.mockRejectedValue(new Error("permission-denied"));

    await expect(cancelOrder("o1")).rejects.toThrow("permission-denied");
  });
});

describe("order constants", () => {
  it("defines the English statuses in Tableau column order", () => {
    expect(ORDER_STATUSES).toEqual(["Pending", "In progress", "Completed"]);
    expect(ORDER_STATUS.PENDING).toBe("Pending");
    expect(ORDER_STATUS.IN_PROGRESS).toBe("In progress");
    expect(ORDER_STATUS.COMPLETED).toBe("Completed");
    expect(ORDER_STATUS.CANCELLED).toBe("Cancelled");
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

  it("leaves out Cancelled orders", () => {
    const onChange = vi.fn();
    firestore.onSnapshot.mockImplementation((q, next) => {
      next({
        docs: [
          { id: "o1", data: () => ({ status: "Pending" }) },
          { id: "o2", data: () => ({ status: "Cancelled" }) },
        ],
      });
      return vi.fn();
    });

    subscribeToTodayOrders("store-1", onChange);

    expect(onChange).toHaveBeenCalledWith([{ id: "o1", status: "Pending" }]);
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
