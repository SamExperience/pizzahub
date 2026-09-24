import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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
