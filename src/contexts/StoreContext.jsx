import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { isMenuReady } from "../services/menu.service";
import { getAccessibleStore } from "../services/store.service";
import { useAuth } from "./AuthContext";

const StoreContext = createContext();

// Keeps the active Store across page reloads. Storage can be unavailable
// (private mode, blocked data), so every access is guarded.
const SELECTED_STORE_KEY = "pizzahub.selectedStoreId";

const readSelectedStoreId = () => {
  try {
    return localStorage.getItem(SELECTED_STORE_KEY);
  } catch {
    return null;
  }
};

const writeSelectedStoreId = (storeId) => {
  try {
    if (storeId) localStorage.setItem(SELECTED_STORE_KEY, storeId);
    else localStorage.removeItem(SELECTED_STORE_KEY);
  } catch {
    // Persistence is a convenience: ignore storage failures.
  }
};

export function StoreProvider({ children }) {
  const [accessibleStore, setAccessibleStore] = useState(null);
  const [selectedStore, setSelectedStoreState] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [errorStore, setErrorStore] = useState(null);
  // null until the selected Store's readiness is known.
  const [menuReady, setMenuReady] = useState(null);
  const { authUser, loadingLogin, userProfile } = useAuth();

  const setselectedStore = useCallback((store) => {
    writeSelectedStoreId(store?.id ?? null);
    setSelectedStoreState(store);
  }, []);

  const fetchAccesibleStore = useCallback(async () => {
    setErrorStore(null);
    setLoadingStore(true);

    try {
      const store = await getAccessibleStore(authUser.uid);
      setLoadingStore(false);
      setAccessibleStore(store);
      // Restore the Store chosen before a reload, if it is still accessible.
      if (readSelectedStoreId() === store.id) setSelectedStoreState(store);
      console.log(">>>Store: ", store);
    } catch (error) {
      console.log("Error fetch store-> ", error);
      setAccessibleStore(null);
      setErrorStore(error);
      setLoadingStore(false);
    }
  }, [authUser]);

  // On failure the Menu counts as not ready, which keeps the user on /menu.
  const refreshMenuReady = useCallback(async () => {
    if (!selectedStore) return;

    try {
      setMenuReady(await isMenuReady(selectedStore.id));
    } catch (error) {
      console.log("Error checking menu readiness -> ", error);
      setMenuReady(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (!selectedStore) {
      setMenuReady(null);
      return;
    }

    setMenuReady(null);
    refreshMenuReady();
  }, [selectedStore, refreshMenuReady]);

  useEffect(() => {
    if (loadingLogin === true) return;

    if (!authUser) {
      setAccessibleStore(null);
      setselectedStore(null);
      setErrorStore(null);
      setLoadingStore(true);
      return;
    }

    if (!userProfile) return;

    fetchAccesibleStore();
  }, [
    authUser,
    loadingLogin,
    userProfile,
    fetchAccesibleStore,
    setselectedStore,
  ]);

  return (
    <StoreContext.Provider
      value={{
        accessibleStore,
        loadingStore,
        errorStore,
        fetchAccesibleStore,
        selectedStore,
        setselectedStore,
        menuReady,
        refreshMenuReady,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
