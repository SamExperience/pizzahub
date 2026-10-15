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
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { requireText } from "../utils/textValidation";
import { db } from "./firebase";

/**
 * Reads the Store's Menu. Each Store has at most one Menu, so the first
 * match is returned; null means the Menu was never created.
 * @param {string} storeId
 * @returns {Promise<?object>} The Menu with its id, or null.
 * @example
 * const menu = await getMenuByStoreId("store1");
 */
export const getMenuByStoreId = async (storeId) => {
  const menuRef = collection(db, "menus");

  const q = query(menuRef, where("storeId", "==", storeId));

  const menusSnap = await getDocs(q);

  if (!menusSnap.empty) {
    return { id: menusSnap.docs[0].id, ...menusSnap.docs[0].data() };
  } else {
    return null;
  }
};

/**
 * Creates the Store's Menu. The name is validated with the same limits the
 * Firestore rules enforce, so the user gets a clear error instead of a
 * permission denied.
 * @param {string} storeId
 * @param {string} nameMenu
 * @returns {Promise<object>} The created Menu data with its id.
 * @example
 * const menu = await createMenu("store1", "Pizzeria Bella Napoli");
 */
export const createMenu = async (storeId, nameMenu) => {
  if (!storeId) throw new Error("Store ID is required");

  const name = requireText(nameMenu, FIELD_LIMITS.NAME, "Menu name");
  const menuRef = collection(db, "menus");

  const data = {
    storeId: storeId,
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const menuSnap = await addDoc(menuRef, data);

  return {
    id: menuSnap.id,
    ...data,
  };
};

/**
 * Tells whether the Store can take orders: a Menu is ready when at least one
 * Category holds at least one Product. Until then the menu guard keeps the
 * user on /menu. Reads one Product per Category at most.
 * @param {string} storeId
 * @returns {Promise<boolean>}
 * @example
 * if (!(await isMenuReady("store1"))) navigate("/menu");
 */
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
