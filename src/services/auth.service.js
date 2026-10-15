import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth } from "./firebase";

/**
 * Creates an email/password account. Wrapped here so components never call
 * Firebase Auth directly; the profile is created later by onboarding.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 * @example
 * await register("owner@pizzeria.ch", "secret123");
 */
export async function register(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}
/**
 * Signs in with email and password; AuthContext reacts to the new user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 * @example
 * await login("owner@pizzeria.ch", "secret123");
 */
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}
/**
 * Signs in with a Google popup. A new Google user has no profile yet and is
 * sent to onboarding like an email sign-up.
 * @returns {Promise<UserCredential>}
 * @example
 * await loginWithGoogle();
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();

  return await signInWithPopup(auth, provider);
}
/**
 * Signs out the current user; AuthContext and StoreContext clear their state.
 * @returns {Promise<void>}
 * @example
 * await signout();
 */
export async function signout() {
  return await signOut(auth);
}
/**
 * Sends the Firebase password reset email. An unknown email resolves like a
 * known one, so the caller cannot reveal which accounts exist (the emulator
 * and projects without email enumeration protection report
 * auth/user-not-found).
 * @param {string} email
 * @returns {Promise<void>}
 * @example
 * await resetPassword("owner@pizzeria.ch");
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}
