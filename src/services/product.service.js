import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";

import { db, storage } from "./firebase";

const isValidPrice = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Central pricing rule:
// - with sizes, each size carries its own price and `price` must be null;
// - without sizes (null or empty), `price` is the single product price.
// Returns the normalized { sizes, price } pair.
export const validateProductPricing = ({ sizes, price }) => {
  const hasSizes = Array.isArray(sizes) && sizes.length > 0;
  const hasPrice = price !== null && price !== undefined;

  if (sizes !== null && sizes !== undefined && !Array.isArray(sizes)) {
    throw new Error("Product sizes must be an array");
  }

  if (hasSizes) {
    if (hasPrice) {
      throw new Error("Product price must be null when sizes are defined");
    }

    const normalizedSizes = sizes.map((size) => {
      const sizeName = typeof size?.name === "string" ? size.name.trim() : "";

      if (!sizeName) throw new Error("Product size name is required");
      if (!isValidPrice(size.price))
        throw new Error("Product size price must be a non-negative number");

      return { name: sizeName, price: size.price };
    });

    return { sizes: normalizedSizes, price: null };
  }

  if (!isValidPrice(price))
    throw new Error("Product price is required when there are no sizes");

  return { sizes: null, price };
};

export const createProduct = async (categoryId, data) => {
  if (!categoryId) throw new Error("Category ID is required");

  if (!data || typeof data !== "object")
    throw new Error("Product data is required");

  const categorySnap = await getDoc(doc(db, "categories", categoryId));
  if (!categorySnap.exists()) throw new Error("Category not found");

  if (typeof data.name !== "string" || !data.name.trim())
    throw new Error("Product name is required");

  if (!Number.isInteger(data.position) || data.position < 1)
    throw new Error("Product position must be a positive integer");

  const isAvailable = data.isAvailable ?? true;
  if (typeof isAvailable !== "boolean")
    throw new Error("Product availability must be a boolean");

  const { sizes, price } = validateProductPricing(data);

  const productData = {
    categoryId,
    name: data.name.trim(),
    description: data.description ?? null,
    ingredients: data.ingredients ?? null,
    sizes,
    price,
    availableCookingLevels: data.availableCookingLevels ?? null,
    defaultCookingLevel: data.defaultCookingLevel ?? null,
    isAvailable,
    imageUrl: data.imageUrl ?? null,
    position: data.position,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const productSnap = await addDoc(collection(db, "products"), productData);
  console.log(`Product ${productData.name} created`);

  return {
    id: productSnap.id,
    ...productData,
  };
};

const OPTIONAL_UPDATE_FIELDS = [
  "description",
  "ingredients",
  "availableCookingLevels",
  "defaultCookingLevel",
  "imageUrl",
];

const UPDATABLE_FIELDS = [
  "name",
  "position",
  "isAvailable",
  "sizes",
  "price",
  ...OPTIONAL_UPDATE_FIELDS,
];

export const updateProductById = async (productId, data) => {
  if (!productId) throw new Error("Product ID is required");

  if (!data || typeof data !== "object")
    throw new Error("Product data is required");

  const has = (field) => Object.prototype.hasOwnProperty.call(data, field);

  if (!UPDATABLE_FIELDS.some(has)) throw new Error("Nothing to update");

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) throw new Error("Product not found");

  const currentProduct = productSnap.data();
  const updates = {};

  if (has("name")) {
    if (typeof data.name !== "string" || !data.name.trim())
      throw new Error("Product name is required");

    updates.name = data.name.trim();
  }

  if (has("position")) {
    if (!Number.isInteger(data.position) || data.position < 1)
      throw new Error("Product position must be a positive integer");

    updates.position = data.position;
  }

  if (has("isAvailable")) {
    if (typeof data.isAvailable !== "boolean")
      throw new Error("Product availability must be a boolean");

    updates.isAvailable = data.isAvailable;
  }

  // Pricing is validated on the merged result so the A1 rule always holds.
  if (has("sizes") || has("price")) {
    const { sizes, price } = validateProductPricing({
      sizes: has("sizes") ? data.sizes : currentProduct.sizes,
      price: has("price") ? data.price : currentProduct.price,
    });

    updates.sizes = sizes;
    updates.price = price;
  }

  OPTIONAL_UPDATE_FIELDS.filter(has).forEach((field) => {
    updates[field] = data[field] ?? null;
  });

  await updateDoc(productRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getProductsByCategoryId = async (categoryId) => {
  if (!categoryId) throw new Error("Category ID is required");

  const q = query(
    collection(db, "products"),
    where("categoryId", "==", categoryId),
    orderBy("position"),
  );

  const productsSnap = await getDocs(q);

  return productsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const getProductById = async (productId) => {
  if (!productId) throw new Error("Product ID is required");

  const productSnap = await getDoc(doc(db, "products", productId));
  if (!productSnap.exists()) throw new Error("Product not found");

  return {
    id: productSnap.id,
    ...productSnap.data(),
  };
};

// Deletes the product and renumbers the remaining products of its category
// to 1..n in one atomic batch. The image is removed afterwards on a
// best-effort basis: an orphaned file must never block the deletion.
export const deleteProductById = async (productId) => {
  if (!productId) throw new Error("Product ID is required");

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) throw new Error("Product not found");

  const { categoryId, imageUrl } = productSnap.data();
  const siblings = (await getProductsByCategoryId(categoryId)).filter(
    (product) => product.id !== productId,
  );

  const batch = writeBatch(db);
  batch.delete(productRef);
  siblings.forEach((product, index) => {
    if (product.position !== index + 1) {
      batch.update(doc(db, "products", product.id), {
        position: index + 1,
        updatedAt: serverTimestamp(),
      });
    }
  });
  await batch.commit();

  if (imageUrl) {
    try {
      await deleteObject(ref(storage, imageUrl));
    } catch (error) {
      console.warn(`Product image not deleted: ${error.message}`);
    }
  }
};
