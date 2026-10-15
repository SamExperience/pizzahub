import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  register,
  login,
  loginWithGoogle,
  signout,
} from "../services/auth.service";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { logError } from "../utils/logger";

//db
import { getUserDB } from "../services/user.service";

const AuthContext = createContext();

// A profile request is stale when another account signed in (or out) while it
// was running: its result must not overwrite the current user's state.
const isCurrentUser = (uid) => auth.currentUser?.uid === uid;

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingLogin, setloadingLogin] = useState(true);
  // Set when the profile of a signed-in user cannot be read: routes show an
  // error instead of treating the user as new (redirect to /onboarding).
  const [profileError, setProfileError] = useState(null);

  const logout = async () => {
    await signout();
  };

  async function refreshProfile() {
    const uid = authUser.uid;
    const userDB = await getUserDB(uid);
    if (isCurrentUser(uid)) setUserProfile(userDB);
  }

  // Keeps the app in its loading state until the profile is known, so routes
  // never redirect to /onboarding for an existing user.
  const loadProfile = useCallback(async (uid) => {
    setloadingLogin(true);
    setProfileError(null);

    let dataUser = null;
    let failure = null;
    try {
      dataUser = await getUserDB(uid);
    } catch (error) {
      logError("Error loading the user profile -> ", error);
      failure = error;
    }

    if (!isCurrentUser(uid)) return;

    setUserProfile(dataUser ?? null);
    setProfileError(failure);
    setloadingLogin(false);
  }, []);

  const retryProfile = useCallback(() => {
    if (authUser) loadProfile(authUser.uid);
  }, [authUser, loadProfile]);

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, async (authUser) => {
      setAuthUser(authUser);

      if (!authUser) {
        setUserProfile(null);
        setProfileError(null);
        setloadingLogin(false);
        return;
      }

      await loadProfile(authUser.uid);
    });

    return authSubscription;
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        register,
        login,
        loginWithGoogle,
        authUser,
        userProfile,
        loadingLogin,
        profileError,
        retryProfile,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
