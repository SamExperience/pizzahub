import { useEffect, useRef, useState } from "react";
import CategoryForm from "../components/CategoryForm";
import CategoryList from "../components/CategoryList";
import ProductList from "../components/ProductList";
import { useStore } from "../contexts/StoreContext";
import {
  createCategory,
  deleteCategoryById,
  getCategoriesByMenuId,
  moveCategory,
  updateCategoryById,
} from "../services/category.service";
import { createMenu, getMenuByStoreId } from "../services/menu.service";

// Loads the Store's Menu (creating it on first access) and its categories.
const loadMenu = async (store) => {
  const menu =
    (await getMenuByStoreId(store.id)) ??
    (await createMenu(store.id, store.name));

  return { menuId: menu.id, categories: await getCategoriesByMenuId(menu.id) };
};

export default function Menu() {
  const { selectedStore } = useStore();
  const [menuId, setMenuId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  // Shares one in-flight load per Store and attempt so StrictMode cannot
  // create the Menu twice.
  const inFlight = useRef({ key: null, promise: null });

  useEffect(() => {
    let cancelled = false;
    const key = `${selectedStore.id}:${attempt}`;

    if (inFlight.current.key !== key) {
      inFlight.current = { key, promise: loadMenu(selectedStore) };
    }

    inFlight.current.promise
      .then((result) => {
        if (cancelled) return;
        setMenuId(result.menuId);
        setCategories(result.categories);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.log("Error loading menu -> ", err);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStore, attempt]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  // Runs a category change, then reloads the list. Resolves to true on success.
  const runAction = async (action) => {
    setActionError(null);
    try {
      await action();
      setCategories(await getCategoriesByMenuId(menuId));
      return true;
    } catch (err) {
      console.log("Error updating categories -> ", err);
      setActionError(err);
      return false;
    }
  };

  const handleCreate = (name) =>
    runAction(() => createCategory(menuId, name, categories.length + 1));
  const handleRename = (categoryId, name) =>
    runAction(() => updateCategoryById(categoryId, { name }));
  const handleDelete = (categoryId) =>
    runAction(() => deleteCategoryById(categoryId));
  const handleMove = (categoryId, direction) =>
    runAction(() => moveCategory(categoryId, direction));

  // The first category is selected until the user picks another one, or when
  // the picked one no longer exists (e.g. it was deleted).
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0] ??
    null;

  return (
    <div>
      <h1>Menu</h1>
      {loading && <p>Loading ...</p>}
      {error && (
        <p>
          Unable to load the menu.
          <br />
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && (
        <div className="menu-layout">
          <aside className="menu-sidebar">
            {actionError && <p role="alert">{actionError.message}</p>}
            <CategoryForm onSubmit={handleCreate} />
            <CategoryList
              categories={categories}
              selectedId={selectedCategory?.id}
              onSelect={setSelectedCategoryId}
              onRename={handleRename}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          </aside>
          <section className="menu-main">
            {selectedCategory ? (
              <ProductList
                key={selectedCategory.id}
                categoryId={selectedCategory.id}
                categoryName={selectedCategory.name}
              />
            ) : (
              <p>Create a category to start adding products.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
