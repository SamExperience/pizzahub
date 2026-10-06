import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

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

export const createMenu = async (storeId, nameMenu) => {
  const menuRef = collection(db, "menus");

  const data = {
    storeId: storeId,
    name: nameMenu,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const menuSnap = await addDoc(menuRef, data);
  console.log(">>>Menu created");

  return {
    id: menuSnap.id,
    ...data,
  };
};
