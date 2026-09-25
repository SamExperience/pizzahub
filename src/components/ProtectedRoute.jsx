import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute() {
  const { authUser, userProfile, loadingLogin, selectedStoreId } = useAuth();
  const location = useLocation();

  if (loadingLogin) return null;

  if (!authUser) {
    return <Navigate to="/" replace />;
  }

  if (!userProfile) {
    if (location.pathname === "/onboarding") return <Outlet />;
    return <Navigate to="/onboarding" replace />;
  }

  if (!selectedStoreId) {
    if (location.pathname === "/stores") return <Outlet />;
    return <Navigate to="/stores" replace />;
  }

  return <Outlet />;
}
