import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { addCustomerToBatch } from "./customer.service";
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
    customizations: customizations
      .filter((text) => typeof text === "string")
      .map((text) => text.trim())
      .filter(Boolean),
    subtotal: roundPrice(unitPrice * quantity),
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

  if (!(scheduledTime instanceof Date) || Number.isNaN(scheduledTime.getTime()))
    throw new Error("Scheduled time is required");

  return { items, orderType, scheduledTime, total: calculateOrderTotal(items) };
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

// Moves an Order to one of the active Tableau statuses.
export const updateOrderStatus = async (orderId, status) => {
  if (!orderId) throw new Error("Order ID is required");

  if (!ORDER_STATUSES.includes(status)) throw new Error("Order status is invalid");

  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

// Cancels an Order (soft delete): the Order is kept with status Cancelled.
export const cancelOrder = async (orderId) => {
  if (!orderId) throw new Error("Order ID is required");

  await updateDoc(doc(db, "orders", orderId), {
    status: ORDER_STATUS.CANCELLED,
    updatedAt: serverTimestamp(),
  });
};

// Current day in the device time zone: [start, end), end is tomorrow at 00:00.
export const getTodayRange = (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return { start, end };
};

// Listens to the Orders created today for a Store, oldest first; Cancelled
// Orders are left out. Calls onChange with the full list at every change and
// returns the unsubscribe function.
export const subscribeToTodayOrders = (storeId, onChange, onError) => {
  if (!storeId) throw new Error("Store ID is required");

  if (typeof onChange !== "function")
    throw new Error("onChange callback is required");

  const { start, end } = getTodayRange();

  const q = query(
    collection(db, "orders"),
    where("storeId", "==", storeId),
    where("createdAt", ">=", start),
    where("createdAt", "<", end),
    orderBy("createdAt"),
  );

  return onSnapshot(
    q,
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
