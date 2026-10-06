import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

/* getCategoriesByMenuId(menuId)
updateCategory(categoryId, data)
deleteCategory(categoryId)
 */
