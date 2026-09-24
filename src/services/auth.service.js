import { createUserWithEmailAndPassword } from "firebase/auth";

import { auth } from "./firebase";

export async function register(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}
