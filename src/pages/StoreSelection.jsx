import { useStore } from "../contexts/StoreContext";
import StoreCard from "../components/StoreCard";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { alert, button, muted, pageTitle } from "../utils/styles";

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

      {loadingStore && (
        <p className={`${muted} flex items-center gap-2`}>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Loading ...</span>
        </p>
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
