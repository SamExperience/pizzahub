import { doc, getDoc } from "firebase/firestore";

import { db } from "./firebase";

// Reads a Customer by id; returns null when it does not exist.
export const getCustomer = async (customerId) => {
  if (!customerId) throw new Error("Customer ID is required");

  const snapshot = await getDoc(doc(db, "customers", customerId));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};
