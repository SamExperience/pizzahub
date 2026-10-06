import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";
import { useEffect } from "react";
import { getMenuByStoreId } from "../services/menu.service";
import { useNavigate } from "react-router";

export default function StoreSelection() {
  const navigate = useNavigate();

  const {
    accessibleStore,
    loadingStore,
    errorStore,
    fetchAccesibleStore,
    selectedStore,
    setselectedStore,
  } = useStore();

  useEffect(() => {
    console.log(">>>>>Store selected", selectedStore);

    async function checkMenu() {
      const menu = await getMenuByStoreId(selectedStore.id);

      if (menu) {
        navigate("/tableau");
      } else {
        navigate("/menu");
      }
    }
    if (selectedStore) checkMenu();
  }, [selectedStore, navigate]);

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
