import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export const ORDER_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

// Ordered as the Tableau columns
export const ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.COMPLETED,
];

export const ORDER_TYPE = {
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
};

// Current day in the device time zone: [start, end), end is tomorrow at 00:00.
export const getTodayRange = (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return { start, end };
};

// Listens to the Orders created today for a Store, oldest first.
// Calls onChange with the full list at every change and returns the
// unsubscribe function.
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
      onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    },
    onError,
  );
};
