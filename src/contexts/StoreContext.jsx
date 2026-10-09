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

export function StoreProvider({ children }) {
  const [accessibleStore, setAccessibleStore] = useState(null);
  const [selectedStore, setselectedStore] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [errorStore, setErrorStore] = useState(null);
  // null until the selected Store's readiness is known.
  const [menuReady, setMenuReady] = useState(null);
  const { authUser, loadingLogin, userProfile } = useAuth();

  const fetchAccesibleStore = useCallback(async () => {
    setErrorStore(null);
    setLoadingStore(true);

    try {
      const store = await getAccessibleStore(authUser.uid);
      setLoadingStore(false);
      setAccessibleStore(store);
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
