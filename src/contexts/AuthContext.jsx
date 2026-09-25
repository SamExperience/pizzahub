import { createContext, useContext, useEffect, useState } from "react";
import { register, login, loginWithGoogle } from "../services/auth.service";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
//db
import { getUserDB, addUserDB } from "../services/user.service";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authUser, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setUserProfile(null);
      } else {
        const dataUser = await getUserDB(authUser.uid);

        if (!dataUser) {
          console.log(
            ">>>User Auth but NOT found on DB, go to onboarding page",
          );
          setUserProfile(null);
        } else {
          console.log(">>>User auth and IN DB, go to stores page");
          setUserProfile(dataUser);
        }
      }

      console.log("USER ON CHANGE>>> ", authUser);
      setLoading(false);
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
        loading,
        addUserDB,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
