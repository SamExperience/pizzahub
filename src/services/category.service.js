import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";

const validateCategoryName = async (menuId, name) => {
  const categoryRef = collection(db, "categories");

  const q = query(
    categoryRef,
    where("menuId", "==", menuId),
    where("name", "==", name),
  );

  const result = await getDocs(q);

  return result.empty;
};
const validateCategoryPosition = async (menuId, position) => {
  const categoryRef = collection(db, "categories");

  const q = query(
    categoryRef,
    where("menuId", "==", menuId),
    where("position", "==", position),
  );

  const result = await getDocs(q);

  return result.empty;
};

export const createCategory = async (menuId, nameCategory, position) => {
  //check parameter
  if (!menuId) throw new Error("Menu ID is required");

  if (!nameCategory || typeof nameCategory !== "string")
    throw new Error("Category name is required");

  const normalizedName = nameCategory.trim();
  if (!normalizedName) throw new Error("Category name is required");

  if (!Number.isInteger(position) || position < 1)
    throw new Error("Category position must be a positive integer");

  //check nameCategory and position
  const isNameValid = await validateCategoryName(menuId, normalizedName);
  if (!isNameValid) throw new Error("Category name already exists");

  //check position
  const isPositionValid = await validateCategoryPosition(menuId, position);
  if (!isPositionValid) throw new Error("Category position is already in use");

  const categoryRef = collection(db, "categories");

  const data = {
    menuId: menuId,
    name: normalizedName,
    position: position,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const categorySnap = await addDoc(categoryRef, data);
  console.log(`Category ${normalizedName} created`);

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

export const deleteCategoryById = async (categoryId) => {
  const categoryRef = doc(db, "categories", categoryId);
  await deleteDoc(categoryRef);
};

export const updateCategoryById = async (categoryId, data) => {
  const categoryRef = doc(db, "categories", categoryId);
  await updateDoc(categoryRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
