import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function StoreSelection() {
  const navigate = useNavigate();

  const {
    accessibleStore,
    loadingStore,
    errorStore,
    fetchAccesibleStore,
    menuReady,
    setselectedStore,
  } = useStore();

  useEffect(() => {
    if (menuReady === null) return;

    navigate(menuReady ? "/tableau" : "/menu");
  }, [menuReady, navigate]);

  const handleStoreId = (store) => {
    setselectedStore(store);
  };

  return (
    <div>
      <h1>Store Selection</h1>
      {errorStore && (
        <p>
          Unable to load your store.
          <br />
          <button type="button" onClick={fetchAccesibleStore}>
            Try again
          </button>
        </p>
      )}
      {loadingStore ? "Loading ..." : ""}
      {accessibleStore && (
        <StoreCard
          store={accessibleStore}
          onSelect={(store) => handleStoreId(store)}
        />
      )}
    </div>
  );
}
