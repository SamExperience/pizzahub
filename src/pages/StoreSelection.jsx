import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import LoadingState from "../components/LoadingState";
import { alert, button, emptyBox, muted, pageTitle } from "../utils/styles";

/**
 * Store selection page: shows the accessible Store and makes it active, then
 * goes to the Tableau or, when the Menu is not ready, to the Menu. Kept as
 * a step even with one Store per Company, ready for more Stores later.
 * @returns {JSX.Element}
 * @example
 * { path: "/stores", element: <StoreSelection /> }
 */
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className={pageTitle}>Store Selection</h1>
        <p className={muted}>Choose the store you want to work on.</p>
      </header>

      {errorStore && (
        <div
          role="alert"
          className={`${alert} flex flex-col items-start gap-3 sm:max-w-md`}
        >
          <p>Unable to load your store.</p>
          <button type="button" className={button} onClick={fetchAccesibleStore}>
            Try again
          </button>
        </div>
      )}

      {loadingStore && <LoadingState />}

      {!loadingStore && !errorStore && !accessibleStore && (
        <p className={emptyBox}>No store found for your account.</p>
      )}

      {accessibleStore && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StoreCard
            store={accessibleStore}
            onSelect={(store) => handleStoreId(store)}
          />
        </div>
      )}
    </div>
  );
}
