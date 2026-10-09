import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { getCategoriesByMenuId } from "./category.service";
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

    return { id: menusSnap.docs[0].id, ...menusSnap.docs[0].data() };
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

// A Menu is ready when at least one Category holds at least one Product.
export const isMenuReady = async (storeId) => {
  const menu = await getMenuByStoreId(storeId);
  if (!menu) return false;

  const categories = await getCategoriesByMenuId(menu.id);

  for (const category of categories) {
    const q = query(
      collection(db, "products"),
      where("categoryId", "==", category.id),
      limit(1),
    );

    if (!(await getDocs(q)).empty) return true;
  }

  return false;
};
