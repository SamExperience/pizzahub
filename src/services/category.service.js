import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";
import { deleteProductImage, getProductsByCategoryId } from "./product.service";

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

// Assigns sequential positions (1, 2, 3...) keeping the current order.
// If a batch is passed, updates are added to it and the caller commits.
export const reorderCategories = async (
  menuId,
  { batch, excludeCategoryId } = {},
) => {
  const ownBatch = !batch;
  const writeBatchRef = batch ?? writeBatch(db);

  const categories = (await getCategoriesByMenuId(menuId)).filter(
    (category) => category.id !== excludeCategoryId,
  );

  let updatesCount = 0;

  categories.forEach((category, index) => {
    const newPosition = index + 1;

    if (category.position !== newPosition) {
      writeBatchRef.update(doc(db, "categories", category.id), {
        position: newPosition,
        updatedAt: serverTimestamp(),
      });
      updatesCount++;
    }
  });

  if (ownBatch && updatesCount > 0) {
    await writeBatchRef.commit();
  }
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
  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  const categoryRef = doc(db, "categories", categoryId);
  const categorySnap = await getDoc(categoryRef);

  if (!categorySnap.exists()) {
    throw new Error("Category not found");
  }

  const { menuId } = categorySnap.data();
  const products = await getProductsByCategoryId(categoryId);

  // Category, its products (available or not) and renumbering are committed
  // atomically
  const batch = writeBatch(db);
  batch.delete(categoryRef);
  products.forEach((product) => {
    batch.delete(doc(db, "products", product.id));
  });
  await reorderCategories(menuId, { batch, excludeCategoryId: categoryId });
  await batch.commit();

  await Promise.all(
    products.map((product) => deleteProductImage(product.imageUrl)),
  );
};

// Swaps the position of a category with its previous ("up") or next ("down")
// neighbour in a single batch. Does nothing at the first/last position.
export const moveCategory = async (categoryId, direction) => {
  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  if (direction !== "up" && direction !== "down") {
    throw new Error("Direction must be 'up' or 'down'");
  }

  const categorySnap = await getDoc(doc(db, "categories", categoryId));

  if (!categorySnap.exists()) {
    throw new Error("Category not found");
  }

  const categories = await getCategoriesByMenuId(categorySnap.data().menuId);
  const index = categories.findIndex((category) => category.id === categoryId);
  const neighbour = categories[direction === "up" ? index - 1 : index + 1];

  if (!neighbour) return;

  const current = categories[index];
  const batch = writeBatch(db);
  batch.update(doc(db, "categories", current.id), {
    position: neighbour.position,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "categories", neighbour.id), {
    position: current.position,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
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
