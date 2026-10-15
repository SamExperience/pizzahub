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
import { countProductsByCategoryId } from "../services/product.service";
import LoadingState from "../components/LoadingState";
import { alert, button, emptyBox, muted, pageTitle } from "../utils/styles";
import { getErrorMessage } from "../utils/errorMessage";
import { logError } from "../utils/logger";

// Loads the Store's Menu (creating it on first access), its categories and
// the product count of each category for the sidebar badges.
const loadMenu = async (store) => {
  const menu =
    (await getMenuByStoreId(store.id)) ??
    (await createMenu(store.id, store.name));
  const categories = await getCategoriesByMenuId(menu.id);
  const counts = await Promise.all(
    categories.map((category) => countProductsByCategoryId(category.id)),
  );

  return {
    menuId: menu.id,
    categories,
    productCounts: Object.fromEntries(
      categories.map((category, index) => [category.id, counts[index]]),
    ),
  };
};

export default function Menu() {
  const { selectedStore, refreshMenuReady } = useStore();
  const [menuId, setMenuId] = useState(null);
  const [categories, setCategories] = useState([]);
  // Product count per category id; a category missing here is new, so empty.
  const [productCounts, setProductCounts] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [actionError, setActionError] = useState(null);
  // One category change at a time: controls are disabled while it runs and
  // the ref drops clicks that arrive before the next render.
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
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
        setProductCounts(result.productCounts);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logError("Error loading menu -> ", err);
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
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setActionError(null);
    try {
      await action();
      setCategories(await getCategoriesByMenuId(menuId));
      refreshMenuReady();
      return true;
    } catch (err) {
      logError("Error updating categories -> ", err);
      setActionError(err);
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
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

  // ProductList reports the new count after each product change.
  const handleProductsChange = (categoryId, count) => {
    refreshMenuReady();
    if (count !== undefined) {
      setProductCounts((current) => ({ ...current, [categoryId]: count }));
    }
  };

  // The first category is selected until the user picks another one, or when
  // the picked one no longer exists (e.g. it was deleted).
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0] ??
    null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-left">
      <header className="flex flex-col gap-1">
        <h1 className={`${pageTitle} m-0`}>Menu</h1>
        <p className={`${muted} m-0`}>
          Manage categories and products of the active store.
        </p>
      </header>
      {loading && <LoadingState />}
      {error && (
        <p role="alert" className={`${alert} flex flex-wrap items-center gap-3`}>
          Unable to load the menu.
          <button type="button" className={button} onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && (
        <div className="grid items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-4 md:sticky md:top-4 md:rounded-xl md:border md:border-neutral-200 md:bg-white md:p-4 md:shadow-sm">
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Categories
            </h2>
            <CategoryForm onSubmit={handleCreate} busy={pending} />
            {pending && <LoadingState text="Saving ..." />}
            {actionError && (
              <p role="alert" className={alert}>
                {getErrorMessage(actionError)}
              </p>
            )}
            <CategoryList
              busy={pending}
              categories={categories}
              productCounts={productCounts}
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
                onChange={(count) =>
                  handleProductsChange(selectedCategory.id, count)
                }
              />
            ) : (
              <p className={emptyBox}>Create a category to start adding products.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
