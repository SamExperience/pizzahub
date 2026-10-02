import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const getUserDB = async (uid) => {
  //reference
  const ref = doc(db, `users`, uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    console.log("User Exist!!!", snap.data());
    return snap.data();
  } else {
    console.log("Service: User NOT  Exist!!!");
  }
};
