import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isMenuReady } from "../services/menu.service";
import { getAccessibleStore } from "../services/store.service";
import { logError } from "../utils/logger";
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
  const [selectedStoreState, setSelectedStoreState] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [errorStore, setErrorStore] = useState(null);
  // null until the selected Store's readiness is known.
  const [menuReady, setMenuReady] = useState(null);
  // Set when the readiness check fails, so routes can show an error instead
  // of treating the Menu as not ready.
  const [menuReadyError, setMenuReadyError] = useState(null);
  const { authUser, loadingLogin, userProfile } = useAuth();
  // Each Store request gets an id: a response is applied only if no newer
  // request (or logout) happened meanwhile, e.g. after an account switch.
  const storeRequestRef = useRef(0);
  const selectedStoreIdRef = useRef(null);

  // The selection is valid only while it is the accessible Store.
  const selectedStore =
    selectedStoreState &&
    accessibleStore &&
    selectedStoreState.id === accessibleStore.id
      ? selectedStoreState
      : null;

  const setselectedStore = useCallback(
    (store) => {
      if (store && store.id !== accessibleStore?.id) return;
      writeSelectedStoreId(store?.id ?? null);
      setSelectedStoreState(store ? accessibleStore : null);
    },
    [accessibleStore],
  );

  const fetchAccesibleStore = useCallback(async () => {
    const requestId = ++storeRequestRef.current;
    setErrorStore(null);
    setLoadingStore(true);

    try {
      const store = await getAccessibleStore(authUser.uid);
      if (requestId !== storeRequestRef.current) return;

      // Restore the Store chosen before a reload, if it is still accessible;
      // any other selection belongs to a Store the user cannot access.
      const savedStoreId = readSelectedStoreId();
      if (savedStoreId && savedStoreId !== store.id) writeSelectedStoreId(null);
      setSelectedStoreState((current) =>
        current?.id === store.id || savedStoreId === store.id ? store : null,
      );
      setAccessibleStore(store);
      setLoadingStore(false);
    } catch (error) {
      if (requestId !== storeRequestRef.current) return;

      logError("Error fetch store-> ", error);
      setAccessibleStore(null);
      setErrorStore(error);
      setLoadingStore(false);
    }
  }, [authUser]);

  // On failure menuReady stays null (unknown) and menuReadyError is set.
  const refreshMenuReady = useCallback(async () => {
    if (!selectedStore) return;
    const storeId = selectedStore.id;
    setMenuReadyError(null);

    try {
      const ready = await isMenuReady(storeId);
      if (selectedStoreIdRef.current === storeId) setMenuReady(ready);
    } catch (error) {
      logError("Error checking menu readiness -> ", error);
      if (selectedStoreIdRef.current === storeId) setMenuReadyError(error);
    }
  }, [selectedStore]);

  useEffect(() => {
    selectedStoreIdRef.current = selectedStore?.id ?? null;
    setMenuReady(null);
    setMenuReadyError(null);
    if (selectedStore) refreshMenuReady();
  }, [selectedStore, refreshMenuReady]);

  useEffect(() => {
    if (loadingLogin === true) return;

    if (!authUser) {
      // Invalidate any Store request still running for the previous user.
      storeRequestRef.current += 1;
      writeSelectedStoreId(null);
      setAccessibleStore(null);
      setSelectedStoreState(null);
      setErrorStore(null);
      setLoadingStore(true);
      return;
    }

    if (!userProfile) return;

    fetchAccesibleStore();
  }, [authUser, loadingLogin, userProfile, fetchAccesibleStore]);

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
        menuReadyError,
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
