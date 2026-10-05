import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";
import { useEffect } from "react";

export default function StoreSelection() {
  const {
    accessibleStore,
    loadingStore,
    errorStore,
    fetchAccesibleStore,
    selectedStore,
    setselectedStore,
  } = useStore();

  useEffect(() => {
    console.log(">>>>>", selectedStore);
  }, [selectedStore]);

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
