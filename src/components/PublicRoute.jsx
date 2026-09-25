import { Navigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import Login from "../pages/Login";

export default function PublicRoute() {
  const { authUser, userProfile, loadingLogin } = useAuth();

  if (loadingLogin) return null;

  if (!authUser) return <Login />;

  if (!userProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/stores" replace />;
}
