import { useStore } from "../contexts/StoreContext";

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
      <div>
        <span>{accessibleStore?.name}</span>
      </div>
    </div>
  );
}
