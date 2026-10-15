import {
  addDoc,
  collection,
  doc,
  getDoc,
  getCountFromServer,
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

import { FIELD_LIMITS } from "../utils/fieldLimits";
import {
  IMAGE_CACHE_CONTROL,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "../utils/productImage";
import { assertMaxItems, assertMaxLength } from "../utils/textValidation";
import { db, storage } from "./firebase";
import { logError } from "../utils/logger";

const isValidPrice = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Central pricing rule (decision A1, also enforced by the rules), so a
 * Product never has two conflicting prices:
 * - with sizes, each size carries its own price and `price` must be null;
 * - without sizes (null or empty), `price` is the single product price.
 * @param {object} pricing
 * @param {?Array<{name: string, price: number}>} [pricing.sizes]
 * @param {?number} [pricing.price]
 * @returns {{sizes: ?Array<{name: string, price: number}>, price: ?number}}
 * @example
 * validateProductPricing({ sizes: null, price: 12 }); // { sizes: null, price: 12 }
 * validateProductPricing({ sizes: [{ name: "Large", price: 15 }] }); // price null
 */
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

    assertMaxItems(sizes, FIELD_LIMITS.LIST_SIZE, "Product sizes");

    const normalizedSizes = sizes.map((size) => {
      const sizeName = typeof size?.name === "string" ? size.name.trim() : "";

      if (!sizeName) throw new Error("Product size name is required");
      assertMaxLength(sizeName, FIELD_LIMITS.LIST_ITEM, "Product size name");
      if (!isValidPrice(size.price))
        throw new Error("Product size price must be a non-negative number");

      return { name: sizeName, price: size.price };
    });

    const uniqueNames = new Set(
      normalizedSizes.map((size) => size.name.toLowerCase()),
    );
    if (uniqueNames.size !== normalizedSizes.length)
      throw new Error("Product size names must be unique");

    return { sizes: normalizedSizes, price: null };
  }

  if (!isValidPrice(price))
    throw new Error("Product price is required when there are no sizes");

  return { sizes: null, price };
};

const validateProductName = (name) => {
  if (typeof name !== "string" || !name.trim())
    throw new Error("Product name is required");

  assertMaxLength(name.trim(), FIELD_LIMITS.NAME, "Product name");

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

  assertMaxItems(value, FIELD_LIMITS.LIST_SIZE, `Product ${label}`);

  const items = value.map((item) => {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text) throw new Error(`Product ${label} must not contain blank values`);
    assertMaxLength(text, FIELD_LIMITS.LIST_ITEM, `Each product ${label} value`);
    return text;
  });

  if (new Set(items).size !== items.length)
    throw new Error(`Product ${label} must not contain duplicates`);

  return items.length > 0 ? items : null;
};

/**
 * Returns the normalized { availableCookingLevels, defaultCookingLevel }
 * pair. Levels and default go together, so a new ticket item always gets a
 * valid preselected level: without levels both are null; with levels the
 * default is required and must be one of them.
 * @param {object} levels
 * @param {?string[]} [levels.availableCookingLevels]
 * @param {?string} [levels.defaultCookingLevel]
 * @returns {{availableCookingLevels: ?string[], defaultCookingLevel: ?string}}
 * @example
 * validateProductCookingLevels({ availableCookingLevels: ["Normal", "Well done"], defaultCookingLevel: "Normal" });
 */
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

const validateOptionalText = (value, label, max = null) => {
  if (value === null || value === undefined) return null;

  if (typeof value !== "string") throw new Error(`Product ${label} must be text`);

  if (max === null) return value;

  const text = value.trim();
  assertMaxLength(text, max, `Product ${label}`);

  return text || null;
};

const validateProductDescription = (value) =>
  validateOptionalText(value, "description", FIELD_LIMITS.DESCRIPTION);

/**
 * Creates a Product in a Category after validating every field with the
 * same limits as the rules; name and position must be unique in the
 * Category. Availability defaults to true.
 * @param {string} categoryId
 * @param {object} data - Product fields (name, position, price or sizes, ...).
 * @returns {Promise<object>} The created Product with its id.
 * @example
 * await createProduct("category1", { name: "Margherita", position: 1, price: 12 });
 */
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
  const description = validateProductDescription(data.description);
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

/**
 * Updates only the provided Product fields. Pricing and cooking levels are
 * validated on the merged result (current + changes), so a partial update
 * can never break the pricing or cooking level rules.
 * @param {string} productId
 * @param {object} data - Any subset of the updatable fields.
 * @returns {Promise<void>}
 * @example
 * await updateProductById("product1", { price: 13.5 });
 */
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
    updates.description = validateProductDescription(data.description);

  if (has("imageUrl"))
    updates.imageUrl = validateOptionalText(data.imageUrl, "image URL");

  if (has("ingredients"))
    updates.ingredients = normalizeStringList(data.ingredients, "ingredients");

  await updateDoc(productRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Toggles a Product's availability. Availability is a flag only: an
 * unavailable Product stays in the Menu (disabled in "Add product") and is
 * never deleted or hidden by the service layer.
 * @param {string} productId
 * @param {boolean} isAvailable
 * @returns {Promise<void>}
 * @example
 * await setProductAvailability("product1", false);
 */
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

/**
 * Reads the Category's Products in display order (position ascending; needs
 * the products(categoryId, position) composite index in production).
 * @param {string} categoryId
 * @returns {Promise<object[]>}
 * @example
 * const products = await getProductsByCategoryId("category1");
 */
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

/**
 * Counts a Category's Products on the server, so the Menu sidebar badges
 * never download the Products themselves.
 * @param {string} categoryId
 * @returns {Promise<number>}
 * @example
 * const count = await countProductsByCategoryId("category1");
 */
export const countProductsByCategoryId = async (categoryId) => {
  if (!categoryId) throw new Error("Category ID is required");

  const q = query(
    collection(db, "products"),
    where("categoryId", "==", categoryId),
  );

  return (await getCountFromServer(q)).data().count;
};

/**
 * Reads one Product; throws "Product not found" so callers can tell a
 * deleted Product apart from other errors.
 * @param {string} productId
 * @returns {Promise<object>}
 * @example
 * const product = await getProductById("product1");
 */
export const getProductById = async (productId) => {
  if (!productId) throw new Error("Product ID is required");

  const productSnap = await getDoc(doc(db, "products", productId));
  if (!productSnap.exists()) throw new Error("Product not found");

  return {
    id: productSnap.id,
    ...productSnap.data(),
  };
};

/**
 * State of the Product behind a ticket Item; it decides whether the Item
 * gets the full edit (sellable) or the restricted one.
 * @enum {string}
 * @example
 * if (status === ITEM_PRODUCT_STATUS.SELLABLE) reconfigureItem(product, item, options);
 */
export const ITEM_PRODUCT_STATUS = {
  SELLABLE: "sellable",
  UNAVAILABLE: "unavailable",
  DELETED: "deleted",
};

/**
 * Reads the current Product of an Order Item with its status: sellable
 * (exists and available), unavailable, or deleted (product null). Reading a
 * deleted Product, or one whose Category was deleted, is denied by the
 * rules because they check its Category, so permission-denied also means
 * deleted.
 * @param {string} productId - Item productId.
 * @returns {Promise<{status: string, product: ?object}>}
 * @example
 * const { status, product } = await getItemProduct(item.productId);
 */
export const getItemProduct = async (productId) => {
  try {
    const product = await getProductById(productId);

    return {
      status:
        product.isAvailable === false
          ? ITEM_PRODUCT_STATUS.UNAVAILABLE
          : ITEM_PRODUCT_STATUS.SELLABLE,
      product,
    };
  } catch (err) {
    if (err?.message === "Product not found" || err?.code === "permission-denied")
      return { status: ITEM_PRODUCT_STATUS.DELETED, product: null };

    throw err;
  }
};

/**
 * Uploads the product image to a fixed path, so replacing it overwrites the
 * previous file instead of leaving orphans. Expects a file already
 * compressed by compressProductImage; the checks mirror storage.rules so the
 * user gets a clear message instead of a permission error.
 * @param {string} storeId
 * @param {string} productId
 * @param {File|Blob} file - WebP or JPEG under 150 KB.
 * @returns {Promise<string>} The download URL.
 * @example
 * const imageUrl = await uploadProductImage("store1", "product1", compressed);
 */
export const uploadProductImage = async (storeId, productId, file) => {
  if (!storeId) throw new Error("Store ID is required");
  if (!productId) throw new Error("Product ID is required");
  if (!file) throw new Error("Image file is required");

  if (!IMAGE_TYPES.includes(file.type))
    throw new Error("Product image must be a WebP or JPEG file");

  if (file.size >= MAX_IMAGE_BYTES)
    throw new Error("Product image must be smaller than 150 KB");

  const imageRef = ref(storage, `products/${storeId}/${productId}`);
  // Browsers reuse the image for a day instead of downloading it again.
  await uploadBytes(imageRef, file, {
    contentType: file.type,
    cacheControl: IMAGE_CACHE_CONTROL,
  });

  return getDownloadURL(imageRef);
};

/**
 * Best-effort image removal: an orphaned file must never block a deletion,
 * so errors are logged (development only) and swallowed.
 * @param {?string} imageUrl - Download URL; nothing happens when empty.
 * @returns {Promise<void>}
 * @example
 * await deleteProductImage(product.imageUrl);
 */
export const deleteProductImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    await deleteObject(ref(storage, imageUrl));
  } catch (error) {
    logError("Product image not deleted -> ", error);
  }
};

/**
 * Deletes the Product and renumbers the remaining Products of its Category
 * to 1..n in one atomic batch, so positions never have gaps. The image is
 * removed afterwards on a best-effort basis: an orphaned file must never
 * block the deletion. Tickets keep their Item snapshots.
 * @param {string} productId
 * @returns {Promise<void>}
 * @example
 * await deleteProductById("product1");
 */
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

/**
 * Swaps the position of a Product with its neighbour in the Category in one
 * batch, so positions stay unique. Does nothing at the first or last
 * position.
 * @param {string} productId
 * @param {"up"|"down"} direction
 * @returns {Promise<void>}
 * @example
 * await moveProductById("product2", "up");
 */
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
