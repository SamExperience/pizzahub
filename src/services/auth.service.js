import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth } from "./firebase";

export async function register(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();

  return await signInWithPopup(auth, provider);
}
export async function signout() {
  return await signOut(auth);
}
// An unknown email resolves like a known one, so the caller cannot reveal
// which accounts exist (the emulator and projects without email enumeration
// protection report auth/user-not-found).
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}
