import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const getUserDB = async (uid) => {
  //reference
  const ref = doc(db, `users`, uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  }
};
