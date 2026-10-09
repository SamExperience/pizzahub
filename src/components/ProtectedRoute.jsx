import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

export default function ProtectedRoute() {
  const { authUser, userProfile, loadingLogin } = useAuth();
  const { accessibleStore, loadingStore, selectedStore, menuReady } =
    useStore();
  const location = useLocation();

  if (loadingLogin) return null;

  if (!authUser) {
    return <Navigate to="/" replace />;
  }

  if (!userProfile) {
    if (location.pathname === "/onboarding") return <Outlet />;
    return <Navigate to="/onboarding" replace />;
  }
  if (loadingStore) return null;
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
  if (menuReady === null) return null;
  if (!menuReady && location.pathname !== "/menu") {
    return <Navigate to="/menu" replace />;
  }

  return <Outlet />;
}
