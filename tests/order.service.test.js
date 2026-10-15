import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((db, name) => ({ collectionName: name })),
  where: vi.fn((field, op, value) => ({ type: "where", field, op, value })),
  orderBy: vi.fn((field) => ({ type: "orderBy", field })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  getDocs: vi.fn(),
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
  editRestrictedItem,
  getDayRange,
  getOrdersByDay,
  reconfigureItem,
  sortColumnOrders,
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

describe("reconfigureItem", () => {
  // Saved when Large cost 12; the menu now says 13.2.
  const saved = {
    ...buildItemSnapshot(pizza, { size: "Large", quantity: 1 }),
    unitPrice: 12,
    subtotal: 12,
  };

  it("keeps the saved price when the size does not change", () => {
    const item = reconfigureItem(pizza, saved, {
      size: "Large",
      cookingLevel: "Rare",
      customizations: [" No basil "],
      quantity: 3,
    });

    expect(item).toMatchObject({
      size: "Large",
      cookingLevel: "Rare",
      customizations: ["No basil"],
      quantity: 3,
      unitPrice: 12,
      subtotal: 36,
    });
  });

  it("uses the current menu price when the size changes", () => {
    const item = reconfigureItem(pizza, saved, { size: "Small", quantity: 2 });

    expect(item).toMatchObject({ size: "Small", unitPrice: 9.5, subtotal: 19 });
  });

  it("keeps the saved price of a product without sizes", () => {
    const savedCola = { ...buildItemSnapshot(drink, { quantity: 1 }), unitPrice: 3, subtotal: 3 };

    expect(reconfigureItem(drink, savedCola, { quantity: 2 })).toMatchObject({
      unitPrice: 3,
      subtotal: 6,
    });
  });

  it("validates the options like a new Item", () => {
    expect(() => reconfigureItem(pizza, saved, { size: "XL", quantity: 1 })).toThrow(
      "Item size is required",
    );
  });
});

describe("editRestrictedItem", () => {
  const saved = {
    productId: "p1",
    productName: "Margherita",
    size: "Large",
    unitPrice: 12,
    quantity: 3,
    cookingLevel: "Rare",
    customizations: ["No basil"],
    subtotal: 36,
  };

  it("changes only customizations and quantity, keeping size, cooking level and price", () => {
    expect(
      editRestrictedItem(saved, { customizations: [" Well cut ", ""], quantity: 2 }, 3),
    ).toEqual({ ...saved, customizations: ["Well cut"], quantity: 2, subtotal: 24 });
  });

  it("allows the saved quantity but not more", () => {
    expect(editRestrictedItem(saved, { customizations: [], quantity: 3 }, 3).quantity).toBe(3);
    expect(() => editRestrictedItem(saved, { customizations: [], quantity: 4 }, 3)).toThrow(
      "Item quantity cannot exceed the quantity in the ticket",
    );
  });

  it("requires a positive integer quantity", () => {
    expect(() => editRestrictedItem(saved, { customizations: [], quantity: 0 }, 3)).toThrow(
      "Item quantity must be a positive integer",
    );
  });

  it("changes the cooking level of an unavailable Product still in the Menu", () => {
    const product = {
      id: "p1",
      isAvailable: false,
      availableCookingLevels: ["Rare", "Well done"],
    };

    expect(
      editRestrictedItem(
        saved,
        { cookingLevel: "Well done", customizations: [], quantity: 3 },
        3,
        product,
      ),
    ).toEqual({ ...saved, cookingLevel: "Well done", customizations: [] });
    expect(() =>
      editRestrictedItem(
        saved,
        { cookingLevel: "Burnt", customizations: [], quantity: 3 },
        3,
        product,
      ),
    ).toThrow("Item cooking level is invalid");
  });

  it("keeps the saved cooking level when the Product is deleted or has no levels", () => {
    const options = { cookingLevel: "Well done", customizations: [], quantity: 3 };

    expect(editRestrictedItem(saved, options, 3).cookingLevel).toBe("Rare");
    expect(
      editRestrictedItem(saved, options, 3, { id: "p1", availableCookingLevels: [] })
        .cookingLevel,
    ).toBe("Rare");
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
  it.each(["Pending", "In progress"])(
    "writes the %s status, clears completedAt and sets updatedAt",
    async (status) => {
      firestore.updateDoc.mockResolvedValue(undefined);

      await updateOrderStatus("o1", status);

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        { collectionName: "orders", id: "o1" },
        { status, completedAt: null, updatedAt: "server-time" },
      );
    },
  );

  it("records completedAt when the Order moves to Completed", async () => {
    firestore.updateDoc.mockResolvedValue(undefined);

    await updateOrderStatus("o1", "Completed");

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      { collectionName: "orders", id: "o1" },
      { status: "Completed", completedAt: "server-time", updatedAt: "server-time" },
    );
  });

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

describe("sortColumnOrders", () => {
  // Firestore-like Timestamp at the given hour of a fixed day.
  const at = (hour, minute = 0) => {
    const millis = new Date(2026, 9, 12, hour, minute).getTime();
    return { toMillis: () => millis };
  };
  const ids = (orders) => orders.map((order) => order.id);

  it("orders Pending and In progress by scheduled time, earliest first", () => {
    const orders = [
      { id: "a", scheduledTime: at(20) },
      { id: "b", scheduledTime: at(19, 30) },
      { id: "c", scheduledTime: new Date(2026, 9, 12, 19, 45) },
    ];

    expect(ids(sortColumnOrders("Pending", orders))).toEqual(["b", "c", "a"]);
    expect(ids(sortColumnOrders("In progress", orders))).toEqual(["b", "c", "a"]);
  });

  it("orders Completed by completion time, latest first", () => {
    const orders = [
      { id: "a", completedAt: at(19), updatedAt: at(21) },
      { id: "b", completedAt: at(20) },
      { id: "c", completedAt: at(19, 30) },
    ];

    expect(ids(sortColumnOrders("Completed", orders))).toEqual(["b", "c", "a"]);
  });

  it("puts pending completion times first and Orders without completedAt last", () => {
    const orders = [
      { id: "old1", updatedAt: at(21) },
      { id: "done", completedAt: at(19), updatedAt: at(22) },
      { id: "old2", updatedAt: at(18) },
      { id: "local", completedAt: null, updatedAt: null },
    ];

    // updatedAt is ignored: an edit never moves a ticket.
    expect(ids(sortColumnOrders("Completed", orders))).toEqual([
      "local",
      "done",
      "old1",
      "old2",
    ]);
  });

  it("keeps the received order on ties and does not mutate the input", () => {
    const orders = [
      { id: "a", scheduledTime: at(20) },
      { id: "b", scheduledTime: at(20) },
      { id: "c" },
      { id: "d" },
    ];

    expect(ids(sortColumnOrders("Pending", orders))).toEqual(["a", "b", "c", "d"]);
    expect(ids(orders)).toEqual(["a", "b", "c", "d"]);
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

describe("getDayRange", () => {
  it("returns local midnight today and tomorrow", () => {
    const { start, end } = getDayRange(new Date(2026, 9, 9, 15, 30, 45));

    expect(start).toEqual(new Date(2026, 9, 9, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2026, 9, 10, 0, 0, 0, 0));
  });

  it("treats the last millisecond of the day as today", () => {
    const { start, end } = getDayRange(new Date(2026, 9, 9, 23, 59, 59, 999));

    expect(start).toEqual(new Date(2026, 9, 9));
    expect(end).toEqual(new Date(2026, 9, 10));
  });

  it("rolls over month and year boundaries", () => {
    const { start, end } = getDayRange(new Date(2026, 11, 31, 12));

    expect(start).toEqual(new Date(2026, 11, 31));
    expect(end).toEqual(new Date(2027, 0, 1));
  });
});

describe("getDayRange", () => {
  it("defaults to today", () => {
    const { start } = getDayRange();
    const now = new Date();

    expect(start).toEqual(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  });
});

describe("getOrdersByDay", () => {
  it("queries the Store's orders created on the given day", async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await getOrdersByDay("store-1", new Date(2026, 9, 5, 18, 30));

    const [ref, storeFilter, fromFilter, toFilter, order] =
      firestore.query.mock.calls[0];

    expect(ref).toEqual({ collectionName: "orders" });
    expect(storeFilter).toMatchObject({
      field: "storeId",
      op: "==",
      value: "store-1",
    });
    expect(fromFilter).toMatchObject({
      field: "createdAt",
      op: ">=",
      value: new Date(2026, 9, 5),
    });
    expect(toFilter).toMatchObject({
      field: "createdAt",
      op: "<",
      value: new Date(2026, 9, 6),
    });
    expect(order).toEqual({ type: "orderBy", field: "createdAt" });
    expect(firestore.getDocs).toHaveBeenCalledTimes(1);
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it("returns plain orders newest first, Cancelled included", async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        { id: "o1", data: () => ({ status: "Completed" }) },
        { id: "o2", data: () => ({ status: "Cancelled" }) },
        { id: "o3", data: () => ({ status: "Pending" }) },
      ],
    });

    const orders = await getOrdersByDay("store-1", new Date(2026, 9, 5));

    expect(orders).toEqual([
      { id: "o3", status: "Pending" },
      { id: "o2", status: "Cancelled" },
      { id: "o1", status: "Completed" },
    ]);
  });

  it("returns an empty list when there are no orders", async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await expect(
      getOrdersByDay("store-1", new Date(2026, 9, 5)),
    ).resolves.toEqual([]);
  });

  it("propagates read errors", async () => {
    firestore.getDocs.mockRejectedValue(new Error("permission-denied"));

    await expect(
      getOrdersByDay("store-1", new Date(2026, 9, 5)),
    ).rejects.toThrow("permission-denied");
  });

  it("rejects a missing Store ID", async () => {
    await expect(getOrdersByDay("", new Date())).rejects.toThrow(
      "Store ID is required",
    );
    expect(firestore.getDocs).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid date", async () => {
    await expect(getOrdersByDay("store-1")).rejects.toThrow(
      "Valid date is required",
    );
    await expect(
      getOrdersByDay("store-1", new Date("not a date")),
    ).rejects.toThrow("Valid date is required");
    expect(firestore.getDocs).not.toHaveBeenCalled();
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

describe("order field limits", () => {
  const itemsOf = (count) =>
    Array.from({ length: count }, () => buildItemSnapshot(drink, { quantity: 1 }));
  const withItem = (changes) => ({
    ...validOrder(),
    items: [{ ...validOrder().items[0], ...changes }],
  });

  it("accepts 1 and 50 items and rejects 0 and 51", () => {
    expect(validateOrder({ ...validOrder(), items: itemsOf(1) }).items).toHaveLength(1);
    expect(validateOrder({ ...validOrder(), items: itemsOf(50) }).items).toHaveLength(50);
    expect(() => validateOrder({ ...validOrder(), items: itemsOf(0) })).toThrow(
      "Order must have at least one item",
    );
    expect(() => validateOrder({ ...validOrder(), items: itemsOf(51) })).toThrow(
      "Order must have at most 50 elements",
    );
  });

  it("applies the item count limits on create and edit", async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };
    firestore.writeBatch.mockReturnValue(batch);
    const base = {
      companyId: "company1",
      orderId: "o1",
      storeId: "store1",
      customerData: { firstName: "Mario" },
      ...validOrder(),
    };

    for (const count of [0, 51]) {
      await expect(createOrder({ ...base, items: itemsOf(count) })).rejects.toThrow();
      await expect(updateOrder({ ...base, items: itemsOf(count) })).rejects.toThrow();
    }
    await expect(createOrder({ ...base, items: itemsOf(50) })).resolves.toBeDefined();
    await expect(updateOrder({ ...base, items: itemsOf(50) })).resolves.toBeUndefined();
  });

  it("rejects an invalid quantity", () => {
    for (const quantity of [0, 1.5])
      expect(() => validateOrder(withItem({ quantity }))).toThrow(
        "Item quantity must be a positive integer",
      );
  });

  it("rejects negative or non-finite prices and a missing product", () => {
    expect(() => validateOrder(withItem({ unitPrice: -1 }))).toThrow(
      "Item unit price must be a non-negative number",
    );
    expect(() => validateOrder(withItem({ subtotal: -1 }))).toThrow(
      "Item subtotal must be a non-negative number",
    );
    expect(() => validateOrder(withItem({ subtotal: Infinity }))).toThrow(
      "Item subtotal must be a non-negative number",
    );
    expect(() => validateOrder(withItem({ productId: " " }))).toThrow(
      "Item product ID is required",
    );
    expect(() => validateOrder(withItem({ productName: "" }))).toThrow(
      "Item product name is required",
    );
  });

  it("limits the customizations of a saved item", () => {
    const texts = (count, length = 1) => Array.from({ length: count }, () => "a".repeat(length));

    expect(() => validateOrder(withItem({ customizations: texts(50, 100) }))).not.toThrow();
    expect(() => validateOrder(withItem({ customizations: texts(51) }))).toThrow(
      "Item customizations must have at most 50 elements",
    );
    expect(() => validateOrder(withItem({ customizations: texts(1, 101) }))).toThrow(
      "Each item customization must be at most 100 characters",
    );
  });

  it("limits the customizations when items are built or edited", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `c${i}`);
    const tooLong = ["a".repeat(101)];

    expect(() => buildItemSnapshot(drink, { quantity: 1, customizations: tooMany })).toThrow(
      "Item customizations must have at most 50 elements",
    );
    expect(() => buildItemSnapshot(drink, { quantity: 1, customizations: tooLong })).toThrow(
      "Each item customization must be at most 100 characters",
    );

    const item = buildItemSnapshot(drink, { quantity: 2 });
    expect(() => editRestrictedItem(item, { customizations: tooLong, quantity: 1 }, 2)).toThrow(
      "Each item customization must be at most 100 characters",
    );
  });
});
