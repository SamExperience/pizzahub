import { useEffect, useRef, useState } from "react";
import CategoryList from "../components/CategoryList";
import { useStore } from "../contexts/StoreContext";
import { getCategoriesByMenuId } from "../services/category.service";
import { createMenu, getMenuByStoreId } from "../services/menu.service";

// Loads the Store's Menu (creating it on first access) and its categories.
const loadMenu = async (store) => {
  const menu =
    (await getMenuByStoreId(store.id)) ??
    (await createMenu(store.id, store.name));

  return getCategoriesByMenuId(menu.id);
};

export default function Menu() {
  const { selectedStore } = useStore();
  const [categories, setCategories] = useState([]);
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
        setCategories(result);
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
      {!loading && !error && <CategoryList categories={categories} />}
    </div>
  );
}
