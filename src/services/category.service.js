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
  getDoc,
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
  // Check parameters
  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Category data is required");
  }

  const hasName = Object.prototype.hasOwnProperty.call(data, "name");
  const hasPosition = Object.prototype.hasOwnProperty.call(data, "position");

  if (!hasName && !hasPosition) {
    throw new Error("Nothing to update");
  }

  const categoryRef = doc(db, "categories", categoryId);
  const categorySnap = await getDoc(categoryRef);

  if (!categorySnap.exists()) {
    throw new Error("Category not found");
  }

  const currentCategory = categorySnap.data();
  const updates = {};

  // Validate name only if provided
  if (hasName) {
    if (typeof data.name !== "string") {
      throw new Error("Category name is required");
    }

    const normalizedName = data.name.trim();

    if (!normalizedName) {
      throw new Error("Category name is required");
    }

    if (normalizedName !== currentCategory.name) {
      const isNameValid = await validateCategoryName(
        currentCategory.menuId,
        normalizedName,
      );

      if (!isNameValid) {
        throw new Error("Category name already exists");
      }
    }

    updates.name = normalizedName;
  }

  // Validate position only if provided
  if (hasPosition) {
    if (!Number.isInteger(data.position) || data.position < 1) {
      throw new Error("Category position must be a positive integer");
    }

    if (data.position !== currentCategory.position) {
      const isPositionValid = await validateCategoryPosition(
        currentCategory.menuId,
        data.position,
      );

      if (!isPositionValid) {
        throw new Error("Category position is already in use");
      }
    }

    updates.position = data.position;
  }

  await updateDoc(categoryRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};
