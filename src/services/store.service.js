import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getUserDB } from "./user.service";

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
