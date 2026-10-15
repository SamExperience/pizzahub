import { createContext, useContext, useEffect, useState } from "react";
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

  const logout = async () => {
    await signout();
  };

  async function refreshProfile() {
    const uid = authUser.uid;
    const userDB = await getUserDB(uid);
    if (isCurrentUser(uid)) setUserProfile(userDB);
  }

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, async (authUser) => {
      setAuthUser(authUser);

      if (!authUser) {
        setUserProfile(null);
        setloadingLogin(false);
        return;
      }

      // Keep the app in its loading state until the profile is known, so
      // routes never redirect to /onboarding for an existing user.
      setloadingLogin(true);

      let dataUser = null;
      try {
        dataUser = await getUserDB(authUser.uid);
      } catch (error) {
        logError("Error loading the user profile -> ", error);
      }

      if (!isCurrentUser(authUser.uid)) return;

      setUserProfile(dataUser ?? null);
      setloadingLogin(false);
    });

    return authSubscription;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        register,
        login,
        loginWithGoogle,
        authUser,
        userProfile,
        loadingLogin,
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
