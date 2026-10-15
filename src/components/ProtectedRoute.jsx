import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import LogoutButton from "./LogoutButton";

export default function ProtectedRoute() {
  const { authUser, userProfile, loadingLogin, profileError, retryProfile } =
    useAuth();
  const {
    accessibleStore,
    loadingStore,
    selectedStore,
    menuReady,
    menuReadyError,
    refreshMenuReady,
  } = useStore();
  const location = useLocation();

  if (loadingLogin) return <LoadingState fullPage />;

  if (!authUser) {
    return <Navigate to="/" replace />;
  }

  // An unreadable profile is not a missing one: never send the user to /onboarding.
  if (profileError) {
    return (
      <ErrorState
        fullPage
        message="Unable to load your profile."
        onRetry={retryProfile}
      >
        <LogoutButton />
      </ErrorState>
    );
  }

  if (!userProfile) {
    if (location.pathname === "/onboarding") return <Outlet />;
    return <Navigate to="/onboarding" replace />;
  }
  if (loadingStore) return <LoadingState fullPage />;
  if (location.pathname === "/onboarding") {
    return <Navigate to="/stores" replace />;
  }

  if (!accessibleStore) {
    if (location.pathname === "/stores") return <Outlet />;
    return <Navigate to="/stores" replace />;
  }

  if (!selectedStore) {
    if (location.pathname === "/stores") return <Outlet />;
    return <Navigate to="/stores" replace />;
  }

  // Until the Menu is ready, only /menu is reachable.
  if (menuReady === null && menuReadyError) {
    return (
      <ErrorState
        fullPage
        message="Unable to check your menu."
        onRetry={refreshMenuReady}
      />
    );
  }
  if (menuReady === null) return <LoadingState fullPage />;
  if (!menuReady && location.pathname !== "/menu") {
    return <Navigate to="/menu" replace />;
  }

  return <Outlet />;
}
