import { Navigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import Login from "../pages/Login";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import LogoutButton from "../components/LogoutButton";

/**
 * Entry route "/": shows Login to signed-out users and sends signed-in users
 * on (onboarding when they have no profile, otherwise store selection), so
 * the login page is never shown to a signed-in user.
 * @returns {JSX.Element}
 * @example
 * { path: "/", element: <PublicRoute /> }
 */
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
