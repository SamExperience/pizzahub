import { Navigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import Login from "../pages/Login";
import LoadingState from "../components/LoadingState";

export default function PublicRoute() {
  const { authUser, userProfile, loadingLogin } = useAuth();

  if (loadingLogin) return <LoadingState fullPage />;

  if (!authUser) return <Login />;

  if (!userProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/stores" replace />;
}
