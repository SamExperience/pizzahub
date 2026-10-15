import { Navigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import Login from "../pages/Login";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import LogoutButton from "../components/LogoutButton";

export default function PublicRoute() {
  const { authUser, userProfile, loadingLogin, profileError, retryProfile } =
    useAuth();

  if (loadingLogin) return <LoadingState fullPage />;

  if (!authUser) return <Login />;

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
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/stores" replace />;
}
