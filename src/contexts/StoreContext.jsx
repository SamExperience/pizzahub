import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getAccessibleStore } from "../services/store.service";
import { useAuth } from "./AuthContext";

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const [accessibleStore, setAccessibleStore] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [errorStore, setErrorStore] = useState(null);
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

  useEffect(() => {
    if (loadingLogin === true) return;
    if (!authUser) {
      setAccessibleStore(null);
      setErrorStore(null);
      setLoadingStore(true);
      return;
    }
    if (!userProfile) return;

    fetchAccesibleStore();
  }, [authUser, loadingLogin, userProfile, fetchAccesibleStore]);

  return (
    <StoreContext.Provider
      value={{ accessibleStore, loadingStore, errorStore, fetchAccesibleStore }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
