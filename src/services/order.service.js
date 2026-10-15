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

export const ORDER_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  // Soft delete: final, hidden from the Tableau, kept for history.
  CANCELLED: "Cancelled",
};

// Active statuses, ordered as the Tableau columns
export const ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.COMPLETED,
];

export const ORDER_TYPE = {
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
};

const roundPrice = (value) => Math.round(value * 100) / 100;

// Trimmed, non-empty customization texts; at most LIST_SIZE of at most
// LIST_ITEM characters each.
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

const isNonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim() !== "";

// Shape of a saved Item, checked before the Order is written.
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

// Item snapshot for a Product and the options chosen on the ticket. The
// Product data is copied so historical Orders stay correct.
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

// Reconfigured copy of an existing Item for its sellable Product. The saved
// unit price is kept unless the size changes; then the current menu price
// of the new size applies.
export const reconfigureItem = (product, item, options) => {
  const next = buildItemSnapshot(product, options);

  if (next.size !== item.size) return next;

  return {
    ...next,
    unitPrice: item.unitPrice,
    subtotal: roundPrice(item.unitPrice * next.quantity),
  };
};

// Restricted edit of an Item whose Product is no longer sellable: only the
// customizations and a quantity between 1 and maxQuantity (the quantity
// saved in the ticket) can change; size and price are kept. product is the
// unavailable Product still in the Menu (null when deleted): its cooking
// levels stay selectable because they do not affect the price; otherwise the
// saved cooking level is kept.
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

// Copy of an Item snapshot with a new quantity and the recalculated subtotal.
export const updateItemQuantity = (item, quantity) => {
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("Item quantity must be a positive integer");

  return { ...item, quantity, subtotal: roundPrice(item.unitPrice * quantity) };
};

// Order total: sum of the Item subtotals.
export const calculateOrderTotal = (items = []) =>
  roundPrice(items.reduce((sum, item) => sum + item.subtotal, 0));

// Validates the Order data (customer excluded) and returns it with the total.
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

// Creates the Order with status Pending. The Customer (created or updated
// when changed) and the Order are written in a single batch. Returns the
// new Order id.
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

// Updates the content of an existing Order: customer, order type, scheduled
// time, items and total. The Customer (created or updated when changed) and
// the Order are written in a single batch. Status, storeId and createdAt are
// never written here.
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

// Moves an Order to one of the active Tableau statuses. completedAt records
// when the Order moved to Completed and is cleared when it moves back.
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
const toMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();

  return value instanceof Date ? value.getTime() : null;
};

// Orders of one Tableau column in display order: Pending and In progress by
// scheduled time (earliest first); Completed by completion time (latest
// first). In Completed, a pending server timestamp (null right after the
// local write) counts as the latest, and Orders completed before completedAt
// existed (field absent) go last; edits never move a ticket. Ties keep the
// received order (creation time). Returns a new array.
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

// Cancels an Order (soft delete): the Order is kept with status Cancelled.
export const cancelOrder = async (orderId) => {
  if (!orderId) throw new Error("Order ID is required");

  await updateDoc(doc(db, "orders", orderId), {
    status: ORDER_STATUS.CANCELLED,
    updatedAt: serverTimestamp(),
  });
};

// Day of the given date (default today) in the device time zone: [start, end),
// end is the next day at 00:00.
export const getDayRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return { start, end };
};

// Query of the Orders created on a day for a Store, oldest first.
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

// Reads once the Orders created on a day for a Store, newest first; Cancelled
// Orders are included (order history).
export const getOrdersByDay = async (storeId, date) => {
  if (!storeId) throw new Error("Store ID is required");

  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new Error("Valid date is required");

  const snapshot = await getDocs(dayOrdersQuery(storeId, date));

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
};

// Listens to the Orders created today for a Store, oldest first; Cancelled
// Orders are left out. Calls onChange with the full list at every change and
// returns the unsubscribe function.
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
