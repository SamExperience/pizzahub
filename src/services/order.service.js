import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { addCustomerToBatch } from "./customer.service";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { assertMaxItems, assertMaxLength } from "../utils/textValidation";
import { db } from "./firebase";

/**
 * Order statuses as stored in Firestore. The values are the labels shown in
 * the UI, so they stay in English and must match the security rules.
 * @enum {string}
 * @example
 * order.status === ORDER_STATUS.PENDING;
 */
export const ORDER_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  // Soft delete: final, hidden from the Tableau, kept for history.
  CANCELLED: "Cancelled",
};

/**
 * Active statuses, ordered as the Tableau columns; Cancelled is left out
 * because it never appears on the Tableau.
 * @type {string[]}
 * @example
 * ORDER_STATUSES.map((status) => <TableauColumn key={status} status={status} />);
 */
export const ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.COMPLETED,
];

/**
 * Order types. Delivery requires a full Customer address and phone.
 * @enum {string}
 * @example
 * validateCustomer(data, ORDER_TYPE.DELIVERY);
 */
export const ORDER_TYPE = {
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
};

/**
 * Rounds an amount to cents.
 * @private
 * @param {number} value
 * @returns {number}
 * @example
 * roundPrice(0.1 + 0.2); // 0.3
 */
const roundPrice = (value) => Math.round(value * 100) / 100;

// Trimmed, non-empty customization texts; at most LIST_SIZE of at most
// LIST_ITEM characters each.
/**
 * Keeps only the string customizations, trimmed and non-empty, and checks
 * the list size and text length limits.
 * @private
 * @param {string[]} [customizations]
 * @returns {string[]}
 * @throws {Error} When there are too many customizations or one is too long.
 * @example
 * normalizeCustomizations([" No basil ", ""]); // ["No basil"]
 */
const normalizeCustomizations = (customizations = []) => {
  const texts = customizations
    .filter((text) => typeof text === "string")
    .map((text) => text.trim())
    .filter(Boolean);

  assertMaxItems(texts, FIELD_LIMITS.LIST_SIZE, "Item customizations");
  texts.forEach((text) =>
    assertMaxLength(text, FIELD_LIMITS.LIST_ITEM, "Each item customization"),
  );

  return texts;
};

/**
 * Tells whether the value is a finite number greater than or equal to 0.
 * @private
 * @param {*} value
 * @returns {boolean}
 * @example
 * isNonNegativeNumber(12.5); // true
 */
const isNonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Tells whether the value is a string with at least one non-blank character.
 * @private
 * @param {*} value
 * @returns {boolean}
 * @example
 * isNonEmptyString("  "); // false
 */
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

// Shape of a saved Item, checked before the Order is written.
/**
 * Checks an Item snapshot: product id and name, positive integer quantity,
 * non-negative unit price and subtotal, and a customizations text list
 * within the limits.
 * @private
 * @param {object} item
 * @throws {Error} When a field is missing, invalid or too long.
 * @example
 * items.forEach(validateOrderItem);
 */
const validateOrderItem = (item) => {
  if (!item || typeof item !== "object") throw new Error("Order item is invalid");

  if (!isNonEmptyString(item.productId))
    throw new Error("Item product ID is required");

  if (!isNonEmptyString(item.productName))
    throw new Error("Item product name is required");

  if (!Number.isInteger(item.quantity) || item.quantity < 1)
    throw new Error("Item quantity must be a positive integer");

  if (!isNonNegativeNumber(item.unitPrice))
    throw new Error("Item unit price must be a non-negative number");

  if (!isNonNegativeNumber(item.subtotal))
    throw new Error("Item subtotal must be a non-negative number");

  if (!Array.isArray(item.customizations))
    throw new Error("Item customizations must be an array");

  assertMaxItems(item.customizations, FIELD_LIMITS.LIST_SIZE, "Item customizations");
  item.customizations.forEach((text) => {
    if (typeof text !== "string")
      throw new Error("Item customizations must be text");

    assertMaxLength(text, FIELD_LIMITS.LIST_ITEM, "Each item customization");
  });
};

/**
 * Builds the Item snapshot for a Product and the options chosen on the
 * ticket. The Product data is copied (name, size, unit price) so historical
 * Orders stay correct when the Menu changes or the Product is deleted.
 * @param {object} product - Available Product with its id.
 * @param {object} options
 * @param {string} [options.size] - Required when the Product has sizes.
 * @param {string} [options.cookingLevel] - Defaults to the Product default.
 * @param {string[]} [options.customizations]
 * @param {number} options.quantity - Positive integer.
 * @returns {object} The Item with unitPrice and subtotal.
 * @example
 * buildItemSnapshot({ id: "p1", name: "Margherita", price: 12, isAvailable: true }, { quantity: 2 });
 * // { productName: "Margherita", unitPrice: 12, quantity: 2, subtotal: 24, ... }
 */
export const buildItemSnapshot = (
  product,
  { size, cookingLevel, customizations = [], quantity } = {},
) => {
  if (!product?.id) throw new Error("Product is required");

  if (!product.isAvailable) throw new Error("Product is not available");

  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Item quantity must be a positive integer");

  let unitPrice = product.price;
  let sizeName = null;

  if (product.sizes?.length) {
    const selectedSize = product.sizes.find((item) => item.name === size);

    if (!selectedSize) throw new Error("Item size is required");

    sizeName = selectedSize.name;
    unitPrice = selectedSize.price;
  } else if (size) {
    throw new Error("Product has no sizes");
  }

  let selectedCookingLevel = null;

  if (product.availableCookingLevels?.length) {
    selectedCookingLevel = cookingLevel ?? product.defaultCookingLevel;

    if (!product.availableCookingLevels.includes(selectedCookingLevel))
      throw new Error("Item cooking level is invalid");
  } else if (cookingLevel) {
    throw new Error("Product has no cooking levels");
  }

  return {
    productId: product.id,
    productName: product.name,
    size: sizeName,
    unitPrice,
    quantity,
    cookingLevel: selectedCookingLevel,
    customizations: normalizeCustomizations(customizations),
    subtotal: roundPrice(unitPrice * quantity),
  };
};

/**
 * Returns a reconfigured copy of an existing Item for its sellable Product.
 * The saved unit price is kept unless the size changes (a menu price change
 * must not silently reprice an accepted order); then the current menu price
 * of the new size applies.
 * @param {object} product - Current sellable Product.
 * @param {object} item - Item saved in the ticket.
 * @param {object} options - Same options as buildItemSnapshot.
 * @returns {object} The new Item.
 * @example
 * reconfigureItem(product, item, { size: item.size, quantity: 3 }); // keeps item.unitPrice
 */
export const reconfigureItem = (product, item, options) => {
  const next = buildItemSnapshot(product, options);

  if (next.size !== item.size) return next;

  return {
    ...next,
    unitPrice: item.unitPrice,
    subtotal: roundPrice(item.unitPrice * next.quantity),
  };
};

/**
 * Restricted edit of an Item whose Product is no longer sellable: only the
 * customizations and a quantity between 1 and maxQuantity (the quantity
 * saved in the ticket) can change; size and price are kept, so the kitchen
 * never gets more of something it no longer sells. product is the
 * unavailable Product still in the Menu (null when deleted): its cooking
 * levels stay selectable because they do not affect the price; otherwise the
 * saved cooking level is kept.
 * @param {object} item - Item saved in the ticket.
 * @param {object} changes
 * @param {string[]} changes.customizations
 * @param {number} changes.quantity
 * @param {string} [changes.cookingLevel]
 * @param {number} maxQuantity
 * @param {?object} [product] - Unavailable Product, or null when deleted.
 * @returns {object} The edited Item.
 * @example
 * editRestrictedItem(item, { customizations: ["No basil"], quantity: 1 }, 2);
 */
export const editRestrictedItem = (
  item,
  { customizations, quantity, cookingLevel },
  maxQuantity,
  product = null,
) => {
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Item quantity must be a positive integer");

  if (quantity > maxQuantity)
    throw new Error("Item quantity cannot exceed the quantity in the ticket");

  let nextCookingLevel = item.cookingLevel;

  if (product?.availableCookingLevels?.length) {
    nextCookingLevel = cookingLevel ?? item.cookingLevel;

    if (!product.availableCookingLevels.includes(nextCookingLevel))
      throw new Error("Item cooking level is invalid");
  }

  return {
    ...item,
    cookingLevel: nextCookingLevel,
    customizations: normalizeCustomizations(customizations),
    quantity,
    subtotal: roundPrice(item.unitPrice * quantity),
  };
};

/**
 * Returns a copy of an Item snapshot with a new quantity and the
 * recalculated subtotal, keeping the saved unit price (used by the +/- of
 * the ticket summary).
 * @param {object} item
 * @param {number} quantity - Positive integer.
 * @returns {object}
 * @example
 * updateItemQuantity({ unitPrice: 12, quantity: 1, subtotal: 12 }, 3); // subtotal 36
 */
export const updateItemQuantity = (item, quantity) => {
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Item quantity must be a positive integer");

  return { ...item, quantity, subtotal: roundPrice(item.unitPrice * quantity) };
};

/**
 * Order total: sum of the Item subtotals, rounded to cents to avoid
 * floating point leftovers such as 0.30000000000000004.
 * @param {object[]} [items]
 * @returns {number}
 * @example
 * calculateOrderTotal([{ subtotal: 0.1 }, { subtotal: 0.2 }]); // 0.3
 */
export const calculateOrderTotal = (items = []) =>
  roundPrice(items.reduce((sum, item) => sum + item.subtotal, 0));

/**
 * Validates the Order data (customer excluded) and returns it with the
 * total. The total is always recalculated here, never taken from the UI.
 * @param {object} order
 * @param {object[]} order.items - 1 to 50 Item snapshots.
 * @param {"takeaway"|"delivery"} order.orderType
 * @param {Date} order.scheduledTime
 * @returns {{items: object[], orderType: string, scheduledTime: Date, total: number}}
 * @example
 * validateOrder({ items, orderType: "takeaway", scheduledTime: new Date() });
 */
export const validateOrder = ({ items, orderType, scheduledTime }) => {
  if (!Object.values(ORDER_TYPE).includes(orderType))
    throw new Error("Order type is invalid");

  if (!Array.isArray(items) || items.length === 0)
    throw new Error("Order must have at least one item");

  assertMaxItems(items, FIELD_LIMITS.LIST_SIZE, "Order");
  items.forEach(validateOrderItem);

  if (!(scheduledTime instanceof Date) || Number.isNaN(scheduledTime.getTime()))
    throw new Error("Scheduled time is required");

  const total = calculateOrderTotal(items);

  if (!isNonNegativeNumber(total)) throw new Error("Order total is invalid");

  return { items, orderType, scheduledTime, total };
};

/**
 * Creates the Order with status Pending. The Customer (created or updated
 * when changed) and the Order are written in a single batch, so a ticket is
 * never saved without its Customer.
 * @param {object} data
 * @param {string} data.companyId
 * @param {string} data.storeId
 * @param {"takeaway"|"delivery"} data.orderType
 * @param {Date} data.scheduledTime
 * @param {object[]} data.items
 * @param {object} data.customerData - Customer form values.
 * @param {?object} [data.existingCustomer]
 * @returns {Promise<string>} The new Order id.
 * @example
 * const orderId = await createOrder({
 *   companyId, storeId, orderType: "takeaway", scheduledTime, items,
 *   customerData: { firstName: "Mario" },
 * });
 */
export const createOrder = async ({
  companyId,
  storeId,
  orderType,
  scheduledTime,
  items,
  customerData,
  existingCustomer = null,
}) => {
  if (!companyId) throw new Error("Company ID is required");

  if (!storeId) throw new Error("Store ID is required");

  const order = validateOrder({ items, orderType, scheduledTime });
  const batch = writeBatch(db);

  const customerId = addCustomerToBatch(batch, {
    companyId,
    orderType,
    data: customerData,
    existingCustomer,
  });

  const orderRef = doc(collection(db, "orders"));

  batch.set(orderRef, {
    storeId,
    customerId,
    ...order,
    status: ORDER_STATUS.PENDING,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return orderRef.id;
};

/**
 * Updates the content of an existing Order: customer, order type, scheduled
 * time, items and total. The Customer (created or updated when changed) and
 * the Order are written in a single batch. Status, storeId and createdAt are
 * never written here: they are immutable or changed only by status moves.
 * @param {object} data
 * @param {string} data.companyId
 * @param {string} data.orderId
 * @param {"takeaway"|"delivery"} data.orderType
 * @param {Date} data.scheduledTime
 * @param {object[]} data.items
 * @param {object} data.customerData
 * @param {?object} [data.existingCustomer]
 * @returns {Promise<void>}
 * @example
 * await updateOrder({ companyId, orderId: "order1", orderType, scheduledTime, items, customerData });
 */
export const updateOrder = async ({
  companyId,
  orderId,
  orderType,
  scheduledTime,
  items,
  customerData,
  existingCustomer = null,
}) => {
  if (!companyId) throw new Error("Company ID is required");

  if (!orderId) throw new Error("Order ID is required");

  const order = validateOrder({ items, orderType, scheduledTime });
  const batch = writeBatch(db);

  const customerId = addCustomerToBatch(batch, {
    companyId,
    orderType,
    data: customerData,
    existingCustomer,
  });

  batch.update(doc(db, "orders", orderId), {
    customerId,
    ...order,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Moves an Order to one of the active Tableau statuses. completedAt records
 * when the Order moved to Completed (server time, to sort the Completed
 * column) and is cleared when it moves back.
 * @param {string} orderId
 * @param {string} status - One of ORDER_STATUSES.
 * @returns {Promise<void>}
 * @example
 * await updateOrderStatus("order1", ORDER_STATUS.IN_PROGRESS);
 */
export const updateOrderStatus = async (orderId, status) => {
  if (!orderId) throw new Error("Order ID is required");

  if (!ORDER_STATUSES.includes(status)) throw new Error("Order status is invalid");

  await updateDoc(doc(db, "orders", orderId), {
    status,
    completedAt: status === ORDER_STATUS.COMPLETED ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
};

// Milliseconds of a Firestore Timestamp or Date; null when missing.
/**
 * Converts a Firestore Timestamp or a Date to milliseconds since the epoch;
 * any other value gives null.
 * @private
 * @param {?(Timestamp|Date)} value
 * @returns {?number}
 * @example
 * toMillis(order.scheduledTime); // 1760545800000
 */
const toMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();

  return value instanceof Date ? value.getTime() : null;
};

/**
 * Sorts the Orders of one Tableau column: Pending and In progress by
 * scheduled time (earliest first, what the kitchen must prepare next);
 * Completed by completion time (latest first). In Completed, a pending
 * server timestamp (null right after the local write) counts as the latest,
 * and Orders completed before completedAt existed (field absent) go last;
 * edits never move a ticket. Ties keep the received order (creation time).
 * @param {string} status - Column status.
 * @param {object[]} orders
 * @returns {object[]} A new sorted array.
 * @example
 * const pending = sortColumnOrders(ORDER_STATUS.PENDING, ordersByStatus.Pending);
 */
export const sortColumnOrders = (status, orders) => {
  const compare = (x, y) => (x === y ? 0 : x - y);

  if (status === ORDER_STATUS.COMPLETED) {
    const completedAt = (order) => {
      if (order.completedAt === undefined) return -Infinity;

      return toMillis(order.completedAt) ?? Infinity;
    };

    return [...orders].sort((a, b) => compare(completedAt(b), completedAt(a)));
  }

  const scheduledAt = (order) => toMillis(order.scheduledTime) ?? Infinity;

  return [...orders].sort((a, b) => compare(scheduledAt(a), scheduledAt(b)));
};

/**
 * Cancels an Order (soft delete): the Order is kept with status Cancelled,
 * so it disappears from the Tableau but stays in the order history. The
 * rules forbid deleting Orders.
 * @param {string} orderId
 * @returns {Promise<void>}
 * @example
 * await cancelOrder("order1");
 */
export const cancelOrder = async (orderId) => {
  if (!orderId) throw new Error("Order ID is required");

  await updateDoc(doc(db, "orders", orderId), {
    status: ORDER_STATUS.CANCELLED,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Day of the given date (default today) in the device time zone, as a
 * half-open range [start, end) where end is the next day at 00:00, so an
 * Order at 23:59:59.999 is still included and none is counted twice.
 * @param {Date} [date]
 * @returns {{start: Date, end: Date}}
 * @example
 * getDayRange(new Date(2026, 9, 15, 18, 30));
 * // { start: 2026-10-15 00:00, end: 2026-10-16 00:00 }
 */
export const getDayRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return { start, end };
};

// Query of the Orders created on a day for a Store, oldest first.
/**
 * Builds the Firestore query of a Store's Orders whose createdAt falls in
 * the day range of the given date, ordered by createdAt ascending.
 * @private
 * @param {string} storeId
 * @param {Date} date
 * @returns {Query}
 * @example
 * const snapshot = await getDocs(dayOrdersQuery("store1", new Date()));
 */
const dayOrdersQuery = (storeId, date) => {
  const { start, end } = getDayRange(date);

  return query(
    collection(db, "orders"),
    where("storeId", "==", storeId),
    where("createdAt", ">=", start),
    where("createdAt", "<", end),
    orderBy("createdAt"),
  );
};

/**
 * Reads once the Orders created on a day for a Store, newest first.
 * Cancelled Orders are included because the order history shows them. One
 * read instead of a listener: history does not need real-time updates.
 * @param {string} storeId
 * @param {Date} date
 * @returns {Promise<object[]>}
 * @example
 * const orders = await getOrdersByDay("store1", new Date());
 */
export const getOrdersByDay = async (storeId, date) => {
  if (!storeId) throw new Error("Store ID is required");

  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new Error("Valid date is required");

  const snapshot = await getDocs(dayOrdersQuery(storeId, date));

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
};

/**
 * Listens to the Orders created today for a Store, oldest first, with a
 * single real-time listener feeding all Tableau columns. Cancelled Orders
 * are left out. Calls onChange with the full list at every change.
 * @param {string} storeId
 * @param {function(object[]): void} onChange
 * @param {function(Error): void} [onError]
 * @returns {function(): void} Unsubscribe function.
 * @example
 * const stop = subscribeToTodayOrders("store1", setOrders, setError);
 */
export const subscribeToTodayOrders = (storeId, onChange, onError) => {
  if (!storeId) throw new Error("Store ID is required");

  if (typeof onChange !== "function")
    throw new Error("onChange callback is required");

  return onSnapshot(
    dayOrdersQuery(storeId, new Date()),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((order) => order.status !== ORDER_STATUS.CANCELLED),
      );
    },
    onError,
  );
};
