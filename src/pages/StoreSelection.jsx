import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";

export default function StoreSelection() {
  const { accessibleStore, loadingStore, errorStore, fetchAccesibleStore } =
    useStore();

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
          onSelect={(store) => console.log(">>>Selected store: ", store)}
        />
      )}
    </div>
  );
}
