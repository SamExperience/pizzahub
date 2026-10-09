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
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

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

const validateProductName = (name) => {
  if (typeof name !== "string" || !name.trim())
    throw new Error("Product name is required");

  return name.trim();
};

const validateProductAvailability = (isAvailable) => {
  if (typeof isAvailable !== "boolean")
    throw new Error("Product availability must be a boolean");

  return isAvailable;
};

const validateProductPositionFormat = (position) => {
  if (!Number.isInteger(position) || position < 1)
    throw new Error("Product position must be a positive integer");

  return position;
};

// Position is unique within a category. `excludeProductId` lets a product
// keep its own position on update.
const validateProductPositionUnique = async (
  categoryId,
  position,
  excludeProductId = null,
) => {
  const siblings = await getProductsByCategoryId(categoryId);

  if (
    siblings.some(
      (product) =>
        product.id !== excludeProductId && product.position === position,
    )
  )
    throw new Error("Product position is already in use");
};

// Name is unique within a category (exact, case-sensitive match, as for
// category names). `excludeProductId` lets a product keep its own name.
const validateProductNameUnique = async (
  categoryId,
  name,
  excludeProductId = null,
) => {
  const siblings = await getProductsByCategoryId(categoryId);

  if (
    siblings.some(
      (product) => product.id !== excludeProductId && product.name === name,
    )
  )
    throw new Error("Product name already exists");
};

const normalizeStringList = (value, label) => {
  if (value === null || value === undefined) return null;

  if (!Array.isArray(value)) throw new Error(`Product ${label} must be an array`);

  const items = value.map((item) => {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text) throw new Error(`Product ${label} must not contain blank values`);
    return text;
  });

  if (new Set(items).size !== items.length)
    throw new Error(`Product ${label} must not contain duplicates`);

  return items.length > 0 ? items : null;
};

// Returns the normalized { availableCookingLevels, defaultCookingLevel } pair.
// Levels and default go together: without levels both are null; with levels
// the default is required and must be one of them.
export const validateProductCookingLevels = ({
  availableCookingLevels,
  defaultCookingLevel,
}) => {
  const levels = normalizeStringList(
    availableCookingLevels,
    "cooking levels",
  );

  if (defaultCookingLevel === null || defaultCookingLevel === undefined) {
    if (levels)
      throw new Error(
        "Product default cooking level is required when cooking levels are defined",
      );

    return { availableCookingLevels: null, defaultCookingLevel: null };
  }

  const defaultLevel =
    typeof defaultCookingLevel === "string" ? defaultCookingLevel.trim() : "";

  if (!defaultLevel) throw new Error("Product default cooking level is invalid");

  if (!levels || !levels.includes(defaultLevel))
    throw new Error(
      "Product default cooking level must be one of the available cooking levels",
    );

  return { availableCookingLevels: levels, defaultCookingLevel: defaultLevel };
};

const validateOptionalText = (value, label) => {
  if (value === null || value === undefined) return null;

  if (typeof value !== "string") throw new Error(`Product ${label} must be text`);

  return value;
};

export const createProduct = async (categoryId, data) => {
  if (!categoryId) throw new Error("Category ID is required");

  if (!data || typeof data !== "object")
    throw new Error("Product data is required");

  const categorySnap = await getDoc(doc(db, "categories", categoryId));
  if (!categorySnap.exists()) throw new Error("Category not found");

  const name = validateProductName(data.name);
  const position = validateProductPositionFormat(data.position);
  const isAvailable = validateProductAvailability(data.isAvailable ?? true);
  const { sizes, price } = validateProductPricing(data);
  const { availableCookingLevels, defaultCookingLevel } =
    validateProductCookingLevels(data);
  const description = validateOptionalText(data.description, "description");
  const imageUrl = validateOptionalText(data.imageUrl, "image URL");
  const ingredients = normalizeStringList(data.ingredients, "ingredients");

  await validateProductNameUnique(categoryId, name);
  await validateProductPositionUnique(categoryId, position);

  const productData = {
    categoryId,
    name,
    description,
    ingredients,
    sizes,
    price,
    availableCookingLevels,
    defaultCookingLevel,
    isAvailable,
    imageUrl,
    position,
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

const UPDATABLE_FIELDS = [
  "name",
  "position",
  "isAvailable",
  "sizes",
  "price",
  "description",
  "ingredients",
  "availableCookingLevels",
  "defaultCookingLevel",
  "imageUrl",
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
    const name = validateProductName(data.name);

    if (name !== currentProduct.name)
      await validateProductNameUnique(
        currentProduct.categoryId,
        name,
        productId,
      );

    updates.name = name;
  }

  if (has("position")) {
    const position = validateProductPositionFormat(data.position);

    if (position !== currentProduct.position)
      await validateProductPositionUnique(
        currentProduct.categoryId,
        position,
        productId,
      );

    updates.position = position;
  }

  if (has("isAvailable"))
    updates.isAvailable = validateProductAvailability(data.isAvailable);

  // Pricing is validated on the merged result so the A1 rule always holds.
  if (has("sizes") || has("price")) {
    const { sizes, price } = validateProductPricing({
      sizes: has("sizes") ? data.sizes : currentProduct.sizes,
      price: has("price") ? data.price : currentProduct.price,
    });

    updates.sizes = sizes;
    updates.price = price;
  }

  // Cooking levels are validated on the merged result as well.
  if (has("availableCookingLevels") || has("defaultCookingLevel")) {
    const cookingLevels = validateProductCookingLevels({
      availableCookingLevels: has("availableCookingLevels")
        ? data.availableCookingLevels
        : currentProduct.availableCookingLevels,
      defaultCookingLevel: has("defaultCookingLevel")
        ? data.defaultCookingLevel
        : currentProduct.defaultCookingLevel,
    });

    Object.assign(updates, cookingLevels);
  }

  if (has("description"))
    updates.description = validateOptionalText(data.description, "description");

  if (has("imageUrl"))
    updates.imageUrl = validateOptionalText(data.imageUrl, "image URL");

  if (has("ingredients"))
    updates.ingredients = normalizeStringList(data.ingredients, "ingredients");

  await updateDoc(productRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// Availability is a flag only: an unavailable product stays in the menu and
// is never deleted or hidden by the service layer.
export const setProductAvailability = async (productId, isAvailable) => {
  if (!productId) throw new Error("Product ID is required");

  const available = validateProductAvailability(isAvailable);

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) throw new Error("Product not found");

  await updateDoc(productRef, {
    isAvailable: available,
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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Uploads the product image to a fixed path, so replacing it overwrites the
// previous file. Limits mirror storage.rules. Returns the download URL.
export const uploadProductImage = async (storeId, productId, file) => {
  if (!storeId) throw new Error("Store ID is required");
  if (!productId) throw new Error("Product ID is required");
  if (!file) throw new Error("Image file is required");

  if (typeof file.type !== "string" || !file.type.startsWith("image/"))
    throw new Error("Product image must be an image file");

  if (file.size >= MAX_IMAGE_SIZE)
    throw new Error("Product image must be smaller than 5 MB");

  const imageRef = ref(storage, `products/${storeId}/${productId}`);
  await uploadBytes(imageRef, file, { contentType: file.type });

  return getDownloadURL(imageRef);
};

// Best-effort image removal: an orphaned file must never block a deletion.
export const deleteProductImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    await deleteObject(ref(storage, imageUrl));
  } catch (error) {
    console.warn(`Product image not deleted: ${error.message}`);
  }
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

  await deleteProductImage(imageUrl);
};

// Swaps the position of a product with its neighbour in the category.
// Does nothing at the first or last position.
export const moveProductById = async (productId, direction) => {
  if (!productId) throw new Error("Product ID is required");

  if (direction !== "up" && direction !== "down")
    throw new Error("Direction must be 'up' or 'down'");

  const productSnap = await getDoc(doc(db, "products", productId));
  if (!productSnap.exists()) throw new Error("Product not found");

  const products = await getProductsByCategoryId(productSnap.data().categoryId);
  const index = products.findIndex((product) => product.id === productId);
  const neighbour = products[direction === "up" ? index - 1 : index + 1];

  if (!neighbour) return;

  const current = products[index];
  const batch = writeBatch(db);
  batch.update(doc(db, "products", current.id), {
    position: neighbour.position,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "products", neighbour.id), {
    position: current.position,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};
