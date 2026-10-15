import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Reads the User profile (users/{uid}). Undefined means the account exists
 * in Auth but onboarding was never completed.
 * @param {string} uid - Firebase Auth uid.
 * @returns {Promise<(object|undefined)>} Profile with companyId, storeId, role.
 * @example
 * const profile = await getUserDB(user.uid);
 * if (!profile) navigate("/onboarding");
 */
export const getUserDB = async (uid) => {
  const ref = doc(db, `users`, uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  }
};
