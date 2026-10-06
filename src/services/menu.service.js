import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "./firebase";

export const getMenuByStoreId = async (storeId) => {
  const menuRef = collection(db, "menus");

  const q = query(menuRef, where("storeId", "==", storeId));

  const menusSnap = await getDocs(q);

  if (!menusSnap.empty) {
    console.log(
      ">>> Menu exists! Here is the first result:",
      menusSnap.docs[0].data(),
    );

    return menusSnap.docs[0].data();
  } else {
    console.log(">>> Menu does not exist.");

    return null;
  }
};
