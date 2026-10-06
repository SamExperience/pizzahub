import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export const createCategory = async (menuId, nameCategory, position) => {
  const categoryRef = collection(db, "categories");

  const data = {
    menuId: menuId,
    name: nameCategory,
    position: position,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const categorySnap = await addDoc(categoryRef, data);
  console.log(`Category ${nameCategory} created`);

  return {
    id: categorySnap.id,
    ...data,
  };
};

export const getCategoriesByMenuId = async (menuId) => {
  const categoryRef = collection(db, "categories");
  const q = query(
    categoryRef,
    where("menuId", "==", menuId),
    orderBy("position"),
  );

  const categoriesSnap = await getDocs(q);

  return categoriesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};
