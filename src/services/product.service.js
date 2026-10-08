import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

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
