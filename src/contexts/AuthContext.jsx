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
  const [loadingLogin, setloadingLogin] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState(null);

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setUserProfile(null);
      } else {
        const dataUser = await getUserDB(authUser.uid);

        if (!dataUser) {
          console.log(
            ">>>User Auth OK but NOT found on DB, go to onboarding page",
          );
          setUserProfile(null);
        } else {
          console.log(">>>User auth OK and OK IN DB, go to stores page");
          setUserProfile(dataUser);
        }
      }

      console.log("USER ON CHANGE>>> ", authUser);
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
        addUserDB,
        selectedStoreId,
        setSelectedStoreId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
