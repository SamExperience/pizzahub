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
import { alert, button, card, muted } from "../utils/styles";

// Loads the Store's Menu (creating it on first access) and its categories.
const loadMenu = async (store) => {
  const menu =
    (await getMenuByStoreId(store.id)) ??
    (await createMenu(store.id, store.name));

  return { menuId: menu.id, categories: await getCategoriesByMenuId(menu.id) };
};

export default function Menu() {
  const { selectedStore, refreshMenuReady } = useStore();
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
      refreshMenuReady();
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 text-left">
      <h1 className="mt-0 mb-6 text-3xl font-semibold tracking-tight">Menu</h1>
      {loading && <p className={muted}>Loading ...</p>}
      {error && (
        <p className={`${alert} flex flex-wrap items-center gap-3`}>
          Unable to load the menu.
          <button type="button" className={button} onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && (
        <div className="grid items-start gap-6 md:grid-cols-[18rem_1fr]">
          <aside className={`${card} flex flex-col gap-4`}>
            <h2 className="m-0 text-base font-semibold">Categories</h2>
            {actionError && (
              <p role="alert" className={alert}>
                {actionError.message}
              </p>
            )}
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
          <section className="min-w-0">
            {selectedCategory ? (
              <ProductList
                key={selectedCategory.id}
                storeId={selectedStore.id}
                categoryId={selectedCategory.id}
                categoryName={selectedCategory.name}
                onChange={refreshMenuReady}
              />
            ) : (
              <p
                className={`rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700 ${muted}`}
              >
                Create a category to start adding products.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
