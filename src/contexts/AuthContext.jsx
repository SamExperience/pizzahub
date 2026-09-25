import { createContext, useContext, useEffect, useState } from "react";
import { register, login, loginWithGoogle } from "../services/auth.service";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, (user) => {
      console.log("USER ON CHANGE>>> ", user);
      setUser(user);
      setLoading(false);
    });

    return authSubscription;
  }, []);

  return (
    <AuthContext.Provider
      value={{ register, login, loginWithGoogle, user, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
