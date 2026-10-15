import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getUserDB } from "./user.service";

/**
 * Reads the one Store the User can access. V1 has one admin User and one
 * Store per Company, so the Store comes from the profile's storeId rather
 * than from a query over all Stores.
 * @param {string} uid - Firebase Auth uid.
 * @returns {Promise<object>} The Store with its id.
 * @throws {Error} When the profile or the Store is missing.
 * @example
 * const store = await getAccessibleStore(user.uid);
 */
export const getAccessibleStore = async (uid) => {
  if (!uid) {
    throw new Error("User ID is required");
  }

  const user = await getUserDB(uid);

  if (!user) {
    throw new Error("User profile not found");
  }

  if (!user.storeId) {
    throw new Error("No Store available");
  }

  const storeRef = doc(db, "stores", user.storeId);

  let storeSnapshot;

  try {
    storeSnapshot = await getDoc(storeRef);
  } catch (error) {
    throw new Error("Failed to retrieve Store", { cause: error });
  }

  if (!storeSnapshot.exists()) {
    throw new Error("Store not found");
  }

  return {
    id: storeSnapshot.id,
    ...storeSnapshot.data(),
  };
};
